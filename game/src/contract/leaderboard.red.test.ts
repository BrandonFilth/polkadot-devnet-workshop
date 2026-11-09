// Prueba de integración contra el devnet real (proyecto `red`: `pnpm test:red`). Solo lecturas y
// simulaciones con el rpcReader del juego: sin llaves ni firmas.
// Contrato v3: un admin y hora de inicio. Las pruebas que dependen de si el ranking ya abrió leen
// isStarted() antes y revisan el caso que toca.
import { bytesToHex, createPublicClient, http } from 'viem';
import { describe, expect, it } from 'vitest';
import { CHAIN_ID, ETH_RPC_URL, LEADERBOARD_ADDRESS } from './config';
import { NOT_ADMIN_MESSAGE, NOT_STARTED_MESSAGE, revertMessage } from './errors';
import { decodeScores } from './leaderboard';
import { readPgas } from './pgas';
import { createRpcContract } from './rpcReader';

const randomAddress = () => bytesToHex(crypto.getRandomValues(new Uint8Array(20)));
const from = randomAddress();
const contract = createRpcContract(() => from);
const client = createPublicClient({ transport: http(ETH_RPC_URL, { timeout: 30_000 }) });

// Se lee antes de declarar las pruebas para poder saltar las que necesitan jugadores.
const countResult = await contract.playerCount.query();
const players = countResult.success ? BigInt(countResult.value as bigint) : 0n;
const firstPage = players > 0n ? await contract.getScores.query(0n, 50n) : null;
const scores = firstPage?.success ? decodeScores(firstPage.value) : [];
const existingUsername = scores.find((s) => s.username !== '')?.username;
const startedResult = await contract.isStarted.query();
const started = startedResult.success && startedResult.value === true;
const startResult = await contract.startTime.query();
const startTime = startResult.success ? BigInt(startResult.value as bigint) : -1n;

describe('Leaderboard en Products Devnet', () => {
  it('el ETH-RPC es la cadena 420420417', async () => {
    expect(await client.getChainId()).toBe(CHAIN_ID);
  });

  it('hay código desplegado en LEADERBOARD_ADDRESS', async () => {
    const code = await client.getCode({ address: LEADERBOARD_ADDRESS });
    // El tamaño depende de los ajustes de Remix al compilar (optimizador), así que solo se pide que exista.
    expect(code ? (code.length - 2) / 2 : 0).toBeGreaterThan(0);
  });

  it('startTime() e isStarted() responden y cuadran: sin hora de inicio no está abierto', () => {
    expect(startResult.success).toBe(true);
    expect(startedResult.success).toBe(true);
    if (startTime === 0n) expect(started).toBe(false);
    if (started) expect(startTime > 0n).toBe(true);
  });

  it('admin() responde con una dirección distinta de 0x000…', async () => {
    const r = await contract.admin.query();
    expect(r.success).toBe(true);
    expect(String(r.value)).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(BigInt(String(r.value))).not.toBe(0n);
  });

  it('una cuenta que no es admin no puede simular setStartTime ni setAdmin (NotAdmin)', async () => {
    const a = await contract.setStartTime.query(BigInt(Math.floor(Date.now() / 1000) + 86_400));
    expect(a.success).toBe(false);
    expect(revertMessage(a.value)).toBe(NOT_ADMIN_MESSAGE);
    const b = await contract.setAdmin.query(from as `0x${string}`);
    expect(b.success).toBe(false);
    expect(revertMessage(b.value)).toBe(NOT_ADMIN_MESSAGE);
  });

  it('playerCount() responde', () => {
    expect(countResult.success).toBe(true);
    expect(players >= 0n).toBe(true);
  });

  it('currentPeriod() responde', async () => {
    const r = await contract.currentPeriod.query();
    expect(r.success).toBe(true);
    expect(BigInt(r.value as bigint) >= 0n).toBe(true);
  });

  it.skipIf(started || startTime !== 0n)('sin hora de inicio, periodBounds revierte con NotStarted', async () => {
    const r = await contract.periodBounds.query(0n);
    expect(r.success).toBe(false);
    expect(revertMessage(r.value)).toBe(NOT_STARTED_MESSAGE);
  });

  it.skipIf(started)('antes del evento: submitScore revierte con NotStarted y el ranking está vacío', async () => {
    const r = await contract.submitScore.query(1n);
    expect(r.success).toBe(false);
    expect(revertMessage(r.value)).toBe(NOT_STARTED_MESSAGE);
    expect(players).toBe(0n);
    const period = await contract.currentPeriod.query();
    expect(period.success).toBe(true);
    expect(BigInt(period.value as bigint)).toBe(0n);
  });

  it.skipIf(!started)('periodBounds(currentPeriod) contiene la hora actual', async () => {
    const period = await contract.currentPeriod.query();
    expect(period.success).toBe(true);
    const r = await contract.periodBounds.query(BigInt(period.value as bigint));
    expect(r.success).toBe(true);
    const [startsAt, endsAt] = (r.value as [bigint, bigint]).map((v) => Number(v));
    const nowSec = Date.now() / 1000;
    expect(startsAt).toBeLessThanOrEqual(nowSec);
    expect(nowSec).toBeLessThan(endsAt!);
  });

  it.skipIf(players === 0n)('getScores() se decodifica', () => {
    expect(firstPage?.success).toBe(true);
    expect(scores.length).toBe(Number(players < 50n ? players : 50n));
    for (const s of scores) {
      expect(s.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(s.score > 0n).toBe(true);
    }
  });

  it.skipIf(!started)('una cuenta nueva puede simular submitScore(1)', async () => {
    const r = await contract.submitScore.query(1n);
    expect(r.success).toBe(true);
  });

  it.skipIf(!started)('submitScore(0) revierte con ScoreNotHigher', async () => {
    const r = await contract.submitScore.query(0n);
    expect(r.success).toBe(false);
    expect(revertMessage(r.value)).toBe('Ese puntaje no supera tu récord (0).');
  });

  it('setUsername("Ana") revierte con InvalidUsername', async () => {
    const r = await contract.setUsername.query('Ana');
    expect(r.success).toBe(false);
    expect(revertMessage(r.value)).toBe('El username debe tener de 3 a 16 caracteres: a-z, 0-9 o _.');
  });

  it.skipIf(existingUsername === undefined)('un username ya tomado revierte con UsernameTaken', async () => {
    const r = await contract.setUsername.query(existingUsername!);
    expect(r.success).toBe(false);
    expect(revertMessage(r.value)).toBe('Ese username ya es de otro jugador.');
  });

  it('una dirección nueva tiene 0 PGAS', async () => {
    expect(await readPgas(randomAddress())).toBe(0n);
  });
});
