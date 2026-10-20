// Animaciones de los personajes. Puro: sin DOM; todo sale del estado de la partida.
import {
  DEATH_HOLD_SECONDS,
  DEATH_SECONDS,
  HOUSE_BLINK_PERIOD,
  HOUSE_BLINK_SECONDS,
  MOUTH_STOPPED_OPEN,
} from '../engine/rules';

/** Media apertura de la boca, en fracciones de π: cerrada y abierta. */
export const MOUTH_MIN = 0.04;
export const MOUTH_MAX = 0.26;

/** Apertura de la boca de 0 (cerrada) a 1 (abierta). Quieto contra la pared queda a media apertura. */
export function mouthOpen(player: { mouth: number; moving: boolean }): number {
  return player.moving ? Math.abs(1 - 2 * player.mouth) : MOUTH_STOPPED_OPEN;
}

/** Media apertura de la boca en radianes para una apertura de 0 a 1. */
export function mouthHalf(open: number): number {
  return Math.PI * (MOUTH_MIN + (MOUTH_MAX - MOUTH_MIN) * open);
}

/**
 * Cuadro de la muerte a partir del phaseTimer de 'muriendo' (sin temporizador propio: la pausa lo congela).
 * Primero DEATH_HOLD_SECONDS con la boca abierta; después la boca se abre hasta π y el cuerpo se encoge a 0.
 */
export function deathFrame(phaseTimer: number): { half: number; scale: number } {
  const open = mouthHalf(1);
  const elapsed = DEATH_SECONDS - phaseTimer;
  if (elapsed <= DEATH_HOLD_SECONDS) return { half: open, scale: 1 };
  const p = Math.min(1, (elapsed - DEATH_HOLD_SECONDS) / (DEATH_SECONDS - DEATH_HOLD_SECONDS));
  return { half: open + (Math.PI - open) * p, scale: 1 - p };
}

/** ¿El fantasma en casa está en el tramo apagado del parpadeo? Solo en el último segundo de su espera. */
export function houseBlink(houseTimer: number): boolean {
  if (houseTimer <= 0 || houseTimer > HOUSE_BLINK_SECONDS) return false;
  return Math.floor(houseTimer / HOUSE_BLINK_PERIOD) % 2 === 0;
}
