// Fantasmas: personalidades, objetivos, modos y movimiento. Lógica pura.
import { tileAt, tileIndex } from './maze';
import { advance, DIR_VECTORS, OPPOSITE } from './movement';
import { random } from './rng';
import { EYES_SPEED, FORK_AHEAD, FRIGHT_SPEED_FACTOR, GAS_RADIUS, NONCE_RADIUS } from './rules';
import type { Dir, GhostMode, Maze, Vec } from './types';

export interface Personality {
  name: string;
  color: string;
}

/** Las 6 personalidades, en orden: el fantasma i usa la personalidad i. */
export const PERSONALITIES: readonly Personality[] = [
  { name: 'Bug', color: '#ff6b4a' },
  { name: 'Lag', color: '#9be7b0' },
  { name: 'Spam', color: '#ffd479' },
  { name: 'Fork', color: '#7fb8ff' },
  { name: 'Gas', color: '#c39bff' },
  { name: 'Nonce', color: '#5ee0d0' },
];

/** Esquinas del tablero. */
export const CORNER_TL: Vec = { x: 1, y: 1 };
export const CORNER_TR: Vec = { x: 17, y: 1 };
export const CORNER_BR: Vec = { x: 17, y: 19 };
export const CORNER_BL: Vec = { x: 1, y: 19 };

/** Recorrido de Nonce. */
export const NONCE_CORNERS: readonly Vec[] = [CORNER_TL, CORNER_TR, CORNER_BR, CORNER_BL];

/** Orden de desempate al elegir dirección. */
const DIR_ORDER: readonly Dir[] = ['arriba', 'izquierda', 'abajo', 'derecha'];

export interface Ghost {
  /** Índice del fantasma; también su personalidad. */
  id: number;
  pos: Vec;
  dir: Dir;
  mode: GhostMode;
  /** Esquina actual de Nonce (índice en NONCE_CORNERS). */
  corner: number;
  /** Casilla (índice) donde decidió por última vez; evita decidir dos veces en el mismo centro. */
  lastTile: number;
}

/** Lo que un fantasma necesita saber de la partida. */
export interface GhostWorld {
  player: { pos: Vec; dir: Dir | null };
  /** Muestras de la casilla de Polka-Man, de la más vieja a la más nueva. */
  lagSamples: readonly Vec[];
  /** Estado del generador (la semilla de la partida). */
  rng: { seed: number };
  /** Casillas por segundo. */
  speed: number;
}

/** Fantasma i esperando en la casilla G número i % 3. */
export function createGhost(maze: Maze, id: number): Ghost {
  const home = maze.house[id % maze.house.length]!;
  return { id, pos: { x: home.x, y: home.y }, dir: 'arriba', mode: 'casa', corner: 0, lastTile: -1 };
}

export function createGhosts(maze: Maze, count: number): Ghost[] {
  return Array.from({ length: count }, (_, i) => createGhost(maze, i));
}

/** ¿Puede un fantasma en `mode` entrar a (col, row)? */
export function ghostCanEnter(maze: Maze, mode: GhostMode, col: number, row: number): boolean {
  const t = tileAt(maze, col, row);
  if (t === 'pared') return false;
  if (t === 'puerta') return mode === 'casa' || mode === 'saliendo' || mode === 'ojos';
  return true;
}

/** Casilla de Polka-Man, con la columna dentro del tablero. */
export function playerTile(maze: Maze, pos: Vec): Vec {
  const c = Math.round(pos.x);
  return { x: ((c % maze.width) + maze.width) % maze.width, y: Math.round(pos.y) };
}

function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Casilla objetivo según la personalidad; null para Spam (elige al azar). */
export function ghostTarget(ghost: Ghost, world: GhostWorld, maze: Maze): Vec | null {
  const p = playerTile(maze, world.player.pos);
  switch (ghost.id % PERSONALITIES.length) {
    case 0: // Bug
      return p;
    case 1: {
      // Lag: la muestra más vieja.
      const oldest = world.lagSamples[0];
      return oldest ? { x: oldest.x, y: oldest.y } : p;
    }
    case 2: // Spam
      return null;
    case 3: {
      // Fork: FORK_AHEAD casillas delante.
      const dir = world.player.dir;
      if (dir === null) return p;
      const v = DIR_VECTORS[dir];
      return {
        x: clamp(p.x + v.x * FORK_AHEAD, 0, maze.width - 1),
        y: clamp(p.y + v.y * FORK_AHEAD, 0, maze.height - 1),
      };
    }
    case 4: // Gas
      return dist(ghost.pos, p) > GAS_RADIUS ? p : { ...CORNER_BL };
    default: {
      // Nonce
      if (dist(ghost.pos, p) <= NONCE_RADIUS) return p;
      const corner = NONCE_CORNERS[ghost.corner]!;
      return { ...corner };
    }
  }
}

/** Centro de la casa: la casilla bajo la puerta. Ahí los ojos vuelven a 'saliendo'. */
export function houseCenter(maze: Maze): Vec {
  return { x: maze.door.x, y: maze.door.y + 1 };
}

/** Un fantasma en 'normal' se asusta y da media vuelta. Los demás modos no cambian. */
export function frighten(ghost: Ghost): void {
  if (ghost.mode !== 'normal') return;
  ghost.mode = 'asustado';
  ghost.dir = OPPOSITE[ghost.dir];
  // Que vuelva a decidir en el centro del que venía.
  ghost.lastTile = -1;
}

/** Velocidad según el modo, a partir de la velocidad normal de la ronda. */
export function modeSpeed(mode: GhostMode, speed: number): number {
  if (mode === 'asustado') return FRIGHT_SPEED_FACTOR * speed;
  if (mode === 'ojos') return EYES_SPEED;
  return speed;
}

/** Dirección en un centro: al azar si está asustado; si no, hacia su objetivo. */
function decide(ghost: Ghost, world: GhostWorld, maze: Maze, col: number, row: number): void {
  const reverse = OPPOSITE[ghost.dir];
  const open = DIR_ORDER.filter((d) => {
    const v = DIR_VECTORS[d];
    return ghostCanEnter(maze, ghost.mode, col + v.x, row + v.y);
  });
  let candidates = open.filter((d) => d !== reverse);
  if (candidates.length === 0) candidates = open;
  if (candidates.length === 0) return;

  if (ghost.mode === 'asustado') {
    ghost.dir = candidates[Math.floor(random(world.rng) * candidates.length)]!;
    return;
  }
  const target = ghost.mode === 'ojos' ? { ...maze.exit } : ghostTarget(ghost, world, maze);
  if (target === null) {
    ghost.dir = candidates[Math.floor(random(world.rng) * candidates.length)]!;
    return;
  }
  let best = candidates[0]!;
  let bestD = Infinity;
  for (const d of candidates) {
    const v = DIR_VECTORS[d];
    const dx = col + v.x - target.x;
    const dy = row + v.y - target.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) {
      bestD = d2;
      best = d;
    }
  }
  ghost.dir = best;
}

/** Mueve un fantasma `dt` segundos según su modo. En 'casa' no se mueve. */
export function updateGhost(ghost: Ghost, world: GhostWorld, maze: Maze, dt: number): void {
  if (ghost.mode === 'casa') return;

  // Nonce cambia de esquina cuando está a menos de 1 casilla de la actual.
  if (ghost.id % PERSONALITIES.length === 5 && dist(ghost.pos, NONCE_CORNERS[ghost.corner]!) < 1) {
    ghost.corner = (ghost.corner + 1) % NONCE_CORNERS.length;
  }

  const canEnter = (c: number, r: number) => ghostCanEnter(maze, ghost.mode, c, r);
  advance(
    ghost,
    modeSpeed(ghost.mode, world.speed) * dt,
    canEnter,
    (c, r) => {
      if (ghost.mode === 'ojos') {
        const center = houseCenter(maze);
        if (c === maze.exit.x && r >= maze.exit.y && r < center.y) {
          // En la salida o en la puerta: baja hacia el centro de la casa.
          ghost.dir = 'abajo';
          return;
        }
        if (c === center.x && r === center.y) {
          // Llegó al centro: vuelve a salir como siempre.
          ghost.mode = 'saliendo';
          ghost.lastTile = -1;
        }
      }
      if (ghost.mode === 'saliendo') {
        if (c !== maze.exit.x) {
          ghost.dir = c < maze.exit.x ? 'derecha' : 'izquierda';
          return;
        }
        if (r > maze.exit.y) {
          ghost.dir = 'arriba';
          return;
        }
        // Llegó a la salida: pasa a 'normal' conservando 'arriba' y decide ahí mismo.
        ghost.mode = 'normal';
        ghost.dir = 'arriba';
      }
      const here = tileIndex(maze, c, r);
      if (here === ghost.lastTile) return;
      ghost.lastTile = here;
      decide(ghost, world, maze, c, r);
    },
    maze.width,
  );
}
