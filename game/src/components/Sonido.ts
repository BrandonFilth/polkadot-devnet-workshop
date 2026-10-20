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

/** Para qué es cada toggle: tooltip (title) y leyenda del popover. */
export const SONIDO_AYUDA = {
  music: 'Música: canción de fondo',
  effects: 'Efectos: sonidos del juego (comer, fantasmas, morir)',
} as const;

/** Leyenda corta bajo el nombre, en el popover del HUD. */
const SONIDO_DETALLE = {
  music: 'Canción de fondo',
  effects: 'Comer, fantasmas, morir',
} as const;

const SLASH = '<path d="M3 3l18 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>';
const SPEAKER = '<path d="M4 9h4l5-4v14l-5-4H4z"/>';
const SPEAKER_WAVES = '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
const SPEAKER_ON = `<svg viewBox="0 0 24 24" aria-hidden="true">${SPEAKER}${SPEAKER_WAVES}</svg>`;
const SPEAKER_OFF = `<svg viewBox="0 0 24 24" aria-hidden="true">${SPEAKER}<path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const NOTE = '<path d="M9 4v11.3A3 3 0 1 0 11 18V8h7V4z"/>';
/** Música: nota (tachada si está apagada). Efectos: altavoz (con cruz si está apagado). */
const ICONS = {
  music: { on: `<svg viewBox="0 0 24 24" aria-hidden="true">${NOTE}</svg>`, off: `<svg viewBox="0 0 24 24" aria-hidden="true">${NOTE}${SLASH}</svg>` },
  effects: { on: SPEAKER_ON, off: SPEAKER_OFF },
} as const;

export interface SonidoToggles {
  readonly element: HTMLElement;
  readonly first: HTMLButtonElement;
}

/**
 * Dos toggles con aria-pressed. `onTap` suena al tocar (audio.tap()).
 * - 'lista' (popover del HUD): ícono, nombre, leyenda y un interruptor que muestra el estado.
 * - 'iconos' (pantalla de inicio): solo ícono con su nombre chico debajo; el title explica para qué es.
 */
export function createSonidoToggles(prefs: SoundPrefs, onTap?: () => void, variant: 'lista' | 'iconos' = 'lista'): SonidoToggles {
  const element = document.createElement('div');
  element.className = variant === 'iconos' ? 'sonido-toggles sonido-toggles--iconos' : 'sonido-toggles';

  const make = (kind: 'music' | 'effects', text: string, toggle: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = variant === 'iconos' ? 'sonido-toggle sonido-toggle--icono' : 'sonido-toggle';
    b.title = SONIDO_AYUDA[kind];
    const icon = document.createElement('span');
    icon.className = 'sonido-icono';
    const name = document.createElement('span');
    name.className = 'sonido-nombre';
    name.textContent = text;
    if (variant === 'iconos') {
      b.append(icon, name);
    } else {
      const label = document.createElement('span');
      label.className = 'sonido-texto';
      const detail = document.createElement('small');
      detail.className = 'sonido-detalle';
      detail.textContent = SONIDO_DETALLE[kind];
      label.append(name, detail);
      const sw = document.createElement('span');
      sw.className = 'sonido-switch';
      sw.setAttribute('aria-hidden', 'true');
      b.append(icon, label, sw);
    }
    b.addEventListener('click', () => {
      toggle();
      onTap?.();
    });
    return { b, icon };
  };
  const music = make('music', 'Música', () => prefs.toggleMusic());
  const effects = make('effects', 'Efectos', () => prefs.toggleEffects());
  element.append(music.b, effects.b);

  let shown = '';
  const sync = () => {
    const key = `${prefs.music},${prefs.effects}`;
    if (key === shown) return;
    shown = key;
    const l = sonidoLabels(prefs);
    music.b.setAttribute('aria-pressed', String(prefs.music));
    music.b.setAttribute('aria-label', l.music);
    music.icon.innerHTML = prefs.music ? ICONS.music.on : ICONS.music.off;
    effects.b.setAttribute('aria-pressed', String(prefs.effects));
    effects.b.setAttribute('aria-label', l.effects);
    effects.icon.innerHTML = prefs.effects ? ICONS.effects.on : ICONS.effects.off;
  };
  prefs.subscribe(sync);
  sync();
  return { element, first: music.b };
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
  button.title = 'Sonido: música y efectos';
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
