// Bloque de 'fin': puntaje, récord del periodo y de por vida, el botón que decide saveOptions() y el mensaje del último Result.
import { eventStarted, notOpenText, type EventInfo } from '../contract/eventStart';
import type { HostPhase, Hub, Result } from '../hub/hub';

/** 'cerrado' = el ranking todavía no abre: se juega, pero no se ofrece guardar (no se pide firma). */
export type SaveOption = 'fuera' | 'conectar' | 'cero' | 'cargando' | 'guardar' | 'no-supera' | 'cerrado';

export const OUTSIDE_NOTICE =
  'Abre Polka-Man dentro de Polkadot Desktop o de la Polkadot App para guardar tu récord. Aquí puedes jugar y ver el ranking.';

/** Qué ofrecer al terminar. Gana la primera regla que aplica. */
export function saveOptions(i: {
  host: HostPhase;
  connected: boolean;
  score: number;
  best: bigint | null | 'error';
  busy: boolean;
  /** El ranking ya abrió. undefined = no se sabe (no se pudo leer): se ofrece guardar y el contrato decide. */
  started?: boolean;
}): { option: SaveOption; disabled: boolean } {
  if (i.score === 0) return { option: 'cero', disabled: false };
  if (i.host === 'fuera') return { option: 'fuera', disabled: false };
  if (i.started === false) return { option: 'cerrado', disabled: false };
  if (!i.connected) return { option: 'conectar', disabled: i.busy };
  if (i.best === null) return { option: 'cargando', disabled: true };
  // Con 'error' se ofrece guardar: saveScore simula antes de firmar.
  if (i.best === 'error') return { option: 'guardar', disabled: i.busy };
  if (BigInt(i.score) > i.best) return { option: 'guardar', disabled: i.busy };
  return { option: 'no-supera', disabled: false };
}

/** `best` = récord del periodo actual; `lifetime` = récord de por vida. null = leyendo. */
export type Mine = { best: bigint; lifetime: bigint; username: string } | null | 'error';

/** Las tres líneas del resumen. «—» si no hay cuenta, si se está leyendo o si la lectura falló. */
export function finSummary(i: { score: number; connected: boolean; mine: Mine }): [string, string, string] {
  const known = i.connected && i.mine !== null && i.mine !== 'error' ? i.mine : null;
  return [
    `Puntaje: ${i.score}`,
    `Récord del periodo: ${known ? known.best : '—'}`,
    `Récord de por vida: ${known ? known.lifetime : '—'}`,
  ];
}

/** Aviso en lugar del botón de guardar. Vacío cuando hay botón. */
export function finNotice(option: SaveOption, event: EventInfo | null): string {
  if (option === 'fuera') return OUTSIDE_NOTICE;
  if (option === 'cero' || option === 'no-supera') return 'No supera tu récord';
  if (option === 'cerrado') return `${notOpenText(event?.start ?? 0n)} Tu puntaje no se guarda hasta entonces.`;
  return '';
}

export type FinButton = 'guardar' | 'jugar' | 'ranking' | 'inicio';

/**
 * Botones del popup de fin, en orden. El ranking NUNCA va dentro del popup: «Ver ranking» abre su
 * propia pestaña. 'guardar' es el botón de saveOptions (Guardar récord, Conecta para guardar o Leyendo…).
 */
export function finButtons(option: SaveOption): FinButton[] {
  const save = option === 'guardar' || option === 'conectar' || option === 'cargando';
  return [...(save ? (['guardar'] as const) : []), 'jugar', 'ranking', 'inicio'];
}

export interface FinDePartida {
  readonly element: HTMLElement;
  /** Al entrar a 'fin': borra el mensaje anterior. */
  enter(): void;
  /** Ajusta el bloque al estado actual. Solo toca el DOM si algo cambió. */
  sync(): void;
}

const LABELS: Partial<Record<SaveOption, string>> = {
  conectar: 'Conecta para guardar',
  cargando: 'Leyendo tu récord…',
  guardar: 'Guardar récord',
};

export function createFinDePartida(opts: {
  hub: Hub;
  score: () => number;
  mine: () => Mine;
  /** Tras un saveScore con ok:true. */
  onSaved: () => void;
  openUsername: () => void;
  /** Admin y hora de inicio del contrato; null = todavía no se lee o falló. */
  event?: () => EventInfo | null;
}): FinDePartida {
  const { hub } = opts;
  const element = document.createElement('div');
  element.className = 'fin';

  const summary = document.createElement('p');
  summary.className = 'fin-summary';
  const notice = document.createElement('p');
  notice.className = 'fin-notice';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'overlay-secondary';
  const message = document.createElement('p');
  message.className = 'fin-message';
  message.setAttribute('role', 'status');
  const nameLink = document.createElement('button');
  nameLink.type = 'button';
  nameLink.className = 'link-button';
  nameLink.textContent = 'Ponle nombre a tu récord';
  nameLink.addEventListener('click', () => opts.openUsername());
  // Los pasos (Simulando → Firma en tu teléfono → …) van en el popup de estados (TxEstado), encima de este.
  element.append(summary, notice, button, message, nameLink);

  let lastMessage = '';
  let savedOk = false;
  let option: SaveOption = 'cero';
  let shownKey = '';

  // Si el popup de estados ya mostró el resultado, no se repite aquí.
  const shown = (r: Result) => {
    const p = hub.getState().progress;
    return p !== null && (p.step === 'listo' || p.step === 'error') && p.message === r.message ? '' : r.message;
  };

  button.addEventListener('click', async () => {
    if (hub.getState().busy) return;
    if (option === 'conectar') {
      const r = await hub.connect();
      lastMessage = shown(r);
    } else if (option === 'guardar') {
      const r = await hub.saveScore(opts.score());
      lastMessage = shown(r);
      if (r.ok) {
        savedOk = true;
        opts.onSaved();
      }
    }
  });

  const sync = () => {
    const s = hub.getState();
    const mine = opts.mine();
    const connected = s.account !== null;
    const best = !connected ? null : mine === null || mine === 'error' ? mine : mine.best;
    const score = opts.score();
    const event = opts.event?.() ?? null;
    const started = event ? eventStarted(event.start, Date.now() / 1000) : undefined;
    const decided = saveOptions({ host: s.host, connected, score, best, busy: s.busy, ...(started === undefined ? {} : { started }) });
    option = decided.option;
    const lines = finSummary({ score, connected, mine });
    const showName = savedOk && mine !== null && mine !== 'error' && mine.username === '';
    const key = [...lines, decided.option, decided.disabled, lastMessage, showName, event?.start ?? ''].join('|');
    if (key === shownKey) return;
    shownKey = key;

    summary.replaceChildren(
      ...lines.map((text) => {
        const span = document.createElement('span');
        span.textContent = text;
        return span;
      }),
    );
    const label = finButtons(decided.option).includes('guardar') ? LABELS[decided.option] : undefined;
    button.hidden = label === undefined;
    button.disabled = decided.disabled;
    if (label !== undefined) button.textContent = label;
    notice.hidden = label !== undefined;
    notice.textContent = finNotice(decided.option, event);
    message.textContent = lastMessage;
    message.hidden = lastMessage === '';
    nameLink.hidden = !showName;
  };

  return {
    element,
    enter() {
      lastMessage = '';
      savedOk = false;
      shownKey = '';
      sync();
    },
    sync,
  };
}
