// Cliente del Worker anti-trampas. Por partida: /start al empezar, un /beat cada ANTICHEAT_BEAT_MS y en cada
// cambio de ronda o de vidas, y /finish al terminar, que devuelve el puntaje firmado para LeaderboardV5.
// Una petición a la vez y en orden. Si una falla por la red se reintenta con el mismo número de avance (el
// Worker la acepta dos veces); si el Worker la rechaza, la partida queda sin validar. No bloquea el juego.
import { parseProof, type ScoreProof } from '../contract/leaderboard';

export interface Snapshot {
  score: number;
  round: number;
  lives: number;
}

/** Estado de la validación de la partida actual. */
export type ProofState =
  | { kind: 'ninguna' }
  | { kind: 'jugando' }
  | { kind: 'validando' }
  | { kind: 'lista'; proof: ScoreProof }
  | { kind: 'rechazada'; reason: string }
  | { kind: 'sin-conexion' };

export interface Anticheat {
  readonly state: ProofState;
  /** Empieza una partida nueva (se olvida la anterior). */
  start(): void;
  /** Un avance; `force` lo manda aunque no haya pasado ANTICHEAT_BEAT_MS (ronda o vida nueva). */
  beat(s: Snapshot, force?: boolean): void;
  /** Termina la partida: pide la firma del puntaje final para `player` (cuenta H160). */
  finish(s: Snapshot, player: `0x${string}` | null): void;
  /** Vuelve a pedir la firma si falló por la red (por ejemplo, al conectar la cuenta después). */
  retryFinish(player: `0x${string}` | null): void;
  /** Avisa en cada cambio de estado. */
  subscribe(listener: (s: ProofState) => void): () => void;
}

export interface AnticheatDeps {
  url: string;
  beatMs: number;
  timeoutMs: number;
  fetch?: typeof fetch;
  now?: () => number;
}

type Reply = { ok: true; data: Record<string, unknown> } | { ok: false; network: boolean; error: string };

export function createAnticheat(deps: AnticheatDeps): Anticheat {
  const doFetch = deps.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const now = deps.now ?? (() => Date.now());
  const listeners = new Set<(s: ProofState) => void>();
  let state: ProofState = { kind: 'ninguna' };
  let generation = 0;
  let gameId: string | null = null;
  let starting: Promise<boolean> | null = null;
  let seq = 0;
  let lastSent = 0;
  let chain: Promise<unknown> = Promise.resolve();
  let last: Snapshot | null = null;
  let dead = false;

  const set = (s: ProofState) => {
    state = s;
    for (const l of listeners) l(s);
  };

  const post = async (path: string, body: unknown): Promise<Reply> => {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl?.abort(), deps.timeoutMs);
    try {
      const res = await doFetch(deps.url + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        ...(ctrl ? { signal: ctrl.signal } : {}),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.ok && data.ok === true) return { ok: true, data };
      return { ok: false, network: res.status >= 500, error: typeof data.error === 'string' ? data.error : `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, network: true, error: e instanceof Error ? e.message : 'sin conexión' };
    } finally {
      clearTimeout(timer);
    }
  };

  /** Encadena para que salgan en orden; descarta lo de una partida anterior. */
  const queue = (job: () => Promise<void>) => {
    const mine = generation;
    chain = chain.then(() => (mine === generation ? job() : undefined)).catch(() => undefined);
  };

  const ensureStarted = (mine: number): Promise<boolean> => {
    if (gameId) return Promise.resolve(true);
    starting ??= (async () => {
      const r = await post('/start', {});
      if (mine !== generation) return false;
      if (r.ok && typeof r.data.gameId === 'string') {
        gameId = r.data.gameId;
        return true;
      }
      starting = null;
      if (!r.ok && !r.network) {
        dead = true;
        set({ kind: 'rechazada', reason: r.error });
      }
      return false;
    })();
    return starting;
  };

  const sendBeat = (s: Snapshot) =>
    queue(async () => {
      const mine = generation;
      if (dead || !(await ensureStarted(mine))) return;
      const r = await post('/beat', { gameId, seq: seq + 1, ...s });
      if (mine !== generation) return;
      if (r.ok) seq += 1;
      else if (!r.network) {
        dead = true;
        set({ kind: 'rechazada', reason: r.error });
      }
      // Fallo de red: el próximo avance lleva el mismo número y el puntaje más nuevo.
    });

  const sendFinish = (s: Snapshot, player: `0x${string}` | null) =>
    queue(async () => {
      const mine = generation;
      if (dead) return;
      if (!player) {
        set({ kind: 'sin-conexion' });
        return;
      }
      set({ kind: 'validando' });
      if (!(await ensureStarted(mine))) {
        if (mine === generation && !dead) set({ kind: 'sin-conexion' });
        return;
      }
      const r = await post('/finish', { gameId, seq: seq + 1, player, ...s });
      if (mine !== generation) return;
      if (r.ok) {
        const proof = parseProof(r.data, s.score);
        if (proof) {
          seq += 1;
          set({ kind: 'lista', proof });
        } else set({ kind: 'rechazada', reason: 'respuesta inválida' });
      } else if (r.network) set({ kind: 'sin-conexion' });
      else {
        dead = true;
        set({ kind: 'rechazada', reason: r.error });
      }
    });

  return {
    get state() {
      return state;
    },
    start() {
      generation += 1;
      gameId = null;
      starting = null;
      seq = 0;
      dead = false;
      last = null;
      lastSent = now();
      set({ kind: 'jugando' });
      void ensureStarted(generation);
    },
    beat(s, force = false) {
      if (state.kind !== 'jugando') return;
      last = s;
      if (!force && now() - lastSent < deps.beatMs) return;
      lastSent = now();
      sendBeat(s);
    },
    finish(s, player) {
      if (state.kind !== 'jugando') return;
      last = s;
      sendFinish(s, player);
    },
    retryFinish(player) {
      if (state.kind !== 'sin-conexion' || !last) return;
      sendFinish(last, player);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
