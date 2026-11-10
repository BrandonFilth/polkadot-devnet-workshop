// Popup de estados: aparte y por encima de todo (fin, username, inicio). Simulando → Firma en tu teléfono →
// Enviando → Confirmando en la blockchain → Actualizando → Listo o el error. Mientras hay una firma en curso
// no se puede cerrar y bloquea lo de abajo; al terminar muestra el resultado con «Cerrar».
import { CHAIN_ID, LEADERBOARD_ADDRESS } from '../contract/config';
import { COPY_FEEDBACK_MS } from '../engine/rules';
import type { Hub, HubState } from '../hub/hub';
import { KIND_TITLE, progressView, type Progress, type ProgressOp } from '../hub/progress';
import { copyText, type ClipboardEnv } from '../lib/clipboard';
import { typeInto } from '../lib/typewriter';

export const COPY_DETAILS_LABEL = 'Copiar detalles';
export const DETAILS_COPIED_LABEL = 'Detalles copiados';
export const DETAILS_FAILED_LABEL = 'No se pudo copiar';

/** El popup ofrece «Copiar detalles» solo en un error que trae el error completo. */
export function canCopyDetails(progress: Progress | null): boolean {
  return progress?.step === 'error' && typeof progress.details === 'string' && progress.details !== '';
}

/**
 * Texto que se copia para diagnosticar: qué operación, en qué paso falló, el mensaje, la cuenta (direcciones
 * públicas), el contrato, el navegador del Host y el error completo de cada intento. Nada secreto.
 */
export function diagnosticReport(
  progress: Progress,
  ctx: { account: HubState['account']; allowance: HubState['allowance']; userAgent: string; now: Date },
): string {
  return [
    'Polka-Man · detalles del error',
    `fecha: ${ctx.now.toISOString()}`,
    `operación: ${progress.op}`,
    `pasos alcanzados: ${progress.reached.join(' → ')}`,
    `tipo: ${progress.kind ?? 'sin tipo'}`,
    `mensaje: ${progress.message}`,
    `cuenta H160: ${ctx.account?.h160 ?? '—'}`,
    `cuenta SS58: ${ctx.account?.ss58 ?? '—'}`,
    `permiso de gas: ${ctx.allowance ?? '—'}`,
    `contrato: ${LEADERBOARD_ADDRESS} · chainId ${CHAIN_ID}`,
    `navegador: ${ctx.userAgent || '—'}`,
    '',
    progress.details ?? '',
  ].join('\n');
}

const OPS: readonly ProgressOp[] = ['conectar', 'guardar', 'username', 'inicio', 'wallet', 'premio'];

/** Título mientras la operación sigue en curso. */
export const TX_TITLE: Record<ProgressOp, string> = {
  conectar: 'Conectando',
  guardar: 'Guardando récord',
  username: 'Guardando username',
  inicio: 'Guardando hora de inicio',
  wallet: 'Guardando tu wallet',
  premio: 'Registrando el pago',
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
  clipboard?: ClipboardEnv,
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
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'overlay-secondary tx-copiar';
  copy.textContent = COPY_DETAILS_LABEL;
  copy.hidden = true;

  const steps = document.createElement('div');
  steps.className = 'progreso';
  steps.append(list, line);
  box.append(title, steps, close, copy);
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
    typeInto(line, pv.line);
    copy.hidden = !(view.closable && canCopyDetails(s.progress));
    copy.textContent = COPY_DETAILS_LABEL;
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

  let copyTimer: ReturnType<typeof setTimeout> | null = null;
  copy.addEventListener('click', async () => {
    const s = hub.getState();
    if (!s.progress || !canCopyDetails(s.progress)) return;
    const report = diagnosticReport(s.progress, {
      account: s.account,
      allowance: s.allowance,
      userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
      now: new Date(),
    });
    copy.textContent = (await copyText(report, clipboard)) ? DETAILS_COPIED_LABEL : DETAILS_FAILED_LABEL;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copy.textContent = COPY_DETAILS_LABEL;
    }, COPY_FEEDBACK_MS);
  });

  // Las teclas del popup no llegan al juego ni a lo de abajo. El foco se queda dentro.
  element.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      dismiss();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (!closable) {
        box.focus({ preventScroll: true });
        return;
      }
      // Con «Copiar detalles» visible, Tab alterna entre los dos botones.
      const target = !copy.hidden && document.activeElement === close ? copy : close;
      target.focus({ preventScroll: true });
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
