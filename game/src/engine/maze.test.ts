import { describe, expect, it } from 'vitest';
import { MAZE, parseMaze, playerCanEnter, tileAt } from './maze';
import { MAZE_HEIGHT, MAZE_WIDTH } from './rules';

const maze = parseMaze(MAZE);
const STEPS = [
  [0, -1],
  [-1, 0],
  [0, 1],
  [1, 0],
] as const;

/** Casillas por las que camina Polka-Man (orbes, especiales y pasillos). */
function walkable(): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = 0; r < maze.height; r++) {
    for (let c = 0; c < maze.width; c++) if (playerCanEnter(maze, c, r)) out.push([c, r]);
  }
  return out;
}

/** Vecinos transitables; la columna se envuelve (túnel). */
function neighbors(c: number, r: number): Array<[number, number]> {
  return STEPS.map(([dc, dr]) => [(c + dc + maze.width) % maze.width, r + dr] as [number, number]).filter(([nc, nr]) =>
    playerCanEnter(maze, nc, nr),
  );
}

describe('laberinto', () => {
  it('mide 19 × 21, igual que rules.ts', () => {
    expect(maze.width).toBe(19);
    expect(maze.height).toBe(21);
    expect(maze.width).toBe(MAZE_WIDTH);
    expect(maze.height).toBe(MAZE_HEIGHT);
  });

  it('tiene 146 orbes y 4 especiales', () => {
    expect(maze.orbs.size).toBe(146);
    expect(maze.power.size).toBe(4);
    const power = [...maze.power].map((i) => [i % maze.width, Math.floor(i / maze.width)]);
    expect(power).toEqual([
      [1, 2],
      [17, 2],
      [1, 15],
      [17, 15],
    ]);
  });

  it('deriva inicio, puerta, salida y casa', () => {
    expect(maze.start).toEqual({ x: 9, y: 15 });
    expect(maze.door).toEqual({ x: 9, y: 8 });
    expect(maze.exit).toEqual({ x: 9, y: 7 });
    expect(maze.house).toEqual([
      { x: 8, y: 9 },
      { x: 9, y: 9 },
      { x: 10, y: 9 },
    ]);
    for (const [c, r] of [
      [1, 1],
      [17, 1],
      [1, 19],
      [17, 19],
    ] as const) {
      expect(playerCanEnter(maze, c, r)).toBe(true);
    }
  });

  it('tiene 185 casillas transitables, todas alcanzables desde P (con túnel)', () => {
    const all = walkable();
    expect(all).toHaveLength(185);
    const key = (c: number, r: number) => r * maze.width + c;
    const seen = new Set([key(maze.start.x, maze.start.y)]);
    const queue: Array<[number, number]> = [[maze.start.x, maze.start.y]];
    while (queue.length) {
      const [c, r] = queue.shift()!;
      for (const [nc, nr] of neighbors(c, r)) {
        if (!seen.has(key(nc, nr))) {
          seen.add(key(nc, nr));
          queue.push([nc, nr]);
        }
      }
    }
    expect(seen.size).toBe(185);
  });

  it('no tiene callejones sin salida fuera de la casa', () => {
    const deadEnds = walkable().filter(([c, r]) => neighbors(c, r).length < 2);
    expect(deadEnds).toEqual([]);
  });

  it('es simétrico de izquierda a derecha', () => {
    for (const row of MAZE) expect(row).toBe([...row].reverse().join(''));
  });

  it('el túnel de la fila 9 conecta los bordes', () => {
    expect(tileAt(maze, -1, 9)).toBe(tileAt(maze, 18, 9));
    expect(tileAt(maze, 19, 9)).toBe(tileAt(maze, 0, 9));
    expect(playerCanEnter(maze, -1, 9)).toBe(true);
    expect(playerCanEnter(maze, -1, 8)).toBe(false);
  });

  it('rechaza filas de distinto largo', () => {
    const rows = [...MAZE];
    rows[4] = rows[4]!.slice(1);
    expect(() => parseMaze(rows)).toThrow(/Fila 4/);
  });

  it('rechaza un segundo P', () => {
    const rows = [...MAZE];
    rows[19] = '#P................#';
    expect(() => parseMaze(rows)).toThrow(/exactamente un P/);
  });

  it('rechaza caracteres desconocidos, puertas de más y la falta de casa', () => {
    const unknown = [...MAZE];
    unknown[1] = '#x.......#........#';
    expect(() => parseMaze(unknown)).toThrow(/Fila 1, columna 1/);
    const doors = [...MAZE];
    doors[19] = '#-................#';
    expect(() => parseMaze(doors)).toThrow(/puerta/);
    const noHouse = MAZE.map((row) => row.replace(/G/g, ' '));
    expect(() => parseMaze(noHouse)).toThrow(/casilla G/);
  });
});
