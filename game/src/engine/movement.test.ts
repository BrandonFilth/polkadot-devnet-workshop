import { describe, expect, it } from 'vitest';
import { MAZE, parseMaze, playerCanEnter } from './maze';
import { advance, type Mover } from './movement';
import { chooseAtCenter, createPlayer, requestDirection, requestDirections, updatePlayer, type Player } from './player';
import type { Dir } from './types';
import { DT } from './rules';

const maze = parseMaze(MAZE);
const canEnter = (c: number, r: number) => playerCanEnter(maze, c, r);
const noop = () => {};

describe('advance', () => {
  it('avanza por un pasillo', () => {
    // Fila 19 es un pasillo largo.
    const e: Mover = { pos: { x: 5, y: 19 }, dir: 'derecha' };
    advance(e, 0.3, canEnter, noop);
    expect(e.pos.x).toBeCloseTo(5.3);
    expect(e.pos.y).toBe(19);
    advance(e, 0.3, canEnter, noop);
    advance(e, 0.3, canEnter, noop);
    expect(e.pos.x).toBeCloseTo(5.9);
  });

  it('se detiene en el centro ante una pared', () => {
    // (1, 19): a la izquierda está la pared (0, 19).
    const e: Mover = { pos: { x: 1.4, y: 19 }, dir: 'izquierda' };
    for (let i = 0; i < 10; i++) advance(e, 0.3, canEnter, noop);
    expect(e.pos).toEqual({ x: 1, y: 19 });
    expect(e.dir).toBe('izquierda');
  });

  it('llama onCenter una sola vez al cruzar un centro y nunca cruza dos', () => {
    const e: Mover = { pos: { x: 5.9, y: 19 }, dir: 'derecha' };
    const centers: Array<[number, number]> = [];
    advance(e, 5, canEnter, (c, r) => centers.push([c, r]));
    expect(centers).toEqual([[6, 19]]);
    expect(e.pos.x).toBeLessThanOrEqual(7);
  });

  it('aplica la distancia sobrante en la nueva dirección tras girar en un centro', () => {
    // En (1, 19) se puede subir a (1, 18).
    const e: Mover = { pos: { x: 1.2, y: 19 }, dir: 'izquierda' };
    advance(e, 0.5, canEnter, () => {
      e.dir = 'arriba';
    });
    expect(e.pos.x).toBe(1);
    expect(e.pos.y).toBeCloseTo(18.7);
  });

  it('cruza el túnel hacia la izquierda', () => {
    const e: Mover = { pos: { x: 0, y: 9 }, dir: 'izquierda' };
    for (let i = 0; i < 12; i++) advance(e, 0.05, canEnter, noop);
    expect(e.pos.x).toBeCloseTo(18.4);
    expect(e.pos.y).toBe(9);
  });

  it('cruza el túnel hacia la derecha', () => {
    const e: Mover = { pos: { x: 18, y: 9 }, dir: 'derecha' };
    for (let i = 0; i < 12; i++) advance(e, 0.05, canEnter, noop);
    expect(e.pos.x).toBeCloseTo(-0.4);
    for (let i = 0; i < 8; i++) advance(e, 0.05, canEnter, noop);
    expect(e.pos.x).toBeCloseTo(0);
  });
});

describe('Polka-Man', () => {
  it('arranca en (9, 15) mirando a la izquierda', () => {
    const p = createPlayer(maze);
    expect(p.pos).toEqual({ x: 9, y: 15 });
    expect(p.dir).toBe('izquierda');
  });

  it('un giro pedido antes de un cruce se aplica en el siguiente cruce', () => {
    // Hacia la izquierda por la fila 15: en (8, 15) se puede subir a (8, 14).
    const p = createPlayer(maze);
    p.pos = { x: 8.5, y: 15 };
    requestDirection(p, 'arriba');
    expect(p.dir).toBe('izquierda'); // a mitad de casilla todavía no gira
    updatePlayer(p, maze, 0.05); // 0.3 casillas: no llega al centro
    expect(p.dir).toBe('izquierda');
    expect(p.pos.y).toBe(15);
    updatePlayer(p, maze, 0.05); // cruza el centro (8, 15), gira y sube lo que sobra
    expect(p.dir).toBe('arriba');
    expect(p.pos.x).toBe(8);
    expect(p.pos.y).toBeCloseTo(14.9);
  });

  it('el giro pedido no caduca: espera hasta un cruce donde se pueda', () => {
    // Fila 15 hacia la izquierda desde (7, 15): (7, 14) y (6, 14) son pared; (4, 14) es orbe.
    const p = createPlayer(maze);
    p.pos = { x: 7, y: 15 };
    requestDirection(p, 'arriba');
    for (let i = 0; i < 24; i++) updatePlayer(p, maze, DT * 4);
    expect(p.dir).toBe('arriba');
    expect(p.pos.x).toBe(4);
  });

  it('la reversa es inmediata a mitad de casilla', () => {
    const p = createPlayer(maze);
    p.pos = { x: 8.5, y: 15 };
    requestDirection(p, 'derecha');
    expect(p.dir).toBe('derecha');
    updatePlayer(p, maze, 0.05);
    expect(p.pos.x).toBeCloseTo(8.8);
  });

  it('la secundaria contraria no invierte; la principal contraria sí, al instante', () => {
    const p = createPlayer(maze);
    p.pos = { x: 8.5, y: 15 };
    requestDirections(p, 'arriba', 'derecha');
    expect(p.dir).toBe('izquierda');
    requestDirections(p, 'derecha', 'arriba');
    expect(p.dir).toBe('derecha');
  });

  it('la boca solo avanza mientras se mueve', () => {
    const p = createPlayer(maze);
    p.pos = { x: 1, y: 19 };
    updatePlayer(p, maze, 0.05); // contra la pared: quieto
    expect(p.mouth).toBe(0);
    requestDirection(p, 'derecha');
    updatePlayer(p, maze, 0.05);
    expect(p.mouth).toBeGreaterThan(0);
  });

  it('moving: false contra la pared, true al avanzar', () => {
    const p = createPlayer(maze);
    expect(p.moving).toBe(false);
    p.pos = { x: 1, y: 19 };
    updatePlayer(p, maze, 0.05); // mirando a la izquierda contra la pared
    expect(p.moving).toBe(false);
    requestDirection(p, 'derecha');
    updatePlayer(p, maze, 0.05);
    expect(p.moving).toBe(true);
    requestDirection(p, 'izquierda');
    for (let i = 0; i < 10; i++) updatePlayer(p, maze, 0.05);
    expect(p.moving).toBe(false);
  });
});

describe('Polka-Man: diagonales (dos direcciones pedidas)', () => {
  /** Sube por la columna 1 desde justo encima de (1, 19); devuelve dónde giró y cómo terminó. */
  const upColumn1 = (primary: Dir, secondary: Dir | null) => {
    const p: Player = createPlayer(maze);
    p.pos = { x: 1, y: 18.95 };
    p.dir = 'arriba' as Dir;
    requestDirections(p, primary, secondary);
    let turnedAt: { x: number; y: number } | null = null;
    for (let i = 0; i < 120 && !turnedAt; i++) {
      updatePlayer(p, maze, DT);
      if (p.dir === 'derecha') turnedAt = { x: Math.round(p.pos.x), y: Math.round(p.pos.y) };
    }
    return { p, turnedAt };
  };

  it('75° (arriba + derecha) subiendo: en (1, 18) sigue arriba y en (1, 17) gira a la derecha', () => {
    // (2, 18) es pared: ahí no gira. (2, 17) es orbe: ahí sí.
    const { turnedAt, p } = upColumn1('arriba', 'derecha');
    expect(turnedAt).toEqual({ x: 1, y: 17 });
    expect(p.pos.y).toBe(17);
    for (let i = 0; i < 10; i++) updatePlayer(p, maze, DT);
    expect(p.pos.x).toBeGreaterThan(1);
    expect(p.pos.y).toBe(17);
  });

  it('15° (derecha + arriba) subiendo: también gira a la derecha en (1, 17)', () => {
    expect(upColumn1('derecha', 'arriba').turnedAt).toEqual({ x: 1, y: 17 });
  });

  it('90° (arriba sola): no gira; se queda contra la pared en (1, 17) mirando arriba, igual que requestDirection', () => {
    const { p, turnedAt } = upColumn1('arriba', null);
    expect(turnedAt).toBeNull();
    expect(p.pos).toEqual({ x: 1, y: 17 });
    expect(p.dir).toBe('arriba');
    const q = createPlayer(maze);
    q.pos = { x: 1, y: 18.95 };
    q.dir = 'arriba';
    requestDirection(q, 'arriba');
    for (let i = 0; i < 120; i++) updatePlayer(q, maze, DT);
    expect(q.pos).toEqual(p.pos);
    expect(q.dir).toBe(p.dir);
  });

  it('diagonal contra pared en los dos ejes: sigue en su dirección, sin reversa', () => {
    // Hacia la izquierda por la fila 3, pide arriba + derecha: (2, 2) es pared y la derecha es la contraria.
    const p = createPlayer(maze);
    p.pos = { x: 2.2, y: 3 };
    p.dir = 'izquierda';
    requestDirections(p, 'arriba', 'derecha');
    updatePlayer(p, maze, 0.05); // cruza el centro (2, 3)
    expect(p.dir).toBe('izquierda');
    expect(p.pos.x).toBeLessThan(2);
    expect(p.pos.y).toBe(3);
  });

  it('chooseAtCenter: giro primero, después la otra, si no sigue igual', () => {
    const open = (...dirs: Dir[]) => (d: Dir) => dirs.includes(d);
    // Cardinal: lo de siempre.
    expect(chooseAtCenter('arriba', 'derecha', null, open('derecha', 'arriba'))).toBe('derecha');
    expect(chooseAtCenter('arriba', 'derecha', null, open('arriba'))).toBe('arriba');
    // Diagonal: el giro gana aunque sea la secundaria.
    expect(chooseAtCenter('arriba', 'arriba', 'derecha', open('arriba', 'derecha'))).toBe('derecha');
    expect(chooseAtCenter('arriba', 'derecha', 'arriba', open('arriba', 'derecha'))).toBe('derecha');
    // Giro cerrado: la otra pedida si se puede.
    expect(chooseAtCenter('arriba', 'arriba', 'derecha', open('arriba'))).toBe('arriba');
    // La secundaria contraria nunca se prueba en un centro.
    expect(chooseAtCenter('izquierda', 'arriba', 'derecha', open('derecha'))).toBe('izquierda');
    // Nada abierto: sigue igual (y advance lo detiene en la pared).
    expect(chooseAtCenter('izquierda', 'arriba', 'derecha', open())).toBe('izquierda');
    // Sin dirección: principal, después secundaria.
    expect(chooseAtCenter(null, 'arriba', 'derecha', open('arriba', 'derecha'))).toBe('arriba');
    expect(chooseAtCenter(null, 'arriba', 'derecha', open('derecha'))).toBe('derecha');
    expect(chooseAtCenter(null, null, null, open('derecha'))).toBeNull();
  });
});
