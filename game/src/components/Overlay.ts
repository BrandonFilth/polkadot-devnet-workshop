// Overlay sobre el escenario: «LISTO», «RONDA N», pausa y fin. La pantalla de inicio es components/Inicio.ts.
// Pausa y fin son opacos; «LISTO» y «RONDA N» dejan ver el tablero alrededor de su texto. Región aria-live.
import { setPaused, start, type GameState } from '../engine/game';
import type { Phase } from '../engine/types';

export interface Overlay {
  readonly element: HTMLElement;
  /** Ajusta el overlay a la fase actual. Solo toca el DOM cuando la fase cambia. */
  sync(): void;
}

export interface OverlayParts {
  /** Antes del botón en 'fin' (puntaje y guardar). */
  fin: Node[];
  /** Hay una firma en curso: los botones del fin quedan deshabilitados. */
  busy(): boolean;
  /** «Ver ranking» del fin: abre la pestaña Ranking (nunca dentro del popup). */
  onVerRanking(): void;
  /** «Inicio» del fin: vuelve a la pantalla de inicio. */
  onInicio(): void;
  /** Se llama al cambiar de fase, después de mostrarla. */
  onPhase(phase: Phase): void;
}

export function createOverlay(parent: HTMLElement, state: GameState, parts: OverlayParts): Overlay {
  const element = document.createElement('section');
  element.className = 'overlay';
  element.setAttribute('aria-live', 'polite');

  const box = document.createElement('div');
  box.className = 'overlay-box';
  const heading = document.createElement('h1');
  const text = document.createElement('p');
  const middle = document.createElement('div');
  middle.className = 'overlay-extra';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'overlay-action';

  // Fin: Ver ranking e Inicio, debajo de «Jugar otra vez».
  const finRow = document.createElement('div');
  finRow.className = 'overlay-row';
  const verRanking = document.createElement('button');
  verRanking.type = 'button';
  verRanking.className = 'overlay-secondary';
  verRanking.textContent = 'Ver ranking';
  verRanking.addEventListener('click', () => {
    if (!parts.busy()) parts.onVerRanking();
  });
  const inicio = document.createElement('button');
  inicio.type = 'button';
  inicio.className = 'overlay-secondary';
  inicio.textContent = 'Inicio';
  inicio.addEventListener('click', () => {
    if (!parts.busy()) parts.onInicio();
  });
  finRow.append(verRanking, inicio);

  box.append(heading, text, middle, button, finRow);
  element.append(box);
  parent.append(element);

  let action: (() => void) | null = null;
  button.addEventListener('click', () => action?.());

  const show = (title: string, message: string, label: string | null, onClick: (() => void) | null, quiet = false, inner: Node[] = []) => {
    middle.replaceChildren(...inner);
    middle.hidden = inner.length === 0;
    finRow.hidden = state.phase !== 'fin';
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
      // No le quita el foco al menú, al modal ni al popup de estados (cerraría el teclado del celular).
      const inDialog = document.activeElement?.closest?.('.menu, .modal, .tx');
      if (!inDialog) button.focus({ preventScroll: true });
    }
  };

  let shown: Phase | null = null;

  return {
    element,
    sync() {
      if (state.phase === 'fin') {
        const busy = parts.busy();
        if (button.disabled !== busy) {
          button.disabled = busy;
          verRanking.disabled = busy;
          inicio.disabled = busy;
        }
      }
      if (state.phase === shown) return;
      shown = state.phase;
      switch (state.phase) {
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
        case 'fin': {
          // Botón .overlay-action: 48 px de alto mínimo (styles.css). El puntaje lo muestra FinDePartida.
          show('FIN', '', 'Jugar otra vez', () => {
            if (!parts.busy()) start(state);
          }, false, parts.fin);
          const busy = parts.busy();
          button.disabled = busy;
          verRanking.disabled = busy;
          inicio.disabled = busy;
          break;
        }
        default:
          // 'titulo' lo dibuja Inicio; 'jugando' y 'muriendo' no llevan overlay.
          action = null;
          element.hidden = true;
          break;
      }
      parts.onPhase(state.phase);
    },
  };
}
