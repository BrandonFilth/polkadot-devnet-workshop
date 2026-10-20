// Pasos visibles de una interacción con el Host (Simulando…, Esperando tu firma…, Listo o el error).
import type { Hub } from '../hub/hub';
import { progressView, type ProgressOp } from '../hub/progress';

export interface Progreso {
  readonly element: HTMLElement;
  /** Oculta el resultado de la operación anterior (si ya terminó). Una operación en curso se sigue viendo. */
  reset(): void;
}

/** Muestra el progreso del Hub solo para las operaciones `ops`. Se suscribe una vez y vive toda la sesión. */
export function createProgreso(hub: Hub, ops: readonly ProgressOp[]): Progreso {
  const element = document.createElement('div');
  element.className = 'progreso';
  element.hidden = true;

  const list = document.createElement('ol');
  list.className = 'progreso-pasos';
  const line = document.createElement('p');
  line.className = 'progreso-linea';
  line.setAttribute('role', 'status');
  line.setAttribute('aria-live', 'polite');
  element.append(list, line);

  let shownKey = '';
  let ignored: unknown = null;
  const render = () => {
    const progress = hub.getState().progress;
    const view = progress === ignored ? null : progressView(progress, ops);
    const key = view ? `${view.tone}|${view.line}|${view.steps.map((s) => s.status).join(',')}` : '';
    if (key === shownKey) return;
    shownKey = key;
    element.hidden = view === null;
    if (!view) return;
    element.dataset.tone = view.tone;
    list.replaceChildren(
      ...view.steps.map((s) => {
        const li = document.createElement('li');
        li.className = `progreso-paso progreso-paso--${s.status}`;
        li.textContent = s.label;
        if (s.status === 'actual') li.setAttribute('aria-current', 'step');
        return li;
      }),
    );
    line.textContent = view.line;
  };

  hub.subscribe(render);
  render();
  return {
    element,
    reset() {
      const s = hub.getState();
      ignored = s.busy ? null : s.progress;
      render();
    },
  };
}
