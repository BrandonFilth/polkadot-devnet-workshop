// Salir de una partida en curso con doble confirmación: primero «¿Salir de la partida?» y después «Perderás
// el progreso». Solo con el segundo «Sí» se abandona; cualquier otra opción vuelve a la pausa.
import { typeInto } from '../lib/typewriter';

export type AbandonStep = 'cerrado' | 'primera' | 'segunda';

export interface AbandonText {
  title: string;
  text: string;
  stay: string;
  go: string;
}

export const ABANDON_TEXT: Record<Exclude<AbandonStep, 'cerrado'>, AbandonText> = {
  primera: {
    title: '¿Salir de la partida?',
    text: 'Vas a volver al menú principal.',
    stay: 'Seguir jugando',
    go: 'Salir',
  },
  segunda: {
    title: '¿Seguro que quieres salir?',
    text: 'Perderás el progreso de esta partida: tu puntaje de ahora no se guardará.',
    stay: 'Cancelar',
    go: 'Sí, salir y perder el progreso',
  },
};

/** Paso siguiente. 'go' en la segunda confirmación = abandonar (devuelve 'abandonar'). */
export function nextAbandonStep(step: AbandonStep, choice: 'open' | 'stay' | 'go'): AbandonStep | 'abandonar' {
  if (choice === 'open') return 'primera';
  if (choice === 'stay') return 'cerrado';
  if (step === 'primera') return 'segunda';
  if (step === 'segunda') return 'abandonar';
  return 'cerrado';
}

export interface Abandonar {
  readonly element: HTMLElement;
  readonly isOpen: boolean;
  open(): void;
  close(): void;
}

/** `onAbandon` solo se llama tras las dos confirmaciones. `onToggle` al abrir o cerrar. */
export function createAbandonar(parent: HTMLElement, onAbandon: () => void, onToggle: () => void = () => {}): Abandonar {
  const backdrop = document.createElement('div');
  backdrop.className = 'aviso abandonar';
  backdrop.hidden = true;
  const box = document.createElement('div');
  box.className = 'aviso-box';
  box.setAttribute('role', 'alertdialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'abandonar-title');
  box.setAttribute('aria-describedby', 'abandonar-text');
  const title = document.createElement('h2');
  title.id = 'abandonar-title';
  const text = document.createElement('p');
  text.id = 'abandonar-text';
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const stay = document.createElement('button');
  stay.type = 'button';
  stay.className = 'overlay-action';
  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'overlay-secondary btn-danger';
  actions.append(stay, go);
  box.append(title, text, actions);
  backdrop.append(box);
  parent.append(backdrop);

  let step: AbandonStep = 'cerrado';
  let returnFocus: HTMLElement | null = null;

  const render = () => {
    const wasOpen = !backdrop.hidden;
    if (step === 'cerrado') {
      backdrop.hidden = true;
      if (wasOpen) {
        onToggle();
        returnFocus?.focus({ preventScroll: true });
        returnFocus = null;
      }
      return;
    }
    const t = ABANDON_TEXT[step];
    title.textContent = t.title;
    typeInto(text, t.text);
    stay.textContent = t.stay;
    go.textContent = t.go;
    box.dataset.step = step;
    backdrop.hidden = false;
    if (!wasOpen) onToggle();
    // El foco va a la opción segura: un toque de más nunca hace perder la partida.
    stay.focus({ preventScroll: true });
  };

  const choose = (choice: 'open' | 'stay' | 'go') => {
    const next = nextAbandonStep(step, choice);
    if (next === 'abandonar') {
      step = 'cerrado';
      returnFocus = null;
      render();
      onAbandon();
      return;
    }
    step = next;
    render();
  };

  stay.addEventListener('click', () => choose('stay'));
  go.addEventListener('click', () => choose('go'));
  backdrop.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      choose('stay');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      (document.activeElement === stay ? go : stay).focus();
    }
  });

  return {
    element: backdrop,
    get isOpen() {
      return !backdrop.hidden;
    },
    open() {
      if (step !== 'cerrado') return;
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      choose('open');
    },
    close() {
      if (step === 'cerrado') return;
      step = 'cerrado';
      render();
    },
  };
}
