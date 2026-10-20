// Joystick virtual: el desplazamiento de la perilla se convierte en direcciones del laberinto (8 sectores).
import { JOYSTICK_DEAD_ZONE_PX, JOYSTICK_DIAGONAL_HALF_DEG } from '../engine/rules';
import type { Dir } from '../engine/types';

/** Lo que pide un gesto: la dirección del eje dominante y, en diagonal, la del otro eje. */
export interface Wanted {
  primary: Dir;
  secondary: Dir | null;
}

/**
 * 8 sectores para un desplazamiento (dx, dy) fuera de la zona muerta. `dy` positivo es hacia abajo.
 * Recto si el ángulo queda a (45 − halfDeg)° o menos de un eje; si no, diagonal: principal = eje
 * dominante (en el empate exacto de 45° gana el horizontal), secundaria = el otro eje.
 */
export function sectorDirections(dx: number, dy: number, halfDeg = JOYSTICK_DIAGONAL_HALF_DEG): Wanted {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const horizontal: Dir = dx > 0 ? 'derecha' : 'izquierda';
  const vertical: Dir = dy > 0 ? 'abajo' : 'arriba';
  const band = 45 - halfDeg;
  // Ángulo desde el eje horizontal, de 0 a 90.
  const angle = (Math.atan2(ay, ax) * 180) / Math.PI;
  if (angle <= band) return { primary: horizontal, secondary: null };
  if (angle >= 90 - band) return { primary: vertical, secondary: null };
  return ax >= ay ? { primary: horizontal, secondary: vertical } : { primary: vertical, secondary: horizontal };
}

/** Direcciones del joystick. A menos de `deadZonePx` px del centro de la base da null. */
export function joystickDirections(
  dx: number,
  dy: number,
  deadZonePx = JOYSTICK_DEAD_ZONE_PX,
  halfDeg = JOYSTICK_DIAGONAL_HALF_DEG,
): Wanted | null {
  if (Math.hypot(dx, dy) < deadZonePx) return null;
  return sectorDirections(dx, dy, halfDeg);
}

/**
 * Dirección principal para un desplazamiento (dx, dy): gana el eje dominante; en el empate exacto
 * (45°) gana el horizontal, igual que el swipe. Dentro de la zona muerta da null.
 */
export function joystickDirection(dx: number, dy: number, deadZonePx = JOYSTICK_DEAD_ZONE_PX): Dir | null {
  return joystickDirections(dx, dy, deadZonePx)?.primary ?? null;
}

/** Posición de la perilla: el mismo desplazamiento, pero sin salir del radio de la base. */
export function knobOffset(dx: number, dy: number, radius: number): { x: number; y: number } {
  const distance = Math.hypot(dx, dy);
  if (distance <= radius) return { x: dx, y: dy };
  const k = radius / distance;
  return { x: dx * k, y: dy * k };
}
