// Worker anti-trampas de Polka-Man (Cloudflare). Un Durable Object (SQLite) por partida guarda los avances;
// las reglas están en rules.js. Al terminar firma (EIP-712) «esta cuenta hizo X puntos en la partida gameId»,
// que es lo único que acepta submitScore de LeaderboardV5. La llave va como secreto: SIGNER_KEY.
//   POST /start                         → { ok, gameId }
//   POST /beat   { gameId, seq, score, round, lives }
//   POST /finish { gameId, seq, score, round, lives, player } → { ok, score, gameId, deadline, signature }
import { DurableObject } from 'cloudflare:workers';
import { privateKeyToAccount } from 'viem/accounts';
import { applyBeat, newGame } from './rules.js';

/** La firma vale 30 minutos para guardarse en la cadena (da tiempo de conectar la cuenta y firmar). */
const SIGNATURE_TTL_SECONDS = 1_800;

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

export class Partida extends DurableObject {
  async start(now) {
    if (await this.ctx.storage.get('game')) return { ok: false, error: 'ya existe' };
    await this.ctx.storage.put('game', newGame(now));
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
    await this.ctx.storage.put('game', close ? { ...r.game, closed: true } : r.game);
    return { ok: true, score: r.game.score, durationMs: now - game.startedAt };
  }
}

async function readJson(request) {
  try {
    return JSON.parse(await request.text());
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return json({ ok: false, error: 'solo POST' }, 405);
    const { pathname } = new URL(request.url);
    const data = (await readJson(request)) ?? {};
    const now = Date.now();

    if (pathname === '/start') {
      const id = env.PARTIDA.newUniqueId();
      const r = await env.PARTIDA.get(id).start(now);
      return json({ ...r, gameId: `0x${id.toString()}` }, r.ok ? 200 : 409);
    }

    if (pathname !== '/beat' && pathname !== '/finish') return json({ ok: false, error: 'not found' }, 404);
    if (!isGameId(data.gameId) || !isSeq(data.seq)) return json({ ok: false, error: 'datos inválidos' }, 400);
    let id;
    try {
      id = env.PARTIDA.idFromString(data.gameId.slice(2));
    } catch {
      return json({ ok: false, error: 'partida desconocida' }, 400);
    }
    const snap = { score: data.score, round: data.round, lives: data.lives };
    const stub = env.PARTIDA.get(id);

    if (pathname === '/beat') {
      const r = await stub.beat(data.seq, snap, now);
      return json(r, r.ok ? 200 : 422);
    }

    if (!isAddress(data.player)) return json({ ok: false, error: 'player inválido' }, 400);
    const r = await stub.beat(data.seq, snap, now, true);
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
    return json({ ok: true, player: data.player, score: r.score, gameId: data.gameId, deadline, signature, durationMs: r.durationMs });
  },
};
