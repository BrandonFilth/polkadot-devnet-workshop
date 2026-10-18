import { describe, expect, it } from 'vitest';
import { DT, MAX_FRAME_SECONDS } from './engine/rules';
import { startLoop } from './loop';

function harness() {
  let t = 0;
  let pending: FrameRequestCallback | null = null;
  const steps: number[] = [];
  const renders: number[] = [];
  const stop = startLoop({
    step: (dt) => steps.push(dt),
    render: (time) => renders.push(time),
    raf: (cb) => {
      pending = cb;
      return 1;
    },
    now: () => t,
  });
  const tick = (ms: number) => {
    t += ms;
    const cb = pending;
    pending = null;
    cb?.(t);
  };
  return { steps, renders, stop, tick, hasPending: () => pending !== null };
}

describe('startLoop', () => {
  it('llama step(DT) las veces que caben en el tiempo real', () => {
    const h = harness();
    h.tick(100);
    // 0.1 s / DT = 12 pasos (11 si el redondeo de punto flotante deja el último fuera).
    expect(h.steps.length).toBeGreaterThanOrEqual(11);
    expect(h.steps.length).toBeLessThanOrEqual(12);
    expect(h.steps.every((dt) => dt === DT)).toBe(true);
    expect(h.renders).toEqual([100]);
  });

  it('recorta un cuadro largo a MAX_FRAME_SECONDS', () => {
    const h = harness();
    h.tick(10_000);
    expect(h.steps.length).toBeLessThanOrEqual(Math.ceil(MAX_FRAME_SECONDS / DT));
    expect(h.steps.length).toBeGreaterThanOrEqual(Math.floor(MAX_FRAME_SECONDS / DT) - 1);
  });

  it('stop detiene el ciclo', () => {
    const h = harness();
    h.tick(16);
    h.stop();
    h.tick(16);
    expect(h.renders.length).toBe(1);
    expect(h.hasPending()).toBe(false);
  });
});
