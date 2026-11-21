// Vuelve a jugar una partida a partir de su semilla y sus pedidos de dirección. El motor es determinista
// (paso fijo DT, semilla propia), así que la misma grabación da siempre el mismo resultado. Lo usa la
// auditoría del top 3 antes de pagar premios (auditoria/). Lógica pura: sin DOM ni red.
import { createGame, releaseDirections, setDirections, start, update, type InputEvent } from './game';
import { DT } from './rules';
import type { Dir } from './types';

export interface ReplayResult {
  score: number;
  round: number;
  lives: number;
  phase: string;
  /** Pasos activos que se simularon. */
  ticks: number;
}

const DIRS: readonly string[] = ['arriba', 'abajo', 'izquierda', 'derecha'];
const isDir = (v: unknown): v is Dir => typeof v === 'string' && DIRS.includes(v);

/** Valida una grabación que llega de afuera (del Worker). Lanza si algo no tiene la forma esperada. */
export function parseInputs(value: unknown): InputEvent[] {
  if (!Array.isArray(value)) throw new TypeError('la grabación no es una lista');
  let last = 0;
  return value.map((e, i) => {
    if (!Array.isArray(e) || e.length !== 3) throw new TypeError(`pedido ${i} mal formado`);
    const [tick, primary, secondary] = e as unknown[];
    if (!Number.isSafeInteger(tick) || (tick as number) < last) throw new TypeError(`pedido ${i}: paso inválido`);
    last = tick as number;
    if (primary === 'soltar') return [tick as number, 'soltar', null];
    if (!isDir(primary) || (secondary !== null && !isDir(secondary))) throw new TypeError(`pedido ${i}: dirección inválida`);
    return [tick as number, primary, secondary as Dir | null];
  });
}

/**
 * Juega la partida desde cero con `seed` y aplica cada pedido justo antes del paso `tick` en que llegó.
 * Se detiene en `maxTicks` pasos activos o cuando la partida termina.
 */
export function replayGame(seed: number, inputs: readonly InputEvent[], maxTicks: number): ReplayResult {
  const state = createGame(seed);
  start(state);
  let next = 0;
  while (state.phase !== 'fin' && state.tick < maxTicks) {
    while (next < inputs.length && inputs[next]![0] <= state.tick) {
      const [, primary, secondary] = inputs[next]!;
      if (primary === 'soltar') releaseDirections(state);
      else setDirections(state, primary, secondary);
      next += 1;
    }
    update(state, DT);
  }
  return { score: state.score, round: state.round, lives: state.lives, phase: state.phase, ticks: state.tick };
}
