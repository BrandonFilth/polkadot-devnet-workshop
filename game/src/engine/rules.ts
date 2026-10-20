// Única fuente de los números del juego (design §4.3, tabla normativa).

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

/* ------------------------------------------------ pantalla y controles */

/** Casillas del anillo exterior de pared que no se dibujan en cada lado (solo dibujo; el laberinto no cambia). */
export const VIEW_CROP_TILES = 0.5;

/** Tamaño mínimo de casilla, en px CSS. */
export const MIN_TILE_PX = 8;

/** Alto de la barra superior (HUD + menú), en px CSS. */
export const HUD_HEIGHT_PX = 44;

/** Alto de la zona de controles táctiles (joystick y pausa), en px CSS. */
export const CONTROLS_HEIGHT_PX = 132;

/** Radio de la base del joystick, en px CSS. */
export const JOYSTICK_RADIUS_PX = 56;

/** Radio de la perilla del joystick, en px CSS. */
export const JOYSTICK_KNOB_RADIUS_PX = 26;

/** Zona muerta del joystick, como fracción del radio: más cerca del centro no cambia la dirección. */
export const JOYSTICK_DEAD_ZONE = 0.3;

/**
 * Media anchura, en grados, del sector diagonal del joystick (y del swipe) alrededor de cada 45°.
 * 32.5 → diagonal de 12.5° a 77.5° desde el eje horizontal; recto = ±12.5° alrededor de cada eje.
 * Con ±22.5 los 75° caerían en «arriba» puro y con ±30 justo en el borde: 32.5 los incluye con margen.
 */
export const JOYSTICK_DIAGONAL_HALF_DEG = 32.5;

/** Alto máximo de la lista del ranking, en px CSS; más filas se desplazan dentro de su caja. */
export const RANKING_MAX_HEIGHT_PX = 320;

/** Diámetro del botón de pausa estilo Atari, en px CSS. */
export const PAUSE_BUTTON_PX = 72;

/** Diferencia mínima de alto, en px CSS, para decir que el teclado del celular está abierto. */
export const KEYBOARD_MIN_PX = 120;

/** Milisegundos que el modal de username deja ver «Listo» antes de cerrarse. */
export const DONE_VISIBLE_MS = 1200;

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
