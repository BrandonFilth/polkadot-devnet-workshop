// Cliente del Worker anti-trampas. Antes de jugar se prepara una partida (/start sin semilla: la semilla la
// elige el Worker y el juego la usa para la próxima partida). Al empezar se manda un avance inicial; luego uno
// cada ANTICHEAT_BEAT_MS y en cada cambio de ronda o de vidas, con los pedidos de dirección nuevos (la
// grabación), y /finish al terminar, que devuelve el puntaje firmado para LeaderboardV5.
// Los avances salen en orden, de a uno. Si uno falla por la red se vuelve a mandar IGUAL (mismo número y mismos
// datos: el Worker lo acepta dos veces); lo que se juntó mientras tanto va en un solo avance después. Si el
// Worker rechaza algo, la partida queda sin validar. No bloquea el juego.
import { parseProof, type ScoreProof } from '../contract/leaderboard';
import type { InputEvent } from '../engine/game';

export interface Snapshot {
  score: number;
  round: number;
  lives: number;
  /** Bolitas normales y especiales que quedan en la ronda. */
  orbsLeft: number;
  powerLeft: number;
  /** Pasos de simulación activos desde que empezó la partida. */
  tick: number;
  /** Todos los pedidos de la partida; el cliente manda solo los nuevos. */
  inputs: readonly InputEvent[];
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
  /**
   * Semilla de una partida ya preparada en el Worker, o null si todavía no hay (la pide en segundo plano).
   * Se llama en el título y en el fin; el juego la usa como semilla de la próxima partida.
   */
  preparedSeed(): number | null;
  /** Empieza una partida nueva con `seed` (se olvida la anterior) y manda el avance inicial. */
  start(seed: number, s: Snapshot): void;
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

/** Pedidos por avance (el Worker acepta hasta 5000). */
export const MAX_INPUTS_PER_BEAT = 4_000;
/** Una partida preparada se usa hasta 8 min después de pedirla (el Worker la vence a los 10). */
export const PREPARED_MAX_MS = 8 * 60_000;
/** Espera antes de volver a preparar si falló. */
export const PREPARE_RETRY_MS = 15_000;

type Reply = { ok: true; data: Record<string, unknown> } | { ok: false; network: boolean; error: string };
type Body = Omit<Snapshot, 'inputs'> & { seq: number; inputs: InputEvent[] };
interface Item {
  kind: 'beat' | 'finish';
  body: Body;
  /** Ya salió al menos una vez: desde ahí no cambia (se reintenta igual). */
  tried: boolean;
}

const isGameId = (g: unknown): g is string => typeof g === 'string' && /^0x[0-9a-f]{64}$/.test(g);
const isSeed = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0 && (n as number) <= 0xffffffff;

const fields = (s: Snapshot) => ({
  score: s.score,
  round: s.round,
  lives: s.lives,
  orbsLeft: s.orbsLeft,
  powerLeft: s.powerLeft,
  tick: s.tick,
});

export function createAnticheat(deps: AnticheatDeps): Anticheat {
  const doFetch = deps.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const now = deps.now ?? (() => Date.now());
  const listeners = new Set<(s: ProofState) => void>();
  let state: ProofState = { kind: 'ninguna' };
  let generation = 0;
  let seed = 0;
  let gameId: string | null = null;
  let starting: Promise<boolean> | null = null;
  let builtSeq = 0;
  let taken = 0;
  let outbox: Item[] = [];
  let flushing = false;
  let player: `0x${string}` | null = null;
  let lastSent = 0;
  let dead = false;
  let prepared: { gameId: string; seed: number; at: number } | null = null;
  let preparing = false;
  let prepareFailedAt = -Infinity;

  const set = (s: ProofState) => {
    state = s;
    for (const l of listeners) l(s);
  };
  const reject = (reason: string) => {
    dead = true;
    set({ kind: 'rechazada', reason });
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

  /** Partida en el Worker con la semilla `seed` (si no venía preparada, la crea con esa semilla). */
  const ensureStarted = (mine: number): Promise<boolean> => {
    if (gameId) return Promise.resolve(true);
    starting ??= (async () => {
      const r = await post('/start', { seed });
      if (mine !== generation) return false;
      if (r.ok && isGameId(r.data.gameId) && r.data.seed === seed) {
        gameId = r.data.gameId;
        return true;
      }
      starting = null;
      if (r.ok) reject('respuesta inválida');
      else if (!r.network) reject(r.error);
      return false;
    })();
    return starting;
  };

  /** Arma avances con lo nuevo desde el último; si el último aún no salió, lo nuevo se junta ahí. */
  const enqueue = (kind: Item['kind'], s: Snapshot) => {
    const fresh = s.inputs.slice(taken);
    taken = s.inputs.length;
    const tail = outbox[outbox.length - 1];
    if (kind === 'beat' && tail && !tail.tried && tail.kind === 'beat' && tail.body.inputs.length + fresh.length <= MAX_INPUTS_PER_BEAT) {
      tail.body = { ...fields(s), seq: tail.body.seq, inputs: tail.body.inputs.concat(fresh) };
      return;
    }
    const chunks: InputEvent[][] = [];
    for (let i = 0; i < fresh.length; i += MAX_INPUTS_PER_BEAT) chunks.push(fresh.slice(i, i + MAX_INPUTS_PER_BEAT));
    if (chunks.length === 0) chunks.push([]);
    chunks.forEach((inputs, i) => {
      builtSeq += 1;
      outbox.push({ kind: i === chunks.length - 1 ? kind : 'beat', tried: false, body: { ...fields(s), seq: builtSeq, inputs } });
    });
  };

  const hasFinish = () => outbox.some((i) => i.kind === 'finish');

  /** Manda lo pendiente en orden. Se detiene en un fallo de red (se reintenta en el próximo avance). */
  const flush = async () => {
    if (flushing || dead) return;
    flushing = true;
    const mine = generation;
    try {
      while (mine === generation && !dead && outbox.length) {
        const item = outbox[0]!;
        const finishing = item.kind === 'finish';
        if (finishing && !player) {
          set({ kind: 'sin-conexion' });
          return;
        }
        if (!(await ensureStarted(mine))) {
          if (mine === generation && !dead && hasFinish()) set({ kind: 'sin-conexion' });
          return;
        }
        item.tried = true;
        const r = await post(finishing ? '/finish' : '/beat', { gameId, ...item.body, ...(finishing ? { player } : {}) });
        if (mine !== generation) return;
        if (!r.ok) {
          if (!r.network) reject(r.error);
          else if (hasFinish()) set({ kind: 'sin-conexion' });
          return;
        }
        outbox.shift();
        if (finishing) {
          const proof = parseProof(r.data, item.body.score);
          if (proof) set({ kind: 'lista', proof });
          else reject('respuesta inválida');
        }
      }
    } finally {
      if (mine === generation) flushing = false;
    }
  };

  return {
    get state() {
      return state;
    },
    preparedSeed() {
      const t = now();
      if (prepared && t - prepared.at < PREPARED_MAX_MS) return prepared.seed;
      prepared = null;
      if (!preparing && t - prepareFailedAt >= PREPARE_RETRY_MS) {
        preparing = true;
        void post('/start', {}).then((r) => {
          preparing = false;
          if (r.ok && isGameId(r.data.gameId) && isSeed(r.data.seed)) prepared = { gameId: r.data.gameId, seed: r.data.seed, at: t };
          else prepareFailedAt = now();
        });
      }
      return null;
    },
    start(newSeed, s) {
      generation += 1;
      seed = newSeed;
      gameId = null;
      if (prepared && prepared.seed === newSeed && now() - prepared.at < PREPARED_MAX_MS) {
        gameId = prepared.gameId;
        prepared = null;
      }
      starting = null;
      builtSeq = 0;
      taken = 0;
      outbox = [];
      flushing = false;
      player = null;
      dead = false;
      lastSent = now();
      set({ kind: 'jugando' });
      enqueue('beat', s);
      void flush();
    },
    beat(s, force = false) {
      if (state.kind !== 'jugando') return;
      if (!force && now() - lastSent < deps.beatMs) return;
      lastSent = now();
      enqueue('beat', s);
      void flush();
    },
    finish(s, who) {
      if (state.kind !== 'jugando') return;
      player = who;
      enqueue('finish', s);
      set(who ? { kind: 'validando' } : { kind: 'sin-conexion' });
      void flush();
    },
    retryFinish(who) {
      if (state.kind !== 'sin-conexion' || !who || !hasFinish()) return;
      player = who;
      set({ kind: 'validando' });
      void flush();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
