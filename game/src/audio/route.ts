// Traduce cada evento del motor a su efecto de sonido.
import type { GameEvent } from '../engine/types';
import type { Sfx } from './sfx';

export function routeEvent(e: GameEvent, sfx: Sfx): void {
  switch (e.type) {
    case 'orbe':
      sfx.onDotEaten();
      break;
    case 'especial':
      sfx.onPowerDot();
      break;
    case 'fantasmaComido':
      sfx.onGhostEaten(e.points);
      break;
    case 'muerte':
      sfx.onDeath();
      break;
    case 'rondaLimpia':
      sfx.onRoundClear();
      break;
    case 'finPartida':
      sfx.onGameOver();
      break;
    case 'inicio':
      break;
  }
}
