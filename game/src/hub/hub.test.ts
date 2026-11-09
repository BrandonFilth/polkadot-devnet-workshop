import { describe, expect, it, vi } from 'vitest';
import type { LeaderboardContract, TxOptions } from '../contract/leaderboard';
import { TX_EXT_VERSION } from '../contract/config';
import { createHub, productIdFromHost, type Hub, type HubDeps, type SignerAccount } from './hub';
import type { ProgressStep } from './progress';

const sdkEvents = (opts?: TxOptions) => {
  for (const status of ['signing', 'broadcasting', 'in-block', 'finalized']) opts?.onStatus?.(status);
};

/** Pasos visibles que pasan por el Hub, sin repetir los consecutivos. */
function recordSteps(hub: Hub) {
  const steps: ProgressStep[] = [];
  hub.subscribe((s) => {
    const step = s.progress?.step;
    if (step && steps[steps.length - 1] !== step) steps.push(step);
  });
  return steps;
}

// Dobles sin red: el contrato vive en memoria, el reloj es instantáneo y el log es un espía.

const ME: SignerAccount = { address: '5FakeSs58Cuenta', h160Address: `0x${'1'.repeat(40)}` };
const OTHER = `0x${'2'.repeat(40)}` as const;

const ok = <T>(value: T) => ({ success: true as const, value });
/** startTime del contrato falso: medianoche de Monterrey del 1 nov 2026. */
const START = BigInt(Date.UTC(2026, 10, 1, 6) / 1000);

/** Contrato en memoria compartido por el lector (RPC) y el escritor (Host). */
function makeWorld() {
  const store = { best: 0n, lifetime: 0n, username: '' };
  const reader = {
    bestScore: { query: vi.fn(async (..._a: unknown[]) => ok<unknown>(store.best)) },
    lifetimeBest: { query: vi.fn(async (..._a: unknown[]) => ok<unknown>(store.lifetime)) },
    scoreOf: { query: vi.fn(async (..._a: unknown[]) => ok<unknown>(0n)) },
    currentPeriod: { query: vi.fn(async (..._a: unknown[]) => ok<unknown>(2n)) },
    startTime: { query: vi.fn(async (..._a: unknown[]) => ok<unknown>(START)) },
    PERIOD_LENGTH: { query: vi.fn(async (..._a: unknown[]) => ok<unknown>(259_200n)) },
    playerCountIn: { query: vi.fn(async (..._a: unknown[]) => ok<unknown>(2n)) },
    getScoresIn: { query: vi.fn(async (..._a: unknown[]) => ok<unknown>([[ME.h160Address, OTHER], ['', 'otro_1'], [90n, 400n]])) },
    usernameOf: { query: vi.fn(async (..._a: unknown[]) => ok<unknown>(store.username)) },
    playerOf: { query: vi.fn(async (..._a: unknown[]) => ok<unknown>(`0x${'0'.repeat(40)}`)) },
    playerCount: { query: vi.fn(async (..._a: unknown[]) => ok<unknown>(2n)) },
    getScores: { query: vi.fn(async (..._a: unknown[]) => ok<unknown>([[OTHER, ME.h160Address], ['prueba_ok', ''], [1240n, 300n]])) },
    submitScore: { query: vi.fn(async (..._a: unknown[]): Promise<{ success: boolean; value: unknown }> => ok<unknown>(undefined)) },
    setUsername: { query: vi.fn(async (..._a: unknown[]): Promise<{ success: boolean; value: unknown }> => ok<unknown>(undefined)) },
    admin: { query: vi.fn(async (..._a: unknown[]) => ok<unknown>(ME.h160Address)) },
    isStarted: { query: vi.fn(async (..._a: unknown[]) => ok<unknown>(true)) },
    setStartTime: { query: vi.fn(async (..._a: unknown[]): Promise<{ success: boolean; value: unknown }> => ok<unknown>(undefined)) },
  };
  // Como submitAndWatch de product-sdk-tx 0.5.3 con waitFor 'finalized': signing → broadcasting →
  // in-block → finalized y luego resuelve.
  const tx = vi.fn(async (arg: unknown, opts?: TxOptions): Promise<{ ok: true; value: object } | { ok: false; error: unknown }> => {
    sdkEvents(opts);
    store.best = arg as bigint;
    if ((arg as bigint) > store.lifetime) store.lifetime = arg as bigint;
    return { ok: true, value: {} };
  });
  const usernameTx = vi.fn(async (name: unknown, opts?: TxOptions): Promise<{ ok: true; value: object } | { ok: false; error: unknown }> => {
    sdkEvents(opts);
    store.username = name as string;
    return { ok: true, value: {} };
  });
  // setStartTime cambia el startTime que devuelve el lector.
  const startTx = vi.fn(async (start: unknown, opts?: TxOptions): Promise<{ ok: true; value: object } | { ok: false; error: unknown }> => {
    sdkEvents(opts);
    reader.startTime.query.mockResolvedValue(ok<unknown>(start));
    return { ok: true, value: {} };
  });
  const writer = {
    ...reader,
    submitScore: { query: reader.submitScore.query, tx },
    setUsername: { query: reader.setUsername.query, tx: usernameTx },
    setStartTime: { query: reader.setStartTime.query, tx: startTx },
  };
  return { store, reader, tx, usernameTx, startTx, writerContract: writer as unknown as LeaderboardContract };
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

  it('3b. Invalid.Payment con PGAS: reconecta, reintenta y guarda los dos intentos en los detalles', async () => {
    const { hub, world, deps } = await connectedHub({ readPgas: vi.fn(async () => 549_800_000_000n) });
    const first = Object.assign(new Error('Transaction failed before inclusion: Invalid.Payment'), {
      type: 'Invalid',
      value: { type: 'Payment' },
    });
    const second = new Error('Transaction failed before inclusion: Invalid.Payment', { cause: { reason: 'otra vez' } });
    world.usernameTx.mockResolvedValueOnce({ ok: false, error: first }).mockResolvedValueOnce({ ok: false, error: second });
    const r = await hub.setUsername('ana_92');
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.kind).toBe('host-payment');
    expect(deps.connectChain).toHaveBeenCalledTimes(1);
    expect(world.usernameTx).toHaveBeenCalledTimes(2);
    const details = r.ok === false ? r.details ?? '' : '';
    expect(details).toContain('intento 1: host-payment · PGAS 54.98');
    expect(details).toContain('"type":"Invalid"');
    expect(details).toContain('recuperación: reconectar → reintento');
    expect(details).toContain('intento 2: host-payment');
    expect(details).toContain('causa: {"reason":"otra vez"}');
    // Los detalles llegan al popup de estados.
    expect(hub.getState().progress?.details).toBe(details);
  });

  it('3c. el firmante se pide en el pipeline TX_EXT_VERSION (1 = AsPgas, comisión en PGAS)', async () => {
    const { deps } = await connectedHub();
    expect(TX_EXT_VERSION).toBe(1);
    expect(deps.writer).toHaveBeenCalledWith(expect.anything(), ME, { productId: 'polka-man.dot', txExtVersion: 1 });
  });

  it('3d. si el Host no acepta el pipeline 1, rearma el firmante con el 0 y reintenta una vez', async () => {
    const { hub, deps, world } = await connectedHub();
    vi.mocked(deps.writer).mockClear();
    world.usernameTx.mockResolvedValueOnce({ ok: false, error: new Error('chain declares no transaction-extension pipeline version 1') });
    const r = await hub.setUsername('ana_92');
    expect(r.ok).toBe(true);
    expect(world.usernameTx).toHaveBeenCalledTimes(2);
    expect(deps.writer).toHaveBeenCalledTimes(1);
    expect(deps.writer).toHaveBeenCalledWith(expect.anything(), ME, { productId: 'polka-man.dot', txExtVersion: 0 });

    // El resto de la sesión (también al reconectar) firma en el 0.
    vi.mocked(deps.writer).mockClear();
    world.usernameTx.mockResolvedValueOnce({ ok: false, error: new Error('Host provider is not connected') });
    await hub.setUsername('ana_93');
    expect(deps.writer).toHaveBeenCalledWith(expect.anything(), ME, { productId: 'polka-man.dot', txExtVersion: 0 });
  });

  it('3e. sin PAS para el depósito (StorageDepositNotEnoughFunds) lo dice y no reconecta', async () => {
    const { hub, deps, world } = await connectedHub();
    const error = Object.assign(new Error('Dry-run failed for "setUsername"'), {
      dispatchError: { type: 'Module', value: { type: 'Revive', value: { type: 'StorageDepositNotEnoughFunds' } } },
    });
    world.usernameTx.mockResolvedValueOnce({ ok: false, error });
    const r = await hub.setUsername('ana_92');
    expect(r.ok === false && r.kind).toBe('no-pas');
    expect(r.message).toMatch(/PAS/);
    expect(world.usernameTx).toHaveBeenCalledTimes(1);
    expect(deps.connectChain).not.toHaveBeenCalled();
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

describe('hub: periodos, historial y récord de por vida', () => {
  it('readPeriods devuelve el periodo actual, startTime, PERIOD_LENGTH e isStarted', async () => {
    const deps = fakeDeps();
    const hub = createHub(deps);
    expect(await hub.readPeriods()).toEqual({ current: 2, start: START, length: 259_200n, started: true });
  });

  it('readPeriods con error lanza «No se pudo leer el periodo»', async () => {
    const deps = fakeDeps();
    deps.world.reader.currentPeriod.query.mockRejectedValue(new Error('RPC caído'));
    const hub = createHub(deps);
    await expect(hub.readPeriods()).rejects.toThrow('No se pudo leer el periodo');
  });

  it('readTopIn(1) lee playerCountIn/getScoresIn con 1n, ordena y marca tu fila', async () => {
    const { hub, world } = await connectedHub();
    const top = await hub.readTopIn(1);
    expect(world.reader.playerCountIn.query).toHaveBeenCalledWith(1n);
    expect(world.reader.getScoresIn.query).toHaveBeenCalledWith(1n, 0n, 2n);
    expect(top).toEqual([
      { address: OTHER, username: 'otro_1', score: 400n, mine: false },
      { address: ME.h160Address, username: '', score: 90n, mine: true },
    ]);
    expect(world.reader.getScores.query).not.toHaveBeenCalled();
  });

  it('readTopIn con error lanza «No se pudo leer el historial»', async () => {
    const deps = fakeDeps();
    deps.world.reader.getScoresIn.query.mockRejectedValue(new Error('RPC caído'));
    const hub = createHub(deps);
    await expect(hub.readTopIn(0)).rejects.toThrow('No se pudo leer el historial');
  });

  it('readMine devuelve el récord del periodo, el de por vida y el username', async () => {
    const { hub, world } = await connectedHub();
    world.store.best = 300n;
    world.store.lifetime = 900n;
    world.store.username = 'ana';
    expect(await hub.readMine()).toEqual({ best: 300n, lifetime: 900n, username: 'ana' });
  });

  it('guardar un récord mayor sube también el de por vida', async () => {
    const { hub, world } = await connectedHub();
    world.store.lifetime = 200n;
    expect((await hub.saveScore(500)).ok).toBe(true);
    expect(await hub.readMine()).toEqual({ best: 500n, lifetime: 500n, username: '' });
  });
});

// Textos exactos de product-sdk-tx 0.5.3.
const sdkError = (name: string, message: string) => Object.assign(new Error(message), { name });
const REJECTED = () => sdkError('TxSigningRejectedError', 'Transaction signing was rejected.');
const TIMEOUT = () => sdkError('TxTimeoutError', 'Transaction timed out after 300s. The transaction may still be processing on-chain.');

describe('hub: estados visibles de cada firma', () => {
  it('11. guardar recorre simulando → firma → enviando → confirmando → actualizando → listo', async () => {
    const { hub } = await connectedHub();
    const steps = recordSteps(hub);
    const r = await hub.saveScore(500);
    expect(r.ok).toBe(true);
    expect(steps).toEqual(['simulando', 'firma', 'enviando', 'confirmando', 'actualizando', 'listo']);
    expect(hub.getState().progress).toMatchObject({ op: 'guardar', step: 'listo', message: 'Récord guardado: 500.' });
  });

  it('12. si la simulación revierte: simulando → error, sin firma', async () => {
    const { hub, world } = await connectedHub();
    world.reader.submitScore.query.mockResolvedValue({ success: false, value: { error: 'ScoreNotHigher', args: [300n, 200n] } });
    const steps = recordSteps(hub);
    await hub.saveScore(200);
    expect(steps).toEqual(['simulando', 'error']);
    expect(world.tx).not.toHaveBeenCalled();
  });

  it('13. firma rechazada sin eventos del SDK: firma → error «rejected», nunca «enviando»', async () => {
    const { hub, world } = await connectedHub();
    world.tx.mockResolvedValue({ ok: false, error: REJECTED() });
    const steps = recordSteps(hub);
    const r = await hub.saveScore(500);
    expect(r).toMatchObject({ ok: false, kind: 'rejected' });
    expect(steps).toEqual(['simulando', 'firma', 'error']);
    expect(steps).not.toContain('enviando');
    expect(hub.getState().progress).toMatchObject({ step: 'error', kind: 'rejected' });
  });

  it('14. sin respuesta y sin récord en la cadena: error «timeout», distinto de rechazada', async () => {
    const { hub, world } = await connectedHub();
    world.tx.mockResolvedValueOnce({ ok: false, error: TIMEOUT() });
    const timeout = await hub.saveScore(500);
    expect(timeout).toMatchObject({ ok: false, kind: 'timeout' });
    expect(timeout.message).toMatch(/no respondió a tiempo/);
    world.tx.mockResolvedValueOnce({ ok: false, error: REJECTED() });
    const rejected = await hub.saveScore(500);
    expect(rejected).toMatchObject({ ok: false, kind: 'rejected' });
    expect(rejected.message).not.toBe(timeout.message);
  });

  it('15. sin gas: firma → permiso-gas → firma → … → listo', async () => {
    const { hub, world } = await connectedHub({ readPgas: vi.fn(async () => 0n) });
    world.tx.mockResolvedValueOnce({ ok: false, error: new Error('Transaction failed before inclusion: Invalid.Payment') });
    const steps = recordSteps(hub);
    const r = await hub.saveScore(500);
    expect(r.ok).toBe(true);
    expect(steps).toEqual(['simulando', 'firma', 'permiso-gas', 'firma', 'enviando', 'confirmando', 'actualizando', 'listo']);
  });

  it('16. conectar: conectando → permiso-gas → listo, ocupado mientras dura', async () => {
    let allow: (v: 'Allocated') => void = () => undefined;
    const deps = fakeDeps({ requestAllowance: vi.fn(() => new Promise<'Allocated'>((resolve) => (allow = resolve))) });
    const hub = createHub(deps);
    await hub.start();
    const steps = recordSteps(hub);
    const pending = hub.connect();
    expect(hub.getState().busy).toBe(true);
    await vi.waitFor(() => expect(deps.requestAllowance).toHaveBeenCalledTimes(1));
    expect(await hub.connect()).toEqual({ ok: false, message: 'Espera a que termine la firma en curso.' });
    expect(await hub.saveScore(100)).toEqual({ ok: false, message: 'Espera a que termine la firma en curso.' });
    allow('Allocated');
    expect(await pending).toEqual({ ok: true, message: 'Cuenta conectada.' });
    expect(hub.getState().busy).toBe(false);
    expect(steps).toEqual(['conectando', 'permiso-gas', 'listo']);
  });

  it('17. username sin récord guardado: se guarda sin tocar submitScore', async () => {
    const { hub, world } = await connectedHub();
    expect(world.store.best).toBe(0n);
    const r = await hub.setUsername('ana_01');
    expect(r).toEqual({ ok: true, message: 'Username guardado: ana_01.' });
    expect(world.reader.submitScore.query).not.toHaveBeenCalled();
    expect(world.tx).not.toHaveBeenCalled();
    expect(world.usernameTx).toHaveBeenCalledTimes(1);
    expect(hub.getState().progress).toMatchObject({ op: 'username', step: 'listo' });
  });

  it('18. saveScore y setUsername piden waitFor «finalized» a .tx()', async () => {
    const { hub, world } = await connectedHub();
    await hub.saveScore(500);
    await hub.setUsername('ana_01');
    expect(world.tx).toHaveBeenCalledWith(500n, expect.objectContaining({ waitFor: 'finalized' }));
    expect(world.usernameTx).toHaveBeenCalledWith('ana_01', expect.objectContaining({ waitFor: 'finalized' }));
  });

  it('19. connect: un connect() con error del SignerManager no deja cuenta y lo registra', async () => {
    const deps = fakeDeps({
      createSigner: vi.fn(() => ({
        connect: vi.fn(async () => ({ ok: false, error: new Error('Host rejected product account request: DomainNotValid') })),
        getProductAccount: vi.fn(async () => ({ ok: true as const, value: ME })),
        destroy: vi.fn(),
      })),
    });
    const hub = createHub(deps);
    await hub.start();
    const r = await hub.connect();
    expect(r.ok).toBe(false);
    expect(r.message).toContain('DomainNotValid');
    expect(hub.getState().account).toBeNull();
    expect(deps.log.warn).toHaveBeenCalledWith('connect', expect.stringContaining('DomainNotValid'));
  });
});

describe('productIdFromHost', () => {
  it.each([
    ['polka-man.dot', 'polka-man.dot'],
    ['localhost:5173', 'localhost:5173'],
    ['polka-man.dot.li', 'polka-man.dot'],
    ['polka-man.app.dot.li', 'polka-man.dot'],
    ['tmpabc.dev-dot.li', 'tmpabc.dot'],
    ['tmpabc.app.dev-dot.li', 'tmpabc.dot'],
    ['TMPABC.App.Dev-Dot.li', 'tmpabc.dot'],
    ['example.com', 'polka-man.dot'],
    ['', 'polka-man.dot'],
  ])('%s → %s', (host, expected) => {
    expect(productIdFromHost(host)).toBe(expected);
  });
});

describe('hub: evento y panel de admin', () => {
  const FUTURE = START + 30n * 86_400n;

  it('readPeriods antes del evento: started false y startTime 0n', async () => {
    const deps = fakeDeps();
    deps.world.reader.isStarted.query.mockResolvedValue(ok<unknown>(false));
    deps.world.reader.startTime.query.mockResolvedValue(ok<unknown>(0n));
    deps.world.reader.currentPeriod.query.mockResolvedValue(ok<unknown>(0n));
    const hub = createHub(deps);
    expect(await hub.readPeriods()).toEqual({ current: 0, start: 0n, length: 259_200n, started: false });
  });

  it('readEvent devuelve el admin y la hora de inicio, también sin cuenta', async () => {
    const deps = fakeDeps();
    const hub = createHub(deps);
    expect(await hub.readEvent()).toEqual({ admin: ME.h160Address, start: START });
  });

  it('readEvent con error lanza «No se pudo leer la hora de inicio»', async () => {
    const deps = fakeDeps();
    deps.world.reader.admin.query.mockRejectedValue(new Error('RPC caído'));
    const hub = createHub(deps);
    await expect(hub.readEvent()).rejects.toThrow('No se pudo leer la hora de inicio');
  });

  it('antes del evento, guardar récord revierte con NotStarted en la simulación y no pide firma', async () => {
    const { hub, world } = await connectedHub();
    world.reader.submitScore.query.mockResolvedValue({ success: false, value: { error: 'NotStarted', args: [] } });
    const r = await hub.saveScore(500);
    expect(r.ok).toBe(false);
    expect(r.message).toBe('El ranking todavía no abre: tu récord no se guarda hasta que empiece el evento.');
    expect(world.tx).not.toHaveBeenCalled();
    expect(hub.getState().busy).toBe(false);
  });

  it('setStartTime: simula como la cuenta, firma una vez, relee startTime y termina en Listo', async () => {
    const { hub, world } = await connectedHub();
    const steps = recordSteps(hub);
    const r = await hub.setStartTime(FUTURE);
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/^Hora de inicio guardada: .+ \(hora de México\)\.$/);
    expect(world.reader.setStartTime.query).toHaveBeenCalledWith(FUTURE, { from: ME.h160Address, origin: ME.address });
    expect(world.startTx).toHaveBeenCalledTimes(1);
    expect(world.startTx.mock.calls[0]![0]).toBe(FUTURE);
    expect(steps).toEqual(['simulando', 'firma', 'enviando', 'confirmando', 'actualizando', 'listo']);
    expect(hub.getState().progress?.op).toBe('inicio');
    expect(hub.getState().busy).toBe(false);
  });

  it('setStartTime de una cuenta que no es admin: NotAdmin en la simulación, sin firma', async () => {
    const { hub, world } = await connectedHub();
    world.reader.setStartTime.query.mockResolvedValue({ success: false, value: { error: 'NotAdmin', args: [] } });
    const r = await hub.setStartTime(FUTURE);
    expect(r).toEqual({ ok: false, message: 'Solo el admin del ranking puede hacer esto.' });
    expect(world.startTx).not.toHaveBeenCalled();
  });

  it('setStartTime con el ranking ya abierto: StartLocked, sin firma', async () => {
    const { hub, world } = await connectedHub();
    world.reader.setStartTime.query.mockResolvedValue({ success: false, value: { error: 'StartLocked', args: [] } });
    const r = await hub.setStartTime(FUTURE);
    expect(r).toEqual({ ok: false, message: 'El ranking ya empezó: la hora de inicio ya no se puede cambiar.' });
    expect(world.startTx).not.toHaveBeenCalled();
  });

  it('setStartTime sin cuenta, con 0 o con otra firma en curso no simula ni firma', async () => {
    const deps = fakeDeps();
    const hub = createHub(deps);
    await hub.start();
    expect(await hub.setStartTime(FUTURE)).toEqual({ ok: false, message: 'Conecta tu cuenta primero.' });
    expect(deps.world.reader.setStartTime.query).not.toHaveBeenCalled();

    const connected = await connectedHub();
    expect(await connected.hub.setStartTime(0n)).toEqual({ ok: false, message: 'La hora de inicio no es válida.' });
    let release: () => void = () => undefined;
    connected.world.tx.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ ok: true, value: {} });
        }),
    );
    connected.world.reader.bestScore.query.mockResolvedValue(ok<unknown>(500n));
    const saving = connected.hub.saveScore(500);
    expect(await connected.hub.setStartTime(FUTURE)).toEqual({ ok: false, message: 'Espera a que termine la firma en curso.' });
    await vi.waitFor(() => expect(connected.world.tx).toHaveBeenCalledTimes(1));
    release();
    await saving;
    expect(connected.world.reader.setStartTime.query).not.toHaveBeenCalled();
  });
});
