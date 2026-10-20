// Convierte un deslizamiento en direcciones: el eje dominante debe superar el umbral; mismos 8 sectores que el joystick.
import { SWIPE_THRESHOLD_PX } from '../engine/rules';
import type { Dir } from '../engine/types';
import { sectorDirections, type Wanted } from './joystick';

/** `dy` positivo es hacia abajo (coordenadas de pantalla). Bajo el umbral da null. */
export function swipeDirections(dx: number, dy: number, threshold = SWIPE_THRESHOLD_PX): Wanted | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null;
  return sectorDirections(dx, dy);
}

/** Solo la dirección del eje dominante. */
export function swipeDirection(dx: number, dy: number, threshold = SWIPE_THRESHOLD_PX): Dir | null {
  return swipeDirections(dx, dy, threshold)?.primary ?? null;
}
