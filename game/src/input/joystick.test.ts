import { describe, expect, it } from 'vitest';
import { JOYSTICK_DEAD_ZONE, JOYSTICK_DIAGONAL_HALF_DEG, JOYSTICK_RADIUS_PX as R } from '../engine/rules';
import { joystickDirection, joystickDirections, knobOffset } from './joystick';

/** Desplazamiento a `deg` grados (0 = derecha, 90 = abajo, en pantalla) y `dist` px del centro. */
const at = (deg: number, dist = 0.8 * R) => {
  const rad = (deg * Math.PI) / 180;
  return [Math.cos(rad) * dist, Math.sin(rad) * dist] as const;
};
const dirAt = (deg: number, dist?: number) => {
  const [dx, dy] = at(deg, dist);
  return joystickDirection(dx, dy, R);
};
const dirsAt = (deg: number, dist?: number) => {
  const [dx, dy] = at(deg, dist);
  return joystickDirections(dx, dy, R);
};

describe('joystick: dirección', () => {
  it.each([
    [0, 'derecha'],
    [90, 'abajo'],
    [180, 'izquierda'],
    [270, 'arriba'],
    [44, 'derecha'],
    [46, 'abajo'],
    [134, 'abajo'],
    [136, 'izquierda'],
    [224, 'izquierda'],
    [226, 'arriba'],
    [314, 'arriba'],
    [316, 'derecha'],
  ] as const)('%i° → %s', (deg, dir) => {
    expect(dirAt(deg)).toBe(dir);
  });

  it('el empate exacto a 45° y 135° gana el eje horizontal', () => {
    expect(joystickDirection(30, 30, R)).toBe('derecha');
    expect(joystickDirection(-30, 30, R)).toBe('izquierda');
    expect(joystickDirection(-30, -30, R)).toBe('izquierda');
  });

  it('zona muerta: cerca del centro no hay dirección', () => {
    expect(JOYSTICK_DEAD_ZONE).toBe(0.3);
    expect(dirAt(0, 0.29 * R)).toBeNull();
    expect(dirAt(90, 0.29 * R)).toBeNull();
    expect(dirAt(0, 0.31 * R)).toBe('derecha');
    expect(dirAt(270, 0.31 * R)).toBe('arriba');
    expect(joystickDirection(0, 0, R)).toBeNull();
  });

  it('más allá del radio sigue dando dirección', () => {
    expect(dirAt(180, 3 * R)).toBe('izquierda');
    expect(dirAt(90, 3 * R)).toBe('abajo');
  });
});

describe('joystick: 8 sectores', () => {
  /** `deg` medido desde el eje horizontal hacia ARRIBA-derecha (0 = derecha, 90 = arriba). */
  const upRight = (deg: number, dist?: number) => {
    const [dx, dy] = at(-deg, dist);
    return joystickDirections(dx, dy, R);
  };

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

  it('dentro de la zona muerta → null', () => {
    expect(upRight(75, 0.29 * R)).toBeNull();
    expect(joystickDirections(0, 0, R)).toBeNull();
  });

  it('las cuatro diagonales (45° gana el horizontal)', () => {
    expect(joystickDirections(30, -30, R)).toEqual({ primary: 'derecha', secondary: 'arriba' });
    expect(joystickDirections(30, 30, R)).toEqual({ primary: 'derecha', secondary: 'abajo' });
    expect(joystickDirections(-30, 30, R)).toEqual({ primary: 'izquierda', secondary: 'abajo' });
    expect(joystickDirections(-30, -30, R)).toEqual({ primary: 'izquierda', secondary: 'arriba' });
    expect(dirsAt(60)).toEqual({ primary: 'abajo', secondary: 'derecha' });
    expect(dirsAt(240)).toEqual({ primary: 'arriba', secondary: 'izquierda' });
  });

  it('borde del sector recto en 45 − 32.5 = 12.5°', () => {
    expect(JOYSTICK_DIAGONAL_HALF_DEG).toBe(32.5);
    expect(upRight(12)!.secondary).toBeNull();
    expect(upRight(13)!.secondary).toBe('arriba');
    expect(upRight(78)!.secondary).toBeNull();
    expect(upRight(77)!.secondary).toBe('derecha');
  });

  it('la anchura del sector se puede ajustar', () => {
    const [dx, dy] = at(-75);
    expect(joystickDirections(dx, dy, R, JOYSTICK_DEAD_ZONE, 22.5)).toEqual({ primary: 'arriba', secondary: null });
  });
});

describe('joystick: perilla', () => {
  it('no sale del radio de la base', () => {
    expect(knobOffset(3 * R, 0, R)).toEqual({ x: R, y: 0 });
    const k = knobOffset(3 * R, 4 * R, R);
    expect(Math.hypot(k.x, k.y)).toBeCloseTo(R);
  });

  it('dentro del radio queda igual', () => {
    expect(knobOffset(10, 0, R)).toEqual({ x: 10, y: 0 });
    expect(knobOffset(-5, 7, R)).toEqual({ x: -5, y: 7 });
  });
});
