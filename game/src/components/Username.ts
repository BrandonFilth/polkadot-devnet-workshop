// Modal para elegir username: valida antes de enviar, foco atrapado y Escape cierra.
import { INVALID_USERNAME_MESSAGE } from '../contract/errors';
import type { Hub } from '../hub/hub';
import { isValidUsername } from '../lib/username';
import { DONE_VISIBLE_MS } from '../engine/rules';
import { createProgreso } from './Progreso';

export interface Username {
  /** Abre el modal con el username actual. */
  open(current: string): void;
}

export function createUsername(parent: HTMLElement, hub: Hub, onSaved: () => void): Username {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal';
  backdrop.hidden = true;

  const dialog = document.createElement('form');
  dialog.className = 'modal-box';
  dialog.noValidate = true;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'username-title');

  const title = document.createElement('h2');
  title.id = 'username-title';
  title.textContent = 'Tu username';

  const label = document.createElement('label');
  label.htmlFor = 'username-input';
  label.textContent = '3 a 16 caracteres: a-z, 0-9 o _';
  const input = document.createElement('input');
  input.id = 'username-input';
  input.type = 'text';
  input.autocomplete = 'off';
  input.autocapitalize = 'none';
  input.spellcheck = false;
  input.maxLength = 16;
  input.setAttribute('aria-describedby', 'username-message');

  const message = document.createElement('p');
  message.id = 'username-message';
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
  cancel.textContent = 'Cancelar';
  actions.append(submit, cancel);

  const progreso = createProgreso(hub, ['username']);

  dialog.append(title, label, input, message, progreso.element, actions);
  backdrop.append(dialog);
  parent.append(backdrop);

  let returnFocus: HTMLElement | null = null;
  let sending = false;

  const close = () => {
    if (backdrop.hidden || sending) return;
    backdrop.hidden = true;
    returnFocus?.focus({ preventScroll: true });
    returnFocus = null;
  };

  input.addEventListener('input', () => {
    const lower = input.value.toLowerCase();
    if (lower !== input.value) {
      const at = input.selectionStart;
      input.value = lower;
      if (at !== null) input.setSelectionRange(at, at);
    }
  });

  dialog.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    const name = input.value;
    if (!isValidUsername(name)) {
      message.textContent = INVALID_USERNAME_MESSAGE;
      input.focus();
      return;
    }
    // Mientras se firma no se puede cancelar ni enviar otra vez; el progreso dice en qué paso va.
    sending = true;
    submit.disabled = true;
    cancel.disabled = true;
    input.readOnly = true;
    message.textContent = '';
    progreso.reset();
    let saved = false;
    try {
      const r = await hub.setUsername(name);
      if (r.ok) {
        saved = true;
        // Deja ver «Listo» un momento antes de cerrar.
        await new Promise((resolve) => setTimeout(resolve, DONE_VISIBLE_MS));
      } else {
        // El progreso ya muestra el error con su motivo (rechazada, sin respuesta…); aquí solo lo que no pasó por él.
        const p = hub.getState().progress;
        const covered = p?.op === 'username' && p.step === 'error' && p.message === r.message;
        message.textContent = covered ? '' : r.message;
      }
    } finally {
      sending = false;
      submit.disabled = false;
      cancel.disabled = false;
      input.readOnly = false;
    }
    if (saved) {
      close();
      onSaved();
    }
  });

  cancel.addEventListener('click', close);

  // Las teclas del modal no llegan a los controles del juego.
  backdrop.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      close(); // no cierra mientras se firma
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = [input, submit, cancel].filter((el) => !el.disabled);
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
    open(current) {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      input.value = current;
      message.textContent = '';
      progreso.reset();
      backdrop.hidden = false;
      input.focus();
      input.select();
    },
  };
}
