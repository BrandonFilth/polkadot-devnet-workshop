import { decodeErrorResult, toFunctionSelector, type Abi, type Hex } from 'viem';
import { leaderboardAbi } from './leaderboard';

/** Errores de Leaderboard.sol con la firma completa (la que da el selector de 4 bytes). */
const SIGNATURES = {
  ScoreNotHigher: 'ScoreNotHigher(uint256,uint256)',
  InvalidUsername: 'InvalidUsername()',
  UsernameTaken: 'UsernameTaken()',
} as const;

type ErrorName = keyof typeof SIGNATURES;

export const INVALID_USERNAME_MESSAGE = 'El username debe tener de 3 a 16 caracteres: a-z, 0-9 o _.';

function message(name: ErrorName, args: readonly unknown[] | undefined): string {
  if (name === 'ScoreNotHigher') {
    const current = args?.[0];
    const known = typeof current === 'bigint' || typeof current === 'number' || (typeof current === 'string' && current !== '');
    return known ? `Ese puntaje no supera tu récord (${String(current)}).` : 'Ese puntaje no supera tu récord.';
  }
  if (name === 'InvalidUsername') return INVALID_USERNAME_MESSAGE;
  return 'Ese username ya es de otro jugador.';
}

const NAMES = Object.keys(SIGNATURES) as ErrorName[];
const BY_SELECTOR = new Map(NAMES.map((name) => [toFunctionSelector(SIGNATURES[name]).toLowerCase(), name]));
const isName = (value: unknown): value is ErrorName => typeof value === 'string' && value in SIGNATURES;

function serialise(value: unknown): string {
  try {
    return JSON.stringify(value, (_k, v) => {
      if (typeof v === 'bigint') return v.toString();
      if (v instanceof Uint8Array) return `0x${Array.from(v, (b) => b.toString(16).padStart(2, '0')).join('')}`;
      return v;
    }) ?? '';
  } catch {
    return String(value);
  }
}

/** Intenta decodificar los argumentos del error a partir de los datos crudos del revert. */
function decodeArgs(data: string): readonly unknown[] | undefined {
  try {
    return decodeErrorResult({ abi: leaderboardAbi as unknown as Abi, data: data as Hex }).args;
  } catch {
    return undefined;
  }
}

/**
 * Mensaje en español para un revert de Leaderboard, o null si no se reconoce (quien llama usa su
 * mensaje genérico). Acepta tres formas:
 *  1. `{ error: 'ScoreNotHigher', args }` (rpcReader con viem);
 *  2. cualquier valor que contenga los datos del revert (`0x` + selector de 4 bytes…), como el SDK;
 *  3. cualquier valor cuyo JSON contenga el nombre del error.
 */
export function revertMessage(value: unknown): string | null {
  if (typeof value === 'object' && value !== null) {
    const v = value as { error?: unknown; args?: unknown };
    if (isName(v.error)) return message(v.error, Array.isArray(v.args) ? v.args : undefined);
  }
  const text = serialise(value);
  for (const match of text.toLowerCase().matchAll(/0x[0-9a-f]{8,}/g)) {
    const name = BY_SELECTOR.get(match[0].slice(0, 10));
    if (name) return message(name, decodeArgs(match[0]));
  }
  for (const name of NAMES) {
    if (text.includes(name)) return message(name, undefined);
  }
  return null;
}
