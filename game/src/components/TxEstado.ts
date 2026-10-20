// Popup de estados: aparte y por encima de todo (fin, username, inicio). Simulando → Firma en tu teléfono →
// Enviando → Confirmando en la blockchain → Actualizando → Listo o el error. Mientras hay una firma en curso
// no se puede cerrar y bloquea lo de abajo; al terminar muestra el resultado con «Cerrar».
import type { Hub } from '../hub/hub';
import { KIND_TITLE, progressView, type Progress, type ProgressOp } from '../hub/progress';

const OPS: readonly ProgressOp[] = ['conectar', 'guardar', 'username'];

/** Título mientras la operación sigue en curso. */
export const TX_TITLE: Record<ProgressOp, string> = {
  conectar: 'Conectando',
  guardar: 'Guardando récord',
  username: 'Guardando username',
};

export interface TxPopupView {
  open: boolean;
  /** Solo se puede cerrar cuando no hay nada en curso. */
  closable: boolean;
  title: string;
  tone: 'curso' | 'listo' | 'error';
}

/**
 * Qué muestra el popup. Abierto mientras hay una operación en curso, o con su resultado hasta que se
 * cierra (`dismissed` = el último progreso que se cerró). Una operación nueva lo vuelve a abrir.
 */
export function txPopupView(progress: Progress | null, busy: boolean, dismissed: Progress | null): TxPopupView {
  if (!progress) return { open: false, closable: true, title: '', tone: 'curso' };
  const done = progress.step === 'listo' || progress.step === 'error';
  if (!done) return { open: true, closable: false, title: TX_TITLE[progress.op], tone: 'curso' };
  const title = progress.step === 'listo' ? 'Listo' : progress.kind ? KIND_TITLE[progress.kind] : 'No se pudo completar';
  return { open: progress !== dismissed, closable: !busy, title, tone: progress.step === 'listo' ? 'listo' : 'error' };
}

export interface TxEstado {
  readonly element: HTMLElement;
  readonly isOpen: boolean;
}

/** Se suscribe al Hub una sola vez; vive toda la sesión. Va al final de #app para quedar arriba. */
/** `onToggle` se llama al abrir o cerrar, antes de mover el foco (app.ts reajusta las capas). */
export function createTxEstado(
  parent: HTMLElement,
  hub: Pick<Hub, 'getState' | 'subscribe'>,
  onToggle: () => void = () => {},
): TxEstado {
  const element = document.createElement('div');
  element.className = 'tx';
  element.hidden = true;

  const box = document.createElement('div');
  box.className = 'tx-box';
  box.tabIndex = -1;
  box.setAttribute('role', 'alertdialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'tx-title');
  box.setAttribute('aria-describedby', 'tx-linea');

  const title = document.createElement('h2');
  title.id = 'tx-title';
  const list = document.createElement('ol');
  list.className = 'progreso-pasos';
  const line = document.createElement('p');
  line.id = 'tx-linea';
  line.className = 'progreso-linea';
  line.setAttribute('role', 'status');
  line.setAttribute('aria-live', 'polite');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'overlay-action';
  close.textContent = 'Cerrar';

  const steps = document.createElement('div');
  steps.className = 'progreso';
  steps.append(list, line);
  box.append(title, steps, close);
  element.append(box);
  parent.append(element);

  let dismissed: Progress | null = null;
  let returnFocus: HTMLElement | null = null;
  let shownKey = '';
  let closable = false;

  const render = () => {
    const s = hub.getState();
    const view = txPopupView(s.progress, s.busy, dismissed);
    const pv = view.open ? progressView(s.progress, OPS) : null;
    const key = pv ? `${view.title}|${view.closable}|${pv.line}|${pv.steps.map((x) => x.status).join(',')}` : '';
    if (key === shownKey) return;
    const wasOpen = !element.hidden;
    shownKey = key;
    closable = view.closable;
    if (!view.open || !pv) {
      element.hidden = true;
      if (wasOpen) {
        onToggle();
        // El foco vuelve a donde estaba, si sigue a la vista.
        if (returnFocus?.isConnected && returnFocus.offsetParent !== null) returnFocus.focus({ preventScroll: true });
        returnFocus = null;
      }
      return;
    }
    if (!wasOpen) returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.hidden = false;
    if (!wasOpen) onToggle();
    box.dataset.tone = view.tone;
    steps.dataset.tone = view.tone;
    title.textContent = view.title;
    list.replaceChildren(
      ...pv.steps.map((x) => {
        const li = document.createElement('li');
        li.className = `progreso-paso progreso-paso--${x.status}`;
        li.textContent = x.label;
        if (x.status === 'actual') li.setAttribute('aria-current', 'step');
        return li;
      }),
    );
    line.textContent = pv.line;
    close.hidden = !view.closable;
    if (view.closable) close.focus({ preventScroll: true });
    else if (!box.contains(document.activeElement)) box.focus({ preventScroll: true });
  };

  const dismiss = () => {
    if (!closable) return;
    dismissed = hub.getState().progress;
    render();
  };
  close.addEventListener('click', dismiss);

  // Las teclas del popup no llegan al juego ni a lo de abajo. El foco se queda dentro.
  element.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      dismiss();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      (closable ? close : box).focus({ preventScroll: true });
    }
  });

  hub.subscribe(render);
  render();
  return {
    element,
    get isOpen() {
      return !element.hidden;
    },
  };
}
