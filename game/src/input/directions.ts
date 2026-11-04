// 8 sectores compartidos por swipe y teclado: un desplazamiento se convierte en direcciones del laberinto.
import { SWIPE_DIAGONAL_HALF_DEG } from '../engine/rules';
import type { Dir } from '../engine/types';

/** Lo que pide un gesto: la dirección del eje dominante y, en diagonal, la del otro eje. */
export interface Wanted {
  primary: Dir;
  secondary: Dir | null;
}

/**
 * 8 sectores para un desplazamiento (dx, dy). `dy` positivo es hacia abajo.
 * Recto si el ángulo queda a (45 − halfDeg)° o menos de un eje; si no, diagonal: principal = eje
 * dominante (en el empate exacto de 45° gana el horizontal), secundaria = el otro eje.
 */
export function sectorDirections(dx: number, dy: number, halfDeg = SWIPE_DIAGONAL_HALF_DEG): Wanted {
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
