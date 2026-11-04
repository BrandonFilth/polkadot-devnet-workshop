import { describe, expect, it } from 'vitest';
// Texto de styles.css y del componente (vite.config.js deja pasar estos ?raw a los tests).
import css from '../styles.css?raw';
import source from './Controles.ts?raw';

/** Cuerpos (juntos) de todas las reglas cuyo selector es exactamente `selector`. */
const rule = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, 'g');
  return [...css.replace(/\r\n/g, '\n').matchAll(re)].map((m) => m[1]).join('\n');
};

describe('controles: flechas', () => {
  it('el pad de flechas no deja hacer scroll ni zoom', () => {
    expect(rule('.dpad')).toMatch(/touch-action:\s*none/);
    expect(css).toMatch(/\.stage, \.controles, \.dpad \{ touch-action: none; \}/);
  });

  it('cada flecha bloquea gestos y el menú de mantener presionado', () => {
    const btn = rule('.controles .dpad-btn');
    expect(btn).toMatch(/touch-action:\s*none/);
    expect(btn).toMatch(/-webkit-touch-callout:\s*none/);
    expect(btn).toMatch(/user-select:\s*none/);
  });

  it('no queda nada del joystick', () => {
    for (const text of [css, source]) {
      expect(text).not.toMatch(/\.joystick/);
      expect(text).not.toMatch(/\.stick|stick-zone/);
      expect(text).not.toContain('Toca y arrastra');
      expect(text).not.toContain('createFloatingStick');
    }
    expect(source).not.toMatch(/'joystick/);
  });

  it('un dedo con captura, sin scroll, pedido recto y vibración que falla en silencio', () => {
    expect(source).toContain('setPointerCapture');
    expect(source).toContain('preventDefault');
    expect(source).toContain('lostpointercapture');
    expect(source).toContain('pointercancel');
    expect(source).toContain('createDpad');
    expect(source).toContain('setDirections(state, frame.dir, null)');
    expect(source).toMatch(/try \{\s*navigator\.vibrate\(DPAD_HAPTIC_MS\)/);
  });

  it('nombres accesibles en español', () => {
    for (const label of ['Arriba', 'Abajo', 'Izquierda', 'Derecha', 'Flechas']) {
      expect(source).toContain(`'${label}'`);
    }
  });

  it('textos sin signos de exclamación', () => {
    expect(source).not.toMatch(/[¡!]['"`]/);
    expect(source).not.toMatch(/['"`>][^'"`<]*¡/);
  });
});
