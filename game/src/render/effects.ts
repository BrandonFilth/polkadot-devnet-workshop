// Efectos decorativos (destellos y puntos flotantes). Puro: sin DOM. Usan el tiempo del cuadro en ms.
import {
  DOT_BURST_RADIUS,
  DOT_BURST_SECONDS,
  GHOST_POINTS_RISE,
  GHOST_POINTS_SECONDS,
  POWER_BURST_RADIUS,
  POWER_BURST_SECONDS,
  REDUCED_MOTION_BURST_FACTOR,
} from '../engine/rules';
import type { GameEvent, Maze } from '../engine/types';

/** Un efecto en curso. x, y en casillas (centro de la casilla (c, r) = { x: c, y: r }). */
export type Effect = { kind: 'orbe' | 'especial' | 'puntos'; x: number; y: number; t0Ms: number; text?: string };

/** Cómo se ve un efecto en un instante: opacidad, radio en casillas y casillas que subió. */
export interface EffectFrame {
  alpha: number;
  radius: number;
  rise: number;
}

const DURATION_MS: Record<Effect['kind'], number> = {
  orbe: DOT_BURST_SECONDS * 1000,
  especial: POWER_BURST_SECONDS * 1000,
  puntos: GHOST_POINTS_SECONDS * 1000,
};

const RADIUS: Record<Effect['kind'], number> = {
  orbe: DOT_BURST_RADIUS,
  especial: POWER_BURST_RADIUS,
  puntos: 0,
};

/** Agrega a `list` un efecto por cada bolita, especial o fantasma comido. */
export function addFromEvents(list: Effect[], events: readonly GameEvent[], maze: Maze, nowMs: number): void {
  for (const e of events) {
    if (e.type === 'orbe' || e.type === 'especial') {
      list.push({ kind: e.type, x: e.tile % maze.width, y: Math.floor(e.tile / maze.width), t0Ms: nowMs });
    } else if (e.type === 'fantasmaComido') {
      list.push({ kind: 'puntos', x: e.pos.x, y: e.pos.y, t0Ms: nowMs, text: String(e.points) });
    }
  }
}

/** Quita de `list` (en su lugar) los efectos que ya terminaron. */
export function prune(list: Effect[], nowMs: number): void {
  let keep = 0;
  for (const e of list) {
    if (nowMs - e.t0Ms < DURATION_MS[e.kind]) list[keep++] = e;
  }
  list.length = keep;
}

/**
 * Cuadro de un efecto. Los destellos crecen desde REDUCED_MOTION_BURST_FACTOR del radio hasta el radio completo
 * y se desvanecen; con `reduced` quedan fijos en ese tamaño chico y los puntos no suben (pero se ven).
 */
export function effectFrame(e: Effect, nowMs: number, reduced: boolean): EffectFrame {
  const p = Math.min(1, Math.max(0, (nowMs - e.t0Ms) / DURATION_MS[e.kind]));
  const full = RADIUS[e.kind];
  if (e.kind === 'puntos') {
    // Los puntos se mantienen legibles casi todo el tiempo y se apagan al final.
    return { alpha: 1 - p * p, radius: 0, rise: reduced ? 0 : GHOST_POINTS_RISE * p };
  }
  const small = full * REDUCED_MOTION_BURST_FACTOR;
  return { alpha: 1 - p, radius: reduced ? small : small + (full - small) * p, rise: 0 };
}
