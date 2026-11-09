// Panel de admin: solo lo abre el admin del contrato (el botón «Admin» de la pantalla de inicio solo se ve con
// esa cuenta). Muestra la hora de inicio y el periodo actual, y fija o cambia la hora de inicio con una fecha y
// una hora hh/mm/ss en la hora de México. «Usar fecha y hora actual» llena los dos campos. Una vez que el ranking
// abre, el contrato ya no deja cambiarla (StartLocked) y el formulario queda bloqueado.
import { START_LOCKED_MESSAGE } from '../contract/errors';
import { formatStart, inputsFromUnix, startFromInputs } from '../contract/eventStart';
import { formatPeriod, periodRange } from '../contract/periods';
import type { Hub } from '../hub/hub';

export const ADMIN_TITLE = 'Panel de admin';
export const ADMIN_NOW_LABEL = 'Usar fecha y hora actual';
export const PAST_START_WARNING =
  'Esa hora ya llegó: el ranking abre en cuanto se confirme y la hora de inicio ya no se podrá cambiar.';

export interface PeriodsInfo {
  current: number;
  start: bigint;
  length: bigint;
  started: boolean;
}

/** Lo que muestra la cabecera del panel y si el formulario se puede usar. */
export function adminInfo(p: PeriodsInfo, nowSec: number): { start: string; period: string; locked: boolean; lockedText: string | null } {
  const start = p.start === 0n ? 'Sin fecha de inicio' : formatStart(Number(p.start));
  if (!p.started) {
    return { start, period: 'El ranking todavía no abre', locked: false, lockedText: null };
  }
  const label = formatPeriod(periodRange(p.start, p.length, p.current), nowSec);
  return { start, period: `Periodo ${p.current} · ${label}`, locked: true, lockedText: START_LOCKED_MESSAGE };
}

/** Vista previa de lo que se va a guardar, o el error de los campos. */
export function adminPreview(
  date: string,
  time: string,
  nowSec: number,
): { ok: true; start: bigint; text: string; warning: string | null } | { ok: false; message: string } {
  const r = startFromInputs(date, time);
  if (!r.ok) return r;
  const warning = Number(r.start) <= Math.floor(nowSec) ? PAST_START_WARNING : null;
  return { ok: true, start: r.start, text: `Se guardará: ${formatStart(Number(r.start))}`, warning };
}

/** Mientras se escribe la hora: solo dígitos, con «/» cada dos (`093` → `09/3`, `093015` → `09/30/15`). */
export function formatTimeTyping(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 6);
  return digits.match(/.{1,2}/g)?.join('/') ?? '';
}

export interface Admin {
  readonly element: HTMLElement;
  readonly isOpen: boolean;
  open(): void;
}

/** `onSaved` tras guardar (app.ts relee el evento); `onToggle` al abrir o cerrar, antes de mover el foco. */
export function createAdmin(parent: HTMLElement, hub: Hub, onSaved: () => void, onToggle: () => void = () => {}): Admin {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal admin';
  backdrop.hidden = true;

  const dialog = document.createElement('form');
  dialog.className = 'modal-box';
  dialog.noValidate = true;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'admin-title');

  const title = document.createElement('h2');
  title.id = 'admin-title';
  title.textContent = ADMIN_TITLE;

  const info = document.createElement('dl');
  info.className = 'admin-info';
  const infoRow = (label: string) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    info.append(dt, dd);
    return dd;
  };
  const startValue = infoRow('Hora de inicio');
  const periodValue = infoRow('Periodo actual');

  const dateLabel = document.createElement('label');
  dateLabel.htmlFor = 'admin-fecha';
  dateLabel.textContent = 'Fecha de inicio (hora de México)';
  const dateInput = document.createElement('input');
  dateInput.id = 'admin-fecha';
  dateInput.type = 'date';

  const timeLabel = document.createElement('label');
  timeLabel.htmlFor = 'admin-hora';
  timeLabel.textContent = 'Hora (hh/mm/ss, 24 horas)';
  const timeInput = document.createElement('input');
  timeInput.id = 'admin-hora';
  timeInput.type = 'text';
  timeInput.inputMode = 'numeric';
  timeInput.autocomplete = 'off';
  timeInput.placeholder = '00/00/00';
  timeInput.maxLength = 8;

  const nowButton = document.createElement('button');
  nowButton.type = 'button';
  nowButton.className = 'overlay-secondary';
  nowButton.textContent = ADMIN_NOW_LABEL;

  const preview = document.createElement('p');
  preview.className = 'admin-preview';
  const warning = document.createElement('p');
  warning.className = 'admin-aviso';
  const message = document.createElement('p');
  message.id = 'admin-message';
  message.className = 'modal-message';
  message.setAttribute('role', 'alert');

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'overlay-action';
  submit.textContent = 'Guardar';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'overlay-secondary';
  cancel.textContent = 'Cerrar';
  actions.append(submit, cancel);

  dialog.append(title, info, dateLabel, dateInput, timeLabel, timeInput, nowButton, preview, warning, message, actions);
  backdrop.append(dialog);
  parent.append(backdrop);

  let returnFocus: HTMLElement | null = null;
  let sending = false;
  let locked = true; // hasta leer el contrato no se deja guardar
  let seq = 0;

  const nowSec = () => Date.now() / 1000;

  const setEnabled = () => {
    const off = sending || locked;
    dateInput.disabled = off;
    timeInput.disabled = off;
    nowButton.disabled = off;
    submit.disabled = off;
    cancel.disabled = sending;
  };

  const updatePreview = () => {
    if (locked || (dateInput.value === '' && timeInput.value === '')) {
      preview.textContent = '';
      warning.textContent = '';
      return;
    }
    const p = adminPreview(dateInput.value, timeInput.value, nowSec());
    preview.textContent = p.ok ? p.text : '';
    warning.textContent = p.ok ? (p.warning ?? '') : '';
  };

  /** Lee la hora de inicio y el periodo del contrato y ajusta el panel. */
  const load = () => {
    const mySeq = ++seq;
    startValue.textContent = 'Leyendo…';
    periodValue.textContent = 'Leyendo…';
    locked = true;
    setEnabled();
    hub.readPeriods().then(
      (p) => {
        if (mySeq !== seq) return;
        const view = adminInfo(p, nowSec());
        startValue.textContent = view.start;
        periodValue.textContent = view.period;
        locked = view.locked;
        if (view.lockedText) message.textContent = view.lockedText;
        // Si ya hay fecha y todavía se puede cambiar, los campos empiezan con ella.
        if (!view.locked && p.start !== 0n && dateInput.value === '' && timeInput.value === '') {
          const v = inputsFromUnix(Number(p.start));
          dateInput.value = v.date;
          timeInput.value = v.time;
        }
        setEnabled();
        updatePreview();
      },
      (error: unknown) => {
        if (mySeq !== seq) return;
        startValue.textContent = '—';
        periodValue.textContent = '—';
        message.textContent = error instanceof Error ? error.message : 'No se pudo leer la hora de inicio';
        locked = false; // el contrato decide al simular
        setEnabled();
      },
    );
  };

  const close = () => {
    if (backdrop.hidden || sending) return;
    backdrop.hidden = true;
    seq++;
    onToggle();
    if (!document.activeElement?.closest?.('.tx')) returnFocus?.focus({ preventScroll: true });
    returnFocus = null;
  };

  timeInput.addEventListener('input', () => {
    const formatted = formatTimeTyping(timeInput.value);
    if (formatted !== timeInput.value) timeInput.value = formatted;
    message.textContent = '';
    updatePreview();
  });
  dateInput.addEventListener('input', () => {
    message.textContent = '';
    updatePreview();
  });
  nowButton.addEventListener('click', () => {
    const v = inputsFromUnix(nowSec());
    dateInput.value = v.date;
    timeInput.value = v.time;
    message.textContent = '';
    updatePreview();
  });

  dialog.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending || locked) return;
    const p = adminPreview(dateInput.value, timeInput.value, nowSec());
    if (!p.ok) {
      message.textContent = p.message;
      (dateInput.value === '' ? dateInput : timeInput).focus();
      return;
    }
    sending = true;
    setEnabled();
    message.textContent = '';
    try {
      const r = await hub.setStartTime(p.start);
      if (r.ok) {
        onSaved();
      } else {
        // El popup de estados ya muestra el error con su motivo; aquí solo lo que no pasó por él.
        const s = hub.getState().progress;
        const covered = s?.op === 'inicio' && s.step === 'error' && s.message === r.message;
        message.textContent = covered ? '' : r.message;
      }
    } finally {
      sending = false;
      setEnabled();
    }
    load();
  });

  cancel.addEventListener('click', close);

  // Las teclas del panel no llegan a los controles del juego. Escape cierra; el foco se queda dentro.
  backdrop.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = [dateInput, timeInput, nowButton, submit, cancel].filter((el) => !el.disabled);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !dialog.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  });

  return {
    element: backdrop,
    get isOpen() {
      return !backdrop.hidden;
    },
    open() {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dateInput.value = '';
      timeInput.value = '';
      message.textContent = '';
      preview.textContent = '';
      warning.textContent = '';
      backdrop.hidden = false;
      onToggle();
      cancel.focus({ preventScroll: true });
      load();
    },
  };
}
