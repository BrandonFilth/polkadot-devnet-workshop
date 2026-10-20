import { describe, expect, it } from 'vitest';
import { CONTROLS_HEIGHT_PX, HUD_HEIGHT_PX, MAZE_HEIGHT, MAZE_WIDTH, MIN_TILE_PX } from '../engine/rules';
import { mazeLayout, portraitSplit, stageSize, type Viewport } from './layout';

const phone = (width: number, height: number, extra: Partial<Viewport> = {}): Viewport => ({
  width,
  height,
  safeTop: 0,
  safeRight: 0,
  safeBottom: 0,
  safeLeft: 0,
  touch: true,
  ...extra,
});

const layoutFor = (v: Viewport) => {
  const stage = stageSize(v);
  return { stage, maze: mazeLayout(MAZE_WIDTH, MAZE_HEIGHT, stage.width, stage.height) };
};

describe('layout del laberinto', () => {
  it('360×800 táctil: casilla 20 y el laberinto ocupa todo el ancho', () => {
    const { stage, maze } = layoutFor(phone(360, 800));
    expect(stage).toEqual({ width: 360, height: 624 });
    expect(maze.tile).toBe(20);
    expect([maze.cssWidth, maze.cssHeight]).toEqual([360, 400]);
    expect(maze.offset).toBe(10);
  });

  it('390×844 táctil: casilla 21, 378×420', () => {
    const { stage, maze } = layoutFor(phone(390, 844));
    expect(stage).toEqual({ width: 390, height: 668 });
    expect(maze.tile).toBe(21);
    expect([maze.cssWidth, maze.cssHeight]).toEqual([378, 420]);
  });

  it('390×844 con safe areas (24 arriba, 34 abajo) sigue en casilla 21', () => {
    const { maze } = layoutFor(phone(390, 844, { safeTop: 24, safeBottom: 34 }));
    expect(maze.tile).toBe(21);
  });

  it('1440×900 escritorio: sin controles, casilla 42, 756×840', () => {
    const { stage, maze } = layoutFor(phone(1440, 900, { touch: false }));
    expect(stage).toEqual({ width: 1440, height: 856 });
    expect(maze.tile).toBe(42);
    expect([maze.cssWidth, maze.cssHeight]).toEqual([756, 840]);
  });

  it('vertical: el laberinto pegado al HUD y lo que sobra para los controles (390×844 y 360×800)', () => {
    expect(portraitSplit(phone(390, 844))).toEqual({ tile: 21, mazeHeight: 420, controlsHeight: 380 });
    expect(portraitSplit(phone(360, 800))).toEqual({ tile: 20, mazeHeight: 400, controlsHeight: 356 });
    // La casilla no cambia respecto al layout de siempre, y todo suma el alto disponible.
    const v = phone(390, 844, { safeTop: 24, safeBottom: 34 });
    const s = portraitSplit(v);
    expect(s.tile).toBe(layoutFor(v).maze.tile);
    expect(s.mazeHeight + s.controlsHeight + HUD_HEIGHT_PX).toBe(844 - 24 - 34);
  });

  it('vertical en pantalla baja: los controles nunca bajan de su alto mínimo', () => {
    const s = portraitSplit(phone(390, 500));
    expect(s.controlsHeight).toBeGreaterThanOrEqual(CONTROLS_HEIGHT_PX);
  });

  it('un escenario diminuto usa la casilla mínima', () => {
    expect(mazeLayout(MAZE_WIDTH, MAZE_HEIGHT, 100, 100).tile).toBe(MIN_TILE_PX);
  });

  it('nunca es más ancho que el escenario (salvo la casilla mínima)', () => {
    for (const v of [phone(360, 800), phone(390, 844), phone(412, 915), phone(1440, 900, { touch: false })]) {
      const { stage, maze } = layoutFor(v);
      expect(maze.cssWidth).toBeLessThanOrEqual(stage.width);
      expect(maze.cssHeight).toBeLessThanOrEqual(stage.height);
    }
  });
});
