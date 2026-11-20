// Controles táctiles estilo Atari: botón rojo de pausa a la izquierda y, a la derecha, flechas en cruz o un
// joystick fijo (lo elige el jugador en Perfil). Tocar una flecha pide esa dirección (giro en búfer, como el
// teclado); mantenerla la conserva y deslizar el dedo a otra flecha cambia la dirección sin soltar. El joystick
// pide hacia donde se empuja la palanca, también en diagonal.
import { releaseDirections, setDirections, togglePause, type GameState } from '../engine/game';
import { DPAD_HAPTIC_MS } from '../engine/rules';
import type { Dir } from '../engine/types';
import type { ControlMode, ControlPrefs } from '../input/controlPrefs';
import { createDpad, type Point } from '../input/dpad';
import { joystickDirections, knobOffset, wantedKey } from '../input/joystick';

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

/** `prefs` (opcional) decide si se ven las flechas o el joystick; sin él, flechas. */
export function createControles(state: GameState, prefs?: ControlPrefs): Controles {
  const element = document.createElement('div');
  element.className = 'controles';
  const dpad = createDpad();
  const point = (e: PointerEvent): Point => ({ x: e.clientX, y: e.clientY });

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
      if (e.detail !== 0) return;
      // Un toque sin mantener: el pedido empieza a caducar de inmediato.
      setDirections(state, dir, null);
      releaseDirections(state);
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

  // Joystick fijo: base octagonal con la palanca al centro. Se ve en lugar de las flechas si así lo elige Perfil.
  const joy = document.createElement('div');
  joy.className = 'joystick';
  joy.setAttribute('role', 'group');
  joy.setAttribute('aria-label', 'Joystick');
  const knob = document.createElement('span');
  knob.className = 'joystick-knob';
  knob.setAttribute('aria-hidden', 'true');
  joy.append(knob);

  // Pausa a la izquierda y los controles (flechas o joystick) a la derecha.
  element.append(pause, pad, joy);

  const applyMode = (mode: ControlMode) => {
    element.dataset.modo = mode;
    pad.hidden = mode !== 'cruceta';
    joy.hidden = mode !== 'joystick';
  };
  applyMode(prefs?.mode ?? 'cruceta');
  const unsubscribe = prefs?.subscribe((mode) => {
    releaseJoy();
    if (dpad.pointerId !== null) release(dpad.pointerId);
    applyMode(mode);
  });

  // ---- Joystick: un dedo, centro fijo en la base; pide dirección (y diagonal) mientras se empuja.
  let joyId: number | null = null;
  let joyCenter: Point = { x: 0, y: 0 };
  let joyMax = 0;
  let joyKey = '';
  const placeKnob = (x: number, y: number) => {
    knob.style.transform = x === 0 && y === 0 ? '' : `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  };
  const joyMove = (p: Point) => {
    const dx = p.x - joyCenter.x;
    const dy = p.y - joyCenter.y;
    const k = knobOffset(dx, dy, joyMax);
    placeKnob(k.x, k.y);
    const w = joystickDirections(dx, dy);
    const key = wantedKey(w);
    joy.classList.toggle('joystick--activo', w !== null);
    if (!w || key === joyKey) return;
    joyKey = key;
    setDirections(state, w.primary, w.secondary);
    haptic();
  };
  function releaseJoy() {
    if (joyId === null) return;
    if (joy.hasPointerCapture?.(joyId)) joy.releasePointerCapture(joyId);
    joyId = null;
    joyKey = '';
    placeKnob(0, 0);
    joy.classList.remove('joystick--activo');
    // Al soltar el pedido sigue, pero caduca tras REQUEST_TTL_TILES casillas.
    releaseDirections(state);
  }
  const onJoyDown = (e: PointerEvent) => {
    e.preventDefault();
    if (joyId !== null) return;
    joyId = e.pointerId;
    const r = joy.getBoundingClientRect();
    joyCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    joyMax = (r.width - knob.getBoundingClientRect().width) / 2;
    joy.setPointerCapture?.(e.pointerId);
    joyMove(point(e));
  };
  const onJoyMove = (e: PointerEvent) => {
    if (e.pointerId !== joyId) return;
    e.preventDefault();
    joyMove(point(e));
  };
  const onJoyUp = (e: PointerEvent) => {
    if (e.pointerId === joyId) releaseJoy();
  };
  joy.addEventListener('pointerdown', onJoyDown);
  joy.addEventListener('pointermove', onJoyMove);
  joy.addEventListener('pointerup', onJoyUp);
  joy.addEventListener('pointercancel', onJoyUp);
  joy.addEventListener('lostpointercapture', onJoyUp);


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
    // Al soltar la flecha el pedido sigue, pero caduca tras REQUEST_TTL_TILES casillas.
    releaseDirections(state);
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
    if (joyId !== null && state.phase !== 'listo' && state.phase !== 'jugando') releaseJoy();
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
      joy.removeEventListener('pointerdown', onJoyDown);
      joy.removeEventListener('pointermove', onJoyMove);
      joy.removeEventListener('pointerup', onJoyUp);
      joy.removeEventListener('pointercancel', onJoyUp);
      joy.removeEventListener('lostpointercapture', onJoyUp);
      unsubscribe?.();
      for (const [b, onClick] of clicks) b.removeEventListener('click', onClick);
    },
  };
}
