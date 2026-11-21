import { describe, expect, it } from 'vitest';
import { createGame, releaseDirections, setDirections, setPaused, start, update } from './game';
import { mulberry32 } from './replay.fixture';
import { parseInputs, replayGame } from './replay';
import { DT } from './rules';
import type { Dir } from './types';

const DIRS: Dir[] = ['arriba', 'abajo', 'izquierda', 'derecha'];

/**
 * Una partida «en vivo» como la juega la app: pasos de DT, pedidos al azar entre pasos, pausas largas a
 * mitad de partida y sueltas de tecla (también en pausa).
 */
function playLive(seed: number, inputSeed: number, maxSteps = 120 * 240) {
  const rand = mulberry32(inputSeed);
  const state = createGame(seed);
  start(state);
  for (let step = 0; step < maxSteps && state.phase !== 'fin'; step++) {
    const r = rand();
    if (r < 0.02) setDirections(state, DIRS[Math.floor(rand() * 4)]!, rand() < 0.3 ? DIRS[Math.floor(rand() * 4)]! : null);
    else if (r < 0.025) releaseDirections(state);
    else if (r < 0.0262 && state.phase === 'jugando') {
      // Pausa de 0 a 600 pasos, con una suelta a mitad.
      setPaused(state, true);
      const pause = Math.floor(rand() * 600);
      for (let i = 0; i < pause; i++) {
        if (i === pause >> 1) releaseDirections(state);
        update(state, DT);
      }
      setPaused(state, false);
    }
    update(state, DT);
  }
  return state;
}

describe('volver a jugar una partida', () => {
  it.each([
    [1, 11],
    [42, 7],
    [2_026, 99],
    [123_456_789, 3],
  ])('semilla %i: la repetición da el mismo puntaje, ronda, vidas y pasos que la partida en vivo', (seed, inputSeed) => {
    const live = playLive(seed, inputSeed);
    expect(live.score).toBeGreaterThan(0);
    const replay = replayGame(live.startSeed, live.inputs, live.tick);
    expect(replay).toEqual({ score: live.score, round: live.round, lives: live.lives, phase: live.phase, ticks: live.tick });
  });

  it('otra semilla u otros pedidos dan otra partida', () => {
    const live = playLive(42, 7);
    const same = replayGame(live.startSeed, live.inputs, live.tick);
    const key = (r: { score: number; ticks: number; lives: number; round: number }) => `${r.score}|${r.ticks}|${r.lives}|${r.round}`;
    // Sin los pedidos (un número inventado no trae una partida que lo produzca) el resultado es otro.
    expect(key(replayGame(live.startSeed, [], live.tick))).not.toBe(key(same));
    // Con las direcciones al revés, también.
    const flip: Record<string, 'arriba' | 'abajo' | 'izquierda' | 'derecha'> = { arriba: 'abajo', abajo: 'arriba', izquierda: 'derecha', derecha: 'izquierda' };
    const changed = live.inputs.map(([t, p, s]): typeof live.inputs[number] => [t, p === 'soltar' ? p : flip[p]!, s]);
    expect(key(replayGame(live.startSeed, changed, live.tick))).not.toBe(key(same));
  });

  it('nextSeed: la partida empieza con la semilla del Worker y la anota en startSeed', () => {
    const state = createGame(5);
    state.nextSeed = 777;
    start(state);
    expect(state.startSeed).toBe(777);
    expect(state.nextSeed).toBeNull();
    expect(state.tick).toBe(0);
    expect(state.inputs).toEqual([]);
  });

  it('parseInputs acepta la grabación y rechaza lo mal formado', () => {
    expect(parseInputs([[0, 'arriba', null], [3, 'soltar', null], [3, 'derecha', 'abajo']])).toEqual([
      [0, 'arriba', null],
      [3, 'soltar', null],
      [3, 'derecha', 'abajo'],
    ]);
    expect(() => parseInputs({})).toThrow();
    expect(() => parseInputs([[1, 'volar', null]])).toThrow();
    expect(() => parseInputs([[5, 'arriba', null], [4, 'abajo', null]])).toThrow();
    expect(() => parseInputs([[1.5, 'arriba', null]])).toThrow();
  });
});
