// Controles táctiles estilo Atari: flechas en cruz (arriba, abajo, izquierda, derecha) en la zona de abajo y
// botón rojo de pausa a la derecha. Tocar una flecha pide esa dirección (giro en búfer, como el teclado);
// mantenerla la conserva y deslizar el dedo a otra flecha cambia la dirección sin soltar.
import { setDirections, togglePause, type GameState } from '../engine/game';
import { DPAD_HAPTIC_MS } from '../engine/rules';
import type { Dir } from '../engine/types';
import { createDpad, type Point } from '../input/dpad';

export interface Controles {
  readonly element: HTMLElement;
  /** Ajusta el botón de pausa (Pausa/Seguir) a la fase actual y suelta las flechas si ya no se juega. */
  sync(): void;
  destroy(): void;
}

const PAUSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z"/></svg>';
const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5 L19 12 L8 19 Z"/></svg>';

/** Flechas en el orden del DOM (Arriba, Izquierda, Derecha, Abajo), con su nombre y su triángulo. */
const ARROWS: ReadonlyArray<{ dir: Dir; label: string; path: string }> = [
  { dir: 'arriba', label: 'Arriba', path: 'M12 5 L20 18 L4 18 Z' },
  { dir: 'izquierda', label: 'Izquierda', path: 'M5 12 L18 4 L18 20 Z' },
  { dir: 'derecha', label: 'Derecha', path: 'M19 12 L6 4 L6 20 Z' },
  { dir: 'abajo', label: 'Abajo', path: 'M12 19 L20 6 L4 6 Z' },
];

/** Vibración corta al cambiar de flecha. Si el teléfono no la tiene (iOS) no pasa nada. */
function haptic(): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(DPAD_HAPTIC_MS);
  } catch {
    // Falla en silencio.
  }
}

export function createControles(state: GameState): Controles {
  const element = document.createElement('div');
  element.className = 'controles';

  const pad = document.createElement('div');
  pad.className = 'dpad';
  pad.setAttribute('role', 'group');
  pad.setAttribute('aria-label', 'Flechas');

  const buttons = new Map<Dir, HTMLButtonElement>();
  const clicks: Array<[HTMLButtonElement, (e: MouseEvent) => void]> = [];
  for (const { dir, label, path } of ARROWS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `dpad-btn dpad-btn--${dir}`;
    b.dataset.dir = dir;
    b.setAttribute('aria-label', label);
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
    // Activación sin puntero (teclado o lector de pantalla): detail 0. Con dedo ya la manejan los pointer events.
    const onClick = (e: MouseEvent) => {
      if (e.detail === 0) setDirections(state, dir, null);
    };
    b.addEventListener('click', onClick);
    clicks.push([b, onClick]);
    buttons.set(dir, b);
    pad.append(b);
  }

  const pause = document.createElement('button');
  pause.type = 'button';
  pause.className = 'atari-pause';
  pause.addEventListener('click', () => togglePause(state));

  element.append(pad, pause);

  const dpad = createDpad();
  const point = (e: PointerEvent): Point => ({ x: e.clientX, y: e.clientY });

  let shownActive: Dir | null = null;
  const showActive = (dir: Dir | null) => {
    if (dir === shownActive) return;
    if (shownActive) buttons.get(shownActive)?.classList.remove('dpad-btn--activa');
    if (dir) buttons.get(dir)?.classList.add('dpad-btn--activa');
    shownActive = dir;
  };

  const apply = (frame: { dir: Dir | null; changed: boolean }) => {
    if (!frame.changed || !frame.dir) return;
    // Sin diagonales: cada flecha es un pedido recto. Al soltar no se borra (Polka-Man sigue recto).
    setDirections(state, frame.dir, null);
    haptic();
    showActive(frame.dir);
  };

  const release = (id: number) => {
    if (!dpad.end(id)) return; // no era el dedo activo
    if (pad.hasPointerCapture?.(id)) pad.releasePointerCapture(id);
    showActive(null);
  };

  const onDown = (e: PointerEvent) => {
    e.preventDefault(); // sin scroll, zoom, doble tap, foco ni selección
    const rect = pad.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const frame = dpad.start(e.pointerId, point(e), center);
    if (!frame) return; // ya hay un dedo: este se ignora
    pad.setPointerCapture?.(e.pointerId);
    apply(frame);
  };
  const onMove = (e: PointerEvent) => {
    const frame = dpad.move(e.pointerId, point(e));
    if (!frame) return;
    e.preventDefault();
    apply(frame);
  };
  const onUp = (e: PointerEvent) => release(e.pointerId);

  pad.addEventListener('pointerdown', onDown);
  pad.addEventListener('pointermove', onMove);
  pad.addEventListener('pointerup', onUp);
  pad.addEventListener('pointercancel', onUp);
  pad.addEventListener('lostpointercapture', onUp);

  let shownPaused: boolean | null = null;
  function sync() {
    // Si la partida se pausa o termina con el dedo abajo, se sueltan las flechas.
    if (dpad.pointerId !== null && state.phase !== 'listo' && state.phase !== 'jugando') {
      release(dpad.pointerId);
    }
    const paused = state.phase === 'pausa';
    if (paused === shownPaused) return;
    shownPaused = paused;
    pause.setAttribute('aria-label', paused ? 'Seguir' : 'Pausa');
    pause.innerHTML = paused ? PLAY_ICON : PAUSE_ICON;
  }
  sync();

  return {
    element,
    sync,
    destroy() {
      pad.removeEventListener('pointerdown', onDown);
      pad.removeEventListener('pointermove', onMove);
      pad.removeEventListener('pointerup', onUp);
      pad.removeEventListener('pointercancel', onUp);
      pad.removeEventListener('lostpointercapture', onUp);
      for (const [b, onClick] of clicks) b.removeEventListener('click', onClick);
    },
  };
}
