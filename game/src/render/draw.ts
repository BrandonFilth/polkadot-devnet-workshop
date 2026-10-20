// Dibujo en Canvas 2D. Las paredes se pintan una vez por tamaño en un canvas aparte (caché).
import { GHOST_COLORS } from '../engine/ghosts';
import { tileAt } from '../engine/maze';
import { DIR_VECTORS } from '../engine/movement';
import {
  FRIGHT_BLINK_PERIOD,
  FRIGHT_BLINK_SECONDS,
  GHOST_POINTS_FONT,
  HOUSE_BLINK_ALPHA,
  MIN_TILE_PX,
  POWER_BURST_RING,
} from '../engine/rules';
import type { Dir, GhostMode, Maze, Vec } from '../engine/types';
import { deathFrame, houseBlink, mouthHalf, mouthOpen } from './anim';
import { effectFrame, type Effect } from './effects';
import { mazeLayout } from './layout';

const BG = '#050505';
const WALL_FILL = '#111111';
const WALL_EDGE = '#f2f2ef';
const WALL_GLOW = 'rgba(255, 255, 255, 0.35)';
const ORB = '#f2f2ef';
const POWER = '#ff2867';
const DOOR = '#8b8b86';
const MAX_DPR = 3;

const PLAYER = '#ff2867';
const PLAYER_RADIUS = 0.45;

const BURST_ORB = '#f2f2ef';
const BURST_POWER = '#ff2867';
const POINTS_TEXT = '#f2f2ef';

const GHOST_EYE = '#ffffff';
const GHOST_PUPIL = '#1a1a2e';
/** Media anchura del fantasma, en casillas. */
const GHOST_HALF = 0.42;
/** Sube y baja en la casa, en casillas (solo dibujo). */
const GHOST_BOB = 0.15;

const FRIGHT_BODY = '#8b8b86';
const FRIGHT_EYE = '#050505';
const FRIGHT_BLINK = '#f2f2ef';

/** ¿Toca el color de parpadeo? Solo en los últimos FRIGHT_BLINK_SECONDS del susto. */
export function frightBlink(frightTimer: number): boolean {
  if (frightTimer <= 0 || frightTimer > FRIGHT_BLINK_SECONDS) return false;
  return Math.floor(frightTimer / FRIGHT_BLINK_PERIOD) % 2 === 0;
}

const FACING: Record<Dir, number> = {
  derecha: 0,
  abajo: Math.PI / 2,
  izquierda: Math.PI,
  arriba: -Math.PI / 2,
};

/** Lo que cambia de un cuadro a otro. */
export interface Scene {
  /** Orbes que quedan en el estado de la partida (no los del laberinto). */
  orbs: ReadonlySet<number>;
  /** Especiales que quedan en el estado de la partida. */
  power: ReadonlySet<number>;
  player?: { pos: Vec; dir: Dir | null; mouth: number; moving: boolean };
  /** houseTimer: segundos de espera en la casa (parpadeo en el último segundo). */
  ghosts?: ReadonlyArray<{ id: number; pos: Vec; dir: Dir; mode: GhostMode; houseTimer?: number }>;
  /** Segundos de susto que quedan (para el parpadeo). */
  frightTimer?: number;
  /** phaseTimer de 'muriendo' (también en pausa desde 'muriendo'); null si no está muriendo. */
  death?: number | null;
  /** Destellos y puntos flotantes en curso. */
  effects?: readonly Effect[];
}

export interface Renderer {
  /** Tamaño actual de la casilla en px CSS. */
  readonly tile: number;
  /** Dibuja un cuadro. `timeMs` anima el pulso de los especiales. */
  draw(scene: Scene, timeMs: number): void;
  destroy(): void;
}

/** Crea el dibujante. Escucha el tamaño de `stage` con ResizeObserver. */
export function createRenderer(stage: HTMLElement, canvas: HTMLCanvasElement, maze: Maze): Renderer {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no permite dibujar en canvas 2D.');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let tile = MIN_TILE_PX;
  let offset = 0; // px CSS del anillo exterior recortado (render/layout.ts)
  let dpr = 1;
  let walls: HTMLCanvasElement | null = null;

  const resize = () => {
    const rect = stage.getBoundingClientRect();
    const layout = mazeLayout(maze.width, maze.height, rect.width, rect.height);
    tile = layout.tile;
    offset = layout.offset;
    dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const w = layout.cssWidth;
    const h = layout.cssHeight;
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
      // Todo se dibuja en coordenadas del laberinto completo, corrido por el recorte del borde.
      const shift = -offset * dpr;
      if (walls) ctx.drawImage(walls, shift, shift);
      ctx.setTransform(dpr, 0, 0, dpr, shift, shift);
      drawOrbs(ctx, maze, tile, scene, motion.matches ? null : timeMs);
      const death = scene.death ?? null;
      if (scene.player) drawPlayer(ctx, maze, tile, scene.player, death);
      // Al morir solo queda Polka-Man en el tablero.
      if (scene.ghosts && death === null) {
        const blink = frightBlink(scene.frightTimer ?? 0);
        for (const ghost of scene.ghosts) {
          drawGhost(ctx, maze, tile, ghost, motion.matches ? null : timeMs, blink);
        }
      }
      if (scene.effects) drawEffects(ctx, tile, scene.effects, timeMs, motion.matches);
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

/**
 * Polka-Man: círculo rosa con boca que abre y cierra, mirando a su dirección.
 * Con `death` (phaseTimer de 'muriendo') la boca se abre del todo y el cuerpo se encoge.
 */
function drawPlayer(
  ctx: CanvasRenderingContext2D,
  maze: Maze,
  tile: number,
  player: NonNullable<Scene['player']>,
  death: number | null,
) {
  const frame = death === null ? { half: mouthHalf(mouthOpen(player)), scale: 1 } : deathFrame(death);
  if (frame.scale <= 0) return;
  const half = frame.half;
  const facing = FACING[player.dir ?? 'derecha'];
  const radius = tile * PLAYER_RADIUS * frame.scale;

  // Cerca de un borde (túnel) también se dibuja del otro lado; el canvas recorta lo que sale.
  const xs = [player.pos.x];
  if (player.pos.x < 0.5) xs.push(player.pos.x + maze.width);
  if (player.pos.x > maze.width - 1.5) xs.push(player.pos.x - maze.width);

  ctx.fillStyle = PLAYER;
  ctx.beginPath();
  for (const x of xs) {
    const cx = (x + 0.5) * tile;
    const cy = (player.pos.y + 0.5) * tile;
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, facing + half, facing - half + Math.PI * 2);
    ctx.closePath();
  }
  ctx.fill();
}

/** Fantasma: cúpula, cuerpo y 3 picos abajo, con ojos que miran a su dirección. */
function drawGhost(
  ctx: CanvasRenderingContext2D,
  maze: Maze,
  tile: number,
  ghost: NonNullable<Scene['ghosts']>[number],
  timeMs: number | null,
  blink: boolean,
) {
  const scared = ghost.mode === 'asustado';
  const eyesOnly = ghost.mode === 'ojos';
  const color = scared ? (blink ? FRIGHT_BLINK : FRIGHT_BODY) : GHOST_COLORS[ghost.id % GHOST_COLORS.length]!;
  // En la casa sube y baja; desfasado por fantasma. Quieto si se pide menos movimiento.
  const bob = ghost.mode === 'casa' && timeMs !== null ? GHOST_BOB * Math.sin(timeMs / 200 + ghost.id * 2) : 0;

  const xs = [ghost.pos.x];
  if (ghost.pos.x < 0.5) xs.push(ghost.pos.x + maze.width);
  if (ghost.pos.x > maze.width - 1.5) xs.push(ghost.pos.x - maze.width);

  const half = tile * GHOST_HALF;
  const look = DIR_VECTORS[ghost.dir];
  for (const x of xs) {
    const cx = (x + 0.5) * tile;
    const cy = (ghost.pos.y + 0.5 + bob) * tile;
    const top = cy - half * 0.15;
    const bottom = cy + half;

    // Cúpula + cuerpo + 3 picos. Los ojos (fantasma comido) no llevan cuerpo.
    if (!eyesOnly) {
      // En casa, el último segundo de la espera el cuerpo parpadea (los ojos no).
      if (ghost.mode === 'casa' && houseBlink(ghost.houseTimer ?? 0)) ctx.globalAlpha = HOUSE_BLINK_ALPHA;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, top, half, Math.PI, 0);
      ctx.lineTo(cx + half, bottom);
      const step = (half * 2) / 3;
      for (let i = 0; i < 3; i++) {
        const right = cx + half - step * i;
        ctx.lineTo(right - step / 2, bottom - half * 0.3);
        ctx.lineTo(right - step, bottom);
      }
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    const eyeR = half * 0.3;
    const pupilR = half * 0.15;
    if (scared) {
      // Asustado: dos ojos oscuros pequeños, sin pupilas.
      ctx.fillStyle = FRIGHT_EYE;
      ctx.beginPath();
      for (const side of [-1, 1]) {
        const ex = cx + side * half * 0.4;
        ctx.moveTo(ex + pupilR * 1.4, top);
        ctx.arc(ex, top, pupilR * 1.4, 0, Math.PI * 2);
      }
      ctx.fill();
      continue;
    }

    // Ojos blancos y pupilas hacia la dirección.
    for (const side of [-1, 1]) {
      const ex = cx + side * half * 0.4;
      const ey = top;
      ctx.fillStyle = GHOST_EYE;
      ctx.beginPath();
      ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = GHOST_PUPIL;
      ctx.beginPath();
      ctx.arc(ex + look.x * eyeR * 0.5, ey + look.y * eyeR * 0.5, pupilR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Destellos al comer (blanco la bolita, anillo rosa la especial) y puntos flotantes al comer un fantasma. */
function drawEffects(ctx: CanvasRenderingContext2D, tile: number, effects: readonly Effect[], timeMs: number, reduced: boolean) {
  for (const e of effects) {
    const f = effectFrame(e, timeMs, reduced);
    if (f.alpha <= 0) continue;
    const cx = (e.x + 0.5) * tile;
    const cy = (e.y + 0.5 - f.rise) * tile;
    ctx.globalAlpha = f.alpha;
    if (e.kind === 'orbe') {
      ctx.fillStyle = BURST_ORB;
      ctx.beginPath();
      ctx.arc(cx, cy, f.radius * tile, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'especial') {
      ctx.strokeStyle = BURST_POWER;
      ctx.lineWidth = POWER_BURST_RING * tile;
      ctx.beginPath();
      ctx.arc(cx, cy, f.radius * tile, 0, Math.PI * 2);
      ctx.stroke();
    } else if (e.text) {
      // Misma fuente mono que el resto del juego (empaquetada por @fontsource en main.ts).
      ctx.fillStyle = POINTS_TEXT;
      ctx.font = `500 ${Math.round(GHOST_POINTS_FONT * tile)}px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(e.text, cx, cy);
    }
  }
  ctx.globalAlpha = 1;
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
