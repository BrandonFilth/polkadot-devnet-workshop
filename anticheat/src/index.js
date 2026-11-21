// Worker anti-trampas de Polka-Man (Cloudflare). Un Durable Object (SQLite) por partida guarda sus avances y
// su grabación (pedidos de dirección); las reglas están en rules.js. Al terminar firma (EIP-712) «esta cuenta
// hizo X puntos en la partida gameId», que es lo único que acepta submitScore de LeaderboardV5, y anota la
// partida en el historial del jugador para la auditoría del top 3 (game/auditoria/).
//   POST /start  { seed? }              → { ok, gameId, seed }    sin seed, la semilla la elige el Worker
//   POST /beat   { gameId, seq, score, round, lives, orbsLeft, powerLeft, tick, inputs }
//   POST /finish { …lo mismo…, player } → { ok, score, gameId, deadline, signature }
//   POST /audit  { token, player }      → partidas firmadas de ese jugador, con semilla y grabación
// Secretos: SIGNER_KEY (llave del firmante) y AUDIT_TOKEN (para /audit).
import { DurableObject } from 'cloudflare:workers';
import { privateKeyToAccount } from 'viem/accounts';
import { applyBeat, newGame } from './rules.js';

/** La firma vale 30 minutos para guardarse en la cadena (da tiempo de conectar la cuenta y firmar). */
const SIGNATURE_TTL_SECONDS = 1_800;
/** Partidas firmadas que se guardan por jugador (las más recientes). */
const HISTORY_PER_PLAYER = 200;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '600',
};
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

const isAddress = (a) => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a);
const isGameId = (g) => typeof g === 'string' && /^0x[0-9a-f]{64}$/.test(g);
const isSeq = (n) => Number.isSafeInteger(n) && n >= 1 && n <= 100_000;
const isSeed = (n) => Number.isSafeInteger(n) && n >= 0 && n <= 0xffffffff;

/** Compara sin cortar al primer carácter distinto. */
function sameText(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export class Partida extends DurableObject {
  async start(now, seed, seedSource) {
    if (await this.ctx.storage.get('game')) return { ok: false, error: 'ya existe' };
    await this.ctx.storage.put('game', newGame(now, seed, seedSource));
    return { ok: true };
  }

  /** Un avance; con `close` además cierra la partida (fin). Un avance rechazado invalida la partida. */
  async beat(seq, snap, now, close = false) {
    const game = await this.ctx.storage.get('game');
    if (!game) return { ok: false, error: 'no existe' };
    const r = applyBeat(game, seq, snap, now);
    if (!r.ok) {
      if (!game.invalid && !game.closed) await this.ctx.storage.put('game', { ...game, invalid: r.error });
      return r;
    }
    const next = close ? { ...r.game, closed: true } : r.game;
    if (!r.repeated && snap.inputs.length) await this.ctx.storage.put(`in:${String(seq).padStart(6, '0')}`, snap.inputs);
    await this.ctx.storage.put('game', next);
    return { ok: true, score: next.score, tick: next.tick, seed: next.seed, seedSource: next.seedSource, durationMs: now - game.startedAt };
  }

  /** Semilla, resultado y grabación completa (para la auditoría). */
  async record() {
    const game = await this.ctx.storage.get('game');
    if (!game) return null;
    const chunks = await this.ctx.storage.list({ prefix: 'in:' });
    const inputs = [...chunks.values()].flat();
    return { seed: game.seed, seedSource: game.seedSource, score: game.score, round: game.round, lives: game.lives, ticks: game.tick, closed: game.closed, invalid: game.invalid, inputs };
  }
}

/** Historial de partidas firmadas de un jugador (un objeto por jugador). */
export class Jugador extends DurableObject {
  async add(entry) {
    const list = ((await this.ctx.storage.get('games')) ?? []).filter((g) => g.gameId !== entry.gameId);
    list.push(entry);
    await this.ctx.storage.put('games', list.slice(-HISTORY_PER_PLAYER));
  }

  async games() {
    return (await this.ctx.storage.get('games')) ?? [];
  }
}

async function readJson(request) {
  try {
    return JSON.parse(await request.text());
  } catch {
    return null;
  }
}

const snapshotOf = (d) => ({
  score: d.score,
  round: d.round,
  lives: d.lives,
  orbsLeft: d.orbsLeft,
  powerLeft: d.powerLeft,
  tick: d.tick,
  inputs: d.inputs,
});

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return json({ ok: false, error: 'solo POST' }, 405);
    const { pathname } = new URL(request.url);
    const data = (await readJson(request)) ?? {};
    const now = Date.now();

    if (pathname === '/start') {
      const fromClient = data.seed !== undefined;
      if (fromClient && !isSeed(data.seed)) return json({ ok: false, error: 'semilla inválida' }, 400);
      const seed = fromClient ? data.seed : crypto.getRandomValues(new Uint32Array(1))[0];
      const id = env.PARTIDA.newUniqueId();
      const r = await env.PARTIDA.get(id).start(now, seed, fromClient ? 'cliente' : 'worker');
      return json({ ...r, gameId: `0x${id.toString()}`, seed }, r.ok ? 200 : 409);
    }

    if (pathname === '/audit') {
      if (!env.AUDIT_TOKEN || !sameText(data.token, env.AUDIT_TOKEN)) return json({ ok: false, error: 'no autorizado' }, 401);
      if (!isAddress(data.player)) return json({ ok: false, error: 'player inválido' }, 400);
      const games = await env.JUGADOR.get(env.JUGADOR.idFromName(data.player.toLowerCase())).games();
      const detail = await Promise.all(
        games.map(async (g) => ({ ...g, ...(await env.PARTIDA.get(env.PARTIDA.idFromString(g.gameId.slice(2))).record()) })),
      );
      return json({ ok: true, player: data.player, games: detail });
    }

    if (pathname !== '/beat' && pathname !== '/finish') return json({ ok: false, error: 'not found' }, 404);
    if (!isGameId(data.gameId) || !isSeq(data.seq)) return json({ ok: false, error: 'datos inválidos' }, 400);
    let id;
    try {
      id = env.PARTIDA.idFromString(data.gameId.slice(2));
    } catch {
      return json({ ok: false, error: 'partida desconocida' }, 400);
    }
    const stub = env.PARTIDA.get(id);

    if (pathname === '/beat') {
      const r = await stub.beat(data.seq, snapshotOf(data), now);
      return json(r, r.ok ? 200 : 422);
    }

    if (!isAddress(data.player)) return json({ ok: false, error: 'player inválido' }, 400);
    const r = await stub.beat(data.seq, snapshotOf(data), now, true);
    if (!r.ok) return json(r, 422);
    if (r.score === 0) return json({ ok: false, error: 'puntaje 0' }, 422);
    const account = privateKeyToAccount(env.SIGNER_KEY);
    const deadline = Math.floor(now / 1000) + SIGNATURE_TTL_SECONDS;
    const signature = await account.signTypedData({
      domain: { name: 'PolkaManScore', version: '1', chainId: Number(env.CHAIN_ID), verifyingContract: env.CONTRACT_ADDRESS },
      types: {
        Score: [
          { name: 'player', type: 'address' },
          { name: 'score', type: 'uint256' },
          { name: 'gameId', type: 'bytes32' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      primaryType: 'Score',
      message: { player: data.player, score: BigInt(r.score), gameId: data.gameId, deadline: BigInt(deadline) },
    });
    await env.JUGADOR.get(env.JUGADOR.idFromName(data.player.toLowerCase())).add({
      gameId: data.gameId,
      score: r.score,
      finishedAt: now,
      durationMs: r.durationMs,
    });
    return json({ ok: true, player: data.player, score: r.score, gameId: data.gameId, deadline, signature, durationMs: r.durationMs });
  },
};
