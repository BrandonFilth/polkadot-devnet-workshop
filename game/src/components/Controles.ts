// Controles táctiles estilo Atari: joystick flotante (aparece donde tocas en la zona de abajo y sigue al dedo,
// 8 sectores con diagonales) y botón rojo de pausa a la derecha, fuera de la zona del joystick.
import { setDirections, togglePause, type GameState } from '../engine/game';
import { JOYSTICK_HAPTIC_MS, JOYSTICK_RADIUS_PX } from '../engine/rules';
import { createFloatingStick, stickHintVisible, type Point, type StickFrame } from '../input/floatingStick';

export interface Controles {
  readonly element: HTMLElement;
  /** Ajusta el botón de pausa (Pausa/Seguir) y la pista del joystick a la fase actual. */
  sync(): void;
  destroy(): void;
}

const PAUSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z"/></svg>';
const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5 L19 12 L8 19 Z"/></svg>';

/** Vibración corta al cambiar de dirección. Si el teléfono no la tiene (iOS) no pasa nada. */
function haptic(): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(JOYSTICK_HAPTIC_MS);
  } catch {
    // Falla en silencio.
  }
}

export function createControles(state: GameState): Controles {
  const element = document.createElement('div');
  element.className = 'controles';

  const zone = document.createElement('div');
  zone.className = 'stick-zone';
  zone.setAttribute('role', 'group');
  zone.setAttribute('aria-label', 'Joystick: toca y arrastra para moverte');

  const hint = document.createElement('div');
  hint.className = 'stick-hint';
  hint.setAttribute('aria-hidden', 'true');
  const hintText = document.createElement('span');
  hintText.textContent = 'Toca y arrastra';
  hint.append(hintText);

  const base = document.createElement('div');
  base.className = 'stick';
  base.setAttribute('aria-hidden', 'true');
  const knob = document.createElement('div');
  knob.className = 'stick-knob';
  base.append(knob);

  zone.append(hint, base);

  const pause = document.createElement('button');
  pause.type = 'button';
  pause.className = 'atari-pause';
  pause.addEventListener('click', () => togglePause(state));

  element.append(zone, pause);

  const stick = createFloatingStick();
  // Esquina de la zona al empezar el arrastre: los puntos van en coordenadas de la zona.
  let origin = { left: 0, top: 0 };
  const local = (e: PointerEvent): Point => ({ x: e.clientX - origin.left, y: e.clientY - origin.top });

  // La dirección se manda en cada pointermove; el dibujo espera al siguiente cuadro (un solo rAF pendiente).
  let pending: StickFrame | null = null;
  let raf = 0;
  const draw = () => {
    raf = 0;
    if (!pending) return;
    const { base: b, knob: k } = pending;
    base.style.transform = `translate(${b.x - JOYSTICK_RADIUS_PX}px, ${b.y - JOYSTICK_RADIUS_PX}px)`;
    knob.style.transform = `translate(calc(-50% + ${k.x - b.x}px), calc(-50% + ${k.y - b.y}px))`;
  };
  const schedule = (frame: StickFrame) => {
    pending = frame;
    if (!raf) raf = requestAnimationFrame(draw);
  };

  const release = (id: number) => {
    if (stick.pointerId !== id) return; // no era el dedo activo
    const w = stick.end(id);
    // Al soltar queda la última principal: Polka-Man sigue recto hasta la pared, como en el clásico.
    if (w) setDirections(state, w.primary, null);
    base.classList.remove('stick--activo'); // se desvanece en --stick-fade
    if (zone.hasPointerCapture?.(id)) zone.releasePointerCapture(id);
    sync();
  };

  const onDown = (e: PointerEvent) => {
    e.preventDefault(); // sin scroll, zoom ni selección mientras se arrastra
    const rect = zone.getBoundingClientRect();
    if (stick.pointerId === null) origin = { left: rect.left, top: rect.top };
    const frame = stick.start(e.pointerId, local(e));
    if (!frame) return; // ya hay un dedo: este se ignora
    zone.setPointerCapture?.(e.pointerId);
    base.classList.add('stick--activo');
    schedule(frame);
    draw(); // la base aparece bajo el dedo ya en este cuadro
    sync();
  };
  const onMove = (e: PointerEvent) => {
    const frame = stick.move(e.pointerId, local(e));
    if (!frame) return;
    e.preventDefault();
    if (frame.dir && frame.changed) {
      setDirections(state, frame.dir, frame.secondary);
      haptic();
    }
    schedule(frame);
  };
  const onUp = (e: PointerEvent) => release(e.pointerId);

  zone.addEventListener('pointerdown', onDown);
  zone.addEventListener('pointermove', onMove);
  zone.addEventListener('pointerup', onUp);
  zone.addEventListener('pointercancel', onUp);
  zone.addEventListener('lostpointercapture', onUp);

  let shownPaused: boolean | null = null;
  let shownHint: boolean | null = null;
  function sync() {
    // Si la partida se pausa o termina con el dedo abajo, se suelta el joystick.
    if (stick.pointerId !== null && state.phase !== 'listo' && state.phase !== 'jugando') {
      release(stick.pointerId);
      return;
    }
    const hintOn = stickHintVisible(state.phase, state.round, stick.pointerId !== null);
    if (hintOn !== shownHint) {
      shownHint = hintOn;
      zone.classList.toggle('stick-zone--pista', hintOn);
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
      zone.removeEventListener('pointerdown', onDown);
      zone.removeEventListener('pointermove', onMove);
      zone.removeEventListener('pointerup', onUp);
      zone.removeEventListener('pointercancel', onUp);
      zone.removeEventListener('lostpointercapture', onUp);
      if (raf) cancelAnimationFrame(raf);
    },
  };
}
