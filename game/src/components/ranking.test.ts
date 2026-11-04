import { describe, expect, it } from 'vitest';
// Texto de styles.css (vite.config.js deja pasar este .css a los tests).
import css from '../styles.css?raw';
import overlaySource from './Overlay.ts?raw';
import finSource from './FinDePartida.ts?raw';
import rankingSource from './Ranking.ts?raw';
import { rankingCells, RANKING_TOP } from './Ranking';


/** Cuerpos (juntos) de todas las reglas cuyo selector es exactamente `selector`. */
const rule = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`, 'g');
  return [...css.replace(/\r\n/g, '\n').matchAll(re)].map((m) => m[1]).join('\n');
};

describe('ranking: su propia pestaña con una lista que se desplaza', () => {
  it('la lista vive en una caja con alto máximo fijo y desplazamiento propio', () => {
    const body = rule('.ranking-scroll');
    expect(body).toMatch(/max-height:\s*var\(--ranking-max-h\)/);
    expect(body).toMatch(/overflow-y:\s*auto/);
  });

  it('el encabezado queda fijo y opaco al desplazar', () => {
    const body = rule('.ranking-table thead th');
    expect(body).toMatch(/position:\s*sticky/);
    expect(body).toMatch(/background:\s*var\(--panel\)/);
  });

  it('top 10 y «(tú)» en tu fila', () => {
    expect(RANKING_TOP).toBe(10);
    const row = { address: `0x${'1'.repeat(40)}` as `0x${string}`, username: 'ana', score: 900n, mine: true };
    expect(rankingCells(row, 0)).toEqual(['1', 'ana (tú)', '900']);
    expect(rankingCells({ ...row, mine: false }, 2)).toEqual(['3', 'ana', '900']);
  });

  it('el popup de fin no crea un ranking: solo el botón «Ver ranking»', () => {
    for (const src of [overlaySource, finSource]) {
      expect(src).not.toMatch(/createRanking/);
      expect(src).not.toMatch(/readTop/);
    }
    expect(overlaySource).toMatch(/Ver ranking/);
  });
});

describe('ranking: Actual | Historial', () => {
  it('el componente tiene las vistas Actual e Historial', () => {
    expect(rankingSource).toMatch(/'Actual'/);
    expect(rankingSource).toMatch(/'Historial'/);
    expect(rankingSource).toMatch(/role', 'tablist'/);
  });

  it('el selector marca la vista elegida con aria-selected', () => {
    expect(rule(".ranking-vista-btn[aria-selected='true']")).toMatch(/background:\s*var\(--accent\)/);
    const bar = rule('.ranking > .ranking-vista');
    expect(bar).toMatch(/flex-direction:\s*row/);
    expect(bar).toMatch(/background:\s*var\(--bg\)/);
    expect(rule('.ranking-vista-btn')).toMatch(/min-width:\s*0/);
  });

  it('la lista de periodos no tiene alto propio: vive dentro de .ranking-scroll', () => {
    const body = rule('.ranking-periodos');
    expect(body).not.toMatch(/max-height/);
    expect(body).toMatch(/list-style:\s*none/);
    expect(rule('.ranking-periodos button')).toMatch(/overflow-wrap:\s*anywhere/);
    expect(rankingSource).toMatch(/scrollBox\(list,/);
  });

  it('el contador y el encabezado parten línea en vez de desbordar', () => {
    expect(rule('.ranking-reinicio')).toMatch(/overflow-wrap:\s*anywhere/);
    expect(rule('.ranking h2')).toMatch(/overflow-wrap:\s*anywhere/);
  });

  it('el resumen del fin muestra sus tres líneas en bloque', () => {
    expect(rule('.overlay .fin-summary span')).toMatch(/display:\s*block/);
  });
});

describe('superficies opacas', () => {
  it.each(['.overlay', '.menu', '.modal', '.inicio', '.aviso'])('%s tiene fondo opaco', (selector) => {
    expect(rule(selector)).toMatch(/background:\s*var\(--bg\)/);
  });

  it.each(['.overlay-box', '.menu-sheet', '.modal-box', '.aviso-box,\n.tx-box'])('%s es un panel opaco con borde', (selector) => {
    const body = rule(selector);
    expect(body).toMatch(/background:\s*var\(--panel\)/);
    expect(body).toMatch(/border:\s*1px solid var\(--line\)/);
  });

  it('ningún fondo semitransparente (rgba) en las capas', () => {
    expect(css).not.toMatch(/background:\s*rgba\(/);
  });
});
