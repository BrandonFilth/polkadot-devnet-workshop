// Flechas táctiles (D-pad), sin DOM: la dirección sale de dónde está el dedo respecto al centro del pad,
// así las esquinas también cuentan y deslizar de una flecha a otra cambia la dirección. Un solo dedo a la vez.
import { DPAD_BUTTON_PX } from '../engine/rules';
import type { Dir } from '../engine/types';

/** Punto en px CSS (coordenadas de pantalla). */
export interface Point {
  x: number;
  y: number;
}

/**
 * Dirección para un dedo a (`dx`, `dy`) px del centro del pad (`dy` positivo es hacia abajo).
 * Dentro del cuadro central da null. Fuera, gana el eje dominante; si empatan, el horizontal (como el swipe).
 */
export function dpadDirection(dx: number, dy: number, deadHalf = DPAD_BUTTON_PX / 2): Dir | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < deadHalf && ay < deadHalf) return null;
  if (ax >= ay) return dx < 0 ? 'izquierda' : 'derecha';
  return dy < 0 ? 'arriba' : 'abajo';
}

export interface DpadFrame {
  /** Flecha bajo el dedo; null en el centro del pad. */
  dir: Dir | null;
  /** La flecha no nula cambió respecto a la última del toque: hay que avisar al motor y vibrar. */
  changed: boolean;
}

export interface Dpad {
  /** Dedo activo o null. */
  readonly pointerId: number | null;
  /** Última flecha no nula del toque en curso. */
  readonly dir: Dir | null;
  /** Empieza un toque en `p` con el pad centrado en `center`. Da null si ya hay un dedo (el nuevo se ignora). */
  start(pointerId: number, p: Point, center: Point): DpadFrame | null;
  /** Mueve el dedo activo a `p`. Da null si no es el dedo activo. */
  move(pointerId: number, p: Point): DpadFrame | null;
  /** Suelta el dedo. Da true si era el dedo activo. */
  end(pointerId: number): boolean;
}

export function createDpad(deadHalf = DPAD_BUTTON_PX / 2): Dpad {
  let pointerId: number | null = null;
  let center: Point = { x: 0, y: 0 };
  let dir: Dir | null = null;

  const frame = (p: Point): DpadFrame => {
    const d = dpadDirection(p.x - center.x, p.y - center.y, deadHalf);
    const changed = d !== null && d !== dir;
    if (d) dir = d;
    return { dir: d, changed };
  };

  return {
    get pointerId() {
      return pointerId;
    },
    get dir() {
      return dir;
    },
    start(id, p, c) {
      if (pointerId !== null) return null;
      pointerId = id;
      center = { x: c.x, y: c.y };
      dir = null;
      return frame(p);
    },
    move(id, p) {
      if (pointerId === null || id !== pointerId) return null;
      return frame(p);
    },
    end(id) {
      if (pointerId === null || id !== pointerId) return false;
      pointerId = null;
      dir = null;
      return true;
    },
  };
}
