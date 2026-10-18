// Ciclo de paso fijo: la simulación avanza en pasos de DT; el dibujo va a la tasa de la pantalla.
import { DT, MAX_FRAME_SECONDS } from './engine/rules';

export interface LoopOptions {
  /** Avanza la simulación `dt` segundos. */
  step(dt: number): void;
  /** Dibuja un cuadro. */
  render(timeMs: number): void;
  /** Inyectables para probar el ciclo. */
  raf?: (cb: FrameRequestCallback) => number;
  now?: () => number;
}

/** Arranca el ciclo y devuelve la función que lo detiene. */
export function startLoop(opts: LoopOptions): () => void {
  const raf = opts.raf ?? ((cb: FrameRequestCallback) => requestAnimationFrame(cb));
  const now = opts.now ?? (() => performance.now());
  let last = now();
  let acc = 0;
  let running = true;

  const frame = () => {
    if (!running) return;
    const t = now();
    // Recorta el salto si la pestaña estuvo dormida; nunca hacia atrás.
    const delta = Math.min(MAX_FRAME_SECONDS, Math.max(0, (t - last) / 1000));
    last = t;
    acc += delta;
    while (acc >= DT) {
      opts.step(DT);
      acc -= DT;
    }
    opts.render(t);
    raf(frame);
  };

  raf(frame);
  return () => {
    running = false;
  };
}
