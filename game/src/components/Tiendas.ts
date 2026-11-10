// «Binance» y «Nova Wallet» como enlaces en Premios y Perfil: cada uno abre un diálogo que pregunta si tienes
// iPhone (iOS) o Android y lleva a la tienda oficial para instalar esa app. Los enlaces viven en contract/config.ts.
import { BINANCE_ANDROID_URL, BINANCE_IOS_URL, NOVA_WALLET_ANDROID_URL, NOVA_WALLET_IOS_URL } from '../contract/config';
import { ICON } from './icons';

export type AppId = 'binance' | 'nova';

/** Apps que se pueden instalar desde la app, con su nombre tal como aparece en los textos. */
export const STORE_APPS: Record<AppId, { name: string; ios: string; android: string }> = {
  binance: { name: 'Binance', ios: BINANCE_IOS_URL, android: BINANCE_ANDROID_URL },
  nova: { name: 'Nova Wallet', ios: NOVA_WALLET_IOS_URL, android: NOVA_WALLET_ANDROID_URL },
};

const APP_IDS = Object.keys(STORE_APPS) as AppId[];

/** Partes de `text`: trozos de texto y menciones de una app (la primera que aparece en cada punto). */
export function splitApps(text: string): Array<string | AppId> {
  const out: Array<string | AppId> = [];
  let rest = text;
  while (rest) {
    let best: { id: AppId; at: number } | null = null;
    for (const id of APP_IDS) {
      const at = rest.indexOf(STORE_APPS[id].name);
      if (at >= 0 && (!best || at < best.at)) best = { id, at };
    }
    if (!best) {
      out.push(rest);
      break;
    }
    if (best.at > 0) out.push(rest.slice(0, best.at));
    out.push(best.id);
    rest = rest.slice(best.at + STORE_APPS[best.id].name.length);
  }
  return out;
}

/** Pone `text` en `el` con cada «Binance» y «Nova Wallet» como botón con estilo de enlace que llama a `onOpen`. */
export function textWithApps(el: HTMLElement, text: string, onOpen: (app: AppId) => void): void {
  el.replaceChildren(
    ...splitApps(text).map((part) => {
      if (!APP_IDS.includes(part as AppId)) return document.createTextNode(part);
      const id = part as AppId;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'app-link';
      b.dataset.app = id;
      b.textContent = STORE_APPS[id].name;
      b.setAttribute('aria-haspopup', 'dialog');
      b.setAttribute('aria-label', `${STORE_APPS[id].name}: instalar desde la tienda de tu teléfono`);
      b.addEventListener('click', () => onOpen(id));
      return b;
    }),
  );
}

export interface StoreDialog {
  readonly element: HTMLElement;
  readonly isOpen: boolean;
  open(app: AppId): void;
  close(): void;
}

const STORES = [
  { os: 'ios', label: 'iPhone (iOS)', store: 'App Store', icon: 'apple' },
  { os: 'android', label: 'Android', store: 'Google Play', icon: 'android' },
] as const;

/** Diálogo «Instala …: ¿qué teléfono tienes?» con iOS y Android. `onToggle` al abrir o cerrar (app.ts reajusta las capas). */
export function createStoreDialog(parent: HTMLElement, onToggle: () => void = () => {}): StoreDialog {
  const backdrop = document.createElement('div');
  backdrop.className = 'aviso tiendas';
  backdrop.hidden = true;
  const box = document.createElement('div');
  box.className = 'aviso-box';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'tiendas-title');
  box.setAttribute('aria-describedby', 'tiendas-text');
  const title = document.createElement('h2');
  title.id = 'tiendas-title';
  const text = document.createElement('p');
  text.id = 'tiendas-text';
  text.textContent = '¿Qué teléfono tienes? Te llevamos a la tienda oficial.';

  const list = document.createElement('div');
  list.className = 'tiendas-lista';
  const links = STORES.map((s) => {
    const a = document.createElement('a');
    a.className = 'overlay-secondary tienda';
    a.dataset.os = s.os;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.innerHTML = `<span class="tienda-icono">${ICON[s.icon]}</span><span class="tienda-texto"><span>${s.label}</span><small>${s.store}</small></span>`;
    a.addEventListener('click', () => close());
    list.append(a);
    return a;
  });

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'overlay-secondary tiendas-cerrar';
  cancel.textContent = 'Cerrar';
  cancel.addEventListener('click', () => close());

  box.append(title, text, list, cancel);
  backdrop.append(box);
  parent.append(backdrop);

  let returnFocus: HTMLElement | null = null;

  function close() {
    if (backdrop.hidden) return;
    backdrop.hidden = true;
    onToggle();
    returnFocus?.focus({ preventScroll: true });
    returnFocus = null;
  }

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      const all = [...links, cancel];
      const i = all.indexOf(document.activeElement as HTMLAnchorElement);
      e.preventDefault();
      all[(i + (e.shiftKey ? all.length - 1 : 1)) % all.length]?.focus();
    }
  });

  return {
    element: backdrop,
    get isOpen() {
      return !backdrop.hidden;
    },
    open(app) {
      const a = STORE_APPS[app];
      title.textContent = `Instala ${a.name}`;
      box.dataset.app = app;
      STORES.forEach((s, i) => {
        const link = links[i]!;
        link.href = s.os === 'ios' ? a.ios : a.android;
        link.setAttribute('aria-label', `${s.label}: abrir ${a.name} en ${s.store}`);
      });
      if (!backdrop.hidden) return;
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      backdrop.hidden = false;
      onToggle();
      links[0]?.focus({ preventScroll: true });
    },
    close,
  };
}
