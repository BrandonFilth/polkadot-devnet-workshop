// Polka-Man: dirección pedida (no caduca mientras se mantiene; al soltar dura REQUEST_TTL_TILES), giro en los
// centros con margen para girar tarde (TURN_GRACE_TILES) y reversa inmediata.
import { playerCanEnter } from './maze';
import { advance, DIR_VECTORS, OPPOSITE } from './movement';
import { PLAYER_SPEED, REQUEST_TTL_TILES, TURN_GRACE_TILES } from './rules';
import type { Dir, Maze, Vec } from './types';

export interface Player {
  pos: Vec;
  dir: Dir | null;
  /** Dirección pedida (principal); se aplica en el primer centro donde se pueda girar. */
  nextDir: Dir | null;
  /** Segunda dirección pedida (diagonal del swipe o dos teclas). null = pedido recto. */
  altDir: Dir | null;
  /** El pedido se mantiene (tecla, flecha o dedo abajo). Al soltar empieza a contar `idle`. */
  held: boolean;
  /** Casillas recorridas desde que se soltó sin poder aplicar el pedido (REQUEST_TTL_TILES lo olvida). */
  idle: number;
  /** Fase de la boca, de 0 a 1. Avanza solo mientras se mueve. */
  mouth: number;
  /** Se movió en el último updatePlayer (false = quieto contra la pared o sin dirección). */
  moving: boolean;
  /**
   * Último centro donde se decidió la dirección y con qué pedido («principal|secundaria»). Si un paso
   * termina justo en un centro, el siguiente vuelve a empezar en él: con el mismo pedido no se decide
   * otra vez (en diagonal, la segunda decisión desharía el giro).
   */
  decided?: { col: number; row: number; key: string };
}

export function createPlayer(maze: Maze): Player {
  return {
    pos: { x: maze.start.x, y: maze.start.y },
    dir: 'izquierda',
    nextDir: null,
    altDir: null,
    held: false,
    idle: 0,
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
  player.held = true;
  player.idle = 0;
  if (player.dir !== null && OPPOSITE[player.dir] === primary) player.dir = primary;
}

/** Se soltó la tecla, la flecha o el dedo: el pedido sigue, pero caduca tras REQUEST_TTL_TILES casillas. */
export function releaseDirections(player: Player): void {
  player.held = false;
  player.idle = 0;
}

/**
 * Giro tarde: si el pedido cambió después de pasar el último centro, Polka-Man sigue en la misma línea y
 * está a TURN_GRACE_TILES o menos de él, y desde ese centro se puede girar a lo pedido, vuelve al centro y gira.
 */
function lateTurn(player: Player, canEnter: (c: number, r: number) => boolean): void {
  const d = player.decided;
  const dir = player.dir;
  if (!d || dir === null) return;
  const key = `${player.nextDir}|${player.altDir}`;
  if (d.key === key) return;
  const v = DIR_VECTORS[dir];
  // Distancia recorrida desde el centro, hacia donde va (sobre el mismo eje y alejándose de él).
  const along = (player.pos.x - d.col) * v.x + (player.pos.y - d.row) * v.y;
  const offAxis = v.x !== 0 ? Math.abs(player.pos.y - d.row) : Math.abs(player.pos.x - d.col);
  if (offAxis > 1e-6 || along <= 0 || along > TURN_GRACE_TILES) return;
  const canGo = (x: Dir) => canEnter(d.col + DIR_VECTORS[x].x, d.row + DIR_VECTORS[x].y);
  const choice = chooseAtCenter(dir, player.nextDir, player.altDir, canGo);
  if (choice === null || !isTurn(dir, choice)) return;
  player.pos = { x: d.col, y: d.row };
  player.dir = choice;
  player.decided = { col: d.col, row: d.row, key };
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
  lateTurn(player, canEnter);
  const before = { x: player.pos.x, y: player.pos.y };

  advance(
    player,
    distance,
    canEnter,
    (c, r) => {
      const canGo = (d: Dir) => canEnter(c + DIR_VECTORS[d].x, r + DIR_VECTORS[d].y);
      const key = `${player.nextDir}|${player.altDir}`;
      const d = player.decided;
      if (d && d.col === c && d.row === r && d.key === key && player.dir !== null && canGo(player.dir)) return;
      player.dir = chooseAtCenter(player.dir, player.nextDir, player.altDir, canGo);
      player.decided = { col: c, row: r, key };
    },
    maze.width,
  );

  // Lo recorrido (al cruzar el túnel la posición salta, por eso se limita a `distance`).
  const moved = Math.min(distance, Math.abs(player.pos.x - before.x) + Math.abs(player.pos.y - before.y));
  player.moving = moved > 0;
  if (moved > 0) player.mouth = (player.mouth + moved) % 1;

  // Pedido suelto que no se pudo aplicar: caduca después de REQUEST_TTL_TILES casillas. Un pedido ya
  // aplicado (igual a la dirección actual, sin secundaria) no hace falta guardarlo.
  if (!player.held && player.nextDir !== null) {
    if (player.nextDir === player.dir && player.altDir === null) return;
    player.idle += moved;
    if (player.idle >= REQUEST_TTL_TILES) {
      player.nextDir = null;
      player.altDir = null;
      player.idle = 0;
    }
  }
}
