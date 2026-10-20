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

describe('controles: joystick flotante', () => {
  it('la zona del joystick no deja hacer scroll ni zoom', () => {
    expect(rule('.stick-zone')).toMatch(/touch-action:\s*none/);
    expect(css).toMatch(/\.stage, \.controles, \.stick-zone \{ touch-action: none; \}/);
  });

  it('la pista se esconde con mouse y la base se desvanece con --stick-fade', () => {
    expect(css).toMatch(/@media \(pointer: fine\) \{\s*\.stick-hint \{\s*display: none;/);
    expect(rule('.stick')).toMatch(/transition:\s*opacity var\(--stick-fade\)/);
    expect(rule('.stick')).toMatch(/pointer-events:\s*none/);
  });

  it('no queda nada del joystick fijo', () => {
    expect(css).not.toMatch(/\.joystick/);
    expect(source).not.toMatch(/\.joystick|'joystick/);
  });

  it('un dedo con captura, sin scroll, dibujo por cuadro y vibración que falla en silencio', () => {
    expect(source).toContain('setPointerCapture');
    expect(source).toContain('preventDefault');
    expect(source).toContain('requestAnimationFrame');
    expect(source).toMatch(/try \{\s*navigator\.vibrate\(JOYSTICK_HAPTIC_MS\)/);
    expect(source).toContain('createFloatingStick');
    expect(source).toContain('stickHintVisible');
    expect(source).toContain('Toca y arrastra');
  });

  it('textos sin signos de exclamación', () => {
    expect(source).not.toMatch(/[¡!]['"`]/);
    expect(source).not.toMatch(/['"`>][^'"`<]*¡/);
  });
});
