// SOLO DESARROLLO. Ganchos para capturas sin teléfono: `pnpm dev` + `?debug` en la URL.
// app.ts lo usa detrás de `import.meta.env.DEV`; en `pnpm build` esa rama es falsa y Vite la quita
// (ver la verificación del bundle). Nunca firma ni llama al Host: solo cambia lo que ven las pantallas.
import type { GameState } from '../engine/game';
import type { Hub, HubState, RankingRow } from '../hub/hub';
import { advance, begin, finish, STEPS, type ProgressOp, type ProgressStep } from '../hub/progress';
import type { TxErrorKind } from '../lib/txErrors';

export interface PolkaDebug {
  /** Cuenta falsa conectada (host 'listo'); `false` la quita. */
  cuenta(on: boolean): void;
  /** Fase falsa del Host (por ejemplo 'listo' sin cuenta, para ver el aviso «sin cuenta»). */
  host(phase: HubState['host']): void;
  /** Récord y username que devuelve readMine(). */
  mine(best: number, username: string): void;
  /** `n` filas falsas para el ranking (la 5.ª es «tuya»). */
  ranking(n: number): void;
  /** Termina la partida con `score` puntos. */
  fin(score: number): void;
  /** Operación en curso hasta el paso `step` (busy). */
  enCurso(op: ProgressOp, step: ProgressStep): void;
  /** Termina la operación en curso con Listo o con un error. */
  terminar(ok: boolean, kind?: TxErrorKind): void;
  /** Quita todo lo falso. */
  limpiar(): void;
}

declare global {
  interface Window {
    __polka?: PolkaDebug;
  }
}

/** Envuelve el Hub. Sin `?debug` en la URL devuelve el mismo Hub, sin tocar nada. */
export function withDebug(hub: Hub, state: GameState): Hub {
  if (!new URLSearchParams(location.search).has('debug')) return hub;

  let over: Partial<HubState> = {};
  let rows: RankingRow[] | null = null;
  let mine: { best: bigint; username: string } | null = null;
  const listeners = new Set<(s: HubState) => void>();
  const getState = (): HubState => ({ ...hub.getState(), ...over });
  const notify = () => {
    const s = getState();
    for (const l of listeners) l(s);
  };
  hub.subscribe(() => notify());

  const fakeAddress = (i: number) => `0x${(i + 1).toString(16).padStart(40, 'a')}` as `0x${string}`;

  window.__polka = {
    cuenta(on) {
      over = on
        ? { ...over, host: 'listo', message: '', account: { h160: fakeAddress(4), ss58: '5Debug' }, allowance: 'Allocated' }
        : {};
      notify();
    },
    host(phase) {
      over = { ...over, host: phase, message: '' };
      notify();
    },
    mine(best, username) {
      mine = { best: BigInt(best), username };
    },
    ranking(n) {
      rows = Array.from({ length: n }, (_, i) => ({
        address: fakeAddress(i),
        username: i % 3 === 2 ? '' : `jugador_${String(i + 1).padStart(2, '0')}`,
        score: BigInt((n - i) * 370),
        mine: i === 4,
      }));
    },
    fin(score) {
      state.score = score;
      state.lives = 0;
      state.phase = 'fin';
    },
    enCurso(op, step) {
      // Recorre los pasos en orden hasta `step`, como lo haría el Hub.
      let p = begin(op);
      for (const s of STEPS[op]) {
        p = advance(p, s);
        if (s === step) break;
      }
      if (p.step !== step) p = advance(p, step);
      over = { ...over, busy: true, progress: p };
      notify();
    },
    terminar(ok, kind) {
      const p = getState().progress ?? begin('guardar');
      const done = ok
        ? finish(p, { ok: true, message: 'Récord guardado: 1230.' })
        : finish(p, { ok: false, message: 'No se aprobó la firma en el teléfono.', ...(kind ? { kind } : {}) });
      over = { ...over, busy: false, progress: done };
      notify();
    },
    limpiar() {
      over = {};
      rows = null;
      mine = null;
      notify();
    },
  };

  return {
    ...hub,
    getState,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    // Siempre devuelve todas las filas falsas: así se prueba la lista larga aunque se pidan 10.
    readTop: (limit) => (rows ? Promise.resolve(rows) : hub.readTop(limit)),
    readMine: () => (mine ? Promise.resolve(mine) : hub.readMine()),
  };
}
