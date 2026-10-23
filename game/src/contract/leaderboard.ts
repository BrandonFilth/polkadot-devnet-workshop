import type { AbiEntry } from '@parity/product-sdk/contracts';
import abiJson from './leaderboard.abi.json';

/** Generada con `pnpm --dir contrato abi` desde contrato/Leaderboard.sol. No se edita a mano. */
export const leaderboardAbi = abiJson as AbiEntry[];

type Hex = `0x${string}`;
type Num = number | bigint;

export type QueryResult<T> = { success: true; value: T } | { success: false; value: unknown };

/** `origin`: cuenta SS58 para el Host. `from`: la misma cuenta en H160 para el ETH-RPC. */
export type ReadOptions = { origin?: string; from?: string; at?: 'best' | 'finalized' };

export type TxOptions = {
  waitFor?: 'best-block' | 'finalized';
  timeoutMs?: number;
  onStatus?: (status: unknown) => void;
};

export type TxResult = { txHash?: string; block?: { number?: number; hash?: string } };

type Read<Args extends unknown[], T> = {
  query: (...args: [...Args, ReadOptions?]) => Promise<QueryResult<T>>;
};

type Write<Args extends unknown[]> = Read<Args, unknown> & {
  tx: (...args: [...Args, TxOptions?]) => Promise<{ ok: true; value: TxResult } | { ok: false; error: unknown }>;
};

/** Las 7 funciones de Leaderboard.sol, tipadas a mano porque la ABI se carga como JSON. */
export interface LeaderboardContract {
  bestScore: Read<[Hex], Num>;
  usernameOf: Read<[Hex], string>;
  playerOf: Read<[string], Hex>;
  playerCount: Read<[], Num>;
  getScores: Read<[bigint, bigint], unknown>;
  submitScore: Write<[bigint]>;
  setUsername: Write<[string]>;
}

export interface ScoreEntry {
  address: Hex;
  username: string;
  score: bigint;
}

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/**
 * Decodifica `getScores()`. viem lo devuelve como tupla `[addrs, usernames, scores]` y el SDK
 * puede devolverlo como objeto con esas claves; se aceptan las dos formas.
 */
export function decodeScores(value: unknown): ScoreEntry[] {
  let addrs: unknown[] = [];
  let usernames: unknown[] = [];
  let scores: unknown[] = [];
  if (Array.isArray(value)) {
    [addrs, usernames, scores] = [list(value[0]), list(value[1]), list(value[2])];
  } else if (typeof value === 'object' && value !== null) {
    const v = value as Record<string, unknown>;
    [addrs, usernames, scores] = [list(v.addrs), list(v.usernames), list(v.scores)];
  }
  return addrs.map((address, i) => ({
    address: String(address) as Hex,
    username: usernames[i] === undefined || usernames[i] === null ? '' : String(usernames[i]),
    score: BigInt((scores[i] as Num | string | undefined) ?? 0),
  }));
}

/**
 * Puntaje del motor → argumento `uint256`. Solo enteros > 0 y seguros; otro valor es un error de
 * programación (el motor solo produce enteros ≥ 0 y el 0 se filtra antes).
 */
export function toScoreArg(score: number): bigint {
  if (!Number.isInteger(score) || score <= 0 || score > Number.MAX_SAFE_INTEGER) {
    throw new RangeError(`Puntaje no válido para el contrato: ${score}`);
  }
  return BigInt(score);
}
