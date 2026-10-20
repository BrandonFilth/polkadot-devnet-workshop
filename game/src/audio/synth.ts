// Sintetizador 8 bits sobre Web Audio: osciladores y ruido, sin archivos de audio.
// Trabaja contra AudioLike (un subconjunto de AudioContext) para que los tests usen un contexto falso.
import { MASTER_VOLUME, MUSIC_VOLUME, SFX_VOLUME } from '../engine/rules';

export interface ParamLike {
  value: number;
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
  cancelScheduledValues(time: number): unknown;
}

export interface NodeLike {
  connect(destination: NodeLike | ParamLike): unknown;
  disconnect(): void;
}

export interface GainLike extends NodeLike {
  readonly gain: ParamLike;
}

export interface OscillatorLike extends NodeLike {
  type: OscillatorType;
  readonly frequency: ParamLike;
  onended: (() => void) | null;
  start(when: number): void;
  stop(when: number): void;
}

export interface BufferLike {
  getChannelData(channel: number): Float32Array;
}

export interface BufferSourceLike extends NodeLike {
  buffer: BufferLike | null;
  readonly playbackRate: ParamLike;
  onended: (() => void) | null;
  start(when: number): void;
  stop(when: number): void;
}

/** Lo que el juego usa de AudioContext. */
export interface AudioLike {
  readonly currentTime: number;
  readonly state: string;
  readonly sampleRate: number;
  readonly destination: NodeLike;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  createBuffer(channels: number, length: number, sampleRate: number): BufferLike;
  createBufferSource(): BufferSourceLike;
}

export type Bus = 'music' | 'effects';
export type Wave = 'square' | 'triangle' | 'sawtooth' | 'sine';

export interface ToneOptions {
  wave: Wave;
  /** Hz al empezar. */
  freq: number;
  /** Hz al terminar (barrido exponencial). */
  slideTo?: number;
  /** Segundos del reloj del contexto. */
  at: number;
  dur: number;
  /** 0..1 dentro del bus. */
  gain: number;
  bus: Bus;
}

export interface NoiseOptions {
  at: number;
  dur: number;
  gain: number;
  bus: Bus;
  /** Velocidad de lectura del ruido: menos de 1 suena más grave (como el canal de ruido de las consolas). */
  rate?: number;
}

export interface LoopOptions {
  wave: Wave;
  freq: number;
  /** Vaivén de la altura: veces por segundo y Hz de ida y vuelta. */
  lfoRate: number;
  lfoDepth: number;
  gain: number;
  bus: Bus;
}

export interface Synth {
  readonly ctx: AudioLike;
  tone(o: ToneOptions): void;
  noise(o: NoiseOptions): void;
  /** Sonido continuo hasta llamar stop() (la sirena del susto). */
  loop(o: LoopOptions): { stop(): void };
  /** Silencia o devuelve el volumen de un bus en el mismo instante. */
  setBusMuted(bus: Bus, muted: boolean): void;
  /** Volumen actual del bus (para depurar). */
  busGain(bus: Bus): number;
}

/** Ataque de cada nota, en segundos. */
const ATTACK = 0.005;
/** Piso del release exponencial (no puede llegar a 0). */
const FLOOR = 0.0001;
/** Segundos de ruido blanco del buffer que se reutiliza. */
const NOISE_SECONDS = 1;

const BUS_VOLUME: Record<Bus, number> = { music: MUSIC_VOLUME, effects: SFX_VOLUME };

export function createSynth(ctx: AudioLike): Synth {
  const master = ctx.createGain();
  master.gain.value = MASTER_VOLUME;
  master.connect(ctx.destination);
  const buses: Record<Bus, GainLike> = { music: ctx.createGain(), effects: ctx.createGain() };
  for (const bus of ['music', 'effects'] as const) {
    buses[bus].gain.value = BUS_VOLUME[bus];
    buses[bus].connect(master);
  }

  let noiseBuffer: BufferLike | null = null;
  const getNoise = () => {
    if (!noiseBuffer) {
      const length = Math.max(1, Math.floor(ctx.sampleRate * NOISE_SECONDS));
      noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  };

  /** Envolvente corta: sube en ATTACK y cae exponencial hasta `at + dur`. */
  const envelope = (gain: number, at: number, dur: number, bus: Bus) => {
    const env = ctx.createGain();
    env.gain.setValueAtTime(FLOOR, at);
    env.gain.linearRampToValueAtTime(gain, at + Math.min(ATTACK, dur / 2));
    env.gain.exponentialRampToValueAtTime(FLOOR, at + dur);
    env.connect(buses[bus]);
    return env;
  };

  return {
    ctx,
    tone({ wave, freq, slideTo, at, dur, gain, bus }) {
      const osc = ctx.createOscillator();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, at);
      if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
      const env = envelope(gain, at, dur, bus);
      osc.connect(env);
      osc.onended = () => {
        osc.disconnect();
        env.disconnect();
      };
      osc.start(at);
      osc.stop(at + dur + 0.02);
    },
    noise({ at, dur, gain, bus, rate }) {
      const src = ctx.createBufferSource();
      src.buffer = getNoise();
      if (rate !== undefined) src.playbackRate.setValueAtTime(rate, at);
      const env = envelope(gain, at, dur, bus);
      src.connect(env);
      src.onended = () => {
        src.disconnect();
        env.disconnect();
      };
      src.start(at);
      src.stop(at + dur + 0.02);
    },
    loop({ wave, freq, lfoRate, lfoDepth, gain, bus }) {
      const at = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, at);
      const lfo = ctx.createOscillator();
      lfo.type = 'triangle';
      lfo.frequency.setValueAtTime(lfoRate, at);
      const depth = ctx.createGain();
      depth.gain.value = lfoDepth;
      lfo.connect(depth);
      depth.connect(osc.frequency);
      const env = ctx.createGain();
      env.gain.setValueAtTime(FLOOR, at);
      env.gain.linearRampToValueAtTime(gain, at + ATTACK * 4);
      osc.connect(env);
      env.connect(buses[bus]);
      osc.start(at);
      lfo.start(at);
      let stopped = false;
      return {
        stop() {
          if (stopped) return;
          stopped = true;
          const t = ctx.currentTime;
          env.gain.cancelScheduledValues(t);
          env.gain.setValueAtTime(FLOOR, t);
          osc.stop(t + 0.02);
          lfo.stop(t + 0.02);
          osc.onended = () => {
            osc.disconnect();
            lfo.disconnect();
            depth.disconnect();
            env.disconnect();
          };
        },
      };
    },
    setBusMuted(bus, muted) {
      const g = buses[bus].gain;
      const t = ctx.currentTime;
      const v = muted ? 0 : BUS_VOLUME[bus];
      g.cancelScheduledValues(t);
      // value cambia el valor actual en el acto; setValueAtTime lo fija en la línea de tiempo del parámetro.
      g.value = v;
      g.setValueAtTime(v, t);
    },
    busGain: (bus) => buses[bus].gain.value,
  };
}
