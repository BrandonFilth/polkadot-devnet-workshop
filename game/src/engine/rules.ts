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

/** Probabilidad de que un fantasma elija un camino al azar en un cruce, para no amontonarse. */
export const GHOST_SCATTER_CHANCE = 0.25;

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

/** Segundos que un fantasma comido espera en la casa en la ronda 1. */
export const HOUSE_COOLDOWN_BASE_SECONDS = 5;

/** Segundos de espera en la casa que se pierden en cada ronda. */
export const HOUSE_COOLDOWN_STEP_SECONDS = 0.5;

/** Mínimo de segundos de espera en la casa. */
export const HOUSE_COOLDOWN_MIN_SECONDS = 2;

/** En el último segundo de la espera el fantasma parpadea. */
export const HOUSE_BLINK_SECONDS = 1;

/** Segundos entre dos cambios del parpadeo de la casa. */
export const HOUSE_BLINK_PERIOD = 0.15;

/** Máximo de eventos guardados en GameState.events; al pasarse se descarta el más viejo. */
export const MAX_EVENTS = 64;

/* ------------------------------------------------ animaciones (solo dibujo) */

/** Apertura de la boca (0 cerrada, 1 abierta) cuando Polka-Man está quieto. */
export const MOUTH_STOPPED_OPEN = 0.5;

/** Segundos del inicio de «muriendo» en que Polka-Man queda congelado antes de colapsar. */
export const DEATH_HOLD_SECONDS = 0.2;

/** Duración del destello al comer una bolita, en segundos. */
export const DOT_BURST_SECONDS = 0.18;

/** Radio final del destello de una bolita, en casillas. */
export const DOT_BURST_RADIUS = 0.35;

/** Duración del destello al comer una bolita especial, en segundos. */
export const POWER_BURST_SECONDS = 0.32;

/** Radio final del destello de una bolita especial, en casillas. */
export const POWER_BURST_RADIUS = 0.9;

/** Grosor del anillo del destello especial, en casillas. */
export const POWER_BURST_RING = 0.12;

/** Segundos que se ven los puntos flotantes al comer un fantasma. */
export const GHOST_POINTS_SECONDS = 0.7;

/** Casillas que suben los puntos flotantes. */
export const GHOST_POINTS_RISE = 0.6;

/** Alto del texto de los puntos flotantes, en casillas. */
export const GHOST_POINTS_FONT = 0.6;

/** Con prefers-reduced-motion los destellos no crecen: quedan fijos en esta fracción del radio. */
export const REDUCED_MOTION_BURST_FACTOR = 0.4;

/** Opacidad del cuerpo del fantasma en casa cuando parpadea antes de salir. */
export const HOUSE_BLINK_ALPHA = 0.35;

/* ------------------------------------------------ sonido (Web Audio, sin archivos) */

/** Volumen general (bus maestro), de 0 a 1. */
export const MASTER_VOLUME = 0.6;

/** Volumen del bus de música: bajo, para que no tape los efectos. */
export const MUSIC_VOLUME = 0.12;

/** Volumen del bus de efectos. */
export const SFX_VOLUME = 0.3;

/** Volumen del toque suave de los botones de sonido (dentro del bus de efectos). */
export const TAP_VOLUME = 0.08;

/** Segundos mínimos entre dos «waka»: si llega otra bolita antes, no suena. */
export const WAKA_MIN_INTERVAL_SECONDS = 0.1;

/** Bolita especial: volumen (dentro del bus de efectos) y segundos de cada una de sus dos notas suaves. */
export const POWER_DOT_VOLUME = 0.3;
export const POWER_DOT_NOTE_SECONDS = 0.09;

/** Sirena del susto: volumen bajo (dentro del bus de efectos) y vaivén lento y corto de la altura. */
export const SIREN_VOLUME = 0.09;
export const SIREN_LFO_RATE = 3;
export const SIREN_LFO_DEPTH_HZ = 15;

/** Tempo de la música, en negras por minuto. */
export const MUSIC_BPM = 132;

/** Tempo de la música durante el susto. */
export const MUSIC_FRIGHT_BPM = 168;

/** Segundos hacia adelante que se agendan las notas en cada cuadro. */
export const MUSIC_LOOKAHEAD_SECONDS = 0.15;

/* ------------------------------------------------ pantalla y controles */

/** Casillas del anillo exterior de pared que no se dibujan en cada lado (solo dibujo; el laberinto no cambia). */
export const VIEW_CROP_TILES = 0.5;

/** Tamaño mínimo de casilla, en px CSS. */
export const MIN_TILE_PX = 8;

/** Alto de la barra superior (HUD + menú), en px CSS. */
export const HUD_HEIGHT_PX = 44;

/** Alto de la zona de controles táctiles (joystick y pausa), en px CSS. */
export const CONTROLS_HEIGHT_PX = 132;

/**
 * Radio de la base del joystick flotante, en px CSS. Si el dedo se aleja más que esto, la base lo
 * sigue para que la perilla quede en el borde.
 */
export const JOYSTICK_RADIUS_PX = 56;

/** Radio de la perilla del joystick, en px CSS. */
export const JOYSTICK_KNOB_RADIUS_PX = 26;

/** Zona muerta del joystick, en px CSS desde el centro de la base: más cerca no cambia la dirección. */
export const JOYSTICK_DEAD_ZONE_PX = 10;

/** Duración, en ms, del desvanecido del joystick al soltar el dedo. */
export const JOYSTICK_FADE_MS = 150;

/** Rondas de cada partida en las que se ve la pista «Toca y arrastra» mientras no hay dedo. */
export const JOYSTICK_HINT_ROUNDS = 1;

/** Vibración corta, en ms, al cambiar de dirección con el joystick (si el teléfono la tiene). */
export const JOYSTICK_HAPTIC_MS = 10;

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

/** Segundos que un fantasma comido espera en la casa en la ronda `round`. */
export function houseCooldownSeconds(round: number): number {
  return Math.max(HOUSE_COOLDOWN_MIN_SECONDS, HOUSE_COOLDOWN_BASE_SECONDS - HOUSE_COOLDOWN_STEP_SECONDS * (round - 1));
}
