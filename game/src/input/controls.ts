// Teclado y swipe sobre el escenario. El joystick vive en components/Controles.ts. Solo traduce eventos a llamadas del motor.
import { setDirections, start, togglePause, type GameState } from '../engine/game';
import { OPPOSITE } from '../engine/movement';
import type { Dir } from '../engine/types';
import type { Wanted } from './joystick';
import { swipeDirections } from './swipe';

const KEYS: Record<string, Dir> = {
  arrowup: 'arriba',
  arrowleft: 'izquierda',
  arrowdown: 'abajo',
  arrowright: 'derecha',
  w: 'arriba',
  a: 'izquierda',
  s: 'abajo',
  d: 'derecha',
};

/** Botones que se activan solos con Enter o Espacio: no deben empezar ni reiniciar la partida. */
const OWN_BUTTONS =
  '.overlay button:not(.overlay-action), .hud button, .menu button, .controles button, .modal button, .inicio button, .aviso button, .tx button';

/**
 * Teclas de dirección sostenidas (la última es la más reciente) → lo que se pide.
 * Principal = la última pulsada; secundaria = la sostenida más reciente perpendicular a ella.
 * Dos paralelas (arriba y abajo) cuentan solo la última.
 */
export function keysToDirections(held: readonly Dir[]): Wanted | null {
  const primary = held[held.length - 1];
  if (primary === undefined) return null;
  for (let i = held.length - 2; i >= 0; i--) {
    const d = held[i]!;
    if (d !== primary && d !== OPPOSITE[primary]) return { primary, secondary: d };
  }
  return { primary, secondary: null };
}

/**
 * Conecta los controles. `busy()` = hay una firma en curso; `blocked()` = hay una pantalla o popup
 * encima del juego (sus teclas no mueven a Polka-Man). Devuelve la función que los desconecta.
 */
export function attachControls(
  state: GameState,
  stage: HTMLElement,
  busy: () => boolean,
  blocked: () => boolean = () => false,
): () => void {
  let held: Dir[] = [];
  const request = () => {
    const w = keysToDirections(held);
    if (w) setDirections(state, w.primary, w.secondary);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'enter' || key === ' ') {
      // En 'fin', mientras se firma, Enter y Espacio no hacen nada.
      if (state.phase === 'fin' && busy()) {
        e.preventDefault();
        return;
      }
      // Un botón con foco (Guardar récord, Conectar, Menú…) se activa solo; no reinicia la partida.
      const target = e.target as Element | null;
      if (target?.closest?.(OWN_BUTTONS)) return;
    }
    const dir = KEYS[key];
    // Pausa (P / Escape) sí funciona con la pausa abierta; lo demás no, si hay algo encima del juego.
    const pauseKey = key === 'p' || key === 'escape';
    if (blocked() && !(pauseKey && state.phase === 'pausa')) return;
    if (dir) {
      e.preventDefault();
      if (!e.repeat) held = [...held.filter((d) => d !== dir), dir];
      request();
    } else if (pauseKey) {
      e.preventDefault();
      togglePause(state);
    } else if (key === 'enter' || key === ' ') {
      start(state);
    }
  };

  // Al soltar una de dos teclas queda la otra, recta. Al soltar todas se mantiene el último pedido.
  const onKeyUp = (e: KeyboardEvent) => {
    const dir = KEYS[e.key.toLowerCase()];
    if (!dir || !held.includes(dir)) return;
    held = held.filter((d) => d !== dir);
    if (held.length > 0) request();
  };
  const onBlur = () => {
    held = [];
  };

  // Swipe: dispara en cuanto hay dirección y reinicia el origen para encadenar giros.
  // Un swipe diagonal pide dos direcciones mientras el dedo sigue abajo; al soltar queda la principal.
  let origin: { id: number; x: number; y: number } | null = null;
  let lastSwipe: Dir | null = null;
  const onDown = (e: PointerEvent) => {
    if (!e.isPrimary) return;
    origin = { id: e.pointerId, x: e.clientX, y: e.clientY };
    lastSwipe = null;
  };
  const onMove = (e: PointerEvent) => {
    if (!origin || e.pointerId !== origin.id) return;
    const w = swipeDirections(e.clientX - origin.x, e.clientY - origin.y);
    if (!w) return;
    setDirections(state, w.primary, w.secondary);
    lastSwipe = w.primary;
    origin = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent) => {
    if (!origin || e.pointerId !== origin.id) return;
    origin = null;
    if (lastSwipe) setDirections(state, lastSwipe, null);
    lastSwipe = null;
  };

  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onUp);

  return () => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    stage.removeEventListener('pointerdown', onDown);
    stage.removeEventListener('pointermove', onMove);
    stage.removeEventListener('pointerup', onUp);
    stage.removeEventListener('pointercancel', onUp);
  };
}
