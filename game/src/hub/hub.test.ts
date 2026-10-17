import { describe, expect, it, vi } from 'vitest';
import type { LeaderboardContract } from '../contract/leaderboard';
import { createHub, type HubDeps, type SignerAccount } from './hub';

// Dobles sin red: el contrato vive en memoria, el reloj es instantáneo y el log es un espía.

const ME: SignerAccount = { address: '5FakeSs58Cuenta', h160Address: `0x${'1'.repeat(40)}` };
const OTHER = `0x${'2'.repeat(40)}` as const;

const ok = <T>(value: T) => ({ success: true as const, value });

/** Contrato en memoria compartido por el lector (RPC) y el escritor (Host). */
function makeWorld() {
  const store = { best: 0n, username: '' };
  const reader = {
    bestScore: { query: vi.fn(async (..._a: unknown[]) => ok<unknown>(store.best)) },
    usernameOf: { query: vi.fn(async (..._a: unknown[]) => ok<unknown>(store.username)) },
    playerOf: { query: vi.fn(async (..._a: unknown[]) => ok<unknown>(`0x${'0'.repeat(40)}`)) },
    playerCount: { query: vi.fn(async (..._a: unknown[]) => ok<unknown>(2n)) },
    getScores: { query: vi.fn(async (..._a: unknown[]) => ok<unknown>([[OTHER, ME.h160Address], ['prueba_ok', ''], [1240n, 300n]])) },
    submitScore: { query: vi.fn(async (..._a: unknown[]): Promise<{ success: boolean; value: unknown }> => ok<unknown>(undefined)) },
    setUsername: { query: vi.fn(async (..._a: unknown[]): Promise<{ success: boolean; value: unknown }> => ok<unknown>(undefined)) },
  };
  const tx = vi.fn(async (arg: unknown, _opts?: unknown): Promise<{ ok: true; value: object } | { ok: false; error: unknown }> => {
    store.best = arg as bigint;
    return { ok: true, value: {} };
  });
  const usernameTx = vi.fn(async (name: unknown, _opts?: unknown): Promise<{ ok: true; value: object } | { ok: false; error: unknown }> => {
    store.username = name as string;
    return { ok: true, value: {} };
  });
  const writer = {
    ...reader,
    submitScore: { query: reader.submitScore.query, tx },
    setUsername: { query: reader.setUsername.query, tx: usernameTx },
  };
  return { store, reader, tx, usernameTx, writerContract: writer as unknown as LeaderboardContract };
}

type World = ReturnType<typeof makeWorld>;

/** HubDeps COMPLETO con dobles; `overrides` reemplaza dependencias enteras. */
function fakeDeps(overrides: Partial<HubDeps> = {}): HubDeps & { world: World } {
  const world = makeWorld();
  const deps: HubDeps = {
    isInsideContainer: vi.fn(async () => true),
    getTruApi: vi.fn(async () => ({})),
    getProductContext: vi.fn(async () => ({ productId: 'polka-man.dot' })),
    connectChain: vi.fn(async () => ({ destroy: vi.fn() })),
    createSigner: vi.fn(() => ({
      connect: vi.fn(async () => ({ ok: true })),
      getProductAccount: vi.fn(async () => ({ ok: true as const, value: ME })),
      destroy: vi.fn(),
    })),
    requestAllowance: vi.fn(async () => 'Allocated' as const),
    reader: world.reader as unknown as LeaderboardContract,
    writer: vi.fn(() => world.writerContract),
    readPgas: vi.fn(async () => 0n),
    sleep: vi.fn(async () => undefined),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
  };
  return { ...deps, world };
}

/** Hub con la cuenta conectada; los contadores empiezan en cero después de conectar. */
async function connectedHub(overrides: Partial<HubDeps> = {}) {
  const deps = fakeDeps(overrides);
  const hub = createHub(deps);
  await hub.start();
  const connected = await hub.connect();
  expect(connected.ok).toBe(true);
  vi.mocked(deps.requestAllowance).mockClear();
  vi.mocked(deps.connectChain).mockClear();
  vi.mocked(deps.createSigner).mockClear();
  vi.mocked(deps.log.warn).mockClear();
  return { hub, deps, world: deps.world };
}

describe('hub (sin red, con dobles)', () => {
  it('1. si la simulación revierte con ScoreNotHigher, no pide firma', async () => {
    const { hub, world } = await connectedHub();
    world.reader.submitScore.query.mockResolvedValue({ success: false, value: { error: 'ScoreNotHigher', args: [300n, 200n] } });
    const r = await hub.saveScore(200);
    expect(r).toEqual({ ok: false, message: 'Ese puntaje no supera tu récord (300).' });
    expect(world.reader.submitScore.query).toHaveBeenCalledTimes(1);
    expect(world.tx).not.toHaveBeenCalled();
  });

  it('2. dos guardados simultáneos piden una sola firma y busy vuelve a false', async () => {
    const { hub, world } = await connectedHub();
    let release: () => void = () => undefined;
    world.tx.mockImplementationOnce(
      (arg) =>
        new Promise((resolve) => {
          release = () => {
            world.store.best = arg as bigint;
            resolve({ ok: true, value: {} });
          };
        }),
    );
    const first = hub.saveScore(500);
    expect(hub.getState().busy).toBe(true);
    const second = await hub.saveScore(600);
    expect(second).toEqual({ ok: false, message: 'Espera a que termine la firma en curso.' });
    await vi.waitFor(() => expect(world.tx).toHaveBeenCalledTimes(1));
    release();
    expect(await first).toEqual({ ok: true, message: 'Récord guardado: 500.' });
    expect(world.tx).toHaveBeenCalledTimes(1);
    expect(hub.getState().busy).toBe(false);

    // También vuelve a false si tx() lanza.
    world.tx.mockRejectedValueOnce(new Error('falla inesperada'));
    const failed = await hub.saveScore(700);
    expect(failed.ok).toBe(false);
    expect(hub.getState().busy).toBe(false);
  });

  it('3. Invalid.Payment con PGAS 0 es no-gas: pide gas una vez y firma dos veces', async () => {
    const { hub, deps, world } = await connectedHub({ readPgas: vi.fn(async () => 0n) });
    world.tx.mockResolvedValue({ ok: false, error: new Error('Transaction failed before inclusion: Invalid.Payment') });
    const r = await hub.saveScore(500);
    expect(r.ok).toBe(false);
    expect(r.message).toBe('Te quedan 0.00 PGAS: no alcanza para la comisión. Pide más gas y reintenta.');
    expect(deps.requestAllowance).toHaveBeenCalledTimes(1);
    expect(world.tx).toHaveBeenCalledTimes(2);
    expect(deps.connectChain).not.toHaveBeenCalled();
    expect(deps.log.warn).toHaveBeenCalledWith('tx', 'no-gas', expect.any(String));
  });

  it('4. timeout con el récord ya en la cadena cuenta como guardado', async () => {
    const { hub, world } = await connectedHub();
    world.tx.mockResolvedValue({ ok: false, error: new Error('TxTimeout') });
    world.reader.bestScore.query.mockResolvedValue(ok<unknown>(800n));
    const r = await hub.saveScore(500);
    expect(r).toEqual({ ok: true, message: 'Tu récord quedó guardado.' });
    expect(world.tx).toHaveBeenCalledTimes(1);
  });

  it('5. sin cuenta no simula ni firma', async () => {
    const deps = fakeDeps();
    const hub = createHub(deps);
    await hub.start();
    const r = await hub.saveScore(100);
    expect(r).toEqual({ ok: false, message: 'Conecta tu cuenta primero.' });
    expect(deps.world.reader.submitScore.query).not.toHaveBeenCalled();
    expect(deps.world.tx).not.toHaveBeenCalled();
  });

  it('6. éxito sin relectura que alcance: «Récord enviado…» y un warn', async () => {
    const { hub, deps, world } = await connectedHub();
    world.tx.mockResolvedValue({ ok: true, value: {} }); // no cambia el récord en memoria
    const r = await hub.saveScore(500);
    expect(r).toEqual({ ok: true, message: 'Récord enviado. Puede tardar unos segundos en aparecer.' });
    expect(world.reader.bestScore.query).toHaveBeenCalledTimes(3);
    expect(deps.sleep).toHaveBeenCalledTimes(2);
    expect(deps.sleep).toHaveBeenCalledWith(2_000);
    expect(deps.log.warn).toHaveBeenCalled();
  });

  it('7. setUsername con un username inválido no llama al contrato', async () => {
    const { hub, world } = await connectedHub();
    const r = await hub.setUsername('Ana');
    expect(r).toEqual({ ok: false, message: 'El username debe tener de 3 a 16 caracteres: a-z, 0-9 o _.' });
    expect(world.reader.setUsername.query).not.toHaveBeenCalled();
    expect(world.usernameTx).not.toHaveBeenCalled();
  });

  it('8. fuera del Host queda en «fuera» y el ranking se sigue leyendo', async () => {
    const deps = fakeDeps({ isInsideContainer: vi.fn(async () => false) });
    const hub = createHub(deps);
    const seen: string[] = [];
    hub.subscribe((s) => seen.push(s.host));
    await hub.start();
    expect(hub.getState().host).toBe('fuera');
    expect(hub.getState().message).toMatch(/^Abre Polka-Man dentro de Polkadot Desktop/);
    expect(seen).toContain('fuera');
    expect(deps.getTruApi).not.toHaveBeenCalled();
    const top = await hub.readTop();
    expect(top).toEqual([
      { address: OTHER, username: 'prueba_ok', score: 1240n, mine: false },
      { address: ME.h160Address, username: '', score: 300n, mine: false },
    ]);
  });

  it('9. Invalid.Payment con 1 PGAS es host-payment: reconecta y reintenta sin pedir gas', async () => {
    const { hub, deps, world } = await connectedHub({ readPgas: vi.fn(async () => 10n ** 10n) });
    world.tx.mockResolvedValueOnce({ ok: false, error: new Error('Transaction failed before inclusion: Invalid.Payment') });
    const r = await hub.saveScore(500);
    expect(r).toEqual({ ok: true, message: 'Récord guardado: 500.' });
    expect(deps.connectChain).toHaveBeenCalledTimes(1);
    expect(deps.createSigner).toHaveBeenCalledTimes(1);
    expect(world.tx).toHaveBeenCalledTimes(2);
    expect(deps.requestAllowance).not.toHaveBeenCalled();
    expect(deps.log.warn).toHaveBeenCalledWith('tx', 'host-payment', expect.any(String));
  });

  it('10. readMine lanza si la lectura falla (no devuelve null)', async () => {
    const { hub, world } = await connectedHub();
    world.reader.bestScore.query.mockRejectedValue(new Error('RPC caído'));
    await expect(hub.readMine()).rejects.toThrow('No se pudo leer tu récord');
  });
});
