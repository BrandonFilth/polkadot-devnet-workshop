// Única fuente de los números del juego (design §4.3, tabla normativa).
// Cada etapa agrega aquí sus constantes, con estos nombres exactos.

/** Columnas y filas del laberinto. */
export const MAZE_WIDTH = 19;
export const MAZE_HEIGHT = 21;

/** Vidas al empezar una partida. */
export const LIVES = 5;

/** Paso fijo de la simulación, en segundos. */
export const DT = 1 / 120;

/** Máximo de tiempo real que se simula en un cuadro (pestaña dormida). */
export const MAX_FRAME_SECONDS = 0.25;

/** Velocidad de Polka-Man en casillas por segundo. */
export const PLAYER_SPEED = 6.0;

/** Duración de la fase «LISTO», en segundos. */
export const READY_SECONDS = 1.5;

/** Puntos por orbe normal. */
export const ORB_POINTS = 10;

/** Puntos por orbe especial. */
export const POWER_POINTS = 50;

/** Duración de la fase «RONDA N» al vaciar el laberinto, en segundos. */
export const ROUND_CLEAR_SECONDS = 1.5;

/** Distancia mínima en px CSS para que un deslizamiento cuente como dirección. */
export const SWIPE_THRESHOLD_PX = 24;

/** Velocidad base de los fantasmas en casillas por segundo. */
export const GHOST_BASE_SPEED = 4.0;

/** Distancia entre centros, en casillas, por debajo de la cual hay choque. */
export const HITBOX = 0.6;

/** Segundos entre la salida de un fantasma y la del siguiente. */
export const RELEASE_INTERVAL = 3;

/** Duración de la fase «muriendo», en segundos. */
export const DEATH_SECONDS = 1.2;

/** Muestras de la casilla de Polka-Man que guarda Lag. */
export const LAG_SAMPLES = 8;

/** Segundos entre dos muestras de Lag. */
export const LAG_SAMPLE_SECONDS = 0.25;

/** Casillas por delante de Polka-Man que apunta Fork. */
export const FORK_AHEAD = 4;

/** Si Polka-Man está a esta distancia o menos, Gas se va a su esquina. */
export const GAS_RADIUS = 6;

/** Si Polka-Man está a esta distancia o menos, Nonce lo persigue. */
export const NONCE_RADIUS = 5;

/** Fantasmas en la ronda 1. */
export const GHOST_START = 2;

/** Multiplicador de la velocidad de los fantasmas en cada ronda. */
export const GHOST_SPEED_GROWTH = 1.05;

/** Velocidad máxima de los fantasmas, en casillas por segundo. */
export const GHOST_SPEED_CAP = 5.7;

/** Máximo de fantasmas en el tablero. */
export const GHOST_MAX = 6;

/** Cada cuántas rondas sale un fantasma más. */
export const GHOST_EVERY_ROUNDS = 3;

/** Fracción de la velocidad normal de un fantasma asustado. */
export const FRIGHT_SPEED_FACTOR = 0.5;

/** Velocidad de los ojos (fantasma comido) en casillas por segundo. */
export const EYES_SPEED = 12.0;

/** Segundos de susto en la ronda 1. */
export const FRIGHT_BASE_SECONDS = 6;

/** Segundos de susto que se pierden en cada ronda. */
export const FRIGHT_STEP_SECONDS = 0.5;

/** Mínimo de segundos de susto. */
export const FRIGHT_MIN_SECONDS = 2;

/** En los últimos segundos del susto los fantasmas parpadean. */
export const FRIGHT_BLINK_SECONDS = 1.5;

/** Segundos entre dos cambios de color del parpadeo. */
export const FRIGHT_BLINK_PERIOD = 0.2;

/** Puntos por cada fantasma comido en un mismo susto, en orden. */
export const GHOST_CHAIN_POINTS: readonly number[] = [200, 400, 800, 1600];

/** Fantasmas en la ronda `round`. */
export function ghostCount(round: number): number {
  return Math.min(GHOST_MAX, GHOST_START + Math.floor((round - 1) / GHOST_EVERY_ROUNDS));
}

/** Velocidad de los fantasmas en la ronda `round`, en casillas por segundo. */
export function ghostSpeed(round: number): number {
  return Math.min(GHOST_SPEED_CAP, GHOST_BASE_SPEED * GHOST_SPEED_GROWTH ** (round - 1));
}

/** Segundos de susto en la ronda `round`. */
export function frightenedSeconds(round: number): number {
  return Math.max(FRIGHT_MIN_SECONDS, FRIGHT_BASE_SECONDS - FRIGHT_STEP_SECONDS * (round - 1));
}
