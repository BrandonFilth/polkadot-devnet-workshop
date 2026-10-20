// Música en bucle: un agendador con mirada adelante (lookahead) sobre el reloj del contexto, y el
// reproductor que convierte cada paso de song.ts en notas del sintetizador.
import { MUSIC_BPM, MUSIC_FRIGHT_BPM, MUSIC_LOOKAHEAD_SECONDS } from '../engine/rules';
import { BASS, drumsAt, LEAD, leadLength, noteToHz, SONG_STEPS, type SongVariant } from './song';
import type { Synth } from './synth';

export type MusicMode = 'off' | SongVariant;

/** Toca el paso `step` en `at` (segundos del contexto); `stepDur` = segundos de una corchea. */
export type PlayStep = (step: number, variant: SongVariant, at: number, stepDur: number) => void;

export interface MusicScheduler {
  readonly mode: MusicMode;
  /** Siguiente paso que se va a agendar (0..63). */
  readonly position: number;
  setMode(mode: MusicMode, now: number): void;
  /** Agenda los pasos que caen antes de `now + MUSIC_LOOKAHEAD_SECONDS`. */
  tick(now: number): void;
}

/** Segundos de una corchea al tempo de la variante. */
export function stepSeconds(variant: SongVariant): number {
  return 60 / (variant === 'susto' ? MUSIC_FRIGHT_BPM : MUSIC_BPM) / 2;
}

export function createMusicScheduler(play: PlayStep): MusicScheduler {
  let mode: MusicMode = 'off';
  let next = 0;
  let nextTime = 0;

  return {
    get mode() {
      return mode;
    },
    get position() {
      return next;
    },
    setMode(m, now) {
      if (m === mode) return;
      // Desde 'off' sigue en el paso guardado, empezando ahora. Entre normal y susto solo cambia el tempo.
      if (mode === 'off') nextTime = now;
      mode = m;
    },
    tick(now) {
      if (mode === 'off') return;
      // Si el cuadro llegó tarde (pestaña dormida), no se tocan de golpe las notas atrasadas.
      if (nextTime < now) nextTime = now;
      const dur = stepSeconds(mode);
      while (nextTime < now + MUSIC_LOOKAHEAD_SECONDS) {
        play(next, mode, nextTime, dur);
        nextTime += dur;
        next = (next + 1) % SONG_STEPS;
      }
    },
  };
}

/** Partitura del reproductor: volúmenes relativos dentro del bus de música y duración de la percusión. */
const VOICE = {
  lead: { gain: 0.5, legato: 0.9 },
  bass: { gain: 0.8, legato: 0.85 },
  kick: { gain: 0.9, dur: 0.09, rate: 0.25, freq: 130, slideTo: 45 },
  hat: { gain: 0.25, dur: 0.03 },
} as const;

/** Convierte un paso de la canción en notas del sintetizador (bus de música). */
export function createSongPlayer(synth: Synth): PlayStep {
  return (step, variant, at, stepDur) => {
    const lead = LEAD[step];
    if (lead) {
      synth.tone({ wave: 'square', freq: noteToHz(lead), at, dur: leadLength(step) * stepDur * VOICE.lead.legato, gain: VOICE.lead.gain, bus: 'music' });
    }
    const bass = BASS[step];
    if (bass) {
      synth.tone({ wave: 'triangle', freq: noteToHz(bass), at, dur: 2 * stepDur * VOICE.bass.legato, gain: VOICE.bass.gain, bus: 'music' });
    }
    const drums = drumsAt(step, variant);
    if (drums.kick) {
      const k = VOICE.kick;
      synth.tone({ wave: 'triangle', freq: k.freq, slideTo: k.slideTo, at, dur: k.dur, gain: k.gain, bus: 'music' });
      synth.noise({ at, dur: k.dur, gain: k.gain / 2, bus: 'music', rate: k.rate });
    }
    if (drums.hat) synth.noise({ at, dur: VOICE.hat.dur, gain: VOICE.hat.gain, bus: 'music' });
  };
}
