// El laberinto como datos. Cambia solo si se pide.
//
//   #  pared                              transitable por: nadie
//   .  orbe (10 pts)                      todos
//   o  orbe especial (50 pts)             todos
//      pasillo sin orbe                   todos
//   P  inicio de Polka-Man (sin orbe)     todos
//   -  puerta de la casa de los fantasmas solo fantasmas en modo casa, saliendo u ojos
//   G  interior de la casa                solo fantasmas
//
// Túnel: tileAt() envuelve la columna en todas las filas; las paredes del borde hacen que solo
// la fila 9 se pueda cruzar.
import type { Maze, Tile, Vec } from './types';

export const MAZE: readonly string[] = [
  '###################', //  0
  '#........#........#', //  1
  '#o##.###.#.###.##o#', //  2
  '#.................#', //  3
  '#.##.#.#####.#.##.#', //  4
  '#....#...#...#....#', //  5
  '####.### # ###.####', //  6
  '####.#       #.####', //  7
  '####.# ##-## #.####', //  8
  '    .  #GGG#  .    ', //  9
  '####.# ##### #.####', // 10
  '####.#       #.####', // 11
  '####.# ##### #.####', // 12
  '#........#........#', // 13
  '#.##.###.#.###.##.#', // 14
  '#o.#.....P.....#.o#', // 15
  '##.#.#.#####.#.#.##', // 16
  '#....#...#...#....#', // 17
  '#.######.#.######.#', // 18
  '#.................#', // 19
  '###################', // 20
];

const CHARS: Record<string, Tile> = {
  '#': 'pared',
  '.': 'orbe',
  o: 'especial',
  ' ': 'pasillo',
  P: 'pasillo',
  '-': 'puerta',
  G: 'casa',
};

/**
 * Interpreta el laberinto. Lanza Error con la fila y la causa si está mal formado: es un error
 * de programación (el laberinto viene en el código) y lo detecta `pnpm test`.
 */
export function parseMaze(rows: readonly string[]): Maze {
  const height = rows.length;
  if (height === 0) throw new Error('El laberinto no tiene filas.');
  const width = rows[0]!.length;
  const tiles: Tile[] = [];
  const orbs = new Set<number>();
  const power = new Set<number>();
  const starts: Vec[] = [];
  const doors: Vec[] = [];
  const house: Vec[] = [];

  rows.forEach((row, r) => {
    if (row.length !== width) {
      throw new Error(`Fila ${r}: mide ${row.length} y la fila 0 mide ${width}.`);
    }
    for (let c = 0; c < width; c++) {
      const ch = row[c]!;
      const tile = CHARS[ch];
      if (!tile) throw new Error(`Fila ${r}, columna ${c}: carácter desconocido «${ch}».`);
      const i = r * width + c;
      tiles.push(tile);
      if (tile === 'orbe') orbs.add(i);
      else if (tile === 'especial') power.add(i);
      else if (tile === 'puerta') doors.push({ x: c, y: r });
      else if (tile === 'casa') house.push({ x: c, y: r });
      if (ch === 'P') starts.push({ x: c, y: r });
    }
  });

  if (starts.length !== 1) {
    const where = starts[1] ? ` (el segundo está en la fila ${starts[1].y})` : '';
    throw new Error(`Debe haber exactamente un P y hay ${starts.length}${where}.`);
  }
  if (doors.length !== 1) {
    const where = doors[1] ? ` (la segunda está en la fila ${doors[1].y})` : '';
    throw new Error(`Debe haber exactamente una puerta «-» y hay ${doors.length}${where}.`);
  }
  if (house.length === 0) throw new Error('Debe haber al menos una casilla G (casa de los fantasmas).');

  const door = doors[0]!;
  return {
    width,
    height,
    tiles,
    orbs,
    power,
    start: starts[0]!,
    door,
    exit: { x: door.x, y: door.y - 1 },
    house,
  };
}

/** Índice de una casilla, con la columna envuelta (túnel). */
export function tileIndex(maze: Maze, col: number, row: number): number {
  const c = ((col % maze.width) + maze.width) % maze.width;
  return row * maze.width + c;
}

/** Qué hay en (col, row). La columna se envuelve (túnel); fuera de las filas es pared. */
export function tileAt(maze: Maze, col: number, row: number): Tile {
  if (row < 0 || row >= maze.height) return 'pared';
  return maze.tiles[tileIndex(maze, col, row)]!;
}

export function isWall(maze: Maze, col: number, row: number): boolean {
  return tileAt(maze, col, row) === 'pared';
}

/** Polka-Man entra en orbes, especiales y pasillos; nunca en la puerta ni en la casa. */
export function playerCanEnter(maze: Maze, col: number, row: number): boolean {
  const t = tileAt(maze, col, row);
  return t === 'orbe' || t === 'especial' || t === 'pasillo';
}
