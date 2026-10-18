// Polka-Man: dirección pedida que no caduca, giro en los centros y reversa inmediata.
import { playerCanEnter } from './maze';
import { advance, DIR_VECTORS, OPPOSITE } from './movement';
import { PLAYER_SPEED } from './rules';
import type { Dir, Maze, Vec } from './types';

export interface Player {
  pos: Vec;
  dir: Dir | null;
  /** Dirección pedida; se aplica en el primer centro donde se pueda girar. */
  nextDir: Dir | null;
  /** Fase de la boca, de 0 a 1. Avanza solo mientras se mueve. */
  mouth: number;
}

export function createPlayer(maze: Maze): Player {
  return { pos: { x: maze.start.x, y: maze.start.y }, dir: 'izquierda', nextDir: null, mouth: 0 };
}

/** Pide una dirección. La contraria invierte al instante, aunque esté a mitad de casilla. */
export function requestDirection(player: Player, dir: Dir): void {
  player.nextDir = dir;
  if (player.dir !== null && OPPOSITE[player.dir] === dir) player.dir = dir;
}

export function updatePlayer(player: Player, maze: Maze, dt: number): void {
  const canEnter = (c: number, r: number) => playerCanEnter(maze, c, r);
  const distance = PLAYER_SPEED * dt;
  const before = { x: player.pos.x, y: player.pos.y };

  advance(
    player,
    distance,
    canEnter,
    (c, r) => {
      const next = player.nextDir;
      if (next === null) return;
      const v = DIR_VECTORS[next];
      if (canEnter(c + v.x, r + v.y)) player.dir = next;
    },
    maze.width,
  );

  // Lo recorrido (al cruzar el túnel la posición salta, por eso se limita a `distance`).
  const moved = Math.min(distance, Math.abs(player.pos.x - before.x) + Math.abs(player.pos.y - before.y));
  if (moved > 0) player.mouth = (player.mouth + moved) % 1;
}
