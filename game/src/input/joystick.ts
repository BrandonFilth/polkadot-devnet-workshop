// Joystick virtual: el desplazamiento de la perilla se convierte en una de las 4 direcciones del laberinto.
import { JOYSTICK_DEAD_ZONE } from '../engine/rules';
import type { Dir } from '../engine/types';

/**
 * Dirección para un desplazamiento (dx, dy) desde el centro de la base. `dy` positivo es hacia abajo.
 * Dentro de la zona muerta (deadZone × radio) da null. Fuera, gana el eje dominante: 4 sectores de 90°
 * centrados en los ejes; en el empate exacto (45°) gana el horizontal, igual que el swipe.
 */
export function joystickDirection(dx: number, dy: number, radius: number, deadZone = JOYSTICK_DEAD_ZONE): Dir | null {
  if (Math.hypot(dx, dy) < deadZone * radius) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'derecha' : 'izquierda';
  return dy > 0 ? 'abajo' : 'arriba';
}

/** Posición de la perilla: el mismo desplazamiento, pero sin salir del radio de la base. */
export function knobOffset(dx: number, dy: number, radius: number): { x: number; y: number } {
  const distance = Math.hypot(dx, dy);
  if (distance <= radius) return { x: dx, y: dy };
  const k = radius / distance;
  return { x: dx * k, y: dy * k };
}
