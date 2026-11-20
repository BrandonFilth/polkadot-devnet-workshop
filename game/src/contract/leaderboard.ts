import type { AbiEntry } from '@parity/product-sdk/contracts';
import abiJson from './leaderboard.abi.json';

/** Generada con `pnpm --dir contrato abi` desde contrato/LeaderboardV5.sol. No se edita a mano. */
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

/** Las funciones de LeaderboardV5.sol, tipadas a mano porque la ABI se carga como JSON. */
export interface LeaderboardContract {
  bestScore: Read<[Hex], Num>;
  lifetimeBest: Read<[Hex], Num>;
  scoreOf: Read<[bigint, Hex], Num>;
  usernameOf: Read<[Hex], string>;
  playerOf: Read<[string], Hex>;
  playerCount: Read<[], Num>;
  playerCountIn: Read<[bigint], Num>;
  currentPeriod: Read<[], Num>;
  startTime: Read<[], Num>;
  PERIOD_LENGTH: Read<[], Num>;
  periodBounds: Read<[bigint], unknown>;
  getScores: Read<[bigint, bigint], unknown>;
  getScoresIn: Read<[bigint, bigint, bigint], unknown>;
  admin: Read<[], Hex>;
  isStarted: Read<[], boolean>;
  payoutOf: Read<[Hex], Hex>;
  payoutsOf: Read<[readonly Hex[]], unknown>;
  prizesOf: Read<[bigint], unknown>;
  prizeAmount: Read<[bigint], Num>;
  setPayoutWallet: Write<[Hex]>;
  recordPrize: Write<[bigint, bigint, Hex, Hex]>;
  submitScore: Write<[bigint, Hex, bigint, Hex]>;
  setUsername: Write<[string]>;
  setStartTime: Write<[bigint]>;
  setAdmin: Write<[Hex]>;
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

/** Puntaje validado por el Worker anti-trampas: lo que pide submitScore de LeaderboardV5. */
export interface ScoreProof {
  score: number;
  gameId: Hex;
  /** Segundos Unix: después de esta hora la firma ya no vale. */
  deadline: number;
  signature: Hex;
}

const HEX32 = /^0x[0-9a-f]{64}$/i;
const SIG = /^0x[0-9a-f]{130}$/i;

/** Valida la respuesta de /finish del Worker. null si falta algo o el puntaje no coincide. */
export function parseProof(value: unknown, score: number): ScoreProof | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.ok !== true || v.score !== score) return null;
  if (typeof v.gameId !== 'string' || !HEX32.test(v.gameId)) return null;
  if (typeof v.signature !== 'string' || !SIG.test(v.signature)) return null;
  if (!Number.isSafeInteger(v.deadline) || (v.deadline as number) <= 0) return null;
  return { score, gameId: v.gameId as Hex, deadline: v.deadline as number, signature: v.signature as Hex };
}

/** Argumentos de submitScore para una prueba. */
export function proofArgs(p: ScoreProof): [bigint, Hex, bigint, Hex] {
  return [toScoreArg(p.score), p.gameId, BigInt(p.deadline), p.signature];
}
