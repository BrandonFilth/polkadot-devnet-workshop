import { describe, expect, it } from 'vitest';
import {
  MASTER_VOLUME,
  MUSIC_VOLUME,
  POWER_DOT_NOTE_SECONDS,
  POWER_DOT_VOLUME,
  SFX_VOLUME,
  SIREN_LFO_DEPTH_HZ,
  SIREN_LFO_RATE,
  SIREN_VOLUME,
  WAKA_MIN_INTERVAL_SECONDS,
} from '../engine/rules';
import { fakeContext } from './fakeContext';
import { createSfx, POWER_NOTES, SIREN, WAKA } from './sfx';
import { createSynth } from './synth';

const setup = () => {
  const ctx = fakeContext();
  const synth = createSynth(ctx);
  let t = 0;
  const sfx = createSfx(synth, () => t);
  return { ctx, synth, sfx, at: (s: number) => (t = s) };
};

describe('sintetizador', () => {
  it('buses maestro → música y efectos con sus volúmenes', () => {
    const { ctx } = setup();
    expect(ctx.gains.map((g) => g.gain.value)).toEqual([MASTER_VOLUME, MUSIC_VOLUME, SFX_VOLUME]);
  });

  it('tone: ataque corto, release exponencial y barrido', () => {
    const { ctx, synth } = setup();
    synth.tone({ wave: 'square', freq: 400, slideTo: 200, at: 2, dur: 0.5, gain: 0.5, bus: 'effects' });
    const osc = ctx.oscillators[0]!;
    expect(osc.type).toBe('square');
    expect(osc.started).toBe(2);
    expect(osc.stopped).toBeGreaterThan(2.5);
    expect(osc.frequency.calls.map((c) => c.fn)).toEqual(['set', 'exp']);
    const env = ctx.gains[3]!;
    expect(env.gain.calls.map((c) => c.fn)).toEqual(['set', 'linear', 'exp']);
    expect(env.gain.calls[1]!.time).toBeCloseTo(2.005, 9);
    expect(env.gain.calls[2]!.time).toBeCloseTo(2.5, 9);
  });

  it('noise reutiliza un solo buffer', () => {
    const { ctx, synth } = setup();
    synth.noise({ at: 0, dur: 0.03, gain: 0.2, bus: 'music' });
    synth.noise({ at: 0.1, dur: 0.03, gain: 0.2, bus: 'music', rate: 0.5 });
    expect(ctx.buffers).toHaveLength(1);
    expect(ctx.sources).toHaveLength(2);
    expect(ctx.sources[1]!.buffer).toBe(ctx.sources[0]!.buffer);
  });

  it('setBusMuted pone el bus en 0 en currentTime y lo devuelve', () => {
    const { ctx, synth } = setup();
    ctx.currentTime = 3.25;
    synth.setBusMuted('music', true);
    expect(synth.busGain('music')).toBe(0);
    expect(ctx.gains[1]!.gain.calls.at(-1)).toEqual({ fn: 'set', value: 0, time: 3.25 });
    synth.setBusMuted('music', false);
    expect(synth.busGain('music')).toBe(MUSIC_VOLUME);
  });
});

describe('efectos', () => {
  it('el waka alterna dos alturas en cada bolita', () => {
    const { ctx, sfx, at } = setup();
    for (let i = 0; i < 3; i++) {
      at(i * 0.2);
      sfx.onDotEaten();
    }
    const freqs = ctx.oscillators.map((o) => o.frequency.calls[0]!.value);
    expect(freqs).toEqual([WAKA[0].freq, WAKA[1].freq, WAKA[0].freq]);
  });

  it('una bolita dentro del intervalo mínimo no suena', () => {
    const { ctx, sfx, at } = setup();
    at(1);
    sfx.onDotEaten();
    at(1 + WAKA_MIN_INTERVAL_SECONDS / 2);
    sfx.onDotEaten();
    expect(ctx.oscillators).toHaveLength(1);
    at(1 + WAKA_MIN_INTERVAL_SECONDS);
    sfx.onDotEaten();
    expect(ctx.oscillators).toHaveLength(2);
    expect(ctx.oscillators[1]!.frequency.calls[0]!.value).toBe(WAKA[1].freq);
  });

  it('la sirena se crea una sola vez y se para', () => {
    const { ctx, sfx } = setup();
    sfx.setFrightened(true);
    sfx.setFrightened(true);
    expect(sfx.sirenOn).toBe(true);
    // Oscilador grave + LFO.
    expect(ctx.oscillators).toHaveLength(2);
    expect(ctx.oscillators[0]!.frequency.calls[0]!.value).toBe(SIREN.freq);
    // Suave: triangle (no square), volumen bajo y vaivén lento y corto.
    expect(ctx.oscillators[0]!.type).toBe('triangle');
    expect(ctx.oscillators[1]!.frequency.calls[0]!.value).toBe(SIREN_LFO_RATE);
    const [depth, env] = ctx.gains.slice(3);
    expect(depth!.gain.value).toBe(SIREN_LFO_DEPTH_HZ);
    expect(env!.gain.calls.find((c) => c.fn === 'linear')?.value).toBe(SIREN_VOLUME);
    expect(SIREN_VOLUME).toBeLessThanOrEqual(0.1);
    expect(SIREN_LFO_DEPTH_HZ).toBeLessThanOrEqual(15);
    expect(ctx.oscillators[0]!.stopped).toBeNull();
    sfx.setFrightened(false);
    expect(sfx.sirenOn).toBe(false);
    expect(ctx.oscillators[0]!.stopped).not.toBeNull();
    expect(ctx.oscillators[1]!.stopped).not.toBeNull();
  });

  it('muerte: barrido descendente square de ~1 s; fantasma comido más agudo con más puntos', () => {
    const { ctx, sfx } = setup();
    sfx.onDeath();
    const death = ctx.oscillators[0]!;
    expect(death.type).toBe('square');
    const [start, end] = death.frequency.calls;
    expect(end!.value).toBeLessThan(start!.value);
    expect(end!.time - start!.time).toBeGreaterThan(0.8);
    expect(end!.time - start!.time).toBeLessThan(1.2);
    sfx.onGhostEaten(200);
    sfx.onGhostEaten(1600);
    const f200 = ctx.oscillators[1]!.frequency.calls[0]!.value;
    const f1600 = ctx.oscillators[2]!.frequency.calls[0]!.value;
    expect(f1600).toBeGreaterThan(f200);
  });

  it('especial: dos notas suaves en triangle, que suben, con volumen bajo', () => {
    const { ctx, sfx } = setup();
    sfx.onPowerDot();
    expect(ctx.oscillators).toHaveLength(POWER_NOTES.length);
    expect(POWER_NOTES).toHaveLength(2);
    expect(ctx.oscillators.map((o) => o.type)).toEqual(['triangle', 'triangle']);
    const [a, b] = ctx.oscillators.map((o) => o.frequency.calls[0]!);
    expect(b!.value).toBeGreaterThan(a!.value);
    expect(b!.time - a!.time).toBeCloseTo(POWER_DOT_NOTE_SECONDS, 9);
    // Envolventes de las dos notas (después de maestro, música y efectos).
    for (const env of ctx.gains.slice(3)) {
      expect(env.gain.calls.find((c) => c.fn === 'linear')?.value).toBe(POWER_DOT_VOLUME);
    }
    expect(POWER_DOT_VOLUME).toBeLessThanOrEqual(0.3);
  });

  it('especial, ronda limpia, fin y tap suenan en el bus de efectos', () => {
    const { ctx, sfx } = setup();
    sfx.onPowerDot();
    sfx.onRoundClear();
    sfx.onGameOver();
    sfx.onTap();
    expect(ctx.oscillators).toHaveLength(2 + 4 + 3 + 1);
  });
});
