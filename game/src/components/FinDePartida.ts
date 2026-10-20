// Bloque de 'fin': puntaje, récord, el botón que decide saveOptions() y el mensaje del último Result.
import type { HostPhase, Hub, Result } from '../hub/hub';
import { createProgreso } from './Progreso';

export type SaveOption = 'fuera' | 'conectar' | 'cero' | 'cargando' | 'guardar' | 'no-supera';

export const OUTSIDE_NOTICE =
  'Abre Polka-Man dentro de Polkadot Desktop o de la Polkadot App para guardar tu récord. Aquí puedes jugar y ver el ranking.';

/** Qué ofrecer al terminar. Gana la primera regla que aplica. */
export function saveOptions(i: {
  host: HostPhase;
  connected: boolean;
  score: number;
  best: bigint | null | 'error';
  busy: boolean;
}): { option: SaveOption; disabled: boolean } {
  if (i.score === 0) return { option: 'cero', disabled: false };
  if (i.host === 'fuera') return { option: 'fuera', disabled: false };
  if (!i.connected) return { option: 'conectar', disabled: i.busy };
  if (i.best === null) return { option: 'cargando', disabled: true };
  // Con 'error' se ofrece guardar: saveScore simula antes de firmar.
  if (i.best === 'error') return { option: 'guardar', disabled: i.busy };
  if (BigInt(i.score) > i.best) return { option: 'guardar', disabled: i.busy };
  return { option: 'no-supera', disabled: false };
}

export type Mine = { best: bigint; username: string } | null | 'error';

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
  // Simulando… → Esperando tu firma en el teléfono… → … → Listo (o el error con su motivo).
  const progreso = createProgreso(hub, ['guardar', 'conectar']);
  element.append(summary, notice, button, progreso.element, message, nameLink);

  let lastMessage = '';
  let savedOk = false;
  let option: SaveOption = 'cero';
  let shownKey = '';

  // Si el progreso ya muestra el resultado, no se repite en el mensaje.
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
    const decided = saveOptions({ host: s.host, connected, score, best, busy: s.busy });
    option = decided.option;
    const record = connected && mine !== null && mine !== 'error' ? String(mine.best) : '—';
    const showName = savedOk && mine !== null && mine !== 'error' && mine.username === '';
    const key = [score, record, decided.option, decided.disabled, lastMessage, showName].join('|');
    if (key === shownKey) return;
    shownKey = key;

    summary.textContent = `Puntaje: ${score} · Récord: ${record}`;
    const label = LABELS[decided.option];
    button.hidden = label === undefined;
    button.disabled = decided.disabled;
    if (label !== undefined) button.textContent = label;
    notice.hidden = label !== undefined;
    notice.textContent =
      decided.option === 'fuera' ? OUTSIDE_NOTICE : decided.option === 'cero' || decided.option === 'no-supera' ? 'No supera tu récord' : '';
    message.textContent = lastMessage;
    message.hidden = lastMessage === '';
    nameLink.hidden = !showName;
  };

  return {
    element,
    enter() {
      lastMessage = '';
      savedOk = false;
      progreso.reset();
      shownKey = '';
      sync();
    },
    sync,
  };
}
