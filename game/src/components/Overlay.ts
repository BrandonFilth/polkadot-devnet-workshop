// Overlay sobre el escenario: título y mensajes de fase. Los textos van en una región aria-live.

export interface Overlay {
  readonly element: HTMLElement;
  /** Muestra un título y un mensaje. */
  show(title: string, message: string): void;
  hide(): void;
}

export function createOverlay(parent: HTMLElement): Overlay {
  const element = document.createElement('section');
  element.className = 'overlay';
  element.setAttribute('aria-live', 'polite');

  const heading = document.createElement('h1');
  const text = document.createElement('p');
  element.append(heading, text);
  parent.append(element);

  return {
    element,
    show(title, message) {
      heading.textContent = title;
      text.textContent = message;
      element.hidden = false;
    },
    hide() {
      element.hidden = true;
    },
  };
}

/** Pantalla de la plantilla (etapa 0): todavía no hay partida, así que no hay botón. */
export function showTemplateTitle(overlay: Overlay): void {
  overlay.show('POLKA-MAN', 'La plantilla funciona. Sigue con la etapa 1.');
}
