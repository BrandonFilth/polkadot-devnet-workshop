// Estado del Host y de la cuenta: Conectar, Reintentar o el aviso de fuera del Host.
import type { Hub, HubState } from '../hub/hub';
import { OUTSIDE_NOTICE } from './FinDePartida';
import { createProgreso } from './Progreso';

export interface Conexion {
  readonly element: HTMLElement;
}

/** Se suscribe al Hub una sola vez; vive toda la sesión. */
export function createConexion(hub: Hub): Conexion {
  const element = document.createElement('div');
  element.className = 'conexion';

  const status = document.createElement('p');
  status.className = 'conexion-status';
  status.setAttribute('role', 'status');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'overlay-secondary';
  const result = document.createElement('p');
  result.className = 'conexion-result';
  result.hidden = true;
  // Conectando tu cuenta… → Esperando el permiso de gas… → Listo (o el error).
  const progreso = createProgreso(hub, ['conectar']);
  element.append(status, button, progreso.element, result);

  let connecting = false;
  let action: 'conectar' | 'reintentar' | null = null;

  const render = (s: HubState) => {
    status.textContent = s.host === 'fuera' ? OUTSIDE_NOTICE : s.message;
    status.classList.toggle('conexion-status--aviso', s.host === 'fuera');
    if (s.host === 'listo' && s.account === null) action = 'conectar';
    else if (s.host === 'error') action = 'reintentar';
    else action = null;
    button.hidden = action === null;
    button.textContent = action === 'reintentar' ? 'Reintentar' : 'Conectar';
    button.disabled = connecting || s.busy;
    if (s.host === 'fuera') result.hidden = true;
  };

  button.addEventListener('click', async () => {
    if (action === 'reintentar') {
      result.hidden = true;
      void hub.start();
      return;
    }
    if (action !== 'conectar' || connecting) return;
    connecting = true;
    render(hub.getState());
    try {
      const r = await hub.connect();
      // Si el progreso ya muestra este resultado, no se repite abajo.
      const p = hub.getState().progress;
      result.textContent = r.message;
      result.hidden = p?.op === 'conectar' && p.message === r.message;
    } finally {
      connecting = false;
      render(hub.getState());
    }
  });

  hub.subscribe(render);
  render(hub.getState());
  return { element };
}
