// Reglas del anti-trampas, sin red ni Cloudflare (se prueban con node --test). Cada avance trae lo que se ve
// de la partida (puntos, ronda, vidas, bolitas que quedan y pasos de simulación) y se revisa que sea posible
// para el tiempo REAL que pasó según el reloj del Worker. Con esto, inventar avances solo da, como mucho, lo
// de una partida casi perfecta; la auditoría del top 3 (game/auditoria/) vuelve a jugar la partida completa.
// Los números salen de game/src/engine/rules.ts y del laberinto; si cambian allá, se cambian aquí.

/** Del laberinto: bolitas normales y especiales por ronda. */
export const ORBS = 146;
export const POWER = 4;
const ORB_POINTS = 10;
const POWER_POINTS = 50;
/** Puntos por los fantasmas de una bolita especial: 200, 400, 800 y 1600 cada uno de los siguientes (6 fantasmas). */
export const GHOST_CHAIN_MAX = 200 + 400 + 800 + 1600 * 3;
export const LIVES = 5;
/** Pasos de simulación por segundo (DT = 1/120 en el juego). */
export const TICKS_PER_SECOND = 120;
/** Casillas por segundo de Polka-Man (PLAYER_SPEED): come como mucho una bolita por casilla. */
export const TILES_PER_SECOND = 6;
/** Margen del reloj: la simulación no corre más rápido que el tiempo real (5 % y 2 s por la red). */
const CLOCK_SLACK = 1.05;
const CLOCK_SLACK_TICKS = 2 * TICKS_PER_SECOND;
/** Igual que MAX_SCORE de LeaderboardV5. */
export const MAX_SCORE = 10_000_000;
/** Una partida dura como mucho 6 h. */
export const GAME_TTL_MS = 6 * 3_600_000;
/** Una partida preparada (semilla pedida antes de jugar) tiene 10 min para empezar. */
export const PREPARED_TTL_MS = 10 * 60_000;
/** Pedidos de dirección por avance y por partida. */
export const MAX_INPUTS_PER_BEAT = 5_000;
export const MAX_INPUTS_PER_GAME = 200_000;

const DIRS = ['arriba', 'abajo', 'izquierda', 'derecha'];
const isInt = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;

/** Valida la forma de un avance. Devuelve el error o null. */
export function badSnapshot(s) {
  if (!s || typeof s !== 'object') return 'datos inválidos';
  if (!isInt(s.score, 0, MAX_SCORE)) return 'puntaje inválido';
  if (!isInt(s.round, 1, 10_000)) return 'ronda inválida';
  if (!isInt(s.lives, 0, LIVES)) return 'vidas inválidas';
  if (!isInt(s.orbsLeft, 0, ORBS)) return 'bolitas inválidas';
  if (!isInt(s.powerLeft, 0, POWER)) return 'bolitas especiales inválidas';
  if (!isInt(s.tick, 0, 1e9)) return 'pasos inválidos';
  if (!Array.isArray(s.inputs) || s.inputs.length > MAX_INPUTS_PER_BEAT) return 'pedidos inválidos';
  let last = -1;
  for (const e of s.inputs) {
    if (!Array.isArray(e) || e.length !== 3) return 'pedido mal formado';
    const [t, p, q] = e;
    if (!isInt(t, 0, s.tick) || t < last) return 'pedido fuera de orden';
    last = t;
    if (p === 'soltar' ? q !== null : !DIRS.includes(p) || (q !== null && !DIRS.includes(q))) return 'pedido inválido';
  }
  return null;
}

/** Totales de la partida que se deducen del avance. */
export function totals(s) {
  const orbs = ORBS * (s.round - 1) + (ORBS - s.orbsLeft);
  const power = POWER * (s.round - 1) + (POWER - s.powerLeft);
  return { orbs, power, ghosts: s.score - ORB_POINTS * orbs - POWER_POINTS * power };
}

/** Partida nueva con su semilla. `seedSource`: 'worker' (la dio el Worker) o 'cliente'. */
export function newGame(now, seed, seedSource) {
  return {
    startedAt: now,
    seed,
    seedSource,
    seq: 0,
    score: 0,
    round: 1,
    lives: LIVES,
    tick: 0,
    orbs: 0,
    power: 0,
    ghosts: 0,
    inputs: 0,
    closed: false,
    invalid: null,
  };
}

const same = (g, s) => s.score === g.score && s.round === g.round && s.lives === g.lives && s.tick === g.tick;

/**
 * Revisa el avance `seq` con `snap` a la hora `now` (ms del Worker). Devuelve { ok: true, game } con la partida
 * actualizada, o { ok: false, error }. Repetir el último avance aceptado (mismo seq y mismos datos) es válido:
 * así el juego puede reintentar si se cortó la red.
 */
export function applyBeat(game, seq, snap, now) {
  if (game.invalid) return { ok: false, error: game.invalid };
  // Repetir el último avance (también el de fin) es un reintento por la red: se acepta igual.
  if (seq === game.seq && seq > 0 && snap && same(game, snap)) return { ok: true, game, repeated: true };
  if (game.closed) return { ok: false, error: 'cerrada' };
  if (now - game.startedAt > GAME_TTL_MS) return { ok: false, error: 'partida vencida' };
  if (game.seq === 0 && now - game.startedAt > PREPARED_TTL_MS) return { ok: false, error: 'partida vencida' };
  const shape = badSnapshot(snap);
  if (shape) return { ok: false, error: shape };
  if (seq !== game.seq + 1) return { ok: false, error: 'avance fuera de orden' };
  if (game.inputs + snap.inputs.length > MAX_INPUTS_PER_GAME) return { ok: false, error: 'demasiados pedidos' };

  if (snap.score < game.score) return { ok: false, error: 'el puntaje bajó' };
  if (snap.round < game.round) return { ok: false, error: 'la ronda bajó' };
  if (snap.lives > game.lives) return { ok: false, error: 'las vidas subieron' };
  if (snap.tick < game.tick) return { ok: false, error: 'los pasos bajaron' };

  // La simulación no puede ir más rápido que el reloj del Worker. Se cuenta desde el inicio (no desde el
  // avance anterior) para que, tras un corte de red, los avances atrasados que llegan juntos sigan valiendo.
  const realSeconds = Math.max(0, now - game.startedAt) / 1000;
  const ticks = snap.tick - game.tick;
  if (snap.tick > realSeconds * TICKS_PER_SECOND * CLOCK_SLACK + CLOCK_SLACK_TICKS) {
    return { ok: false, error: `${snap.tick} pasos en ${realSeconds.toFixed(1)} s` };
  }

  // Bolitas: totales que no bajan y como mucho una por casilla recorrida.
  const t = totals(snap);
  if (t.orbs < game.orbs || t.power < game.power) return { ok: false, error: 'bolitas que vuelven' };
  const tiles = (ticks / TICKS_PER_SECOND) * TILES_PER_SECOND;
  if (t.orbs - game.orbs + (t.power - game.power) > tiles + 2) return { ok: false, error: 'bolitas demasiado rápido' };

  // Fantasmas: los puntos que sobran solo salen de cadenas de fantasmas tras una bolita especial.
  if (t.ghosts < game.ghosts || t.ghosts % 200 !== 0) return { ok: false, error: 'puntos que no cuadran' };
  if (t.ghosts > GHOST_CHAIN_MAX * t.power) return { ok: false, error: 'más fantasmas de los posibles' };
  if (t.ghosts - game.ghosts > GHOST_CHAIN_MAX * (t.power - game.power + 1)) return { ok: false, error: 'demasiados fantasmas de golpe' };

  return {
    ok: true,
    game: {
      ...game,
      seq,
      score: snap.score,
      round: snap.round,
      lives: snap.lives,
      tick: snap.tick,
      orbs: t.orbs,
      power: t.power,
      ghosts: t.ghosts,
      inputs: game.inputs + snap.inputs.length,
    },
  };
}
