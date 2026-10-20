// Cuentas del tamaño del laberinto en pantalla. Puro (sin DOM) para probarlo con Vitest.
import { CONTROLS_HEIGHT_PX, HUD_HEIGHT_PX, MIN_TILE_PX, VIEW_CROP_TILES } from '../engine/rules';

export interface Viewport {
  width: number;
  height: number;
  safeTop: number;
  safeRight: number;
  safeBottom: number;
  safeLeft: number;
  /** Pantalla táctil: hay zona de controles (joystick y pausa). */
  touch: boolean;
}

/**
 * Espacio libre para el laberinto: la pantalla menos las safe areas, el HUD y, en táctil, los
 * controles. La rejilla de styles.css hace la misma resta; esto documenta y prueba la intención.
 */
export function stageSize(v: Viewport): { width: number; height: number } {
  return {
    width: Math.max(0, v.width - v.safeLeft - v.safeRight),
    height: Math.max(0, v.height - v.safeTop - v.safeBottom - HUD_HEIGHT_PX - (v.touch ? CONTROLS_HEIGHT_PX : 0)),
  };
}

export interface MazeLayout {
  /** Tamaño de casilla en px CSS. */
  tile: number;
  /** Casillas recortadas en cada lado (anillo exterior de pared). */
  crop: number;
  /** Desplazamiento del dibujo en px CSS (crop × tile). */
  offset: number;
  cssWidth: number;
  cssHeight: number;
}

/**
 * Casilla = floor(min(ancho / columnas visibles, alto / filas visibles)). Se recorta media casilla
 * del anillo exterior de pared en cada lado: en vertical el ancho manda y esa franja oscura no aporta.
 */
export function mazeLayout(cols: number, rows: number, stageW: number, stageH: number): MazeLayout {
  const crop = VIEW_CROP_TILES;
  const vc = cols - 2 * crop;
  const vr = rows - 2 * crop;
  const tile = Math.max(MIN_TILE_PX, Math.floor(Math.min(stageW / vc, stageH / vr)));
  return { tile, crop, offset: crop * tile, cssWidth: vc * tile, cssHeight: vr * tile };
}
