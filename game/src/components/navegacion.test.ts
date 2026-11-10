import { describe, expect, it } from 'vitest';
import css from '../styles.css?raw';
import appSource from '../app.ts?raw';
import { parseRoute, routeHash, TAB_LABEL, TABS } from '../lib/route';
import shellSource from './Shell.ts?raw';
import { initialTab, shellMode } from './Shell';
import { ABANDON_TEXT, nextAbandonStep } from './Abandonar';
import { capas } from './capas';

/** Cuerpos (juntos) de todas las reglas cuyo selector es exactamente `selector`. */
const rule = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`, 'g');
  return [...css.replace(/\r\n/g, '\n').matchAll(re)].map((m) => m[1]).join('\n');
};

describe('rutas', () => {
  it('cuatro pestañas en orden: Jugar · Ranking · Premios · Perfil', () => {
    expect(TABS).toEqual(['jugar', 'ranking', 'premios', 'perfil']);
    expect(TABS.map((t) => TAB_LABEL[t])).toEqual(['Jugar', 'Ranking', 'Premios', 'Perfil']);
  });

  it('parseRoute lee el hash; lo desconocido o vacío es Jugar', () => {
    expect(parseRoute('#/ranking')).toBe('ranking');
    expect(parseRoute('#premios')).toBe('premios');
    expect(parseRoute('#/perfil?x=1')).toBe('perfil');
    expect(parseRoute('#/partida')).toBe('partida');
    expect(parseRoute('')).toBe('jugar');
    expect(parseRoute('#/otra')).toBe('jugar');
    expect(routeHash('premios')).toBe('#/premios');
  });

  it('al cargar con #/partida se abre Jugar (no hay partida en curso)', () => {
    expect(initialTab('#/partida')).toBe('jugar');
    expect(initialTab('#/ranking')).toBe('ranking');
  });

  it('el botón Atrás: fuera de la partida cambia de pestaña; en una partida vuelve a Jugar o pregunta si salir', () => {
    expect(appSource).toMatch(/addEventListener\('popstate'/);
    expect(appSource).toMatch(
      /history\.pushState\(null, '', routeHash\('partida'\)\);[\s\S]*?if \(shellRef\.tab !== 'jugar'\) \{\s*\n\s*shellRef\.go\('jugar'\);\s*\n\s*return;\s*\n\s*\}\s*\n\s*if \(!abandonar\.isOpen\) askAbandon\(\);/,
    );
  });

  it('en partida: la barra de navegación sigue abajo, otra pestaña tapa el juego y lo pausa', () => {
    expect(shellMode(false, 'jugar')).toBe('inicio');
    expect(shellMode(false, 'ranking')).toBe('inicio');
    expect(shellMode(true, 'jugar')).toBe('juego');
    expect(shellMode(true, 'premios')).toBe('encima');
    // Las pestañas en partida no tocan el historial (sigue en #/partida).
    expect(shellSource).toMatch(/if \(!inGame\) \{\s*\n\s*const hash = routeHash\(next\);/);
    expect(appSource).toMatch(/onTab: \(tab\) => \{\s*\n\s*if \(tab !== 'jugar'\) setPaused\(state, true\);/);
    expect(appSource).toMatch(/if \(shellRef\.tab !== 'jugar'\) setPaused\(state, true\);/);
    expect(appSource).toMatch(/root\.classList\.toggle\('con-tabbar', inGame\);\s*\n\s*shellRef\.setInGame\(inGame\);\s*\n\s*syncSplit\(\);/);
    // La barra superior también se queda en la partida.
    expect(css).toMatch(
      /#app\.con-tabbar \{\s*\n\s*padding-top: calc\(var\(--shellbar-h\) \+ env\(safe-area-inset-top\)\);\s*\n\s*padding-bottom: calc\(var\(--tabbar-h\) \+ env\(safe-area-inset-bottom\)\);/,
    );
    expect(css).toMatch(/\.shell\[data-modo='juego'\] \{\s*\n\s*background: transparent;\s*\n\s*pointer-events: none;/);
    expect(css).toMatch(/\.shell\[data-modo='juego'\] > \.shell-bar,\s*\n\.shell\[data-modo='juego'\] > \.tabbar \{\s*\n\s*pointer-events: auto;/);
    expect(css).toMatch(/\.shell\[data-modo='juego'\] > \.shell-main \{\s*\n\s*visibility: hidden;/);
  });
});

describe('barra de navegación', () => {
  it('es un <nav> con aria-current en la pestaña activa y la billetera arriba a la derecha', () => {
    expect(shellSource).toMatch(/createElement\('nav'\)/);
    expect(shellSource).toMatch(/setAttribute\('aria-label', 'Secciones'\)/);
    expect(shellSource).toMatch(/setAttribute\('aria-current', 'page'\)/);
    expect(shellSource).toMatch(/if \(opts\.billetera\) bar\.append\(opts\.billetera\);/);
  });

  it('respeta la zona segura de abajo y tiene áreas de toque de 48 px o más', () => {
    expect(rule('.tabbar')).toMatch(/env\(safe-area-inset-bottom\)/);
    expect(rule('.tabbar')).toMatch(/grid-template-columns:\s*repeat\(4/);
    expect(rule('.tabbar-btn')).toMatch(/min-height:\s*52px/);
    expect(rule('.wallet-copy')).toMatch(/width:\s*44px/);
  });

  it('el contenedor es opaco y sin animaciones si se pide reducir movimiento', () => {
    expect(rule('.shell')).toMatch(/background:\s*var\(--bg\)/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\n\s*\.shell-panel:not\(\[hidden\]\) \{ animation: none; \}/);
    expect(css).not.toMatch(/background:\s*rgba\(/);
  });
});

describe('salir de una partida: doble confirmación', () => {
  it('abrir → primera; Salir → segunda; Sí → abandonar', () => {
    expect(nextAbandonStep('cerrado', 'open')).toBe('primera');
    expect(nextAbandonStep('primera', 'go')).toBe('segunda');
    expect(nextAbandonStep('segunda', 'go')).toBe('abandonar');
  });

  it('cualquier «quedarse» cierra sin abandonar', () => {
    expect(nextAbandonStep('primera', 'stay')).toBe('cerrado');
    expect(nextAbandonStep('segunda', 'stay')).toBe('cerrado');
    expect(nextAbandonStep('cerrado', 'go')).toBe('cerrado');
  });

  it('la segunda confirmación dice que se pierde el progreso', () => {
    expect(ABANDON_TEXT.primera.title).toBe('¿Salir de la partida?');
    expect(ABANDON_TEXT.segunda.text).toMatch(/Perderás el progreso/);
    expect(ABANDON_TEXT.segunda.go).toMatch(/perder el progreso/);
  });

  it('la confirmación queda encima de la pausa y del menú, y debajo del popup de estados', () => {
    const none = { menuOpen: false, usernameOpen: false, avisoOpen: false, txOpen: false };
    expect(capas({ ...none, phase: 'pausa', confirmOpen: true })).toMatchObject({ top: 'confirmar', inert: ['juego', 'pausa'] });
    expect(capas({ ...none, phase: 'pausa', confirmOpen: true, txOpen: true }).top).toBe('tx');
  });
});
