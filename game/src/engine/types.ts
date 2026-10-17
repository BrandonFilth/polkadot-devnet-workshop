// Tipos del motor. Lógica pura: nada de DOM ni de tiempo real.

/** Dirección sobre la cuadrícula. */
export type Dir = 'arriba' | 'izquierda' | 'abajo' | 'derecha';

/** Posición en casillas: el centro de la casilla (c, r) es { x: c, y: r }. */
export interface Vec {
  x: number;
  y: number;
}

/** Qué hay en una casilla del laberinto (ver la tabla de caracteres en maze.ts). */
export type Tile =
  | 'pared' // #
  | 'orbe' // .
  | 'especial' // o
  | 'pasillo' // espacio y P
  | 'puerta' // -
  | 'casa'; // G

/** Laberinto ya interpretado por parseMaze(). Los índices son fila mayor: r * width + c. */
export interface Maze {
  width: number;
  height: number;
  tiles: Tile[];
  /** Índices de las casillas con orbe normal. */
  orbs: Set<number>;
  /** Índices de las casillas con orbe especial. */
  power: Set<number>;
  /** Inicio de Polka-Man (la P). */
  start: Vec;
  /** Puerta de la casa de los fantasmas (el -). */
  door: Vec;
  /** Salida de la casa: la casilla sobre la puerta. */
  exit: Vec;
  /** Interior de la casa (las G), en orden de lectura. */
  house: Vec[];
}

/** Fases de la partida (design §4.5). Cada etapa usa las que ya existen. */
export type Phase = 'titulo' | 'listo' | 'jugando' | 'muriendo' | 'rondaLimpia' | 'pausa' | 'fin';

/** Fases desde las que se puede pausar y a las que se regresa al reanudar. */
export type ActivePhase = 'listo' | 'jugando' | 'muriendo' | 'rondaLimpia';

/** Modos de un fantasma (design §4.4). */
export type GhostMode = 'casa' | 'saliendo' | 'normal' | 'asustado' | 'ojos';
