// Overlay sobre el escenario: título, «LISTO», «RONDA N», pausa y fin. Los textos van en una región aria-live.
import { setPaused, start, type GameState } from '../engine/game';
import type { Phase } from '../engine/types';

export interface Overlay {
  readonly element: HTMLElement;
  /** Ajusta el overlay a la fase actual. Solo toca el DOM cuando la fase cambia. */
  sync(): void;
}

export interface OverlayParts {
  /** Antes del título en 'titulo' (estado de la conexión). */
  titleTop: Node[];
  /** Después del botón JUGAR (username y ranking). */
  title: Node[];
  /** Antes del botón en 'fin' (puntaje y guardar). */
  fin: Node[];
  /** Después del botón en 'fin' (ranking). */
  finAfter: Node[];
  /** Hay una firma en curso: «Jugar otra vez» queda deshabilitado. */
  busy(): boolean;
  /** Se llama al cambiar de fase, después de mostrarla. */
  onPhase(phase: Phase): void;
}

export function createOverlay(parent: HTMLElement, state: GameState, parts: OverlayParts): Overlay {
  const element = document.createElement('section');
  element.className = 'overlay';
  element.setAttribute('aria-live', 'polite');

  const top = document.createElement('div');
  top.className = 'overlay-extra';
  const heading = document.createElement('h1');
  const text = document.createElement('p');
  const middle = document.createElement('div');
  middle.className = 'overlay-extra';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'overlay-action';
  const extra = document.createElement('div');
  extra.className = 'overlay-extra';
  element.append(top, heading, text, middle, button, extra);
  parent.append(element);

  let action: (() => void) | null = null;
  button.addEventListener('click', () => action?.());

  const show = (
    title: string,
    message: string,
    label: string | null,
    onClick: (() => void) | null,
    quiet = false,
    before: Node[] = [],
    after: Node[] = [],
    inner: Node[] = [],
  ) => {
    top.replaceChildren(...before);
    top.hidden = before.length === 0;
    middle.replaceChildren(...inner);
    middle.hidden = inner.length === 0;
    extra.replaceChildren(...after);
    extra.hidden = after.length === 0;
    heading.textContent = title;
    text.textContent = message;
    text.hidden = message === '';
    element.classList.toggle('overlay--quiet', quiet);
    action = onClick;
    button.hidden = label === null;
    button.disabled = false;
    element.hidden = false;
    element.scrollTop = 0;
    if (label !== null) {
      button.textContent = label;
      button.focus({ preventScroll: true });
    }
  };

  let shown: Phase | null = null;

  return {
    element,
    sync() {
      if (state.phase === 'fin') {
        const busy = parts.busy();
        if (button.disabled !== busy) button.disabled = busy;
      }
      if (state.phase === shown) return;
      shown = state.phase;
      switch (state.phase) {
        case 'titulo':
          show(
            'POLKA-MAN',
            'Flechas o WASD en la PC. Desliza o usa el D-pad en el celular.',
            'JUGAR',
            () => start(state),
            false,
            parts.titleTop,
            parts.title,
          );
          break;
        case 'listo':
          show('LISTO', '', null, null, true);
          break;
        case 'rondaLimpia':
          // N = la ronda que sigue.
          show(`RONDA ${state.round + 1}`, '', null, null, true);
          break;
        case 'pausa':
          show('PAUSA', 'Toca Seguir o pulsa P para continuar.', 'Seguir', () => setPaused(state, false));
          break;
        case 'fin':
          // Botón .overlay-action: 48 px de alto mínimo (styles.css). El puntaje lo muestra FinDePartida.
          show('FIN', '', 'Jugar otra vez', () => {
            if (!parts.busy()) start(state);
          }, false, [], parts.finAfter, parts.fin);
          button.disabled = parts.busy();
          break;
        default:
          action = null;
          element.hidden = true;
          break;
      }
      parts.onPhase(state.phase);
    },
  };
}
