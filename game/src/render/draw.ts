// Dibujo en Canvas 2D. Las paredes se pintan una vez por tamaño en un canvas aparte (caché).
import { tileAt } from '../engine/maze';
import type { Maze } from '../engine/types';

const BG = '#050505';
const WALL_FILL = '#111111';
const WALL_EDGE = '#f2f2ef';
const WALL_GLOW = 'rgba(255, 255, 255, 0.35)';
const ORB = '#f2f2ef';
const POWER = '#ff2867';
const DOOR = '#8b8b86';
const MAX_DPR = 3;
const MIN_TILE = 8;

/** Lo que cambia de un cuadro a otro (en la etapa 0, solo los orbes que quedan). */
export interface Scene {
  orbs: ReadonlySet<number>;
  power: ReadonlySet<number>;
}

export interface Renderer {
  /** Tamaño actual de la casilla en px CSS. */
  readonly tile: number;
  /** Dibuja un cuadro. `timeMs` anima el pulso de los especiales. */
  draw(scene: Scene, timeMs: number): void;
  destroy(): void;
}

/** Tamaño de casilla para un escenario de w × h px CSS. */
export function tileSize(maze: Maze, w: number, h: number): number {
  return Math.max(MIN_TILE, Math.floor(Math.min(w / maze.width, h / maze.height)));
}

/** Crea el dibujante. Escucha el tamaño de `stage` con ResizeObserver. */
export function createRenderer(stage: HTMLElement, canvas: HTMLCanvasElement, maze: Maze): Renderer {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no permite dibujar en canvas 2D.');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let tile = MIN_TILE;
  let dpr = 1;
  let walls: HTMLCanvasElement | null = null;

  const resize = () => {
    const rect = stage.getBoundingClientRect();
    tile = tileSize(maze, rect.width, rect.height);
    dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const w = maze.width * tile;
    const h = maze.height * tile;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    walls = drawWalls(maze, tile, dpr);
  };

  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();

  return {
    get tile() {
      return tile;
    },
    draw(scene, timeMs) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (walls) ctx.drawImage(walls, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawOrbs(ctx, maze, tile, scene, motion.matches ? null : timeMs);
    },
    destroy() {
      observer.disconnect();
    },
  };
}

/** Paredes: relleno oscuro, borde claro solo en los lados que dan a un pasillo y luz blanca. */
function drawWalls(maze: Maze, tile: number, dpr: number): HTMLCanvasElement {
  const off = document.createElement('canvas');
  off.width = Math.round(maze.width * tile * dpr);
  off.height = Math.round(maze.height * tile * dpr);
  const g = off.getContext('2d');
  if (!g) return off;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);

  const wall = (c: number, r: number) =>
    c < 0 || c >= maze.width || r < 0 || r >= maze.height || tileAt(maze, c, r) === 'pared';

  g.fillStyle = WALL_FILL;
  for (let r = 0; r < maze.height; r++) {
    for (let c = 0; c < maze.width; c++) if (wall(c, r)) g.fillRect(c * tile, r * tile, tile, tile);
  }

  // Bordes de 2 px dentro de la pared, en el lado que toca un pasillo.
  g.strokeStyle = WALL_EDGE;
  g.lineWidth = 2;
  g.lineCap = 'square';
  g.shadowColor = WALL_GLOW;
  g.shadowBlur = 6 * dpr;
  g.beginPath();
  for (let r = 0; r < maze.height; r++) {
    for (let c = 0; c < maze.width; c++) {
      if (!wall(c, r)) continue;
      const x0 = c * tile;
      const y0 = r * tile;
      const x1 = x0 + tile;
      const y1 = y0 + tile;
      if (!wall(c, r - 1)) line(g, x0, y0 + 1, x1, y0 + 1);
      if (!wall(c, r + 1)) line(g, x0, y1 - 1, x1, y1 - 1);
      if (!wall(c - 1, r)) line(g, x0 + 1, y0, x0 + 1, y1);
      if (!wall(c + 1, r)) line(g, x1 - 1, y0, x1 - 1, y1);
    }
  }
  g.stroke();

  // Puerta de la casa: una barra delgada.
  g.shadowBlur = 0;
  g.fillStyle = DOOR;
  g.fillRect(maze.door.x * tile, maze.door.y * tile + tile * 0.42, tile, Math.max(2, tile * 0.16));
  return off;
}

function line(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
}

function drawOrbs(ctx: CanvasRenderingContext2D, maze: Maze, tile: number, scene: Scene, timeMs: number | null) {
  const center = (i: number) => [((i % maze.width) + 0.5) * tile, (Math.floor(i / maze.width) + 0.5) * tile] as const;

  ctx.fillStyle = ORB;
  ctx.beginPath();
  for (const i of scene.orbs) {
    const [x, y] = center(i);
    ctx.moveTo(x + tile * 0.12, y);
    ctx.arc(x, y, tile * 0.12, 0, Math.PI * 2);
  }
  ctx.fill();

  // Pulso de los especiales; quieto si el sistema pide menos movimiento.
  const pulse = timeMs === null ? 1 : 0.85 + 0.15 * Math.sin(timeMs / 180);
  ctx.fillStyle = POWER;
  ctx.beginPath();
  for (const i of scene.power) {
    const [x, y] = center(i);
    const radius = tile * 0.3 * pulse;
    ctx.moveTo(x + radius, y);
    ctx.arc(x, y, radius, 0, Math.PI * 2);
  }
  ctx.fill();
}
