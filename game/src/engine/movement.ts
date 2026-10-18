// Movimiento sobre la cuadrícula, compartido por Polka-Man y (más adelante) los fantasmas.
import { MAZE_WIDTH } from './rules';
import type { Dir, Vec } from './types';

/** Tolerancia para considerar que una entidad está en el centro de una casilla. */
const EPS = 1e-6;

export const DIR_VECTORS: Readonly<Record<Dir, Vec>> = {
  arriba: { x: 0, y: -1 },
  izquierda: { x: -1, y: 0 },
  abajo: { x: 0, y: 1 },
  derecha: { x: 1, y: 0 },
};

export const OPPOSITE: Readonly<Record<Dir, Dir>> = {
  arriba: 'abajo',
  izquierda: 'derecha',
  abajo: 'arriba',
  derecha: 'izquierda',
};

export interface Mover {
  pos: Vec;
  dir: Dir | null;
}

type CanEnter = (col: number, row: number) => boolean;

function atCenter(pos: Vec): boolean {
  return Math.abs(pos.x - Math.round(pos.x)) < EPS && Math.abs(pos.y - Math.round(pos.y)) < EPS;
}

function snap(pos: Vec): void {
  pos.x = Math.round(pos.x);
  pos.y = Math.round(pos.y);
}

/** Distancia al siguiente centro en la dirección `dir` (0 si ya está en uno). */
function toNextCenter(pos: Vec, dir: Dir): number {
  switch (dir) {
    case 'derecha':
      return Math.ceil(pos.x) - pos.x;
    case 'izquierda':
      return pos.x - Math.floor(pos.x);
    case 'abajo':
      return Math.ceil(pos.y) - pos.y;
    case 'arriba':
      return pos.y - Math.floor(pos.y);
  }
}

function move(entity: Mover, distance: number, width: number): void {
  if (entity.dir === null) return;
  const v = DIR_VECTORS[entity.dir];
  entity.pos.x += v.x * distance;
  entity.pos.y += v.y * distance;
  // Túnel.
  if (entity.pos.x < -0.5) entity.pos.x += width;
  else if (entity.pos.x >= width - 0.5) entity.pos.x -= width;
}

/** ¿Puede salir del centro actual en su dirección? */
function canLeave(entity: Mover, canEnter: CanEnter): boolean {
  if (entity.dir === null) return false;
  const v = DIR_VECTORS[entity.dir];
  return canEnter(Math.round(entity.pos.x) + v.x, Math.round(entity.pos.y) + v.y);
}

/**
 * Avanza `distance` casillas sobre un solo eje. En cada centro llama `onCenter` (que puede cambiar
 * `entity.dir`) y se detiene si la casilla siguiente no es transitable. Nunca cruza más de un
 * centro por paso.
 */
export function advance(
  entity: Mover,
  distance: number,
  canEnter: CanEnter,
  onCenter: (col: number, row: number) => void,
  width = MAZE_WIDTH,
): void {
  if (distance <= 0) return;

  if (atCenter(entity.pos)) {
    snap(entity.pos);
    onCenter(entity.pos.x, entity.pos.y);
    if (!canLeave(entity, canEnter)) return;
    move(entity, Math.min(distance, 1), width);
    return;
  }

  if (entity.dir === null) return;
  const toNext = toNextCenter(entity.pos, entity.dir);
  if (distance < toNext - EPS) {
    move(entity, distance, width);
    return;
  }

  // Cruza un centro: se ajusta exacto, decide y aplica lo que sobra en la nueva dirección.
  move(entity, toNext, width);
  snap(entity.pos);
  onCenter(entity.pos.x, entity.pos.y);
  if (!canLeave(entity, canEnter)) return;
  move(entity, Math.min(distance - toNext, 1), width);
}
