import { describe, expect, it } from 'vitest';
import { DPAD_BUTTON_PX as B, DPAD_GAP_PX as G } from '../engine/rules';
import { createDpad, dpadDirection, type Point } from './dpad';

// Pad de 3x3 centrado en (100, 100): cada flecha está a un botón y una separación del centro.
const C: Point = { x: 100, y: 100 };
const STEP = B + G;
const ARROWS: ReadonlyArray<[string, Point]> = [
  ['arriba', { x: C.x, y: C.y - STEP }],
  ['abajo', { x: C.x, y: C.y + STEP }],
  ['izquierda', { x: C.x - STEP, y: C.y }],
  ['derecha', { x: C.x + STEP, y: C.y }],
];

describe('flechas (D-pad)', () => {
  it.each(ARROWS)('tocar la flecha %s da esa dirección', (dir, p) => {
    const pad = createDpad();
    const f = pad.start(1, p, C)!;
    expect(f.dir).toBe(dir);
    expect(f.changed).toBe(true);
    expect(pad.dir).toBe(dir);
  });

  it('en una esquina gana el eje dominante', () => {
    expect(dpadDirection(50, -40)).toBe('derecha');
    expect(dpadDirection(-30, 50)).toBe('abajo');
  });

  it('si los ejes empatan gana el horizontal', () => {
    expect(dpadDirection(-50, -50)).toBe('izquierda');
    expect(dpadDirection(50, 50)).toBe('derecha');
  });

  it('el centro no da dirección y conserva la última', () => {
    expect(dpadDirection(0, 0)).toBeNull();
    expect(dpadDirection(B / 2 - 1, -(B / 2 - 1))).toBeNull();
    const pad = createDpad();
    const up = { x: C.x, y: C.y - STEP };
    pad.start(1, up, C);
    const f = pad.move(1, C)!;
    expect(f.dir).toBeNull();
    expect(f.changed).toBe(false);
    expect(pad.dir).toBe('arriba');
    // Volver a la misma flecha no es un cambio.
    expect(pad.move(1, up)!.changed).toBe(false);
  });

  it('deslizar de Arriba a Derecha sin soltar cambia la dirección', () => {
    const pad = createDpad();
    pad.start(1, { x: C.x, y: C.y - STEP }, C);
    const f = pad.move(1, { x: C.x + STEP, y: C.y })!;
    expect(f.dir).toBe('derecha');
    expect(f.changed).toBe(true);
  });

  it('moverse dentro de la misma flecha no es un cambio', () => {
    const pad = createDpad();
    pad.start(1, { x: C.x, y: C.y - STEP }, C);
    const f = pad.move(1, { x: C.x + 10, y: C.y - STEP - 8 })!;
    expect(f.dir).toBe('arriba');
    expect(f.changed).toBe(false);
  });

  it('un segundo dedo se ignora en start, move y end', () => {
    const pad = createDpad();
    pad.start(1, { x: C.x, y: C.y - STEP }, C);
    expect(pad.start(2, { x: C.x + STEP, y: C.y }, C)).toBeNull();
    expect(pad.move(2, { x: C.x + STEP, y: C.y })).toBeNull();
    expect(pad.end(2)).toBe(false);
    expect(pad.pointerId).toBe(1);
    expect(pad.dir).toBe('arriba');
  });

  it('después de soltar se puede empezar otro toque', () => {
    const pad = createDpad();
    pad.start(1, { x: C.x, y: C.y - STEP }, C);
    expect(pad.end(1)).toBe(true);
    expect(pad.pointerId).toBeNull();
    expect(pad.dir).toBeNull();
    const f = pad.start(3, { x: C.x, y: C.y - STEP }, C)!;
    expect(f.dir).toBe('arriba');
    expect(f.changed).toBe(true);
    expect(pad.pointerId).toBe(3);
  });
});
