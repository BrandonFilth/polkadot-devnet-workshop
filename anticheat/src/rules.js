// Reglas del anti-trampas, sin red ni Cloudflare (se prueban con node --test). Revisan que cada avance de una
// partida sea posible para el tiempo REAL que pasó según el reloj del Worker. Los números salen de
// game/src/engine/rules.ts y del laberinto (game/src/engine/maze.ts); si cambian allá, se cambian aquí.

/** Del juego: bolitas normales y especiales del laberinto, y sus puntos. */
const ORBS = 146;
const POWER = 4;
const ORB_POINTS = 10;
const POWER_POINTS = 50;
/** Fantasmas comidos con una bolita especial: 200, 400, 800 y 1600 los siguientes (hasta 6 fantasmas). */
const GHOST_CHAIN_TOTAL = 200 + 400 + 800 + 1600 * 3;
export const LIVES = 5;
/** Lo máximo que se puede ganar en una ronda: todas las bolitas y todos los fantasmas de las 4 especiales. */
export const ROUND_MAX_POINTS = ORBS * ORB_POINTS + POWER * (POWER_POINTS + GHOST_CHAIN_TOTAL);
/** Polka-Man avanza 6 casillas/s: comiendo bolitas sin parar son 60 puntos/s. Se da 50 % de margen. */
export const POINTS_PER_SECOND = 90;
/** Puntos de golpe (fantasmas en cadena) que se aceptan además de la tasa, por cada 5 s del tramo (máx. 4). */
export const BURST_POINTS = POWER_POINTS + GHOST_CHAIN_TOTAL;
/** Recorrer las 150 bolitas toma unos 25 s; se acepta una ronda cada 20 s como mínimo. */
export const MIN_ROUND_SECONDS = 20;
/** Igual que MAX_SCORE de LeaderboardV5. */
export const MAX_SCORE = 10_000_000;
/** Una partida dura como mucho 6 h (después ya no se acepta nada). */
export const GAME_TTL_MS = 6 * 3_600_000;

const isInt = (n, max) => Number.isSafeInteger(n) && n >= 0 && n <= max;

/** Valida la forma de un avance. Devuelve el error o null. */
export function badSnapshot(s) {
  if (!s || typeof s !== 'object') return 'datos inválidos';
  if (!isInt(s.score, MAX_SCORE)) return 'puntaje inválido';
  if (!isInt(s.round, 10_000) || s.round < 1) return 'ronda inválida';
  if (!isInt(s.lives, LIVES)) return 'vidas inválidas';
  return null;
}

/** Partida nueva: empieza en 0 puntos, ronda 1 y todas las vidas. */
export function newGame(now) {
  return { startedAt: now, lastAt: now, seq: 0, score: 0, round: 1, lives: LIVES, closed: false, invalid: null };
}

/**
 * Revisa el avance `seq` con `snap` a la hora `now` (ms del Worker). Devuelve { ok: true, game } con la partida
 * actualizada, o { ok: false, error }. Repetir el último avance aceptado (mismo seq y mismos datos) es válido:
 * así el juego puede reintentar si se cortó la red.
 */
export function applyBeat(game, seq, snap, now) {
  if (game.invalid) return { ok: false, error: game.invalid };
  if (game.closed) return { ok: false, error: 'cerrada' };
  if (now - game.startedAt > GAME_TTL_MS) return { ok: false, error: 'partida vencida' };
  const shape = badSnapshot(snap);
  if (shape) return { ok: false, error: shape };
  if (seq === game.seq && seq > 0 && snap.score === game.score && snap.round === game.round && snap.lives === game.lives) {
    return { ok: true, game, repeated: true };
  }
  if (seq !== game.seq + 1) return { ok: false, error: 'avance fuera de orden' };
  if (snap.score < game.score) return { ok: false, error: 'el puntaje bajó' };
  if (snap.round < game.round) return { ok: false, error: 'la ronda bajó' };
  if (snap.lives > game.lives) return { ok: false, error: 'las vidas subieron' };

  const seconds = Math.max(0, now - game.lastAt) / 1000;
  const sinceStart = Math.max(0, now - game.startedAt) / 1000;
  if (snap.round > 1 + Math.floor(sinceStart / MIN_ROUND_SECONDS)) return { ok: false, error: 'rondas demasiado rápidas' };
  const gained = snap.score - game.score;
  const bursts = Math.min(4, 1 + Math.floor(seconds / 5));
  const allowed = Math.ceil(POINTS_PER_SECOND * seconds) + BURST_POINTS * bursts;
  if (gained > allowed) return { ok: false, error: `subió ${gained} puntos en ${seconds.toFixed(1)} s (máximo ${allowed})` };
  if (snap.score > ROUND_MAX_POINTS * snap.round) return { ok: false, error: 'más puntos de los que dan esas rondas' };

  return { ok: true, game: { ...game, seq, score: snap.score, round: snap.round, lives: snap.lives, lastAt: now } };
}
