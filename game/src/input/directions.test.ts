import { describe, expect, it } from 'vitest';
import { SWIPE_DIAGONAL_HALF_DEG } from '../engine/rules';
import { sectorDirections } from './directions';

/** Desplazamiento a `deg` grados (0 = derecha, 90 = abajo, en pantalla) y `dist` px del centro. */
const at = (deg: number, dist = 40) => {
  const rad = (deg * Math.PI) / 180;
  return [Math.cos(rad) * dist, Math.sin(rad) * dist] as const;
};
const dirsAt = (deg: number, dist?: number) => {
  const [dx, dy] = at(deg, dist);
  return sectorDirections(dx, dy);
};
/** `deg` medido desde el eje horizontal hacia ARRIBA-derecha (0 = derecha, 90 = arriba). */
const upRight = (deg: number) => dirsAt(-deg);

describe('direcciones: 8 sectores', () => {
  it.each([
    [0, 'derecha'],
    [90, 'abajo'],
    [180, 'izquierda'],
    [270, 'arriba'],
  ] as const)('%i° → %s recto', (deg, dir) => {
    expect(dirsAt(deg)).toEqual({ primary: dir, secondary: null });
  });

  it('75° arriba-derecha → arriba con derecha de secundaria', () => {
    expect(upRight(75)).toEqual({ primary: 'arriba', secondary: 'derecha' });
  });

  it('15° arriba-derecha → derecha con arriba de secundaria', () => {
    expect(upRight(15)).toEqual({ primary: 'derecha', secondary: 'arriba' });
  });

  it('90° y 80° → arriba recto; 12° → derecha recto', () => {
    expect(upRight(90)).toEqual({ primary: 'arriba', secondary: null });
    expect(upRight(80)).toEqual({ primary: 'arriba', secondary: null });
    expect(upRight(12)).toEqual({ primary: 'derecha', secondary: null });
  });

  it('las cuatro diagonales (el empate exacto a 45° gana el horizontal)', () => {
    expect(sectorDirections(30, -30)).toEqual({ primary: 'derecha', secondary: 'arriba' });
    expect(sectorDirections(30, 30)).toEqual({ primary: 'derecha', secondary: 'abajo' });
    expect(sectorDirections(-30, 30)).toEqual({ primary: 'izquierda', secondary: 'abajo' });
    expect(sectorDirections(-30, -30)).toEqual({ primary: 'izquierda', secondary: 'arriba' });
    expect(dirsAt(60)).toEqual({ primary: 'abajo', secondary: 'derecha' });
    expect(dirsAt(240)).toEqual({ primary: 'arriba', secondary: 'izquierda' });
  });

  it('borde del sector recto en 45 − 32.5 = 12.5°', () => {
    expect(SWIPE_DIAGONAL_HALF_DEG).toBe(32.5);
    expect(upRight(12).secondary).toBeNull();
    expect(upRight(13).secondary).toBe('arriba');
    expect(upRight(78).secondary).toBeNull();
    expect(upRight(77).secondary).toBe('derecha');
  });

  it('la anchura del sector se puede ajustar: con 22.5 los 75° caen en arriba recto, con 32.5 en diagonal', () => {
    const [dx, dy] = at(-75);
    expect(sectorDirections(dx, dy, 22.5)).toEqual({ primary: 'arriba', secondary: null });
    expect(sectorDirections(dx, dy, 32.5)).toEqual({ primary: 'arriba', secondary: 'derecha' });
  });
});
