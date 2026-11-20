// LeaderboardV5: puntajes firmados por el Worker, tope, descalificar y migración desde v4.
// Correr: pnpm test (dentro de contrato/)
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { privateKeyToAccount } from 'viem/accounts';
import { ADMIN, compile, deployContract, expectRevert, NOW, player } from './harness.mjs';

const DAY = 86_400n;
const PERIOD = 3n * DAY;
// Llaves de prueba (solo para estos tests, sin fondos en ninguna red).
const WORKER = privateKeyToAccount(`0x${'11'.repeat(32)}`);
const OTHER_KEY = privateKeyToAccount(`0x${'22'.repeat(32)}`);
const ANA = player(1);
const BETO = player(2);
const CARLA = player(3);
const ZERO = '0x0000000000000000000000000000000000000000';
const MAX = 10_000_000n;
const gid = (n) => `0x${n.toString(16).padStart(64, '0')}`;
const TX = (n) => `0x${(n + 500).toString(16).padStart(64, '0')}`;

/** Despliega v5 con WORKER de firmante y, por defecto, el ranking abierto desde NOW. */
async function deployV5({ start = NOW } = {}) {
  const c = await deployContract('LeaderboardV5', [WORKER.address]);
  if (start !== null) await c.send(ADMIN, 'setStartTime', [start]);
  return c;
}

/** Firma EIP-712 como la hace el Worker. La EVM de prueba usa chainId 1. */
const sign = (c, { who, score, game, deadline, key = WORKER }) =>
  key.signTypedData({
    domain: { name: 'PolkaManScore', version: '1', chainId: 1, verifyingContract: c.address },
    types: {
      Score: [
        { name: 'player', type: 'address' },
        { name: 'score', type: 'uint256' },
        { name: 'gameId', type: 'bytes32' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'Score',
    message: { player: who, score, gameId: game, deadline },
  });

/** Guarda `score` como `who` con una firma válida (o la que se pase). */
async function submit(c, who, score, game, { deadline = c.now() + 600n, sig } = {}) {
  const s = sig ?? (await sign(c, { who, score, game, deadline }));
  return c.send(who, 'submitScore', [score, game, deadline, s]);
}

describe('v5: despliegue', () => {
  it('quien despliega es admin; el firmante es el del constructor; la migración empieza abierta', async () => {
    const c = await deployV5({ start: null });
    assert.equal(await c.read('admin'), ADMIN);
    assert.equal(await c.read('signer'), WORKER.address);
    assert.equal(await c.read('migrationOpen'), true);
    assert.equal(await c.read('MAX_SCORE'), MAX);
  });

  it('el firmante no puede ser 0x000…', async () => {
    await expectRevert(deployContract('LeaderboardV5', [ZERO]), 'InvalidSigner');
  });

  it('compila sin avisos y cabe en 24,576 bytes', () => {
    const { runtimeBytes, warnings } = compile('LeaderboardV5');
    assert.deepEqual(warnings, []);
    assert.ok(runtimeBytes <= 24_576, `${runtimeBytes} bytes`);
  });

  it('el hash del contrato es el mismo que firma el Worker', async () => {
    const c = await deployV5();
    const deadline = NOW + 600n;
    const digest = await c.read('scoreDigest', [ANA, 90n, gid(1), deadline]);
    const { hashTypedData } = await import('viem');
    const local = hashTypedData({
      domain: { name: 'PolkaManScore', version: '1', chainId: 1, verifyingContract: c.address },
      types: { Score: [{ name: 'player', type: 'address' }, { name: 'score', type: 'uint256' }, { name: 'gameId', type: 'bytes32' }, { name: 'deadline', type: 'uint256' }] },
      primaryType: 'Score',
      message: { player: ANA, score: 90n, gameId: gid(1), deadline },
    });
    assert.equal(digest, local);
  });
});

describe('v5: puntajes firmados', () => {
  it('con la firma del Worker se guarda el récord del periodo y el de por vida', async () => {
    const c = await deployV5();
    const { events } = await submit(c, ANA, 1200n, gid(1));
    assert.equal(await c.read('bestScore', [ANA]), 1200n);
    assert.equal(await c.read('lifetimeBest', [ANA]), 1200n);
    assert.equal(await c.read('usedGame', [gid(1)]), true);
    assert.deepEqual(events.map((e) => e.eventName), ['NewHighScore', 'NewLifetimeBest']);
  });

  it('llamar directo con un número inventado (sin firma del Worker) revierte', async () => {
    const c = await deployV5();
    const deadline = c.now() + 600n;
    await expectRevert(c.send(ANA, 'submitScore', [999_999n, gid(1), deadline, '0x']), 'BadSignature');
    const fake = await sign(c, { who: ANA, score: 999_999n, game: gid(1), deadline, key: OTHER_KEY });
    await expectRevert(c.send(ANA, 'submitScore', [999_999n, gid(1), deadline, fake]), 'BadSignature');
  });

  it('la firma es para una cuenta, un puntaje y una partida', async () => {
    const c = await deployV5();
    const deadline = c.now() + 600n;
    const sig = await sign(c, { who: ANA, score: 500n, game: gid(1), deadline });
    await expectRevert(c.send(BETO, 'submitScore', [500n, gid(1), deadline, sig]), 'BadSignature');
    await expectRevert(c.send(ANA, 'submitScore', [5000n, gid(1), deadline, sig]), 'BadSignature');
    await expectRevert(c.send(ANA, 'submitScore', [500n, gid(2), deadline, sig]), 'BadSignature');
    await expectRevert(c.send(ANA, 'submitScore', [500n, gid(1), deadline + 1n, sig]), 'BadSignature');
  });

  it('cada partida se guarda una sola vez', async () => {
    const c = await deployV5();
    const deadline = c.now() + 600n;
    const sig = await sign(c, { who: ANA, score: 500n, game: gid(1), deadline });
    await c.send(ANA, 'submitScore', [500n, gid(1), deadline, sig]);
    await expectRevert(c.send(ANA, 'submitScore', [500n, gid(1), deadline, sig]), 'GameUsed');
  });

  it('una firma vencida no sirve', async () => {
    const c = await deployV5();
    const deadline = c.now() + 600n;
    const sig = await sign(c, { who: ANA, score: 500n, game: gid(1), deadline });
    c.warp(601);
    await expectRevert(c.send(ANA, 'submitScore', [500n, gid(1), deadline, sig]), 'Expired');
  });

  it('la otra forma (maleable) de la misma firma se rechaza', async () => {
    const c = await deployV5();
    const deadline = c.now() + 600n;
    const sig = await sign(c, { who: ANA, score: 500n, game: gid(1), deadline });
    const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
    const s = BigInt(`0x${sig.slice(66, 130)}`);
    const v = parseInt(sig.slice(130, 132), 16);
    const flipped = `${sig.slice(0, 66)}${(N - s).toString(16).padStart(64, '0')}${(v === 27 ? 28 : 27).toString(16)}`;
    await expectRevert(c.send(ANA, 'submitScore', [500n, gid(1), deadline, flipped]), 'BadSignature');
  });

  it('tope: 0 o más de MAX_SCORE revierten aunque estén firmados', async () => {
    const c = await deployV5();
    await expectRevert(submit(c, ANA, MAX + 1n, gid(1)), 'InvalidScore');
    await expectRevert(submit(c, ANA, 2n ** 256n - 1n, gid(2)), 'InvalidScore');
    await expectRevert(submit(c, ANA, 0n, gid(3)), 'InvalidScore');
    await submit(c, ANA, MAX, gid(4));
    assert.equal(await c.read('bestScore', [ANA]), MAX);
  });

  it('antes del inicio no se guarda; un puntaje que no supera el récord revierte', async () => {
    const closed = await deployV5({ start: null });
    await expectRevert(submit(closed, ANA, 100n, gid(1)), 'NotStarted');
    const c = await deployV5();
    await submit(c, ANA, 300n, gid(1));
    await expectRevert(submit(c, ANA, 300n, gid(2)), 'ScoreNotHigher');
  });

  it('setSigner: solo el admin; las firmas de la llave anterior dejan de valer', async () => {
    const c = await deployV5();
    await expectRevert(c.send(ANA, 'setSigner', [OTHER_KEY.address]), 'NotAdmin');
    await expectRevert(c.send(ADMIN, 'setSigner', [ZERO]), 'InvalidSigner');
    await c.send(ADMIN, 'setSigner', [OTHER_KEY.address]);
    await expectRevert(submit(c, ANA, 100n, gid(1)), 'BadSignature');
    const deadline = c.now() + 600n;
    const sig = await sign(c, { who: ANA, score: 100n, game: gid(1), deadline, key: OTHER_KEY });
    await c.send(ANA, 'submitScore', [100n, gid(1), deadline, sig]);
  });
});

describe('v5: descalificar', () => {
  it('pone su puntaje en 0, no deja volver a guardar en ese periodo y reinicia su récord de por vida', async () => {
    const c = await deployV5();
    await submit(c, ANA, 9000n, gid(1));
    await submit(c, BETO, 500n, gid(2));
    await expectRevert(c.send(BETO, 'disqualify', [0n, ANA]), 'NotAdmin');
    await c.send(ADMIN, 'disqualify', [0n, ANA]);
    assert.equal(await c.read('scoreOf', [0n, ANA]), 0n);
    assert.equal(await c.read('lifetimeBest', [ANA]), 0n);
    assert.equal(await c.read('disqualified', [0n, ANA]), true);
    await expectRevert(submit(c, ANA, 100n, gid(3)), 'IsDisqualified');
    const [addrs, , scores] = await c.read('getScores', [0n, 10n]);
    assert.deepEqual(addrs, [ANA, BETO]);
    assert.deepEqual(scores, [0n, 500n]);
    // En el periodo siguiente vuelve a jugar.
    c.warp(Number(PERIOD));
    await submit(c, ANA, 100n, gid(4));
    assert.equal(await c.read('bestScore', [ANA]), 100n);
  });
});

describe('v5: migración desde v4', () => {
  /** v5 con la hora de inicio de v4 en el pasado: ya va en el periodo 3. */
  const migrating = async () => {
    const c = await deployV5({ start: null });
    await c.send(ADMIN, 'setStartTime', [NOW - 3n * PERIOD - DAY]);
    assert.equal(await c.read('currentPeriod'), 3n);
    return c;
  };

  it('una hora de inicio pasada abre el ranking y queda fija', async () => {
    const c = await migrating();
    assert.equal(await c.read('isStarted'), true);
    await expectRevert(c.send(ADMIN, 'setStartTime', [NOW]), 'StartLocked');
  });

  it('importa periodos terminados en el mismo orden, sin tocar el récord de por vida', async () => {
    const c = await migrating();
    await c.send(ADMIN, 'importScores', [0n, [ANA, BETO], [700n, 700n]]);
    await c.send(ADMIN, 'importScores', [0n, [CARLA], [300n]]);
    await c.send(ADMIN, 'importScores', [2n, [BETO], [50n]]);
    const [addrs, , scores] = await c.read('getScoresIn', [0n, 0n, 10n]);
    assert.deepEqual(addrs, [ANA, BETO, CARLA]);
    assert.deepEqual(scores, [700n, 700n, 300n]);
    assert.equal(await c.read('playerCountIn', [2n]), 1n);
    assert.equal(await c.read('lifetimeBest', [ANA]), 0n);
    assert.equal(await c.read('playerCount'), 0n);
  });

  it('no importa el periodo en curso, puntajes imposibles, repetidos ni listas de distinto largo', async () => {
    const c = await migrating();
    await expectRevert(c.send(ADMIN, 'importScores', [3n, [ANA], [100n]]), 'PeriodNotFinished');
    await expectRevert(c.send(ADMIN, 'importScores', [2n, [ANA], [2n ** 256n - 1n]]), 'InvalidScore');
    await expectRevert(c.send(ADMIN, 'importScores', [2n, [ANA], [0n]]), 'InvalidScore');
    await expectRevert(c.send(ADMIN, 'importScores', [2n, [ANA, BETO], [1n]]), 'LengthMismatch');
    await expectRevert(c.send(ADMIN, 'importScores', [2n, [ZERO], [1n]]), 'InvalidPlayer');
    await c.send(ADMIN, 'importScores', [2n, [ANA], [10n]]);
    await expectRevert(c.send(ADMIN, 'importScores', [2n, [ANA], [20n]]), 'AlreadyImported');
    const sinIniciar = await deployV5({ start: null });
    await expectRevert(sinIniciar.send(ADMIN, 'importScores', [0n, [ANA], [1n]]), 'PeriodNotFinished');
  });

  it('importa usernames (únicos) y wallets; vacíos no se tocan', async () => {
    const c = await migrating();
    await c.send(ADMIN, 'importProfiles', [[ANA, BETO, CARLA], ['ana', '', 'carla_9'], [player(1001), player(1002), ZERO]]);
    assert.equal(await c.read('usernameOf', [ANA]), 'ana');
    assert.equal(await c.read('playerOf', ['carla_9']), CARLA);
    assert.equal(await c.read('usernameOf', [BETO]), '');
    assert.equal(await c.read('payoutOf', [BETO]), player(1002));
    assert.equal(await c.read('payoutOf', [CARLA]), ZERO);
    await expectRevert(c.send(ADMIN, 'importProfiles', [[BETO], ['ana'], [ZERO]]), 'UsernameTaken');
    await expectRevert(c.send(ADMIN, 'importProfiles', [[BETO], ['Ana!'], [ZERO]]), 'InvalidUsername');
    await expectRevert(c.send(ADMIN, 'importProfiles', [[BETO], ['beto'], []]), 'LengthMismatch');
  });

  it('importa premios con su wallet y su hora originales', async () => {
    const c = await migrating();
    await c.send(ADMIN, 'importPrize', [1n, 1n, ANA, player(1001), TX(1), 1_794_600_000n]);
    const p = await c.read('prizeOf', [1n, 1n]);
    assert.equal(p.player, ANA);
    assert.equal(p.wallet, player(1001));
    assert.equal(p.txHash, TX(1));
    assert.equal(p.paidAt, 1_794_600_000n);
    await expectRevert(c.send(ADMIN, 'importPrize', [7n, 1n, ANA, player(1001), TX(1), 1n]), 'InvalidRound');
    await expectRevert(c.send(ADMIN, 'importPrize', [1n, 1n, ANA, ZERO, TX(1), 1n]), 'NoPayoutWallet');
  });

  it('solo el admin importa; closeMigration la cierra para siempre', async () => {
    const c = await migrating();
    await expectRevert(c.send(ANA, 'importScores', [0n, [ANA], [1n]]), 'NotAdmin');
    await expectRevert(c.send(ANA, 'closeMigration'), 'NotAdmin');
    const { events } = await c.send(ADMIN, 'closeMigration');
    assert.equal(events[0].eventName, 'MigrationClosed');
    assert.equal(await c.read('migrationOpen'), false);
    await expectRevert(c.send(ADMIN, 'importScores', [0n, [ANA], [1n]]), 'MigrationIsClosed');
    await expectRevert(c.send(ADMIN, 'importProfiles', [[ANA], ['ana'], [ZERO]]), 'MigrationIsClosed');
    await expectRevert(c.send(ADMIN, 'importPrize', [1n, 1n, ANA, player(1001), TX(1), 1n]), 'MigrationIsClosed');
    await expectRevert(c.send(ADMIN, 'closeMigration'), 'MigrationIsClosed');
  });

  it('el periodo en curso empieza vacío y se juega con firma como siempre', async () => {
    const c = await migrating();
    await c.send(ADMIN, 'importScores', [2n, [ANA], [800n]]);
    await submit(c, ANA, 50n, gid(1));
    assert.equal(await c.read('bestScore', [ANA]), 50n);
    assert.equal(await c.read('lifetimeBest', [ANA]), 50n);
  });
});
