import { describe, expect, it } from 'vitest';
// Texto de styles.css (vite.config.js deja pasar este .css a los tests).
import css from '../styles.css?raw';
import { sonidoLabels } from './Sonido';

/** Cuerpos (juntos) de todas las reglas cuyo selector es exactamente `selector`. */
const rule = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`, 'g');
  return [...css.replace(/\r\n/g, '\n').matchAll(re)].map((m) => m[1]).join('\n');
};

describe('botones de sonido', () => {
  it('aria-label de Música y Efectos según las preferencias', () => {
    expect(sonidoLabels({ music: true, effects: true })).toEqual({
      music: 'Música activada',
      effects: 'Efectos activados',
      allOff: false,
    });
    expect(sonidoLabels({ music: false, effects: true })).toMatchObject({ music: 'Música silenciada', allOff: false });
    expect(sonidoLabels({ music: false, effects: false })).toEqual({
      music: 'Música silenciada',
      effects: 'Efectos silenciados',
      allOff: true,
    });
  });

  it('el popover es un panel opaco con borde, por debajo del menú', () => {
    const body = rule('.sonido-pop');
    expect(body).toMatch(/background:\s*var\(--panel\)/);
    expect(body).toMatch(/border:\s*1px solid var\(--line\)/);
    const z = Number(/z-index:\s*(\d+)/.exec(body)?.[1]);
    const menuZ = Number(/z-index:\s*(\d+)/.exec(rule('.menu'))?.[1]);
    expect(z).toBeLessThan(menuZ);
  });

  it('un toggle apagado se ve apagado (gris y tachado)', () => {
    const body = rule('.sonido-toggle[aria-pressed="false"]');
    expect(body).toMatch(/color:\s*#8b8b86/);
    expect(body).toMatch(/text-decoration:\s*line-through/);
  });
});
