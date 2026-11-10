// Contenedor de la app: barra superior (Polka-Man a la izquierda; billetera y Polkadot a la derecha), una sección
// por pestaña y la barra de navegación inferior Jugar · Ranking · Premios · Perfil.
// Fuera de la partida la pestaña vive en el hash (#/ranking): el botón Atrás de Android vuelve a la anterior.
// En una partida (setInGame) solo queda la barra de navegación encima del juego; las otras pestañas tapan el
// juego (app.ts lo pausa) y no tocan el historial, que sigue en #/partida.
import { parseRoute, routeHash, TAB_LABEL, TABS, type Tab } from '../lib/route';
import { ICON, POLKADOT_LOGO } from './icons';

export interface ShellPanel {
  readonly element: HTMLElement;
  /** Se llama cada vez que la pestaña se muestra. */
  onShow?(): void;
}

export interface Shell {
  readonly element: HTMLElement;
  readonly tab: Tab;
  /** El contenedor tapa el juego: fuera de la partida, o en una partida con otra pestaña que no es Jugar. */
  readonly covers: boolean;
  /** Va a una pestaña. `push` = nueva entrada en el historial (Atrás vuelve a la anterior). En partida no toca el historial. */
  go(tab: Tab, opts?: { push?: boolean; focus?: boolean }): void;
  /** En partida: solo la barra de navegación sobre el juego (pestaña Jugar) o la pestaña elegida encima. */
  setInGame(inGame: boolean): void;
}

export interface ShellOptions {
  panels: Record<Tab, ShellPanel>;
  /** Botón de la billetera (a la derecha, antes del logo de Polkadot). */
  billetera?: HTMLElement;
  /** Al cambiar de pestaña. */
  onTab?(tab: Tab): void;
  /** Historial del navegador; se inyecta para probar sin DOM. */
  history?: Pick<History, 'pushState' | 'replaceState'>;
  location?: Pick<Location, 'hash'>;
}

/** Pestaña a mostrar al cargar: la del hash, o Jugar (también si el hash dice 'partida'). */
export function initialTab(hash: string): Tab {
  const r = parseRoute(hash);
  return r === 'partida' ? 'jugar' : r;
}

/** Modo del contenedor. 'inicio' = fuera de la partida; 'juego' = solo la barra; 'encima' = pestaña sobre el juego. */
export function shellMode(inGame: boolean, tab: Tab): 'inicio' | 'juego' | 'encima' {
  if (!inGame) return 'inicio';
  return tab === 'jugar' ? 'juego' : 'encima';
}

export function createShell(parent: HTMLElement, opts: ShellOptions): Shell {
  const hist = opts.history ?? window.history;
  const loc = opts.location ?? window.location;

  const element = document.createElement('div');
  element.className = 'shell';
  element.hidden = true;

  const bar = document.createElement('header');
  bar.className = 'shell-bar';
  const brand = document.createElement('p');
  brand.className = 'shell-brand';
  brand.innerHTML = `<span class="shell-mark" aria-hidden="true">${ICON.jugar}</span><span>POLKA-MAN</span>`;
  const polkadot = document.createElement('p');
  polkadot.className = 'shell-polkadot';
  polkadot.innerHTML = `<span class="shell-polkadot-mark" aria-hidden="true">${POLKADOT_LOGO}</span><span class="shell-polkadot-text">POLKADOT</span>`;
  bar.append(brand);
  if (opts.billetera) bar.append(opts.billetera);
  bar.append(polkadot);

  const main = document.createElement('main');
  main.className = 'shell-main';

  const nav = document.createElement('nav');
  nav.className = 'tabbar';
  nav.setAttribute('aria-label', 'Secciones');

  let inGame = false;

  const buttons = new Map<Tab, HTMLButtonElement>();
  const sections = new Map<Tab, HTMLElement>();
  for (const tab of TABS) {
    const section = document.createElement('section');
    section.className = `shell-panel shell-panel--${tab}`;
    section.id = `panel-${tab}`;
    section.setAttribute('aria-label', TAB_LABEL[tab]);
    section.tabIndex = -1;
    section.hidden = true;
    section.append(opts.panels[tab].element);
    main.append(section);
    sections.set(tab, section);

    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tabbar-btn';
    b.dataset.tab = tab;
    b.setAttribute('aria-controls', section.id);
    b.innerHTML = `<span class="tabbar-icon">${ICON[tab]}</span><span class="tabbar-label">${TAB_LABEL[tab]}</span>`;
    b.addEventListener('click', () => go(tab, { push: true, focus: true }));
    nav.append(b);
    buttons.set(tab, b);
  }

  element.append(bar, main, nav);
  parent.append(element);

  let tab: Tab = initialTab(loc.hash);

  const paintMode = () => {
    element.dataset.modo = shellMode(inGame, tab);
  };

  function go(next: Tab, o: { push?: boolean; focus?: boolean } = {}) {
    const changed = next !== tab;
    tab = next;
    // En partida el historial se queda en #/partida: Atrás sigue preguntando si quieres salir.
    if (!inGame) {
      const hash = routeHash(next);
      if (o.push && changed) hist.pushState(null, '', hash);
      else if (loc.hash !== hash) hist.replaceState(null, '', hash);
    }
    for (const [t, b] of buttons) {
      if (t === next) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
    for (const [t, s] of sections) s.hidden = t !== next;
    paintMode();
    main.scrollTop = 0;
    opts.panels[next].onShow?.();
    opts.onTab?.(next);
    if (o.focus && shellMode(inGame, next) !== 'juego') sections.get(next)?.focus({ preventScroll: true });
  }

  go(tab);

  return {
    element,
    get tab() {
      return tab;
    },
    get covers() {
      return shellMode(inGame, tab) !== 'juego';
    },
    go,
    setInGame(value) {
      element.hidden = false;
      if (value === inGame) return;
      inGame = value;
      paintMode();
      // Al volver de la partida se relee la pestaña que queda a la vista.
      if (!inGame) opts.panels[tab].onShow?.();
    },
  };
}
