// Polka-Man: dirección pedida que no caduca, giro en los centros y reversa inmediata.
import { playerCanEnter } from './maze';
import { advance, DIR_VECTORS, OPPOSITE } from './movement';
import { PLAYER_SPEED } from './rules';
import type { Dir, Maze, Vec } from './types';

export interface Player {
  pos: Vec;
  dir: Dir | null;
  /** Dirección pedida (principal); se aplica en el primer centro donde se pueda girar. */
  nextDir: Dir | null;
  /** Segunda dirección pedida (diagonal del joystick, swipe o dos teclas). null = pedido recto. */
  altDir: Dir | null;
  /** Fase de la boca, de 0 a 1. Avanza solo mientras se mueve. */
  mouth: number;
  /** Se movió en el último updatePlayer (false = quieto contra la pared o sin dirección). */
  moving: boolean;
}

export function createPlayer(maze: Maze): Player {
  return {
    pos: { x: maze.start.x, y: maze.start.y },
    dir: 'izquierda',
    nextDir: null,
    altDir: null,
    mouth: 0,
    moving: false,
  };
}

/**
 * Pide una dirección principal y, en diagonal, una secundaria. Solo la principal contraria invierte
 * al instante, aunque esté a mitad de casilla.
 */
export function requestDirections(player: Player, primary: Dir, secondary: Dir | null): void {
  player.nextDir = primary;
  player.altDir = secondary;
  if (player.dir !== null && OPPOSITE[player.dir] === primary) player.dir = primary;
}

/** Pide una dirección. La contraria invierte al instante, aunque esté a mitad de casilla. */
export function requestDirection(player: Player, dir: Dir): void {
  requestDirections(player, dir, null);
}

const isTurn = (dir: Dir, other: Dir) => other !== dir && other !== OPPOSITE[dir];

/**
 * Qué dirección tomar en un centro. Orden: la pedida que sea un GIRO (perpendicular a `dir`) si se
 * puede; después la otra pedida si se puede (la secundaria contraria a `dir` nunca, para no temblar);
 * si no, sigue igual. Sin dirección actual se prueba la principal y después la secundaria.
 * Con `secondary` null es la regla de siempre: la pedida si se puede, si no sigue igual.
 */
export function chooseAtCenter(
  dir: Dir | null,
  primary: Dir | null,
  secondary: Dir | null,
  canGo: (d: Dir) => boolean,
): Dir | null {
  const wanted: Dir[] = [];
  if (primary !== null) wanted.push(primary);
  if (secondary !== null && secondary !== primary) wanted.push(secondary);
  let order = wanted;
  if (dir !== null) {
    const allowed = wanted.filter((d) => d !== secondary || d !== OPPOSITE[dir]);
    order = [...allowed.filter((d) => isTurn(dir, d)), ...allowed.filter((d) => !isTurn(dir, d))];
  }
  for (const d of order) if (canGo(d)) return d;
  return dir;
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
      const canGo = (d: Dir) => canEnter(c + DIR_VECTORS[d].x, r + DIR_VECTORS[d].y);
      player.dir = chooseAtCenter(player.dir, player.nextDir, player.altDir, canGo);
    },
    maze.width,
  );

  // Lo recorrido (al cruzar el túnel la posición salta, por eso se limita a `distance`).
  const moved = Math.min(distance, Math.abs(player.pos.x - before.x) + Math.abs(player.pos.y - before.y));
  player.moving = moved > 0;
  if (moved > 0) player.mouth = (player.mouth + moved) % 1;
}
