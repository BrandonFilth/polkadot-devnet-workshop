// Prueba de integración contra el devnet real (proyecto `red`: `pnpm test:red`). Solo lecturas y
// simulaciones con el rpcReader del juego: sin llaves ni firmas.
import { bytesToHex, createPublicClient, http } from 'viem';
import { describe, expect, it } from 'vitest';
import { CHAIN_ID, ETH_RPC_URL, LEADERBOARD_ADDRESS } from './config';
import { revertMessage } from './errors';
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

describe('Leaderboard en Products Devnet', () => {
  it('el ETH-RPC es la cadena 420420417', async () => {
    expect(await client.getChainId()).toBe(CHAIN_ID);
  });

  it('hay código desplegado del tamaño del contrato compilado (5,686 bytes)', async () => {
    const code = await client.getCode({ address: LEADERBOARD_ADDRESS });
    // El runtime de Leaderboard.sol (solc 0.8.28, sin optimizador) mide 5,686 bytes; la metadata
    // puede cambiar pero no su tamaño.
    expect(code ? (code.length - 2) / 2 : 0).toBe(5_686);
  });

  it('playerCount() responde', () => {
    expect(countResult.success).toBe(true);
    expect(players >= 0n).toBe(true);
  });

  it.skipIf(players === 0n)('getScores() se decodifica', () => {
    expect(firstPage?.success).toBe(true);
    expect(scores.length).toBe(Number(players < 50n ? players : 50n));
    for (const s of scores) {
      expect(s.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(s.score > 0n).toBe(true);
    }
  });

  it('una cuenta nueva puede simular submitScore(1)', async () => {
    const r = await contract.submitScore.query(1n);
    expect(r.success).toBe(true);
  });

  it('submitScore(0) revierte con ScoreNotHigher', async () => {
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
