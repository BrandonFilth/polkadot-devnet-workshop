// Joystick flotante, sin DOM: la base aparece donde tocas y, si el dedo se aleja más que el radio,
// la base lo sigue. Un solo dedo a la vez; los demás se ignoran (para poder tocar la pausa).
import {
  JOYSTICK_DEAD_ZONE_PX,
  JOYSTICK_DIAGONAL_HALF_DEG,
  JOYSTICK_HINT_ROUNDS,
  JOYSTICK_RADIUS_PX,
} from '../engine/rules';
import type { Dir, Phase } from '../engine/types';
import { joystickDirections, knobOffset, type Wanted } from './joystick';

export interface Point {
  x: number;
  y: number;
}

export interface StickFrame {
  /** Centro de la base (coordenadas de la zona, px CSS). */
  base: Point;
  /** Centro de la perilla; nunca a más de `radius` de la base. */
  knob: Point;
  /** Dirección principal; null dentro de la zona muerta. */
  dir: Dir | null;
  /** En diagonal, la del otro eje. */
  secondary: Dir | null;
  /** El pedido no nulo cambió respecto al anterior: hay que avisar al motor y vibrar. */
  changed: boolean;
}

export interface StickOptions {
  radius?: number;
  deadZonePx?: number;
  halfDeg?: number;
}

export interface FloatingStick {
  /** Dedo activo o null. */
  readonly pointerId: number | null;
  /** Último pedido no nulo del arrastre en curso. */
  readonly last: Wanted | null;
  /** Empieza un arrastre en `p`. Da null si ya hay un dedo (el nuevo se ignora). */
  start(pointerId: number, p: Point): StickFrame | null;
  /** Mueve el dedo activo a `p`. Da null si no es el dedo activo. */
  move(pointerId: number, p: Point): StickFrame | null;
  /**
   * Suelta el dedo. Da el pedido que queda: la última principal, sin secundaria (sigue recto hasta
   * la pared). Null si no era el dedo activo o nunca salió de la zona muerta.
   */
  end(pointerId: number): Wanted | null;
}

/** Base arrastrada: igual si el dedo está a `radius` o menos; si no, sobre la línea base→dedo a `radius` del dedo. */
export function dragBase(base: Point, finger: Point, radius: number): Point {
  const dx = finger.x - base.x;
  const dy = finger.y - base.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= radius) return base;
  const k = radius / distance;
  return { x: finger.x - dx * k, y: finger.y - dy * k };
}

const HINT_PHASES: readonly Phase[] = ['listo', 'jugando', 'muriendo'];

/** Pista «Toca y arrastra» visible: sin dedo, en las primeras rondas y con la partida en marcha. */
export function stickHintVisible(
  phase: Phase,
  round: number,
  dragging: boolean,
  hintRounds = JOYSTICK_HINT_ROUNDS,
): boolean {
  return !dragging && round <= hintRounds && HINT_PHASES.includes(phase);
}

const keyOf = (w: Wanted | null) => (w ? `${w.primary}|${w.secondary}` : null);

export function createFloatingStick(opts: StickOptions = {}): FloatingStick {
  const radius = opts.radius ?? JOYSTICK_RADIUS_PX;
  const deadZonePx = opts.deadZonePx ?? JOYSTICK_DEAD_ZONE_PX;
  const halfDeg = opts.halfDeg ?? JOYSTICK_DIAGONAL_HALF_DEG;

  let pointerId: number | null = null;
  let base: Point = { x: 0, y: 0 };
  let last: Wanted | null = null;

  return {
    get pointerId() {
      return pointerId;
    },
    get last() {
      return last;
    },
    start(id, p) {
      if (pointerId !== null) return null;
      pointerId = id;
      base = { x: p.x, y: p.y };
      last = null;
      return { base, knob: { x: p.x, y: p.y }, dir: null, secondary: null, changed: false };
    },
    move(id, p) {
      if (pointerId === null || id !== pointerId) return null;
      base = dragBase(base, p, radius);
      const k = knobOffset(p.x - base.x, p.y - base.y, radius);
      const w = joystickDirections(p.x - base.x, p.y - base.y, deadZonePx, halfDeg);
      const changed = w !== null && keyOf(w) !== keyOf(last);
      if (w) last = w;
      return {
        base,
        knob: { x: base.x + k.x, y: base.y + k.y },
        dir: w?.primary ?? null,
        secondary: w?.secondary ?? null,
        changed,
      };
    },
    end(id) {
      if (pointerId === null || id !== pointerId) return null;
      const w = last;
      pointerId = null;
      last = null;
      return w ? { primary: w.primary, secondary: null } : null;
    },
  };
}
