/*
 * Premios del evento (Leaderboard.sol: PRIZE_ROUNDS, PRIZE_PLACES, prizeAmount, prizesOf).
 * Funciones puras, sin DOM. La ronda N es el periodo N-1 del ranking.
 */
import { getAddress, isAddress } from 'viem';
import { PRIZE_TX_URL } from './config';

/** Rondas con premio. */
export const PRIZE_ROUNDS = 6;
/** USDT por lugar: 1.º, 2.º y 3.º (igual que prizeAmount del contrato). */
export const PRIZE_AMOUNTS = [8, 5, 3] as const;
/** USDT que se reparten por ronda y en todo el evento. */
export const PRIZE_PER_ROUND = PRIZE_AMOUNTS.reduce((a, b) => a + b, 0);
export const PRIZE_TOTAL = PRIZE_PER_ROUND * PRIZE_ROUNDS;

/** Dirección vacía (0x000…): «sin wallet» en el contrato. */
export const ZERO_ADDRESS = `0x${'0'.repeat(40)}` as const;
const ZERO = ZERO_ADDRESS;
const ZERO_HASH = `0x${'0'.repeat(64)}`;

/** Ronda (1 a 6) de un periodo del ranking, o null si ese periodo ya no tiene premio. */
export function roundOfPeriod(period: number): number | null {
  const round = period + 1;
  return round >= 1 && round <= PRIZE_ROUNDS ? round : null;
}

/** Periodo del ranking de una ronda. */
export const periodOfRound = (round: number): number => round - 1;

/** «1.º», «2.º», «3.º». */
export const placeLabel = (place: number): string => `${place}.º`;

/** «$8» (solo el monto) o «$8 USDT» (con la moneda). */
export const usd = (amount: number, unit = true): string => (unit ? `$${amount} USDT` : `$${amount}`);

/** Monto en USDT de un lugar (1 a 3). */
export function prizeAmountOf(place: number): number {
  const amount = PRIZE_AMOUNTS[place - 1];
  if (amount === undefined) throw new RangeError(`Lugar sin premio: ${place}`);
  return amount;
}

export type WalletInput = { ok: true; wallet: `0x${string}` } | { ok: false; message: string };

export const WALLET_EMPTY = 'Pega la dirección de tu wallet.';
export const WALLET_INVALID = 'Esa no parece una dirección de wallet. Empieza con 0x y tiene 42 caracteres.';

/**
 * Lo que el jugador pega como wallet de premios → dirección EVM con checksum. Acepta mayúsculas o
 * minúsculas (Binance las muestra en minúsculas) y quita espacios.
 */
export function parseWallet(text: string): WalletInput {
  const raw = text.trim();
  if (raw === '') return { ok: false, message: WALLET_EMPTY };
  const lower = raw.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(lower) || !isAddress(lower)) return { ok: false, message: WALLET_INVALID };
  if (lower === ZERO) return { ok: false, message: WALLET_INVALID };
  return { ok: true, wallet: getAddress(lower) };
}

/** 0x000… (sin wallet) → null. */
export const walletOrNull = (value: unknown): `0x${string}` | null => {
  const s = typeof value === 'string' ? value : '';
  return /^0x[0-9a-fA-F]{40}$/.test(s) && s.toLowerCase() !== ZERO ? getAddress(s.toLowerCase()) : null;
};

/** Hash de una transacción a partir del hash o de un enlace del explorador (…/tx/0x…). null si no hay. */
export function parseTxHash(text: string): `0x${string}` | null {
  const m = /0x[0-9a-fA-F]{64}(?![0-9a-fA-F])/.exec(text.trim());
  if (!m) return null;
  const hash = m[0].toLowerCase();
  return hash === ZERO_HASH ? null : (hash as `0x${string}`);
}

/** Enlace del explorador para un pago. */
export const txUrl = (hash: string): string => `${PRIZE_TX_URL}${hash}`;

export interface PrizeRecord {
  place: number;
  amount: number;
  player: `0x${string}`;
  wallet: `0x${string}`;
  txHash: `0x${string}`;
  paidAt: number;
}

const field = (v: unknown, name: string, index: number): unknown => {
  if (Array.isArray(v)) return v[index];
  if (typeof v === 'object' && v !== null) return (v as Record<string, unknown>)[name];
  return undefined;
};

/**
 * Decodifica prizesOf(round): lista de 3 premios (tuplas o objetos {player, wallet, txHash, paidAt}).
 * Devuelve solo los lugares ya pagados (player distinto de 0x000…).
 */
export function decodePrizes(value: unknown): PrizeRecord[] {
  const list = Array.isArray(value) ? value : [];
  const out: PrizeRecord[] = [];
  list.forEach((p, i) => {
    const player = walletOrNull(field(p, 'player', 0));
    const wallet = walletOrNull(field(p, 'wallet', 1));
    const hash = String(field(p, 'txHash', 2) ?? '');
    if (!player || !wallet || parseTxHash(hash) === null) return;
    const paidAt = Number(BigInt((field(p, 'paidAt', 3) as bigint | number | string | undefined) ?? 0));
    out.push({ place: i + 1, amount: prizeAmountOf(i + 1), player, wallet, txHash: hash.toLowerCase() as `0x${string}`, paidAt });
  });
  return out;
}

/** Estado de la ronda para la pantalla Premios. */
export type RoundStatus = 'por-jugar' | 'en-juego' | 'por-pagar' | 'pagada';

export function roundStatus(round: number, i: { started: boolean; currentPeriod: number; paid: number }): RoundStatus {
  if (i.paid >= PRIZE_AMOUNTS.length) return 'pagada';
  if (!i.started) return 'por-jugar';
  const period = periodOfRound(round);
  if (period > i.currentPeriod) return 'por-jugar';
  if (period === i.currentPeriod) return 'en-juego';
  return 'por-pagar';
}

export const ROUND_STATUS_TEXT: Record<RoundStatus, string> = {
  'por-jugar': 'Por jugar',
  'en-juego': 'En juego',
  'por-pagar': 'Premios en camino',
  pagada: 'Pagada',
};

/** Una fila del panel de ganadores del admin. */
export interface WinnerRow {
  place: number;
  amount: number;
  player: `0x${string}`;
  username: string;
  score: bigint;
  wallet: `0x${string}` | null;
  paid: PrizeRecord | null;
  /** Qué puede hacer el admin con esta fila. */
  action: 'registrar' | 'sin-wallet' | 'pagado';
}

/**
 * Ganadores de una ronda para el admin: los 3 primeros del periodo (ya ordenados de mayor a menor; en
 * empate, quien llegó primero) con su wallet actual y el pago, si ya se registró.
 */
export function winnersOf(
  top: ReadonlyArray<{ address: `0x${string}`; username: string; score: bigint; wallet?: `0x${string}` | null }>,
  paid: readonly PrizeRecord[],
): WinnerRow[] {
  return top.slice(0, PRIZE_AMOUNTS.length).map((row, i) => {
    const place = i + 1;
    const record = paid.find((p) => p.place === place) ?? null;
    const wallet = row.wallet ?? null;
    const action = record ? 'pagado' : wallet ? 'registrar' : 'sin-wallet';
    return { place, amount: prizeAmountOf(place), player: row.address, username: row.username, score: row.score, wallet, paid: record, action };
  });
}
