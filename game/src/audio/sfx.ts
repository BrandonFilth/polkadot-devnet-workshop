// Efectos de sonido 8 bits. Las alturas y duraciones son la partitura de cada efecto (tablas con nombre);
// los volúmenes generales y el throttle del waka viven en rules.ts.
import { TAP_VOLUME, WAKA_MIN_INTERVAL_SECONDS } from '../engine/rules';
import { noteToHz } from './song';
import type { Synth } from './synth';

export interface Sfx {
  onDotEaten(): void;
  onPowerDot(): void;
  onGhostEaten(points: number): void;
  onDeath(): void;
  onRoundClear(): void;
  onGameOver(): void;
  onTap(): void;
  /** Sirena en bucle mientras dura el susto. */
  setFrightened(on: boolean): void;
}

export interface SfxPlayer extends Sfx {
  readonly sirenOn: boolean;
}

/** Waka: dos barridos cortos que se alternan en cada bolita. */
export const WAKA = [
  { freq: 440, slideTo: 260, dur: 0.08 },
  { freq: 260, slideTo: 440, dur: 0.08 },
] as const;

/** Especial: arpegio corto ascendente. */
const POWER_ARPEGGIO = ['E5', 'G5', 'B5', 'E6'];
const POWER_NOTE_SECONDS = 0.05;

/** Fantasma comido: barrido ascendente; cada eslabón de la cadena (200, 400, 800, 1600) sube un poco más. */
const GHOST_EATEN = { freq: 300, perLink: 1.25, slide: 3, dur: 0.22 };

/** Muerte: barrido descendente square (~1 s, cabe en DEATH_SECONDS). */
const DEATH = { freq: 784, slideTo: 82, dur: 0.95 };

/** Ronda limpia: jingle corto. */
const ROUND_CLEAR = ['C5', 'E5', 'G5', 'C6'];
const ROUND_CLEAR_NOTE_SECONDS = 0.09;

/** Fin de partida: tres notas descendentes. */
const GAME_OVER = ['G4', 'E4', 'C4'];
const GAME_OVER_NOTE_SECONDS = 0.22;

/** Tap: triangle muy suave. */
const TAP = { freq: 880, dur: 0.04 };

/** Sirena del susto: square grave con vaivén. */
export const SIREN = { freq: 150, lfoRate: 5, lfoDepth: 45, gain: 0.25 };

/** `now()` es el reloj del contexto, en segundos (lo usa el throttle del waka). */
export function createSfx(synth: Synth, now: () => number): SfxPlayer {
  let wakaIndex = 0;
  let lastWaka = -Infinity;
  let siren: { stop(): void } | null = null;

  const notes = (list: readonly string[], each: number, wave: 'square' | 'triangle', gain = 0.6) => {
    const t = now();
    list.forEach((n, i) => synth.tone({ wave, freq: noteToHz(n), at: t + i * each, dur: each * 0.95, gain, bus: 'effects' }));
  };

  return {
    get sirenOn() {
      return siren !== null;
    },
    onDotEaten() {
      const t = now();
      if (t - lastWaka < WAKA_MIN_INTERVAL_SECONDS) return;
      lastWaka = t;
      const w = WAKA[wakaIndex]!;
      wakaIndex = (wakaIndex + 1) % WAKA.length;
      synth.tone({ wave: 'square', freq: w.freq, slideTo: w.slideTo, at: t, dur: w.dur, gain: 0.5, bus: 'effects' });
    },
    onPowerDot() {
      notes(POWER_ARPEGGIO, POWER_NOTE_SECONDS, 'square');
    },
    onGhostEaten(points) {
      const link = Math.max(0, Math.round(Math.log2(Math.max(1, points) / 200)));
      const freq = GHOST_EATEN.freq * GHOST_EATEN.perLink ** link;
      synth.tone({ wave: 'square', freq, slideTo: freq * GHOST_EATEN.slide, at: now(), dur: GHOST_EATEN.dur, gain: 0.6, bus: 'effects' });
    },
    onDeath() {
      synth.tone({ wave: 'square', freq: DEATH.freq, slideTo: DEATH.slideTo, at: now(), dur: DEATH.dur, gain: 0.7, bus: 'effects' });
    },
    onRoundClear() {
      notes(ROUND_CLEAR, ROUND_CLEAR_NOTE_SECONDS, 'square');
    },
    onGameOver() {
      notes(GAME_OVER, GAME_OVER_NOTE_SECONDS, 'triangle', 0.8);
    },
    onTap() {
      synth.tone({ wave: 'triangle', freq: TAP.freq, at: now(), dur: TAP.dur, gain: TAP_VOLUME, bus: 'effects' });
    },
    setFrightened(on) {
      if (on && !siren) {
        siren = synth.loop({ wave: 'square', freq: SIREN.freq, lfoRate: SIREN.lfoRate, lfoDepth: SIREN.lfoDepth, gain: SIREN.gain, bus: 'effects' });
      } else if (!on && siren) {
        siren.stop();
        siren = null;
      }
    },
  };
}
