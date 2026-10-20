import { describe, expect, it } from 'vitest';
import { MAZE, parseMaze } from '../engine/maze';
import {
  DOT_BURST_RADIUS,
  GHOST_POINTS_RISE,
  POWER_BURST_RADIUS,
  REDUCED_MOTION_BURST_FACTOR,
} from '../engine/rules';
import type { GameEvent } from '../engine/types';
import { addFromEvents, effectFrame, prune, type Effect } from './effects';

const maze = parseMaze(MAZE);

describe('addFromEvents', () => {
  it('crea un efecto por bolita, especial y fantasma comido', () => {
    const tile = 3 * maze.width + 5;
    const events: GameEvent[] = [
      { type: 'orbe', tile },
      { type: 'especial', tile: tile + 1 },
      { type: 'fantasmaComido', ghostId: 1, points: 400, pos: { x: 7.5, y: 9 } },
    ];
    const list: Effect[] = [];
    addFromEvents(list, events, maze, 1000);
    expect(list).toEqual([
      { kind: 'orbe', x: 5, y: 3, t0Ms: 1000 },
      { kind: 'especial', x: 6, y: 3, t0Ms: 1000 },
      { kind: 'puntos', x: 7.5, y: 9, t0Ms: 1000, text: '400' },
    ]);
  });

  it('no crea nada para muerte, inicio, ronda limpia ni fin', () => {
    const list: Effect[] = [];
    addFromEvents(
      list,
      [
        { type: 'muerte', pos: { x: 1, y: 1 } },
        { type: 'inicio' },
        { type: 'rondaLimpia', round: 2 },
        { type: 'finPartida', score: 10 },
      ],
      maze,
      0,
    );
    expect(list).toEqual([]);
  });

  it('copia la posición del fantasma', () => {
    const pos = { x: 2, y: 3 };
    const list: Effect[] = [];
    addFromEvents(list, [{ type: 'fantasmaComido', ghostId: 0, points: 200, pos }], maze, 0);
    pos.x = 99;
    expect(list[0]!.x).toBe(2);
  });
});

describe('prune', () => {
  const make = (): Effect[] => [
    { kind: 'orbe', x: 0, y: 0, t0Ms: 0 },
    { kind: 'especial', x: 0, y: 0, t0Ms: 0 },
    { kind: 'puntos', x: 0, y: 0, t0Ms: 0, text: '200' },
  ];

  it('quita la bolita a 180 ms, la especial a 320 ms y los puntos a 700 ms', () => {
    const list = make();
    prune(list, 179);
    expect(list.map((e) => e.kind)).toEqual(['orbe', 'especial', 'puntos']);
    prune(list, 180);
    expect(list.map((e) => e.kind)).toEqual(['especial', 'puntos']);
    prune(list, 319);
    expect(list.map((e) => e.kind)).toEqual(['especial', 'puntos']);
    prune(list, 320);
    expect(list.map((e) => e.kind)).toEqual(['puntos']);
    prune(list, 699);
    expect(list.map((e) => e.kind)).toEqual(['puntos']);
    prune(list, 700);
    expect(list).toEqual([]);
  });
});

describe('effectFrame', () => {
  const orbe: Effect = { kind: 'orbe', x: 0, y: 0, t0Ms: 0 };
  const especial: Effect = { kind: 'especial', x: 0, y: 0, t0Ms: 0 };
  const puntos: Effect = { kind: 'puntos', x: 0, y: 0, t0Ms: 0, text: '200' };

  it('los destellos crecen hasta su radio y se desvanecen', () => {
    expect(effectFrame(orbe, 0, false).alpha).toBe(1);
    expect(effectFrame(orbe, 180, false).radius).toBeCloseTo(DOT_BURST_RADIUS);
    expect(effectFrame(orbe, 180, false).alpha).toBe(0);
    expect(effectFrame(especial, 320, false).radius).toBeCloseTo(POWER_BURST_RADIUS);
    expect(effectFrame(especial, 160, false).radius).toBeGreaterThan(effectFrame(orbe, 90, false).radius);
  });

  it('los puntos suben mientras se ven', () => {
    expect(effectFrame(puntos, 0, false).rise).toBe(0);
    expect(effectFrame(puntos, 700, false).rise).toBeCloseTo(GHOST_POINTS_RISE);
    expect(effectFrame(puntos, 350, false).alpha).toBeGreaterThan(0.5);
  });

  it('con menos movimiento el radio es fijo y los puntos no suben pero se ven', () => {
    for (const t of [0, 90, 170]) {
      expect(effectFrame(orbe, t, true).radius).toBeCloseTo(DOT_BURST_RADIUS * REDUCED_MOTION_BURST_FACTOR);
    }
    for (const t of [0, 160, 310]) {
      expect(effectFrame(especial, t, true).radius).toBeCloseTo(POWER_BURST_RADIUS * REDUCED_MOTION_BURST_FACTOR);
    }
    for (const t of [0, 350, 690]) {
      const f = effectFrame(puntos, t, true);
      expect(f.rise).toBe(0);
      expect(f.alpha).toBeGreaterThan(0);
    }
  });
});
