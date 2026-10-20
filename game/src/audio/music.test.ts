import { describe, expect, it } from 'vitest';
import { MUSIC_BPM, MUSIC_FRIGHT_BPM, MUSIC_LOOKAHEAD_SECONDS } from '../engine/rules';
import { fakeContext } from './fakeContext';
import { createMusicScheduler, createSongPlayer, stepSeconds } from './music';
import { BASS, drumsAt, LEAD, leadLength, noteToHz, SONG_STEPS } from './song';
import songSource from './song.ts?raw';
import { createSynth } from './synth';

type Call = { step: number; variant: string; at: number; dur: number };
const recorder = () => {
  const calls: Call[] = [];
  const s = createMusicScheduler((step, variant, at, dur) => calls.push({ step, variant, at, dur }));
  return { calls, s };
};

describe('canción', () => {
  it('64 pasos de lead y de bajo, y lleva el comentario de melodía original', () => {
    expect(SONG_STEPS).toBe(64);
    expect(LEAD).toHaveLength(64);
    expect(BASS).toHaveLength(64);
    expect(LEAD[0]).toBe('A4');
    expect(songSource).toMatch(/Melodía original compuesta para Polka-Man; no copia ni aproxima el tema de Pac-Man ni otra música de juegos/);
  });

  it('noteToHz: La4 = 440, octavas y sostenidos', () => {
    expect(noteToHz('A4')).toBeCloseTo(440, 6);
    expect(noteToHz('A5')).toBeCloseTo(880, 6);
    expect(noteToHz('C4')).toBeCloseTo(261.626, 2);
    expect(noteToHz('A#4')).toBeCloseTo(466.164, 2);
    expect(() => noteToHz('H2')).toThrow();
  });

  it('la nota del lead dura hasta el siguiente ataque, dentro del compás', () => {
    expect(leadLength(0)).toBe(2); // A4 .
    expect(leadLength(24)).toBe(3); // D5 . .
    expect(leadLength(60)).toBe(4); // E5 . . .
  });

  it('percusión: grave en 1 y 3, hat en contratiempos; en el susto hat en cada corchea', () => {
    expect(drumsAt(0, 'normal')).toEqual({ kick: true, hat: false });
    expect(drumsAt(1, 'normal')).toEqual({ kick: false, hat: true });
    expect(drumsAt(4, 'normal').kick).toBe(true);
    expect(drumsAt(2, 'normal').hat).toBe(false);
    expect(drumsAt(2, 'susto').hat).toBe(true);
    expect(drumsAt(8, 'susto')).toEqual({ kick: true, hat: true });
  });
});

describe('agendador de la música', () => {
  it('el paso dura 60 / bpm / 2; en el susto 60 / 168 / 2', () => {
    expect(stepSeconds('normal')).toBeCloseTo(60 / MUSIC_BPM / 2, 12);
    expect(stepSeconds('susto')).toBeCloseTo(60 / MUSIC_FRIGHT_BPM / 2, 12);
    expect(MUSIC_FRIGHT_BPM).toBe(168);
  });

  it('agenda en orden y sin duplicar entre ticks', () => {
    const { calls, s } = recorder();
    s.setMode('normal', 10);
    for (let t = 10; t < 12; t += 1 / 60) s.tick(t);
    const steps = calls.map((c) => c.step);
    expect(steps).toEqual(steps.map((_, i) => i % 64));
    for (let i = 1; i < calls.length; i++) expect(calls[i]!.at).toBeGreaterThan(calls[i - 1]!.at);
    expect(calls[0]!.at).toBe(10);
    // Nada más allá del lookahead.
    expect(calls[calls.length - 1]!.at).toBeLessThan(12 + MUSIC_LOOKAHEAD_SECONDS);
  });

  it("'off' no agenda, guarda la posición y retoma en el paso siguiente desde ahora", () => {
    const { calls, s } = recorder();
    s.tick(0);
    expect(calls).toHaveLength(0);
    s.setMode('normal', 0);
    s.tick(0);
    const played = calls.length;
    expect(played).toBeGreaterThan(0);
    s.setMode('off', 0.1);
    s.tick(0.5);
    s.tick(3);
    expect(calls).toHaveLength(played);
    s.setMode('normal', 5);
    s.tick(5);
    expect(calls[played]).toMatchObject({ step: played, at: 5 });
  });

  it("'susto' acorta el paso", () => {
    const { calls, s } = recorder();
    s.setMode('susto', 0);
    for (let t = 0; t < 0.5; t += 1 / 60) s.tick(t);
    expect(calls[0]!.variant).toBe('susto');
    expect(calls[1]!.at - calls[0]!.at).toBeCloseTo(60 / 168 / 2, 9);
    expect(calls[0]!.dur).toBeCloseTo(60 / 168 / 2, 9);
  });

  it('da la vuelta en 64', () => {
    const { calls, s } = recorder();
    s.setMode('normal', 0);
    for (let t = 0; t < 70 * stepSeconds('normal'); t += 0.05) s.tick(t);
    expect(calls[63]!.step).toBe(63);
    expect(calls[64]!.step).toBe(0);
  });

  it('el reproductor toca lead, bajo y percusión en el bus de música', () => {
    const ctx = fakeContext();
    const synth = createSynth(ctx);
    const play = createSongPlayer(synth);
    play(0, 'normal', 1, 0.2); // A4 + A2 + golpe grave
    const waves = ctx.oscillators.map((o) => o.type);
    expect(waves).toEqual(['square', 'triangle', 'triangle']);
    expect(ctx.oscillators[0]!.frequency.calls[0]).toMatchObject({ fn: 'set', value: 440, time: 1 });
    expect(ctx.sources).toHaveLength(1);
  });
});
