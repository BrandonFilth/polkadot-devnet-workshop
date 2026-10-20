import { describe, expect, it } from 'vitest';
import { JOYSTICK_RADIUS_PX as R } from '../engine/rules';
import { createFloatingStick, dragBase, stickHintVisible, type Point } from './floatingStick';

/** Punto a `dist` px de `from`, `deg` grados hacia arriba-derecha (0 = derecha, 90 = arriba). */
const upRight = (from: Point, deg: number, dist: number): Point => {
  const rad = (deg * Math.PI) / 180;
  return { x: from.x + Math.cos(rad) * dist, y: from.y - Math.sin(rad) * dist };
};
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

describe('joystick flotante', () => {
  it('la base y la perilla aparecen en el punto del toque', () => {
    const s = createFloatingStick();
    const f = s.start(1, { x: 120, y: 70 })!;
    expect(f.base).toEqual({ x: 120, y: 70 });
    expect(f.knob).toEqual({ x: 120, y: 70 });
    expect(f.dir).toBeNull();
    expect(f.changed).toBe(false);
    expect(s.pointerId).toBe(1);
  });

  it('zona muerta: 9 px no da dirección, 11 px sí', () => {
    const s = createFloatingStick();
    s.start(1, { x: 100, y: 100 });
    expect(s.move(1, { x: 109, y: 100 })!.dir).toBeNull();
    const f = s.move(1, { x: 111, y: 100 })!;
    expect(f.dir).toBe('derecha');
    expect(f.changed).toBe(true);
  });

  it('75° arriba-derecha da arriba con derecha de secundaria', () => {
    const s = createFloatingStick();
    const p0 = { x: 100, y: 100 };
    s.start(1, p0);
    const f = s.move(1, upRight(p0, 75, 40))!;
    expect(f.dir).toBe('arriba');
    expect(f.secondary).toBe('derecha');
  });

  it('si el dedo pasa el radio, la base lo sigue y la dirección se mantiene', () => {
    const s = createFloatingStick();
    const p0 = { x: 100, y: 100 };
    s.start(1, p0);
    s.move(1, upRight(p0, 75, 40));
    const finger = upRight(p0, 75, 150);
    const f = s.move(1, finger)!;
    expect(dist(f.base, finger)).toBeCloseTo(R);
    // La base se movió sobre la misma línea, 150 − R px desde el toque.
    expect(dist(f.base, p0)).toBeCloseTo(150 - R);
    const back = upRight(p0, 75, 150 - R);
    expect(f.base.x).toBeCloseTo(back.x);
    expect(f.base.y).toBeCloseTo(back.y);
    expect(f.knob.x).toBeCloseTo(finger.x);
    expect(f.knob.y).toBeCloseTo(finger.y);
    expect(f.dir).toBe('arriba');
    expect(f.secondary).toBe('derecha');
    expect(f.changed).toBe(false);
  });

  it('tras arrastrar, manda la base nueva: volver cerca de ella no da dirección', () => {
    const s = createFloatingStick();
    const p0 = { x: 100, y: 100 };
    s.start(1, p0);
    const f1 = s.move(1, { x: 300, y: 100 })!;
    expect(f1.base.x).toBeCloseTo(300 - R);
    const f2 = s.move(1, { x: f1.base.x + 5, y: 100 })!;
    expect(f2.dir).toBeNull();
    expect(f2.base).toEqual(f1.base);
  });

  it('changed solo al cambiar de sector', () => {
    const s = createFloatingStick();
    s.start(1, { x: 100, y: 100 });
    expect(s.move(1, { x: 140, y: 100 })!.changed).toBe(true);
    expect(s.move(1, { x: 145, y: 101 })!.changed).toBe(false);
    expect(s.move(1, { x: 100, y: 60 })!.changed).toBe(true);
  });

  it('al soltar queda la última principal, sin secundaria', () => {
    const s = createFloatingStick();
    const p0 = { x: 100, y: 100 };
    s.start(1, p0);
    s.move(1, upRight(p0, 75, 40));
    expect(s.last).toEqual({ primary: 'arriba', secondary: 'derecha' });
    expect(s.end(1)).toEqual({ primary: 'arriba', secondary: null });
    expect(s.pointerId).toBeNull();
    expect(s.last).toBeNull();
  });

  it('un toque que no sale de la zona muerta no pide nada al soltar', () => {
    const s = createFloatingStick();
    s.start(1, { x: 100, y: 100 });
    s.move(1, { x: 104, y: 103 });
    expect(s.end(1)).toBeNull();
  });

  it('un segundo dedo se ignora', () => {
    const s = createFloatingStick();
    s.start(1, { x: 100, y: 100 });
    expect(s.start(2, { x: 200, y: 50 })).toBeNull();
    expect(s.move(2, { x: 260, y: 50 })).toBeNull();
    expect(s.end(2)).toBeNull();
    expect(s.pointerId).toBe(1);
    const f = s.move(1, { x: 140, y: 100 })!;
    expect(f.base).toEqual({ x: 100, y: 100 });
    expect(f.dir).toBe('derecha');
    expect(s.end(1)).toEqual({ primary: 'derecha', secondary: null });
    expect(s.start(2, { x: 200, y: 50 })).not.toBeNull();
    expect(s.pointerId).toBe(2);
  });

  it('dragBase dentro del radio deja la base igual', () => {
    const b = { x: 10, y: 10 };
    expect(dragBase(b, { x: 30, y: 10 }, R)).toBe(b);
    expect(dragBase(b, { x: 10 + R, y: 10 }, R)).toBe(b);
  });
});

describe('joystick flotante: pista «Toca y arrastra»', () => {
  it('se ve en la ronda 1 sin dedo, con la partida en marcha', () => {
    expect(stickHintVisible('listo', 1, false)).toBe(true);
    expect(stickHintVisible('jugando', 1, false)).toBe(true);
    expect(stickHintVisible('muriendo', 1, false)).toBe(true);
  });

  it('se esconde con el dedo abajo, desde la ronda 2 y fuera del juego', () => {
    expect(stickHintVisible('jugando', 1, true)).toBe(false);
    expect(stickHintVisible('jugando', 2, false)).toBe(false);
    expect(stickHintVisible('titulo', 1, false)).toBe(false);
    expect(stickHintVisible('fin', 1, false)).toBe(false);
    expect(stickHintVisible('pausa', 1, false)).toBe(false);
  });
});
