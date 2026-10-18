// Convierte un deslizamiento en dirección: gana el eje dominante si supera el umbral.
import { SWIPE_THRESHOLD_PX } from '../engine/rules';
import type { Dir } from '../engine/types';

/** `dy` positivo es hacia abajo (coordenadas de pantalla). */
export function swipeDirection(dx: number, dy: number, threshold = SWIPE_THRESHOLD_PX): Dir | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax >= ay) {
    if (ax < threshold) return null;
    return dx > 0 ? 'derecha' : 'izquierda';
  }
  if (ay < threshold) return null;
  return dy > 0 ? 'abajo' : 'arriba';
}
