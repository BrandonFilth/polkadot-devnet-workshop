// Panel del admin para pagar premios: elige la ronda, ve el top 3 de ese periodo con su wallet (para copiarla
// y enviar el USDT) y registra cada pago con el enlace o el hash de la transacción. Lo registrado queda
// público en la pestaña Premios.
import { parseTxHash, PRIZE_AMOUNTS, PRIZE_ROUNDS, roundOfPeriod, txUrl, usd, winnersOf, type WinnerRow } from '../contract/prizes';
import { PRIZE_NETWORK, PRIZE_TX_URL } from '../contract/config';
import type { Hub } from '../hub/hub';
import { copyText } from '../lib/clipboard';
import { shortAddress } from '../lib/format';
import { ICON, textWithUsdt } from './icons';

export const TX_INPUT_INVALID = 'Pega el enlace de BscScan o el hash de la transacción (0x seguido de 64 caracteres).';

/** Ronda que el panel abre por defecto: la última ya cerrada (la que toca pagar), o la 1. */
export function defaultRound(p: { started: boolean; current: number } | null): number {
  if (!p || !p.started || p.current < 1) return 1;
  return roundOfPeriod(p.current - 1) ?? PRIZE_ROUNDS;
}

export interface AdminPremios {
  readonly element: HTMLElement;
  readonly isOpen: boolean;
  open(): void;
}

export function createAdminPremios(parent: HTMLElement, hub: Hub, onToggle: () => void = () => {}): AdminPremios {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal admin admin-premios';
  backdrop.hidden = true;

  const dialog = document.createElement('div');
  dialog.className = 'modal-box modal-box--wide';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'admin-premios-title');

  const title = document.createElement('h2');
  title.id = 'admin-premios-title';
  title.textContent = 'Pagar premios';
  const lead = document.createElement('p');
  lead.className = 'card-note';
  lead.textContent = `Copia la wallet de cada ganador, envía el USDT por ${PRIZE_NETWORK} y registra el enlace de la transacción.`;

  const rounds = document.createElement('div');
  rounds.className = 'chips';
  rounds.setAttribute('role', 'group');
  rounds.setAttribute('aria-label', 'Ronda');
  const roundButtons: HTMLButtonElement[] = [];
  for (let r = 1; r <= PRIZE_ROUNDS; r++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip-btn';
    b.textContent = `Ronda ${r}`;
    b.addEventListener('click', () => {
      round = r;
      load();
    });
    rounds.append(b);
    roundButtons.push(b);
  }

  const note = document.createElement('p');
  note.className = 'card-note admin-premios-note';
  const list = document.createElement('ol');
  list.className = 'winners';
  list.setAttribute('aria-live', 'polite');

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'overlay-secondary';
  close.textContent = 'Cerrar';
  actions.append(close);

  dialog.append(title, lead, rounds, note, list, actions);
  backdrop.append(dialog);
  parent.append(backdrop);

  let round = 1;
  let seq = 0;
  let sending = false;
  let returnFocus: HTMLElement | null = null;

  const status = (text: string) => {
    const li = document.createElement('li');
    li.className = 'rounds-status';
    li.textContent = text;
    list.replaceChildren(li);
  };

  const copyButton = (wallet: string, name: string) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'copy-chip';
    b.innerHTML = `${ICON.copiar}<span>${shortAddress(wallet)}</span>`;
    b.setAttribute('aria-label', `Copiar la wallet de ${name}: ${wallet}`);
    b.title = wallet;
    b.addEventListener('click', async () => {
      const ok = await copyText(wallet);
      const span = b.querySelector('span');
      if (span) span.textContent = ok ? 'Copiada' : 'No se pudo copiar';
      setTimeout(() => {
        if (span) span.textContent = shortAddress(wallet);
      }, 1500);
    });
    return b;
  };

  const rowElement = (w: WinnerRow) => {
    const li = document.createElement('li');
    li.className = `winner winner--${w.action}`;
    const name = w.username || shortAddress(w.player);
    const head = document.createElement('div');
    head.className = 'winner-head';
    head.innerHTML = `<span class="winner-place">${w.place}.º</span>`;
    const who = document.createElement('span');
    who.className = 'winner-who';
    who.textContent = `${name} · ${w.score} pts`;
    const amount = document.createElement('span');
    amount.className = 'winner-amount';
    textWithUsdt(amount, usd(w.amount));
    head.append(who, amount);
    li.append(head);

    if (w.paid) {
      const paid = document.createElement('p');
      paid.className = 'winner-paid';
      const link = document.createElement('a');
      link.href = txUrl(w.paid.txHash);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.innerHTML = `<span>Pagado · ver transacción</span>${ICON.enlace}`;
      paid.append(link, document.createTextNode(` a ${shortAddress(w.paid.wallet)}`));
      li.append(paid);
    }
    if (w.wallet) li.append(copyButton(w.wallet, name));
    else {
      const none = document.createElement('p');
      none.className = 'winner-none';
      none.textContent = 'Todavía no registra su wallet: no se puede pagar.';
      li.append(none);
    }

    if (w.wallet) {
      const form = document.createElement('form');
      form.className = 'winner-form';
      form.noValidate = true;
      const id = `tx-${round}-${w.place}`;
      const label = document.createElement('label');
      label.htmlFor = id;
      label.className = 'field-label';
      label.textContent = w.paid ? 'Corregir el enlace o hash del pago' : 'Enlace o hash de la transacción';
      const input = document.createElement('input');
      input.id = id;
      input.type = 'text';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.placeholder = `${PRIZE_TX_URL}0x…`;
      const msg = document.createElement('p');
      msg.className = 'form-message';
      msg.setAttribute('role', 'alert');
      const submit = document.createElement('button');
      submit.type = 'submit';
      submit.className = w.paid ? 'overlay-secondary' : 'overlay-action';
      submit.textContent = w.paid ? 'Corregir pago' : 'Registrar pago';
      form.append(label, input, msg, submit);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (sending) return;
        const hash = parseTxHash(input.value);
        if (!hash) {
          msg.textContent = TX_INPUT_INVALID;
          input.focus();
          return;
        }
        sending = true;
        submit.disabled = true;
        try {
          const r = await hub.recordPrize(round, w.place, w.player, hash);
          if (r.ok) load();
          else {
            const p = hub.getState().progress;
            msg.textContent = p?.op === 'premio' && p.step === 'error' && p.message === r.message ? '' : r.message;
          }
        } finally {
          sending = false;
          submit.disabled = false;
        }
      });
      li.append(form);
    }
    return li;
  };

  const load = () => {
    const mine = ++seq;
    roundButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(i + 1 === round)));
    note.textContent = '';
    status('Cargando…');
    Promise.all([hub.readPeriods(), hub.readTopIn(round - 1, PRIZE_AMOUNTS.length), hub.readPrizes(round)]).then(
      ([p, top, paid]) => {
        if (mine !== seq) return;
        const period = round - 1;
        if (!p.started || period > p.current) note.textContent = 'Esta ronda todavía no empieza.';
        else if (period === p.current) note.textContent = 'Esta ronda sigue en juego: el top 3 todavía puede cambiar.';
        const rows = winnersOf(top, paid);
        if (rows.length === 0) status('Nadie jugó en esta ronda.');
        else list.replaceChildren(...rows.map(rowElement));
      },
      () => {
        if (mine === seq) status('No se pudieron leer los ganadores. Cierra y vuelve a abrir.');
      },
    );
  };

  const hide = () => {
    if (backdrop.hidden || sending) return;
    backdrop.hidden = true;
    seq++;
    onToggle();
    if (!document.activeElement?.closest?.('.tx')) returnFocus?.focus({ preventScroll: true });
    returnFocus = null;
  };
  close.addEventListener('click', hide);

  backdrop.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      hide();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button, input, a[href]')).filter(
      (el) => !(el as HTMLButtonElement).disabled && el.offsetParent !== null,
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
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
      backdrop.hidden = false;
      onToggle();
      close.focus({ preventScroll: true });
      hub.readPeriods().then(
        (p) => {
          round = defaultRound(p);
          load();
        },
        () => load(),
      );
    },
  };
}
