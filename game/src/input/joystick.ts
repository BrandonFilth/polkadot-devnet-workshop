// Joystick fijo, sin DOM: la dirección sale de hacia dónde empuja el dedo desde el centro de la base, con una
// zona muerta al centro. Usa los mismos 8 sectores que el teclado y el swipe (en diagonal pide dos direcciones).
import { JOY_DEAD_ZONE_PX } from '../engine/rules';
import { sectorDirections, type Wanted } from './directions';

/** Direcciones para el dedo a (`dx`, `dy`) px del centro (`dy` positivo es hacia abajo). En la zona muerta, null. */
export function joystickDirections(dx: number, dy: number, dead = JOY_DEAD_ZONE_PX): Wanted | null {
  if (Math.hypot(dx, dy) < dead) return null;
  return sectorDirections(dx, dy);
}

/** Dónde dibujar la palanca: el mismo vector, recortado a `max` px del centro. */
export function knobOffset(dx: number, dy: number, max: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  if (len <= max || len === 0) return { x: dx, y: dy };
  const k = max / len;
  return { x: dx * k, y: dy * k };
}

/** Clave para saber si el pedido cambió («principal|secundaria»). */
export const wantedKey = (w: Wanted | null): string => (w ? `${w.primary}|${w.secondary ?? ''}` : '');
