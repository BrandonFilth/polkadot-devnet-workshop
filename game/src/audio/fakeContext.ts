// SOLO TESTS. AudioContext falso: registra los nodos creados y las llamadas a sus parámetros.
import type { AudioLike, BufferLike, BufferSourceLike, GainLike, NodeLike, OscillatorLike, ParamLike } from './synth';

export interface FakeParam extends ParamLike {
  calls: Array<{ fn: string; value: number; time: number }>;
}

export interface FakeOscillator extends OscillatorLike {
  frequency: FakeParam;
  started: number | null;
  stopped: number | null;
}

export interface FakeGain extends GainLike {
  gain: FakeParam;
}

export interface FakeContext extends AudioLike {
  currentTime: number;
  state: string;
  oscillators: FakeOscillator[];
  gains: FakeGain[];
  sources: BufferSourceLike[];
  buffers: BufferLike[];
  resumes: number;
}

function param(initial = 1): FakeParam {
  const p: FakeParam = {
    value: initial,
    calls: [],
    setValueAtTime(value, time) {
      p.calls.push({ fn: 'set', value, time });
      p.value = value;
    },
    linearRampToValueAtTime(value, time) {
      p.calls.push({ fn: 'linear', value, time });
    },
    exponentialRampToValueAtTime(value, time) {
      p.calls.push({ fn: 'exp', value, time });
    },
    cancelScheduledValues(time) {
      p.calls.push({ fn: 'cancel', value: NaN, time });
    },
  };
  return p;
}

const node = (): NodeLike => ({ connect: () => undefined, disconnect: () => undefined });

export function fakeContext(): FakeContext {
  const ctx: FakeContext = {
    currentTime: 0,
    state: 'suspended',
    sampleRate: 100,
    destination: node(),
    oscillators: [],
    gains: [],
    sources: [],
    buffers: [],
    resumes: 0,
    resume() {
      ctx.resumes++;
      ctx.state = 'running';
      return Promise.resolve();
    },
    suspend() {
      ctx.state = 'suspended';
      return Promise.resolve();
    },
    createOscillator() {
      const o: FakeOscillator = {
        ...node(),
        type: 'sine',
        frequency: param(440),
        onended: null,
        started: null,
        stopped: null,
        start(t) {
          o.started = t;
        },
        stop(t) {
          o.stopped = t;
        },
      };
      ctx.oscillators.push(o);
      return o;
    },
    createGain() {
      const g: FakeGain = { ...node(), gain: param(1) };
      ctx.gains.push(g);
      return g;
    },
    createBuffer(_channels, length) {
      const data = new Float32Array(length);
      const b: BufferLike = { getChannelData: () => data };
      ctx.buffers.push(b);
      return b;
    },
    createBufferSource() {
      const s: BufferSourceLike = { ...node(), buffer: null, playbackRate: param(1), onended: null, start: () => {}, stop: () => {} };
      ctx.sources.push(s);
      return s;
    },
  };
  return ctx;
}
