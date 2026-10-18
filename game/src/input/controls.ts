// Teclado, swipe sobre el escenario y D-pad. Solo traduce eventos a llamadas del motor.
import { setDirection, start, togglePause, type GameState } from '../engine/game';
import type { Dir } from '../engine/types';
import { swipeDirection } from './swipe';

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

const DIRS: readonly string[] = ['arriba', 'izquierda', 'abajo', 'derecha'];

function isDir(value: string | undefined): value is Dir {
  return value !== undefined && DIRS.includes(value);
}

/** Conecta los controles. `busy()` = hay una firma en curso. Devuelve la función que los desconecta. */
export function attachControls(
  state: GameState,
  stage: HTMLElement,
  dpad: HTMLElement,
  busy: () => boolean,
): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'enter' || key === ' ') {
      // En 'fin', mientras se firma, Enter y Espacio no hacen nada.
      if (state.phase === 'fin' && busy()) {
        e.preventDefault();
        return;
      }
      // Un botón del overlay con foco (Guardar récord, Conectar…) se activa solo; no reinicia la partida.
      const target = e.target as Element | null;
      if (target?.closest?.('.overlay button:not(.overlay-action)')) return;
    }
    const dir = KEYS[key];
    if (dir) {
      e.preventDefault();
      setDirection(state, dir);
    } else if (key === 'p' || key === 'escape') {
      e.preventDefault();
      togglePause(state);
    } else if (key === 'enter' || key === ' ') {
      start(state);
    }
  };

  // Swipe: dispara en cuanto hay dirección y reinicia el origen para encadenar giros.
  let origin: { id: number; x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => {
    if (!e.isPrimary) return;
    origin = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onMove = (e: PointerEvent) => {
    if (!origin || e.pointerId !== origin.id) return;
    const dir = swipeDirection(e.clientX - origin.x, e.clientY - origin.y);
    if (!dir) return;
    setDirection(state, dir);
    origin = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent) => {
    if (origin && e.pointerId === origin.id) origin = null;
  };

  // D-pad: reacciona al tocar (pointerdown); el clic sin puntero (teclado) también cuenta.
  const dirOf = (e: Event): Dir | null => {
    const button = (e.target as Element | null)?.closest<HTMLButtonElement>('button[data-dir]');
    const dir = button?.dataset.dir;
    return isDir(dir) ? dir : null;
  };
  const onPad = (e: PointerEvent) => {
    const dir = dirOf(e);
    if (!dir) return;
    e.preventDefault();
    setDirection(state, dir);
  };
  const onPadClick = (e: MouseEvent) => {
    if (e.detail !== 0) return;
    const dir = dirOf(e);
    if (dir) setDirection(state, dir);
  };

  window.addEventListener('keydown', onKey);
  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onUp);
  dpad.addEventListener('pointerdown', onPad);
  dpad.addEventListener('click', onPadClick);

  return () => {
    window.removeEventListener('keydown', onKey);
    stage.removeEventListener('pointerdown', onDown);
    stage.removeEventListener('pointermove', onMove);
    stage.removeEventListener('pointerup', onUp);
    stage.removeEventListener('pointercancel', onUp);
    dpad.removeEventListener('pointerdown', onPad);
    dpad.removeEventListener('click', onPadClick);
  };
}
