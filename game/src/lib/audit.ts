// Auditoría del top 3 antes de pagar premios: por cada jugador busca, en el historial del Worker, la partida
// firmada con el mismo puntaje que tiene en el contrato y la vuelve a jugar con su semilla y su grabación
// (engine/replay.ts). Si el motor no llega a ese puntaje con esas teclas, la partida no se jugó así.
// Lógica pura (sin red): la usa auditoria/top3.audit.ts, que lee el contrato y llama a /audit.
import { parseInputs, replayGame } from '../engine/replay';

/** Una partida del historial que devuelve /audit del Worker. */
export interface AuditGame {
  gameId: string;
  /** Puntaje firmado. */
  score: number;
  seed: number;
  seedSource: string;
  ticks: number;
  closed: boolean;
  invalid: string | null;
  durationMs: number | null;
  finishedAt: number | null;
  inputs: unknown;
}

export type Verdict = 'OK' | 'FALLA';

export interface AuditResult {
  verdict: Verdict;
  /** Explicación en una línea. */
  detail: string;
  gameId: string | null;
  replayedScore: number | null;
  seedSource: string | null;
  durationMs: number | null;
  inputs: number;
}

/** Pasos de más que se dejan correr al volver a jugar (por si el fin llega un poco después). */
const EXTRA_TICKS = 600;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Valida la respuesta de /audit. Descarta lo que no tenga la forma esperada. */
export function parseAuditGames(value: unknown): AuditGame[] {
  if (typeof value !== 'object' || value === null) return [];
  const games = (value as { games?: unknown }).games;
  if (!Array.isArray(games)) return [];
  const out: AuditGame[] = [];
  for (const g of games) {
    if (typeof g !== 'object' || g === null) continue;
    const r = g as Record<string, unknown>;
    const score = num(r.score);
    const seed = num(r.seed);
    const ticks = num(r.ticks);
    if (typeof r.gameId !== 'string' || score === null || seed === null || ticks === null) continue;
    out.push({
      gameId: r.gameId,
      score,
      seed,
      seedSource: typeof r.seedSource === 'string' ? r.seedSource : '?',
      ticks,
      closed: r.closed === true,
      invalid: typeof r.invalid === 'string' ? r.invalid : null,
      durationMs: num(r.durationMs),
      finishedAt: num(r.finishedAt),
      inputs: r.inputs,
    });
  }
  return out;
}

/** Vuelve a jugar una partida y dice si da el puntaje firmado. */
export function auditGame(game: AuditGame): AuditResult {
  const base = { gameId: game.gameId, seedSource: game.seedSource, durationMs: game.durationMs };
  let inputs;
  try {
    inputs = parseInputs(game.inputs);
  } catch (e) {
    return { ...base, verdict: 'FALLA', detail: `grabación inválida: ${e instanceof Error ? e.message : e}`, replayedScore: null, inputs: 0 };
  }
  const r = replayGame(game.seed, inputs, game.ticks + EXTRA_TICKS);
  const ok = r.phase === 'fin' && r.score === game.score;
  const detail = ok
    ? `la grabación da ${r.score} puntos en ${r.ticks} pasos`
    : `la grabación da ${r.score} puntos (firmado: ${game.score}), fase «${r.phase}», ${r.ticks} pasos (Worker: ${game.ticks})`;
  return { ...base, verdict: ok ? 'OK' : 'FALLA', detail, replayedScore: r.score, inputs: inputs.length };
}

/**
 * Audita a un jugador con su puntaje del contrato: prueba las partidas cerradas con ese puntaje (la más
 * reciente primero) y basta con que una pase.
 */
export function auditPlayer(onChainScore: number, games: readonly AuditGame[]): AuditResult {
  const candidates = games
    .filter((g) => g.closed && !g.invalid && g.score === onChainScore)
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));
  if (candidates.length === 0) {
    return {
      verdict: 'FALLA',
      detail: `ninguna partida firmada de ${onChainScore} puntos en el Worker (${games.length} en su historial)`,
      gameId: null,
      replayedScore: null,
      seedSource: null,
      durationMs: null,
      inputs: 0,
    };
  }
  let first: AuditResult | null = null;
  for (const g of candidates) {
    const r = auditGame(g);
    if (r.verdict === 'OK') return r;
    first ??= r;
  }
  return first!;
}

const minutes = (ms: number | null) => (ms === null ? '?' : `${(ms / 60_000).toFixed(1)} min`);

/** Una línea del reporte. */
export function reportLine(place: number, who: { address: string; username: string; score: bigint }, r: AuditResult): string {
  const name = who.username ? `${who.username} (${who.address})` : who.address;
  const extra = r.gameId
    ? ` | partida ${r.gameId.slice(0, 10)}…, ${minutes(r.durationMs)}, ${r.inputs} pedidos, semilla del ${r.seedSource === 'worker' ? 'Worker' : r.seedSource}`
    : '';
  return `${place}. ${r.verdict} ${name}: ${who.score} puntos. ${r.detail}${extra}`;
}
