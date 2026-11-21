import { describe, expect, it, vi } from 'vitest';
import { saveOptions, SIN_VALIDAR_NOTICE, finNotice, finButtons } from '../components/FinDePartida';
import { parseProof, proofArgs } from '../contract/leaderboard';
import { topScores } from '../contract/ranking';
import appSource from '../app.ts?raw';
import configSource from '../contract/config.ts?raw';
import type { InputEvent } from '../engine/game';
import { createAnticheat, MAX_INPUTS_PER_BEAT, PREPARED_MAX_MS, type ProofState, type Snapshot } from './anticheat';

const GAME = `0x${'ab'.repeat(32)}`;
const GAME2 = `0x${'ef'.repeat(32)}`;
const SIG = `0x${'cd'.repeat(65)}`;
const PLAYER = `0x${'11'.repeat(20)}` as const;
const SEED = 4242;

/** Avance de prueba: `inputs` es la grabación completa de la partida hasta ahora. */
const snap = (score: number, more: Partial<Snapshot> = {}): Snapshot => ({
  score,
  round: 1,
  lives: 5,
  orbsLeft: 146,
  powerLeft: 4,
  tick: score,
  inputs: [],
  ...more,
});

/** Worker de mentira: guarda lo que recibe y responde según `reply`. */
function fakeWorker(reply: (path: string, body: Record<string, unknown>) => { status?: number; body?: unknown } | 'red') {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  const fetch = vi.fn(async (url: string, init?: { body?: string }) => {
    const path = url.replace('https://w.test', '');
    const body = JSON.parse(init?.body ?? '{}') as Record<string, unknown>;
    calls.push({ path, body });
    const r = reply(path, body);
    if (r === 'red') throw new TypeError('Failed to fetch');
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200 });
  });
  return { calls, fetch: fetch as unknown as typeof globalThis.fetch };
}

/** /start responde con la semilla pedida, o con 777 si el cliente no mandó ninguna (partida preparada). */
const startReply = (body: Record<string, unknown>, gameId = GAME) => ({ body: { ok: true, gameId, seed: body.seed ?? 777 } });
const signed = (body: Record<string, unknown>) => ({ body: { ok: true, score: body.score, gameId: GAME, deadline: 1_900_000_000, signature: SIG } });

const okWorker = () =>
  fakeWorker((path, body) => {
    if (path === '/start') return startReply(body);
    if (path === '/beat') return { body: { ok: true } };
    return signed(body);
  });

const settle = () => new Promise((r) => setTimeout(r, 0));
const until = async (ac: { state: ProofState }, kind: ProofState['kind']) => {
  for (let i = 0; i < 50 && ac.state.kind !== kind; i++) await settle();
  return ac.state;
};
const idle = async () => {
  for (let i = 0; i < 20; i++) await settle();
};

describe('anti-trampas: cliente', () => {
  it('start, avance inicial, avances con los pedidos nuevos y fin con la firma del puntaje final', async () => {
    const w = okWorker();
    let t = 0;
    const ac = createAnticheat({ url: 'https://w.test', beatMs: 20_000, timeoutMs: 1000, fetch: w.fetch, now: () => t });
    const inputs: InputEvent[] = [];
    ac.start(SEED, snap(0, { inputs }));
    await idle();
    inputs.push([10, 'arriba', null], [20, 'soltar', null]);
    t = 5_000;
    ac.beat(snap(100, { inputs })); // antes de 20 s: no sale
    ac.beat(snap(120, { lives: 4, inputs }), true); // perdió una vida: sale
    await idle();
    inputs.push([300, 'izquierda', 'arriba']);
    t = 30_000;
    ac.beat(snap(400, { lives: 4, inputs }));
    await idle();
    ac.finish(snap(450, { lives: 0, inputs }), PLAYER);
    const s = await until(ac, 'lista');
    expect(s).toEqual({ kind: 'lista', proof: { score: 450, gameId: GAME, deadline: 1_900_000_000, signature: SIG } });
    expect(w.calls.map((c) => [c.path, c.body.seq, c.body.score, c.body.inputs])).toEqual([
      ['/start', undefined, undefined, undefined],
      ['/beat', 1, 0, []],
      ['/beat', 2, 120, [[10, 'arriba', null], [20, 'soltar', null]]],
      ['/beat', 3, 400, [[300, 'izquierda', 'arriba']]],
      ['/finish', 4, 450, []],
    ]);
    expect(w.calls[0]!.body).toEqual({ seed: SEED });
    expect(w.calls[2]!.body).toMatchObject({ gameId: GAME, round: 1, lives: 4, orbsLeft: 146, powerLeft: 4, tick: 120 });
    expect(w.calls[4]!.body.player).toBe(PLAYER);
  });

  it('usa la partida preparada (semilla del Worker) y no la de más de 8 minutos', async () => {
    const w = fakeWorker((path, body) => {
      if (path === '/start') return startReply(body, body.seed === undefined ? GAME2 : GAME);
      return { body: { ok: true } };
    });
    let t = 0;
    const ac = createAnticheat({ url: 'https://w.test', beatMs: 0, timeoutMs: 1000, fetch: w.fetch, now: () => t });
    expect(ac.preparedSeed()).toBeNull(); // la pide en segundo plano
    expect(ac.preparedSeed()).toBeNull(); // una a la vez
    await idle();
    expect(ac.preparedSeed()).toBe(777);
    ac.start(777, snap(0));
    await idle();
    expect(w.calls.map((c) => [c.path, c.body.gameId ?? null])).toEqual([
      ['/start', null],
      ['/beat', GAME2],
    ]);
    expect(w.calls[0]!.body).toEqual({});

    // Otra preparada que vence: ya no se usa y la semilla del juego se manda al Worker.
    w.calls.length = 0;
    ac.preparedSeed();
    await idle();
    t = PREPARED_MAX_MS + 1;
    expect(ac.preparedSeed()).toBeNull();
    ac.start(777, snap(0));
    await idle();
    expect(w.calls.filter((c) => c.path === '/start').map((c) => c.body)).toContainEqual({ seed: 777 });
    expect(w.calls.find((c) => c.path === '/beat')!.body.gameId).toBe(GAME);
  });

  it('si falla preparar, espera antes de volver a intentar', async () => {
    const w = fakeWorker(() => 'red');
    let t = 0;
    const ac = createAnticheat({ url: 'https://w.test', beatMs: 0, timeoutMs: 1000, fetch: w.fetch, now: () => t });
    ac.preparedSeed();
    await idle();
    ac.preparedSeed();
    expect(w.calls).toHaveLength(1);
    t = 20_000;
    ac.preparedSeed();
    expect(w.calls).toHaveLength(2);
  });

  it('un fallo de red reenvía el mismo avance igual y junta lo nuevo en el siguiente', async () => {
    let down = false;
    const w = fakeWorker((path, body) => {
      if (path === '/start') return startReply(body);
      if (down) return 'red';
      return path === '/beat' ? { body: { ok: true } } : signed(body);
    });
    const ac = createAnticheat({ url: 'https://w.test', beatMs: 0, timeoutMs: 1000, fetch: w.fetch });
    const inputs: InputEvent[] = [];
    ac.start(SEED, snap(0, { inputs }));
    await idle();
    down = true;
    inputs.push([5, 'abajo', null]);
    ac.beat(snap(50, { inputs }));
    await idle();
    inputs.push([60, 'derecha', null]);
    ac.beat(snap(80, { inputs }));
    await idle();
    inputs.push([90, 'soltar', null]);
    ac.beat(snap(90, { inputs }));
    down = false;
    ac.beat(snap(100, { inputs }));
    await idle();
    const beats = w.calls.filter((c) => c.path === '/beat').map((c) => [c.body.seq, c.body.score, c.body.inputs]);
    expect(beats).toEqual([
      [1, 0, []],
      [2, 50, [[5, 'abajo', null]]],
      [2, 50, [[5, 'abajo', null]]], // el mismo, otra vez
      [2, 50, [[5, 'abajo', null]]],
      [3, 100, [[60, 'derecha', null], [90, 'soltar', null]]], // lo que se juntó
    ]);
    ac.finish(snap(120, { lives: 0, inputs }), PLAYER);
    expect((await until(ac, 'lista')).kind).toBe('lista');
  });

  it('parte la grabación en avances de MAX_INPUTS_PER_BEAT pedidos', async () => {
    const w = okWorker();
    const ac = createAnticheat({ url: 'https://w.test', beatMs: 0, timeoutMs: 1000, fetch: w.fetch });
    const inputs: InputEvent[] = Array.from({ length: MAX_INPUTS_PER_BEAT * 2 + 3 }, (_, i) => [i, 'arriba', null]);
    ac.start(SEED, snap(0));
    ac.finish(snap(9000, { lives: 0, inputs }), PLAYER);
    await until(ac, 'lista');
    const sent = w.calls.filter((c) => c.path !== '/start').map((c) => [c.path, c.body.seq, (c.body.inputs as unknown[]).length]);
    expect(sent).toEqual([
      ['/beat', 1, 0],
      ['/beat', 2, MAX_INPUTS_PER_BEAT],
      ['/beat', 3, MAX_INPUTS_PER_BEAT],
      ['/finish', 4, 3],
    ]);
  });

  it('si el Worker rechaza un avance, la partida queda sin validar', async () => {
    const w = fakeWorker((path, body) => (path === '/start' ? startReply(body) : { status: 422, body: { ok: false, error: 'subió de más' } }));
    const ac = createAnticheat({ url: 'https://w.test', beatMs: 0, timeoutMs: 1000, fetch: w.fetch });
    ac.start(SEED, snap(0));
    ac.beat(snap(999_999), true);
    expect(await until(ac, 'rechazada')).toEqual({ kind: 'rechazada', reason: 'subió de más' });
    ac.finish(snap(999_999, { lives: 0 }), PLAYER);
    await settle();
    expect(w.calls.some((c) => c.path === '/finish')).toBe(false);
  });

  it('sin cuenta o sin red al terminar: «sin-conexion» y se reintenta el mismo fin con la cuenta', async () => {
    let down = true;
    const w = fakeWorker((path, body) => {
      if (path === '/start') return startReply(body);
      if (path === '/finish' && down) return 'red';
      return path === '/beat' ? { body: { ok: true } } : signed(body);
    });
    const ac = createAnticheat({ url: 'https://w.test', beatMs: 0, timeoutMs: 1000, fetch: w.fetch });
    ac.start(SEED, snap(0));
    ac.finish(snap(300, { lives: 0, inputs: [[3, 'arriba', null]] }), null);
    expect(await until(ac, 'sin-conexion')).toEqual({ kind: 'sin-conexion' });
    ac.retryFinish(PLAYER);
    expect(await until(ac, 'sin-conexion')).toEqual({ kind: 'sin-conexion' });
    down = false;
    ac.retryFinish(PLAYER);
    expect((await until(ac, 'lista')).kind).toBe('lista');
    const finishes = w.calls.filter((c) => c.path === '/finish').map((c) => c.body);
    expect(finishes).toHaveLength(2);
    expect(finishes[1]).toEqual(finishes[0]);
    expect(finishes[0]).toMatchObject({ seq: 2, score: 300, inputs: [[3, 'arriba', null]], player: PLAYER });
  });

  it('una partida nueva olvida lo pendiente de la anterior', async () => {
    const w = okWorker();
    const ac = createAnticheat({ url: 'https://w.test', beatMs: 0, timeoutMs: 1000, fetch: w.fetch });
    ac.start(SEED, snap(0));
    ac.finish(snap(300, { lives: 0 }), PLAYER);
    ac.start(SEED + 1, snap(0));
    expect(ac.state.kind).toBe('jugando');
    await idle();
    expect(ac.state.kind).toBe('jugando');
    expect(w.calls.some((c) => c.path === '/finish')).toBe(false);
  });
});

describe('anti-trampas: prueba del puntaje', () => {
  it('parseProof exige el mismo puntaje, gameId de 32 bytes, firma de 65 y vencimiento', () => {
    const good = { ok: true, score: 10, gameId: GAME, deadline: 5, signature: SIG };
    expect(parseProof(good, 10)).toEqual({ score: 10, gameId: GAME, deadline: 5, signature: SIG });
    expect(parseProof(good, 11)).toBeNull();
    expect(parseProof({ ...good, gameId: '0x12' }, 10)).toBeNull();
    expect(parseProof({ ...good, signature: '0x12' }, 10)).toBeNull();
    expect(parseProof({ ...good, deadline: 0 }, 10)).toBeNull();
    expect(parseProof({ ...good, ok: false }, 10)).toBeNull();
    expect(proofArgs({ score: 10, gameId: GAME as `0x${string}`, deadline: 5, signature: SIG as `0x${string}` })).toEqual([10n, GAME, 5n, SIG]);
  });
});

describe('anti-trampas: fin de partida', () => {
  const base = { host: 'listo' as const, connected: true, score: 900, best: 100n, busy: false, started: true };
  it('solo ofrece guardar con la firma lista', () => {
    expect(saveOptions({ ...base, proof: 'lista' })).toEqual({ option: 'guardar', disabled: false });
    expect(saveOptions({ ...base, proof: 'validando' })).toEqual({ option: 'validando', disabled: true });
    expect(saveOptions({ ...base, proof: 'sin-conexion' })).toEqual({ option: 'reintentar', disabled: false });
    expect(saveOptions({ ...base, proof: 'rechazada' })).toEqual({ option: 'sin-validar', disabled: false });
    expect(finNotice('sin-validar', null)).toBe(SIN_VALIDAR_NOTICE);
    expect(finButtons('validando')).toContain('guardar');
    expect(finButtons('sin-validar')).not.toContain('guardar');
    // Sin cuenta sigue pidiendo conectar; si no supera el récord, no importa la firma.
    expect(saveOptions({ ...base, connected: false, best: null, proof: 'sin-conexion' }).option).toBe('conectar');
    expect(saveOptions({ ...base, score: 50, proof: 'lista' }).option).toBe('no-supera');
  });

  it('los descalificados (puntaje 0) no salen en el ranking', () => {
    expect(topScores([{ score: 0n }, { score: 5n }, { score: 0n }])).toEqual([{ score: 5n }]);
  });

  it('app.ts arma la partida con el Worker (semilla preparada y grabación) y el Worker vive en config.ts', () => {
    expect(appSource).toMatch(/if \(\(state\.phase === 'titulo' \|\| state\.phase === 'fin'\) && inHost\) state\.nextSeed = anticheat\.preparedSeed\(\);/);
    expect(appSource).toMatch(/if \(state\.inputs !== acInputs\) \{\s*\n\s*acInputs = state\.inputs;\s*\n\s*if \(inHost\) anticheat\.start\(state\.startSeed, snapshot\(\)\);/);
    expect(appSource).toMatch(/orbsLeft: state\.orbs\.size,\s*\n\s*powerLeft: state\.power\.size,\s*\n\s*tick: state\.tick,\s*\n\s*inputs: state\.inputs,/);
    expect(appSource).toMatch(/if \(was !== 'fin'\) anticheat\.finish\(snapshot\(\), hub\.getState\(\)\.account\?\.h160 \?\? null\);/);
    expect(appSource).toMatch(/if \(s\.account\) anticheat\.retryFinish\(s\.account\.h160\);/);
    expect(configSource).toMatch(/export const ANTICHEAT_URL = 'https:\/\/polkaman-anticheat\.brandonfilth6\.workers\.dev';/);
  });
});
