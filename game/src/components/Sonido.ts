// Botones de sonido: dos toggles (Música y Efectos) para la pantalla de inicio y, en el HUD, un botón
// «Sonido» que abre un popover opaco con los mismos toggles. El popover no pausa la partida.
import type { SoundPrefs } from '../audio/prefs';

export interface SonidoLabels {
  music: string;
  effects: string;
  /** Música y Efectos apagados: el ícono del HUD va tachado. */
  allOff: boolean;
}

/** aria-label de cada toggle según las preferencias. */
export function sonidoLabels(p: { music: boolean; effects: boolean }): SonidoLabels {
  return {
    music: p.music ? 'Música activada' : 'Música silenciada',
    effects: p.effects ? 'Efectos activados' : 'Efectos silenciados',
    allOff: !p.music && !p.effects,
  };
}

const SPEAKER = '<path d="M4 9h4l5-4v14l-5-4H4z"/>';
const SPEAKER_ON = `<svg viewBox="0 0 24 24" aria-hidden="true">${SPEAKER}<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const SPEAKER_OFF = `<svg viewBox="0 0 24 24" aria-hidden="true">${SPEAKER}<path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const NOTE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v11.3A3 3 0 1 0 11 18V8h7V4z"/></svg>';
const SFX_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.2 5.8L20 9l-4.6 3.8L17 19l-5-3.3L7 19l1.6-6.2L4 9l5.8-.2z"/></svg>';

export interface SonidoToggles {
  readonly element: HTMLElement;
  readonly first: HTMLButtonElement;
}

/** Dos toggles con aria-pressed. `onTap` suena al tocar (audio.tap()). */
export function createSonidoToggles(prefs: SoundPrefs, onTap?: () => void): SonidoToggles {
  const element = document.createElement('div');
  element.className = 'sonido-toggles';

  const make = (text: string, icon: string, toggle: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sonido-toggle';
    b.innerHTML = `${icon}<span>${text}</span>`;
    b.addEventListener('click', () => {
      toggle();
      onTap?.();
    });
    return b;
  };
  const music = make('Música', NOTE_ICON, () => prefs.toggleMusic());
  const effects = make('Efectos', SFX_ICON, () => prefs.toggleEffects());
  element.append(music, effects);

  const sync = () => {
    const l = sonidoLabels(prefs);
    music.setAttribute('aria-pressed', String(prefs.music));
    music.setAttribute('aria-label', l.music);
    effects.setAttribute('aria-pressed', String(prefs.effects));
    effects.setAttribute('aria-label', l.effects);
  };
  prefs.subscribe(sync);
  sync();
  return { element, first: music };
}

export interface SonidoButton {
  /** Contenedor del botón y del popover (va en el HUD). */
  readonly element: HTMLElement;
  readonly button: HTMLButtonElement;
  readonly isOpen: boolean;
  close(): void;
}

/** Botón «Sonido» del HUD con su popover. Escape o tocar fuera lo cierran y devuelven el foco al botón. */
export function createSonidoButton(prefs: SoundPrefs, onTap?: () => void): SonidoButton {
  const element = document.createElement('div');
  element.className = 'hud-sonido-wrap';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'hud-sonido';
  button.setAttribute('aria-label', 'Sonido');
  button.setAttribute('aria-haspopup', 'true');
  button.setAttribute('aria-expanded', 'false');

  const pop = document.createElement('div');
  pop.className = 'sonido-pop';
  pop.id = 'sonido-pop';
  pop.setAttribute('role', 'group');
  pop.setAttribute('aria-label', 'Sonido');
  pop.hidden = true;
  button.setAttribute('aria-controls', pop.id);
  const toggles = createSonidoToggles(prefs, onTap);
  pop.append(toggles.element);
  element.append(button, pop);

  const syncIcon = () => {
    const off = sonidoLabels(prefs).allOff;
    button.innerHTML = off ? SPEAKER_OFF : SPEAKER_ON;
    button.classList.toggle('hud-sonido--off', off);
  };
  prefs.subscribe(syncIcon);
  syncIcon();

  const onOutside = (e: Event) => {
    if (e.target instanceof Node && element.contains(e.target)) return;
    close();
  };

  const open = () => {
    pop.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', onOutside, true);
    toggles.first.focus({ preventScroll: true });
  };

  function close() {
    if (pop.hidden) return;
    const hadFocus = element.contains(document.activeElement);
    pop.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutside, true);
    if (hadFocus) button.focus({ preventScroll: true });
  }

  button.addEventListener('click', () => (pop.hidden ? open() : close()));
  button.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !pop.hidden) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  });
  // Las teclas dentro del popover no llegan al juego. Escape lo cierra.
  pop.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });

  return {
    element,
    button,
    get isOpen() {
      return !pop.hidden;
    },
    close,
  };
}
