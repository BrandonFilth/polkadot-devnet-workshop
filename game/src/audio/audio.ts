// Fachada del sonido para app.ts. Sin AudioContext (o si falla al crearse o reanudarse) todo es no-op:
// el juego corre en silencio y sin errores.
import type { GameEvent, Phase } from '../engine/types';
import { createMusicScheduler, createSongPlayer, type MusicMode, type MusicScheduler } from './music';
import type { SoundPrefs } from './prefs';
import { routeEvent } from './route';
import { createSfx, type SfxPlayer } from './sfx';
import { createSynth, type AudioLike, type Synth } from './synth';

/** Tipos de evento recientes que guarda debugState(). */
const RECENT_MAX = 20;

export interface AudioDebugState {
  /** Estado del AudioContext ('running', 'suspended'…) o 'sin audio'. */
  context: string;
  music: MusicMode;
  siren: boolean;
  prefs: { music: boolean; effects: boolean };
  /** Volumen actual de los buses (null sin contexto). */
  musicGain: number | null;
  effectsGain: number | null;
  recent: string[];
}

export interface GameAudio {
  /** En cada gesto: crea el contexto la primera vez y después lo reanuda. */
  unlock(): void;
  /** Efectos de los eventos del cuadro. */
  handle(events: readonly GameEvent[]): void;
  /** Música y sirena según el estado (cada cuadro). */
  sync(s: { phase: Phase; frightened: boolean }): void;
  /** Toque suave de los botones de sonido. */
  tap(): void;
  debugState(): AudioDebugState;
}

type ContextCtor = new () => AudioLike;

/** AudioContext del navegador (o webkitAudioContext); undefined si no hay. */
export function defaultContext(): AudioLike | undefined {
  const g = globalThis as { AudioContext?: ContextCtor; webkitAudioContext?: ContextCtor };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  return Ctor ? new Ctor() : undefined;
}

export function createAudio(opts: { prefs: SoundPrefs; createContext?: () => AudioLike | undefined }): GameAudio {
  const { prefs } = opts;
  const createContext = opts.createContext ?? defaultContext;
  let unavailable = false;
  let ctx: AudioLike | null = null;
  let synth: Synth | null = null;
  let sfx: SfxPlayer | null = null;
  let music: MusicScheduler | null = null;
  const recent: string[] = [];

  const applyMutes = () => {
    if (!synth) return;
    synth.setBusMuted('music', !prefs.music);
    synth.setBusMuted('effects', !prefs.effects);
    if (!prefs.effects) sfx?.setFrightened(false);
  };
  prefs.subscribe(() => {
    try {
      applyMutes();
    } catch {
      // El silencio llega igual en el siguiente sync.
    }
  });

  const resume = () => {
    if (!ctx || ctx.state === 'running') return;
    try {
      ctx.resume().catch(() => {});
    } catch {
      // Algunos hosts lanzan en vez de rechazar.
    }
  };

  return {
    unlock() {
      if (unavailable) return;
      if (!ctx) {
        try {
          const c = createContext();
          if (!c) {
            unavailable = true;
            return;
          }
          const s = createSynth(c);
          ctx = c;
          synth = s;
          sfx = createSfx(s, () => c.currentTime);
          music = createMusicScheduler(createSongPlayer(s));
          applyMutes();
        } catch {
          unavailable = true;
          ctx = synth = sfx = music = null;
          return;
        }
      }
      resume();
    },
    handle(events) {
      for (const e of events) {
        recent.push(e.type);
        if (recent.length > RECENT_MAX) recent.shift();
      }
      if (!sfx || !prefs.effects) return;
      try {
        for (const e of events) routeEvent(e, sfx);
      } catch {
        // Un efecto que falla no detiene la partida.
      }
    },
    sync({ phase, frightened }) {
      if (!ctx || !music || !sfx) return;
      try {
        const playing = phase === 'jugando';
        const mode: MusicMode = playing && prefs.music ? (frightened ? 'susto' : 'normal') : 'off';
        music.setMode(mode, ctx.currentTime);
        music.tick(ctx.currentTime);
        sfx.setFrightened(playing && frightened && prefs.effects);
      } catch {
        // Sin sonido, pero el juego sigue.
      }
    },
    tap() {
      if (!sfx || !prefs.effects) return;
      try {
        sfx.onTap();
      } catch {
        // Nada.
      }
    },
    debugState() {
      return {
        context: ctx ? ctx.state : 'sin audio',
        music: music?.mode ?? 'off',
        siren: sfx?.sirenOn ?? false,
        prefs: { music: prefs.music, effects: prefs.effects },
        musicGain: synth ? synth.busGain('music') : null,
        effectsGain: synth ? synth.busGain('effects') : null,
        recent: [...recent],
      };
    },
  };
}
