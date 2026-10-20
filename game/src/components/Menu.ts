// Menú superior: Username (elegir o cambiar en cualquier momento, sin récord) y Ranking (top 10).
// Abrirlo pausa la partida; cerrarlo no la reanuda (nada reanuda solo).
import { setPaused, type GameState } from '../engine/game';
import type { HostPhase, Hub } from '../hub/hub';
import type { Mine } from './FinDePartida';
import { createProgreso } from './Progreso';
import { createRanking } from './Ranking';

export type MenuTab = 'username' | 'ranking';

export const MENU_OUTSIDE =
  'Conectar y firmar necesita la Polkadot App o Polkadot Desktop. Aquí puedes jugar y ver el ranking.';
export const FIRST_RECORD_HINT = 'Tu username aparece en el ranking cuando guardes tu primer récord.';

/** Abrir el menú pausa una partida en curso. En el título o en el fin no cambia nada. */
export function pauseForMenu(state: GameState): void {
  setPaused(state, true);
}

export type UsernameAction = 'ninguna' | 'esperar' | 'reintentar' | 'conectar' | 'elegir' | 'cambiar';

/** Qué ofrece la sección Username. Nunca depende de tener un récord guardado. */
export function usernameAction(i: {
  host: HostPhase;
  connected: boolean;
  /** null = todavía no se lee. */
  username: string | null;
  /** null = sin cuenta, leyendo o error. */
  best: bigint | null;
  busy: boolean;
}): { action: UsernameAction; label: string | null; disabled: boolean; text: string; hint: string | null } {
  if (i.host === 'fuera') return { action: 'ninguna', label: null, disabled: true, text: MENU_OUTSIDE, hint: null };
  if (i.host === 'buscando' || i.host === 'conectando') {
    return { action: 'esperar', label: 'Conectar', disabled: true, text: 'Conectando con la Polkadot App…', hint: null };
  }
  if (i.host === 'error') {
    return { action: 'reintentar', label: 'Reintentar', disabled: i.busy, text: 'No hay conexión con la Polkadot App.', hint: null };
  }
  if (!i.connected) {
    return { action: 'conectar', label: 'Conectar', disabled: i.busy, text: 'Conecta tu cuenta para elegir tu username.', hint: null };
  }
  const hint = i.best === 0n ? FIRST_RECORD_HINT : null;
  if (i.username === null || i.username === '') {
    return { action: 'elegir', label: 'Elegir username', disabled: i.busy, text: 'Sin username', hint };
  }
  return { action: 'cambiar', label: 'Cambiar username', disabled: i.busy, text: `Tu username: ${i.username}`, hint };
}

export interface Menu {
  readonly element: HTMLElement;
  readonly isOpen: boolean;
  open(tab?: MenuTab): void;
  close(): void;
  /** Vuelve a dibujar la sección Username (por ejemplo, al cambiar el récord leído). */
  sync(): void;
}

export function createMenu(opts: {
  parent: HTMLElement;
  state: GameState;
  hub: Hub;
  mine: () => Mine;
  openUsername: () => void;
  /** Botón que abre el menú: recibe el foco al cerrar. */
  trigger: () => HTMLElement | null;
}): Menu {
  const { hub } = opts;
  const element = document.createElement('div');
  element.className = 'menu';
  element.hidden = true;

  const sheet = document.createElement('div');
  sheet.className = 'menu-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', 'Menú');

  const bar = document.createElement('div');
  bar.className = 'menu-bar';
  const tabs = document.createElement('div');
  tabs.className = 'menu-tabs';
  tabs.setAttribute('role', 'tablist');
  const tabButton = (tab: MenuTab, text: string) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'menu-tab';
    b.id = `menu-tab-${tab}`;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', `menu-panel-${tab}`);
    b.textContent = text;
    b.addEventListener('click', () => {
      show(tab);
      b.focus({ preventScroll: true });
    });
    return b;
  };
  const userTab = tabButton('username', 'Username');
  const rankTab = tabButton('ranking', 'Ranking');
  tabs.append(userTab, rankTab);
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'menu-close';
  closeButton.textContent = 'Cerrar';
  closeButton.addEventListener('click', () => close());
  bar.append(tabs, closeButton);

  // Username
  const userPanel = document.createElement('section');
  userPanel.className = 'menu-panel';
  userPanel.id = 'menu-panel-username';
  userPanel.setAttribute('role', 'tabpanel');
  userPanel.setAttribute('aria-labelledby', userTab.id);
  const userText = document.createElement('p');
  userText.className = 'menu-text';
  const userButton = document.createElement('button');
  userButton.type = 'button';
  userButton.className = 'overlay-secondary';
  const userHint = document.createElement('p');
  userHint.className = 'menu-hint';
  const progreso = createProgreso(hub, ['conectar', 'guardar', 'username']);
  const userResult = document.createElement('p');
  userResult.className = 'menu-hint';
  userResult.setAttribute('role', 'status');
  userResult.hidden = true;
  userPanel.append(userText, userButton, userHint, progreso.element, userResult);

  // Ranking: su propia instancia; se lee por ETH-RPC, también fuera del Host.
  const ranking = createRanking(hub);
  const rankPanel = document.createElement('section');
  rankPanel.className = 'menu-panel';
  rankPanel.id = 'menu-panel-ranking';
  rankPanel.setAttribute('role', 'tabpanel');
  rankPanel.setAttribute('aria-labelledby', rankTab.id);
  rankPanel.append(ranking.element);

  sheet.append(bar, userPanel, rankPanel);
  element.append(sheet);
  opts.parent.append(element);

  let action: UsernameAction = 'ninguna';
  let tab: MenuTab = 'username';
  let shownKey = '';

  const sync = () => {
    if (element.hidden) return;
    const s = hub.getState();
    const mine = opts.mine();
    const connected = s.account !== null;
    const known = connected && mine !== null && mine !== 'error';
    const view = usernameAction({
      host: s.host,
      connected,
      username: known ? mine.username : null,
      best: known ? mine.best : null,
      busy: s.busy,
    });
    const key = [view.action, view.label, view.disabled, view.text, view.hint].join('|');
    if (key === shownKey) return;
    shownKey = key;
    action = view.action;
    userText.textContent = view.text;
    userText.classList.toggle('menu-text--aviso', view.action === 'ninguna');
    userButton.hidden = view.label === null;
    if (view.label !== null) userButton.textContent = view.label;
    userButton.disabled = view.disabled;
    userHint.hidden = view.hint === null;
    userHint.textContent = view.hint ?? '';
  };

  userButton.addEventListener('click', async () => {
    if (hub.getState().busy) return;
    if (action === 'reintentar') {
      userResult.hidden = true;
      void hub.start();
    } else if (action === 'conectar') {
      progreso.reset();
      const r = await hub.connect();
      const p = hub.getState().progress;
      userResult.textContent = r.message;
      userResult.hidden = p?.op === 'conectar' && p.message === r.message;
    } else if (action === 'elegir' || action === 'cambiar') {
      opts.openUsername();
    }
  });

  const show = (next: MenuTab) => {
    tab = next;
    for (const [b, panel, t] of [
      [userTab, userPanel, 'username'],
      [rankTab, rankPanel, 'ranking'],
    ] as const) {
      const selected = t === next;
      b.setAttribute('aria-selected', String(selected));
      b.tabIndex = selected ? 0 : -1;
      panel.hidden = !selected;
    }
    if (next === 'ranking') ranking.load();
    else sync();
  };

  const focusables = () =>
    Array.from(sheet.querySelectorAll<HTMLElement>('button, input')).filter(
      (el) => !(el as HTMLButtonElement).disabled && el.offsetParent !== null,
    );

  const close = () => {
    if (element.hidden) return;
    element.hidden = true;
    const trigger = opts.trigger();
    trigger?.setAttribute('aria-expanded', 'false');
    trigger?.focus({ preventScroll: true });
  };

  // Tocar fuera de la hoja cierra el menú.
  element.addEventListener('click', (e) => {
    if (e.target === element) close();
  });

  // Las teclas del menú no llegan a los controles del juego.
  element.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const list = focusables();
    const first = list[0];
    const last = list[list.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !sheet.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !sheet.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  });

  hub.subscribe(() => sync());

  return {
    element,
    get isOpen() {
      return !element.hidden;
    },
    open(next = tab) {
      pauseForMenu(opts.state);
      progreso.reset();
      userResult.hidden = true;
      shownKey = '';
      element.hidden = false;
      opts.trigger()?.setAttribute('aria-expanded', 'true');
      show(next);
      (next === 'ranking' ? rankTab : userTab).focus({ preventScroll: true });
    },
    close,
    sync,
  };
}
