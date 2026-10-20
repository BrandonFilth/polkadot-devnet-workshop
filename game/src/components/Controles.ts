// Controles táctiles estilo Atari: joystick (base + perilla) a la izquierda y botón rojo de pausa a la derecha.
import { setDirection, togglePause, type GameState } from '../engine/game';
import { JOYSTICK_RADIUS_PX } from '../engine/rules';
import type { Dir } from '../engine/types';
import { joystickDirection, knobOffset } from '../input/joystick';

export interface Controles {
  readonly element: HTMLElement;
  /** Ajusta el botón de pausa (Pausa/Seguir) a la fase actual. */
  sync(): void;
  destroy(): void;
}

const PAUSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z"/></svg>';
const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5 L19 12 L8 19 Z"/></svg>';

export function createControles(state: GameState): Controles {
  const element = document.createElement('div');
  element.className = 'controles';

  const base = document.createElement('div');
  base.className = 'joystick';
  base.setAttribute('role', 'group');
  base.setAttribute('aria-label', 'Joystick: arrastra para moverte');
  const knob = document.createElement('div');
  knob.className = 'joystick-knob';
  knob.setAttribute('aria-hidden', 'true');
  base.append(knob);

  const pause = document.createElement('button');
  pause.type = 'button';
  pause.className = 'atari-pause';
  pause.addEventListener('click', () => togglePause(state));

  element.append(base, pause);

  // Un solo dedo a la vez. Al soltar la perilla vuelve al centro y Polka-Man sigue su camino.
  let active: { id: number; cx: number; cy: number } | null = null;
  let last: Dir | null = null;

  const moveKnob = (x: number, y: number) => {
    knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  };

  const track = (e: PointerEvent) => {
    if (!active) return;
    const dx = e.clientX - active.cx;
    const dy = e.clientY - active.cy;
    const k = knobOffset(dx, dy, JOYSTICK_RADIUS_PX);
    moveKnob(k.x, k.y);
    const dir = joystickDirection(dx, dy, JOYSTICK_RADIUS_PX);
    if (dir && dir !== last) {
      last = dir;
      setDirection(state, dir);
    }
  };

  const onDown = (e: PointerEvent) => {
    if (active) return;
    e.preventDefault(); // sin scroll, zoom ni selección mientras se arrastra
    const rect = base.getBoundingClientRect();
    active = { id: e.pointerId, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
    last = null;
    base.setPointerCapture?.(e.pointerId);
    base.classList.add('joystick--activo');
    track(e);
  };
  const onMove = (e: PointerEvent) => {
    if (!active || e.pointerId !== active.id) return;
    e.preventDefault();
    track(e);
  };
  const onUp = (e: PointerEvent) => {
    if (!active || e.pointerId !== active.id) return;
    active = null;
    last = null;
    base.classList.remove('joystick--activo');
    moveKnob(0, 0);
  };

  base.addEventListener('pointerdown', onDown);
  base.addEventListener('pointermove', onMove);
  base.addEventListener('pointerup', onUp);
  base.addEventListener('pointercancel', onUp);
  base.addEventListener('lostpointercapture', onUp);

  let shownPaused: boolean | null = null;
  const sync = () => {
    const paused = state.phase === 'pausa';
    if (paused === shownPaused) return;
    shownPaused = paused;
    pause.setAttribute('aria-label', paused ? 'Seguir' : 'Pausa');
    pause.innerHTML = paused ? PLAY_ICON : PAUSE_ICON;
  };
  sync();

  return {
    element,
    sync,
    destroy() {
      base.removeEventListener('pointerdown', onDown);
      base.removeEventListener('pointermove', onMove);
      base.removeEventListener('pointerup', onUp);
      base.removeEventListener('pointercancel', onUp);
      base.removeEventListener('lostpointercapture', onUp);
    },
  };
}
