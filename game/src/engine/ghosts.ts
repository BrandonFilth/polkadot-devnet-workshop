// Fantasmas: colores, modos y movimiento (una sola regla para todos). Lógica pura.
import { tileAt, tileIndex } from './maze';
import { advance, DIR_VECTORS, OPPOSITE } from './movement';
import { random } from './rng';
import { EYES_SPEED, FRIGHT_SPEED_FACTOR, GHOST_SCATTER_CHANCE } from './rules';
import type { Dir, GhostMode, Maze, Vec } from './types';

/** Los 6 colores, en orden: el fantasma i usa el color i. Solo cambia el color; todos se mueven igual. */
export const GHOST_COLORS: readonly string[] = [
  '#ff6b4a', // fantasma rojo
  '#9be7b0', // fantasma verde
  '#ffd479', // fantasma amarillo
  '#7fb8ff', // fantasma azul
  '#c39bff', // fantasma morado
  '#5ee0d0', // fantasma cian
];

/** Orden de desempate al elegir dirección. */
const DIR_ORDER: readonly Dir[] = ['arriba', 'izquierda', 'abajo', 'derecha'];

export interface Ghost {
  /** Índice del fantasma: su color y su turno de salida. */
  id: number;
  pos: Vec;
  dir: Dir;
  mode: GhostMode;
  /** Casilla (índice) donde decidió por última vez; evita decidir dos veces en el mismo centro. */
  lastTile: number;
  /** Segundos que le quedan de espera en la casa tras ser comido (0 = sin espera). */
  houseTimer: number;
}

/** Lo que un fantasma necesita saber de la partida. */
export interface GhostWorld {
  player: { pos: Vec; dir: Dir | null };
  /** Estado del generador (la semilla de la partida). */
  rng: { seed: number };
  /** Casillas por segundo. */
  speed: number;
  /** Segundos de espera en la casa al llegar como ojos. Sin él (o 0) salen enseguida. */
  houseCooldown?: number;
  /** Probabilidad de dispersión; sin él, GHOST_SCATTER_CHANCE. */
  scatterChance?: number;
}

/** Fantasma i esperando en la casilla G número i % 3. */
export function createGhost(maze: Maze, id: number): Ghost {
  const home = maze.house[id % maze.house.length]!;
  return { id, pos: { x: home.x, y: home.y }, dir: 'arriba', mode: 'casa', lastTile: -1, houseTimer: 0 };
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

/**
 * Dirección en un centro, la misma regla para todos los fantasmas:
 * asustado elige al azar; ojos van a la salida; normal va hacia la casilla de Polka-Man,
 * salvo que con probabilidad scatterChance elija un camino al azar para no amontonarse.
 */
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
  if (ghost.mode === 'normal' && random(world.rng) < (world.scatterChance ?? GHOST_SCATTER_CHANCE)) {
    // Dispersión: un camino al azar entre los abiertos sin media vuelta.
    ghost.dir = candidates[Math.floor(random(world.rng) * candidates.length)]!;
    return;
  }
  const target = ghost.mode === 'ojos' ? { ...maze.exit } : playerTile(maze, world.player.pos);
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
          const cooldown = world.houseCooldown ?? 0;
          if (cooldown > 0) {
            // Llegó al centro: espera en la casa. Debajo hay pared, así que 'abajo' lo deja quieto.
            ghost.mode = 'casa';
            ghost.houseTimer = cooldown;
            ghost.dir = 'abajo';
            ghost.lastTile = -1;
            return;
          }
          // Sin espera: vuelve a salir como siempre.
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
