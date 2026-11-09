// Botón de la billetera, arriba a la derecha de la pantalla de inicio: muestra la dirección EVM (H160) de la
// cuenta conectada, acortada, y al tocarlo la copia completa. Es la dirección que el contrato ve como msg.sender
// (la que se pega en Remix, por ejemplo en setAdmin). Sin cuenta no se muestra.
import { COPY_FEEDBACK_MS } from '../engine/rules';
import type { Hub } from '../hub/hub';
import { copyText, type ClipboardEnv } from '../lib/clipboard';
import { shortAddress } from '../lib/format';

export type CopyState = 'idle' | 'copiada' | 'error';

export const COPIED_LABEL = 'Copiada';
export const COPY_FAILED_LABEL = 'No se pudo copiar';

/** Qué muestra el botón. null = no hay cuenta: el botón se oculta. */
export function billeteraView(h160: string | null | undefined, copy: CopyState): { label: string; aria: string; full: string } | null {
  if (!h160) return null;
  const label = copy === 'copiada' ? COPIED_LABEL : copy === 'error' ? COPY_FAILED_LABEL : shortAddress(h160);
  return { label, aria: `Copiar tu dirección ${h160}`, full: h160 };
}

const COPY_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">' +
  '<rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>' +
  '<path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

export interface Billetera {
  readonly element: HTMLElement;
  sync(): void;
}

export function createBilletera(hub: Pick<Hub, 'getState' | 'subscribe'>, clipboard?: ClipboardEnv): Billetera {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'billetera';
  const icon = document.createElement('span');
  icon.className = 'billetera-icono';
  icon.innerHTML = COPY_ICON;
  const text = document.createElement('span');
  text.className = 'billetera-texto';
  button.append(icon, text);
  button.hidden = true;

  let copy: CopyState = 'idle';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let shownKey = '';

  const sync = () => {
    const view = billeteraView(hub.getState().account?.h160, copy);
    const key = view ? `${view.full}|${view.label}` : '';
    if (key === shownKey) return;
    shownKey = key;
    button.hidden = view === null;
    if (!view) return;
    text.textContent = view.label;
    button.title = view.full;
    button.setAttribute('aria-label', copy === 'idle' ? view.aria : view.label);
    button.dataset.estado = copy;
  };

  button.addEventListener('click', async () => {
    const h160 = hub.getState().account?.h160;
    if (!h160) return;
    copy = (await copyText(h160, clipboard)) ? 'copiada' : 'error';
    sync();
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      copy = 'idle';
      sync();
    }, COPY_FEEDBACK_MS);
  });

  hub.subscribe(() => sync());
  sync();
  return { element: button, sync };
}
