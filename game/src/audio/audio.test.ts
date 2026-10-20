import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../engine/types';
import { createAudio } from './audio';
import { fakeContext } from './fakeContext';
import { createSoundPrefs } from './prefs';

const orbe: GameEvent = { type: 'orbe', tile: 5 };

const setup = () => {
  const ctx = fakeContext();
  const prefs = createSoundPrefs(null);
  const audio = createAudio({ prefs, createContext: () => ctx });
  return { ctx, prefs, audio };
};

describe('audio sin AudioContext', () => {
  it.each([
    ['undefined', () => undefined],
    [
      'que lanza',
      () => {
        throw new Error('sin audio');
      },
    ],
  ])('createContext %s: unlock, handle, sync y tap no lanzan', (_name, createContext) => {
    const audio = createAudio({ prefs: createSoundPrefs(null), createContext });
    expect(() => {
      audio.unlock();
      audio.unlock();
      audio.handle([orbe, { type: 'muerte', pos: { x: 0, y: 0 } }]);
      audio.sync({ phase: 'jugando', frightened: true });
      audio.tap();
    }).not.toThrow();
    expect(audio.debugState()).toMatchObject({ context: 'sin audio', music: 'off', siren: false, recent: ['orbe', 'muerte'] });
  });

  it('resume() que rechaza o lanza no rompe nada', async () => {
    const ctx = fakeContext();
    ctx.resume = () => Promise.reject(new Error('no'));
    const audio = createAudio({ prefs: createSoundPrefs(null), createContext: () => ctx });
    expect(() => audio.unlock()).not.toThrow();
    ctx.resume = () => {
      throw new Error('no');
    };
    expect(() => audio.unlock()).not.toThrow();
    await Promise.resolve();
  });
});

describe('audio', () => {
  it('nada suena antes del primer gesto; unlock crea el contexto una vez y lo reanuda', () => {
    const { ctx, audio } = setup();
    audio.handle([orbe]);
    expect(ctx.oscillators).toHaveLength(0);
    audio.unlock();
    expect(ctx.state).toBe('running');
    audio.unlock();
    expect(ctx.resumes).toBe(1);
    audio.handle([orbe]);
    expect(ctx.oscillators).toHaveLength(1);
  });

  it('con Efectos silenciados no crea osciladores ni sirena', () => {
    const { ctx, prefs, audio } = setup();
    prefs.setEffects(false);
    prefs.setMusic(false);
    audio.unlock();
    audio.handle([orbe, { type: 'muerte', pos: { x: 0, y: 0 } }]);
    audio.sync({ phase: 'jugando', frightened: true });
    audio.tap();
    expect(ctx.oscillators).toHaveLength(0);
    expect(audio.debugState().siren).toBe(false);
  });

  it('silenciar la Música pone el gain del bus en 0 al instante', () => {
    const { ctx, prefs, audio } = setup();
    audio.unlock();
    ctx.currentTime = 4;
    prefs.toggleMusic();
    expect(audio.debugState().musicGain).toBe(0);
    expect(ctx.gains[1]!.gain.calls.at(-1)).toEqual({ fn: 'set', value: 0, time: 4 });
    audio.sync({ phase: 'jugando', frightened: false });
    expect(audio.debugState().music).toBe('off');
  });

  it("música 'normal' en 'jugando', 'susto' con susto y 'off' en pausa y en las otras fases", () => {
    const { audio } = setup();
    audio.unlock();
    audio.sync({ phase: 'jugando', frightened: false });
    expect(audio.debugState().music).toBe('normal');
    audio.sync({ phase: 'jugando', frightened: true });
    expect(audio.debugState()).toMatchObject({ music: 'susto', siren: true });
    audio.sync({ phase: 'pausa', frightened: true });
    expect(audio.debugState()).toMatchObject({ music: 'off', siren: false });
    for (const phase of ['titulo', 'listo', 'muriendo', 'rondaLimpia', 'fin'] as const) {
      audio.sync({ phase, frightened: false });
      expect(audio.debugState().music).toBe('off');
    }
  });

  it('apagar Efectos para la sirena al instante', () => {
    const { prefs, audio } = setup();
    audio.unlock();
    audio.sync({ phase: 'jugando', frightened: true });
    expect(audio.debugState().siren).toBe(true);
    prefs.setEffects(false);
    expect(audio.debugState().siren).toBe(false);
  });

  it('recent guarda los últimos 20 tipos de evento', () => {
    const { audio } = setup();
    audio.handle(Array.from({ length: 25 }, (_, i) => ({ type: 'orbe', tile: i }) as GameEvent));
    audio.handle([{ type: 'inicio' }]);
    const recent = audio.debugState().recent;
    expect(recent).toHaveLength(20);
    expect(recent.at(-1)).toBe('inicio');
  });
});
