import { describe, expect, it } from 'vitest';
import {
  CONTROLS_HEIGHT_PX,
  DPAD_BUTTON_PX,
  DPAD_GAP_PX,
  HUD_HEIGHT_PX,
  MAZE_HEIGHT,
  MAZE_WIDTH,
  MIN_TILE_PX,
  PAUSE_BUTTON_PX,
} from '../engine/rules';
import { dpadSize, mazeLayout, portraitSplit, stageSize, type Viewport } from './layout';

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
    expect(stage).toEqual({ width: 360, height: 584 });
    expect(maze.tile).toBe(20);
    expect([maze.cssWidth, maze.cssHeight]).toEqual([360, 400]);
    expect(maze.offset).toBe(10);
  });

  it('390×844 táctil: casilla 21, 378×420', () => {
    const { stage, maze } = layoutFor(phone(390, 844));
    expect(stage).toEqual({ width: 390, height: 628 });
    expect(maze.tile).toBe(21);
    expect([maze.cssWidth, maze.cssHeight]).toEqual([378, 420]);
  });

  it('390×844 con safe areas (24 arriba, 34 abajo) sigue en casilla 21', () => {
    const { maze } = layoutFor(phone(390, 844, { safeTop: 24, safeBottom: 34 }));
    expect(maze.tile).toBe(21);
  });

  it('1440×900 escritorio: sin controles, casilla 40, 720×800', () => {
    const { stage, maze } = layoutFor(phone(1440, 900, { touch: false }));
    expect(stage).toEqual({ width: 1440, height: 816 });
    expect(maze.tile).toBe(40);
    expect([maze.cssWidth, maze.cssHeight]).toEqual([720, 800]);
  });

  it('en partida: barra superior (56) arriba y de navegación (64) abajo; la casilla sigue en 21', () => {
    const s = portraitSplit(phone(390, 844, { safeTop: 47 + 56, safeBottom: 34 + 64 }));
    expect(s.tile).toBe(21);
    expect(s.mazeHeight).toBe(420);
    // Sobran solo 7 px: todos van a los controles y las flechas se encogen para caber.
    expect(s.stageHeight).toBe(420);
    expect(3 * dpadSize(s.controlsHeight) + 2 * DPAD_GAP_PX).toBeLessThanOrEqual(s.controlsHeight);
  });

  it('vertical: los controles toman lo que necesitan las flechas y el resto se reparte (390×844 y 360×800)', () => {
    // 390×844: sobran 208; 52 a los controles (132 → 184) y de los 156 restantes, 78 al escenario y 78 a los controles.
    expect(portraitSplit(phone(390, 844))).toEqual({ tile: 21, mazeHeight: 420, stageHeight: 498, controlsHeight: 262 });
    expect(portraitSplit(phone(360, 800))).toEqual({ tile: 20, mazeHeight: 400, stageHeight: 466, controlsHeight: 250 });
    // La casilla no cambia respecto al layout de siempre, y todo suma el alto disponible.
    const v = phone(390, 844, { safeTop: 24, safeBottom: 34 });
    const s = portraitSplit(v);
    expect(s.tile).toBe(layoutFor(v).maze.tile);
    expect(s.stageHeight + s.controlsHeight + HUD_HEIGHT_PX).toBe(844 - 24 - 34);
    expect(s.stageHeight).toBeGreaterThanOrEqual(s.mazeHeight);
  });

  it('sin espacio de sobra el laberinto queda pegado al HUD y los controles se quedan con lo que hay', () => {
    const s = portraitSplit(phone(360, 600));
    expect(s.stageHeight).toBe(s.mazeHeight);
  });

  it('vertical en pantalla baja: los controles nunca bajan de su alto mínimo', () => {
    const s = portraitSplit(phone(390, 500));
    expect(s.controlsHeight).toBeGreaterThanOrEqual(CONTROLS_HEIGHT_PX);
  });

  it('vertical: las flechas (3 botones y 2 separaciones) caben en la zona de controles junto a la pausa', () => {
    const dpad = 3 * DPAD_BUTTON_PX + 2 * DPAD_GAP_PX;
    for (const v of [phone(360, 800), phone(390, 844)]) {
      expect(dpad).toBeLessThanOrEqual(portraitSplit(v).controlsHeight);
      // Ancho libre: el más angosto (360) menos 24 de padding y la columna de la pausa.
      expect(dpad).toBeLessThanOrEqual(360 - 24 - PAUSE_BUTTON_PX);
    }
  });

  it('dpadSize: flechas de 56 px en 360×800 y 390×844', () => {
    expect(dpadSize(portraitSplit(phone(360, 800)).controlsHeight)).toBe(56);
    expect(dpadSize(portraitSplit(phone(390, 844)).controlsHeight)).toBe(56);
  });

  it('dpadSize: en pantallas bajas las flechas se encogen y caben en la fila de controles', () => {
    for (const v of [phone(360, 600), phone(390, 500)]) {
      const h = portraitSplit(v).controlsHeight;
      expect(3 * dpadSize(h) + 2 * DPAD_GAP_PX).toBeLessThanOrEqual(h);
    }
    expect(dpadSize(132)).toBe(38);
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
