import { describe, expect, it, vi } from 'vitest';
import { saveOptions, SIN_VALIDAR_NOTICE, finNotice, finButtons } from '../components/FinDePartida';
import { parseProof, proofArgs } from '../contract/leaderboard';
import { topScores } from '../contract/ranking';
import appSource from '../app.ts?raw';
import configSource from '../contract/config.ts?raw';
import { createAnticheat, type ProofState } from './anticheat';

const GAME = `0x${'ab'.repeat(32)}`;
const SIG = `0x${'cd'.repeat(65)}`;
const PLAYER = `0x${'11'.repeat(20)}` as const;

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

const okWorker = () =>
  fakeWorker((path, body) => {
    if (path === '/start') return { body: { ok: true, gameId: GAME } };
    if (path === '/beat') return { body: { ok: true } };
    return { body: { ok: true, score: body.score, gameId: GAME, deadline: 1_900_000_000, signature: SIG } };
  });

const settle = () => new Promise((r) => setTimeout(r, 0));
const until = async (ac: { state: ProofState }, kind: ProofState['kind']) => {
  for (let i = 0; i < 50 && ac.state.kind !== kind; i++) await settle();
  return ac.state;
};

describe('anti-trampas: cliente', () => {
  it('start, avances en orden y fin con la firma del puntaje final', async () => {
    const w = okWorker();
    let t = 0;
    const ac = createAnticheat({ url: 'https://w.test', beatMs: 20_000, timeoutMs: 1000, fetch: w.fetch, now: () => t });
    ac.start();
    t = 5_000;
    ac.beat({ score: 100, round: 1, lives: 5 }); // antes de 20 s: no sale
    ac.beat({ score: 120, round: 1, lives: 4 }, true); // perdió una vida: sale
    t = 30_000;
    ac.beat({ score: 400, round: 1, lives: 4 });
    ac.finish({ score: 450, round: 1, lives: 0 }, PLAYER);
    const s = await until(ac, 'lista');
    expect(s).toEqual({ kind: 'lista', proof: { score: 450, gameId: GAME, deadline: 1_900_000_000, signature: SIG } });
    expect(w.calls.map((c) => [c.path, c.body.seq, c.body.score])).toEqual([
      ['/start', undefined, undefined],
      ['/beat', 1, 120],
      ['/beat', 2, 400],
      ['/finish', 3, 450],
    ]);
    expect(w.calls[3]!.body.player).toBe(PLAYER);
  });

  it('si el Worker rechaza un avance, la partida queda sin validar', async () => {
    const w = fakeWorker((path) => (path === '/start' ? { body: { ok: true, gameId: GAME } } : { status: 422, body: { ok: false, error: 'subió de más' } }));
    const ac = createAnticheat({ url: 'https://w.test', beatMs: 0, timeoutMs: 1000, fetch: w.fetch });
    ac.start();
    ac.beat({ score: 999_999, round: 1, lives: 5 }, true);
    expect(await until(ac, 'rechazada')).toEqual({ kind: 'rechazada', reason: 'subió de más' });
    ac.finish({ score: 999_999, round: 1, lives: 0 }, PLAYER);
    await settle();
    expect(w.calls.some((c) => c.path === '/finish')).toBe(false);
  });

  it('sin cuenta o sin red al terminar: «sin-conexion» y se puede reintentar con la cuenta', async () => {
    let down = true;
    const w = fakeWorker((path, body) => {
      if (path === '/start') return { body: { ok: true, gameId: GAME } };
      if (path === '/finish' && down) return 'red';
      return { body: { ok: true, score: body.score, gameId: GAME, deadline: 1_900_000_000, signature: SIG } };
    });
    const ac = createAnticheat({ url: 'https://w.test', beatMs: 0, timeoutMs: 1000, fetch: w.fetch });
    ac.start();
    ac.finish({ score: 300, round: 1, lives: 0 }, null);
    expect(await until(ac, 'sin-conexion')).toEqual({ kind: 'sin-conexion' });
    ac.retryFinish(PLAYER);
    expect(await until(ac, 'sin-conexion')).toEqual({ kind: 'sin-conexion' });
    down = false;
    ac.retryFinish(PLAYER);
    expect((await until(ac, 'lista')).kind).toBe('lista');
  });

  it('una partida nueva olvida lo pendiente de la anterior', async () => {
    const w = okWorker();
    const ac = createAnticheat({ url: 'https://w.test', beatMs: 0, timeoutMs: 1000, fetch: w.fetch });
    ac.start();
    ac.finish({ score: 300, round: 1, lives: 0 }, PLAYER);
    ac.start();
    expect(ac.state.kind).toBe('jugando');
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

  it('app.ts arma la partida con el Worker y el Worker vive en config.ts', () => {
    expect(appSource).toMatch(/if \(was === 'titulo' && state\.phase !== 'titulo' && hub\.getState\(\)\.host !== 'fuera'\) \{\s*\n\s*anticheat\.start\(\);/);
    expect(appSource).toMatch(/if \(was !== 'fin'\) anticheat\.finish\(snapshot\(\), hub\.getState\(\)\.account\?\.h160 \?\? null\);/);
    expect(appSource).toMatch(/if \(s\.account\) anticheat\.retryFinish\(s\.account\.h160\);/);
    expect(configSource).toMatch(/export const ANTICHEAT_URL = 'https:\/\/polkaman-anticheat\.brandonfilth6\.workers\.dev';/);
  });
});
