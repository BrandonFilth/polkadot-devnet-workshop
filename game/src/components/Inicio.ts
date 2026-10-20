// Pantalla de inicio (fase 'titulo'): POLKA-MAN, Jugar, Conectar cuenta (recomendado), Ranking y Username.
// Opaca y a pantalla completa. Jugar sin cuenta muestra una sola vez el aviso «Sin cuenta no se guardará tu récord».
import { start, type GameState } from '../engine/game';
import type { HostPhase, Hub } from '../hub/hub';
import type { Mine } from './FinDePartida';

export const INICIO_SUGERENCIA = 'Conecta tu cuenta para guardar tu récord. Puedes jugar sin conectarte.';
export const INICIO_FUERA = 'Conectar necesita la Polkadot App o Polkadot Desktop. Puedes jugar y ver el ranking.';
export const AVISO_SIN_CUENTA = 'Sin cuenta no se guardará tu récord';
export const INICIO_AYUDA = 'Flechas o WASD en la PC. Desliza o usa el joystick en el celular.';

export type ConnectAction = 'conectar' | 'reintentar' | 'esperar';

export interface InicioView {
  /** Botón de conexión; null = no hay (fuera del Host o ya conectado). */
  connect: { action: ConnectAction; label: string; recommended: boolean; disabled: boolean } | null;
  /** Sugerencia de conectar (se puede omitir). */
  suggestion: string | null;
  /** Línea de estado: fuera del Host, sin conexión o cuenta conectada. */
  status: string | null;
  /** Botón Username: solo con cuenta. */
  username: { label: string; disabled: boolean } | null;
}

const mineName = (m: Mine) => (m !== null && m !== 'error' ? m.username : '');

/** Qué muestra la pantalla de inicio. Jugar y Ranking siempre están. */
export function inicioView(i: { host: HostPhase; connected: boolean; mine: Mine; busy: boolean }): InicioView {
  if (i.host === 'fuera') return { connect: null, suggestion: null, status: INICIO_FUERA, username: null };
  if (i.connected) {
    const known = i.mine !== null && i.mine !== 'error';
    const username =
      i.mine === null
        ? { label: 'Leyendo…', disabled: true }
        : { label: known && mineName(i.mine) !== '' ? mineName(i.mine) : 'Elige un username', disabled: i.busy };
    return { connect: null, suggestion: null, status: 'Cuenta conectada', username };
  }
  if (i.host === 'buscando' || i.host === 'conectando') {
    return {
      connect: { action: 'esperar', label: 'Conectando con la Polkadot App…', recommended: false, disabled: true },
      suggestion: INICIO_SUGERENCIA,
      status: null,
      username: null,
    };
  }
  if (i.host === 'error') {
    return {
      connect: { action: 'reintentar', label: 'Reintentar', recommended: false, disabled: i.busy },
      suggestion: INICIO_SUGERENCIA,
      status: 'No hay conexión con la Polkadot App.',
      username: null,
    };
  }
  return {
    connect: { action: 'conectar', label: 'Conectar cuenta', recommended: true, disabled: i.busy },
    suggestion: INICIO_SUGERENCIA,
    status: null,
    username: null,
  };
}

export type JugarResult = 'empezar' | 'aviso';

export interface InicioFlow {
  /** Tocar Jugar. Sin cuenta dentro del Host, la primera vez de la sesión da 'aviso'. */
  jugar(i: { host: HostPhase; connected: boolean }): JugarResult;
  /** «Jugar igual» del aviso. */
  jugarIgual(): 'empezar';
  /** El aviso ya se mostró en esta sesión (solo en memoria). */
  readonly avisoVisto: boolean;
}

export function createInicioFlow(): InicioFlow {
  let avisoVisto = false;
  return {
    jugar(i) {
      // Fuera del Host no se puede conectar: el aviso no ayuda.
      if (i.connected || i.host === 'fuera' || avisoVisto) return 'empezar';
      avisoVisto = true;
      return 'aviso';
    },
    jugarIgual: () => 'empezar',
    get avisoVisto() {
      return avisoVisto;
    },
  };
}

export interface Inicio {
  readonly element: HTMLElement;
  /** El aviso «sin cuenta» está abierto. */
  readonly avisoOpen: boolean;
  readonly aviso: HTMLElement;
  /** Ajusta la pantalla a la fase y al Hub. Solo toca el DOM si algo cambió. */
  sync(): void;
}

export function createInicio(
  parent: HTMLElement,
  opts: {
    state: GameState;
    hub: Hub;
    mine: () => Mine;
    onRanking(): void;
    onUsername(): void;
    /** Al abrir o cerrar el aviso, antes de mover el foco (app.ts reajusta las capas). */
    onToggle?: () => void;
  },
): Inicio {
  const { state, hub } = opts;
  const flow = createInicioFlow();

  const element = document.createElement('section');
  element.className = 'inicio';
  element.setAttribute('aria-labelledby', 'inicio-title');
  element.hidden = true;

  const box = document.createElement('div');
  box.className = 'inicio-box';
  const title = document.createElement('h1');
  title.id = 'inicio-title';
  title.textContent = 'POLKA-MAN';
  const help = document.createElement('p');
  help.className = 'inicio-ayuda';
  help.textContent = INICIO_AYUDA;

  const jugar = document.createElement('button');
  jugar.type = 'button';
  jugar.className = 'overlay-action inicio-jugar';
  jugar.textContent = 'Jugar';

  const suggestion = document.createElement('p');
  suggestion.className = 'inicio-sugerencia';
  const connect = document.createElement('button');
  connect.type = 'button';
  connect.className = 'overlay-secondary inicio-conectar';
  const status = document.createElement('p');
  status.className = 'inicio-status';
  status.setAttribute('role', 'status');

  const row = document.createElement('div');
  row.className = 'overlay-row';
  const ranking = document.createElement('button');
  ranking.type = 'button';
  ranking.className = 'overlay-secondary';
  ranking.textContent = 'Ranking';
  ranking.addEventListener('click', () => opts.onRanking());
  const username = document.createElement('button');
  username.type = 'button';
  username.className = 'overlay-secondary';
  username.addEventListener('click', () => opts.onUsername());
  row.append(ranking, username);

  box.append(title, help, jugar, suggestion, connect, status, row);
  element.append(box);

  // Aviso «sin cuenta»: diálogo opaco encima de la pantalla de inicio.
  const aviso = document.createElement('div');
  aviso.className = 'aviso';
  aviso.hidden = true;
  const avisoBox = document.createElement('div');
  avisoBox.className = 'aviso-box';
  avisoBox.setAttribute('role', 'alertdialog');
  avisoBox.setAttribute('aria-modal', 'true');
  avisoBox.setAttribute('aria-labelledby', 'aviso-title');
  const avisoTitle = document.createElement('h2');
  avisoTitle.id = 'aviso-title';
  avisoTitle.textContent = AVISO_SIN_CUENTA;
  const avisoText = document.createElement('p');
  avisoText.textContent = 'Conecta tu cuenta para guardarlo, o juega igual.';
  const avisoActions = document.createElement('div');
  avisoActions.className = 'modal-actions';
  const avisoConectar = document.createElement('button');
  avisoConectar.type = 'button';
  avisoConectar.className = 'overlay-action';
  avisoConectar.textContent = 'Conectar';
  const avisoJugar = document.createElement('button');
  avisoJugar.type = 'button';
  avisoJugar.className = 'overlay-secondary';
  avisoJugar.textContent = 'Jugar igual';
  avisoActions.append(avisoConectar, avisoJugar);
  avisoBox.append(avisoTitle, avisoText, avisoActions);
  aviso.append(avisoBox);

  parent.append(element, aviso);

  let connectAction: ConnectAction | null = null;

  const closeAviso = () => {
    aviso.hidden = true;
    opts.onToggle?.();
  };

  const doConnect = async () => {
    const s = hub.getState();
    if (s.busy) return;
    if (connectAction === 'reintentar') {
      void hub.start();
      return;
    }
    // Los pasos y el resultado se ven en el popup de estados. Después se queda en el inicio.
    if (s.host === 'listo' && s.account === null) await hub.connect();
  };

  jugar.addEventListener('click', () => {
    const s = hub.getState();
    if (flow.jugar({ host: s.host, connected: s.account !== null }) === 'aviso') {
      aviso.hidden = false;
      opts.onToggle?.();
      avisoConectar.disabled = s.host !== 'listo' || s.busy;
      avisoConectar.focus({ preventScroll: true });
      if (avisoConectar.disabled) avisoJugar.focus({ preventScroll: true });
      return;
    }
    start(state);
  });
  connect.addEventListener('click', () => void doConnect());
  avisoConectar.addEventListener('click', () => {
    closeAviso();
    jugar.focus({ preventScroll: true });
    void doConnect();
  });
  avisoJugar.addEventListener('click', () => {
    closeAviso();
    if (flow.jugarIgual() === 'empezar') start(state);
  });

  // Teclas dentro de la pantalla y del aviso: no llegan al juego. Escape cierra el aviso.
  aviso.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      closeAviso();
      jugar.focus({ preventScroll: true });
    } else if (e.key === 'Tab') {
      const list = [avisoConectar, avisoJugar].filter((b) => !b.disabled);
      const i = list.indexOf(document.activeElement as HTMLButtonElement);
      e.preventDefault();
      list[(i + (e.shiftKey ? list.length - 1 : 1)) % list.length]?.focus();
    }
  });
  element.addEventListener('keydown', (e) => e.stopPropagation());

  let shownKey = '';
  let wasVisible = false;
  const sync = () => {
    const visible = state.phase === 'titulo';
    if (!visible) {
      if (wasVisible) {
        element.hidden = true;
        aviso.hidden = true;
        wasVisible = false;
      }
      return;
    }
    if (!wasVisible) {
      element.hidden = false;
      wasVisible = true;
      shownKey = '';
      const active = document.activeElement;
      if (!active?.closest?.('.menu, .modal, .tx')) jugar.focus({ preventScroll: true });
    }
    const s = hub.getState();
    const view = inicioView({ host: s.host, connected: s.account !== null, mine: opts.mine(), busy: s.busy });
    const key = JSON.stringify(view);
    if (key === shownKey) return;
    shownKey = key;
    connectAction = view.connect?.action ?? null;
    connect.hidden = view.connect === null;
    if (view.connect) {
      connect.textContent = view.connect.recommended ? `${view.connect.label} (recomendado)` : view.connect.label;
      connect.disabled = view.connect.disabled;
      connect.classList.toggle('inicio-conectar--recomendado', view.connect.recommended);
    }
    suggestion.hidden = view.suggestion === null;
    suggestion.textContent = view.suggestion ?? '';
    status.hidden = view.status === null;
    status.textContent = view.status ?? '';
    status.classList.toggle('inicio-status--aviso', s.host === 'fuera');
    username.hidden = view.username === null;
    if (view.username) {
      username.textContent = view.username.label;
      username.disabled = view.username.disabled;
      username.setAttribute(
        'aria-label',
        view.username.label === 'Elige un username' || view.username.label === 'Leyendo…' ? view.username.label : `Username: ${view.username.label}`,
      );
    }
    // Si conectó desde el aviso o algo cambió, el aviso sigue a la conexión.
    if (!aviso.hidden) avisoConectar.disabled = s.host !== 'listo' || s.busy || s.account !== null;
  };

  return {
    element,
    aviso,
    get avisoOpen() {
      return !aviso.hidden;
    },
    sync,
  };
}
