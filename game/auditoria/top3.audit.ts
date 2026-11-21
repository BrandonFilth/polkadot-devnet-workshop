// Auditoría del top 3 de un periodo, para correr en tu computadora antes de pagar premios:
//   pnpm --dir game exec vitest run --project auditoria
// Otro periodo (por ejemplo el que acaba de terminar): $env:PERIODO = '0' antes del comando.
// Lee el top 3 de LeaderboardV5, pide al Worker (/audit) las partidas firmadas de cada uno y vuelve a jugar
// la del puntaje del contrato con su semilla y su grabación. El token de /audit se lee de
// anticheat/.audit-token.key (ignorado por git) o de $env:AUDIT_TOKEN.
import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { ANTICHEAT_URL } from '../src/contract/config';
import { decodeScores, type ScoreEntry } from '../src/contract/leaderboard';
import { topScores } from '../src/contract/ranking';
import { createRpcContract } from '../src/contract/rpcReader';
import { auditPlayer, parseAuditGames, reportLine } from '../src/lib/audit';

const TOKEN_FILE = new URL('../../anticheat/.audit-token.key', import.meta.url);
const PAGE = 100n;

function token(): string {
  const fromEnv = process.env.AUDIT_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  if (existsSync(TOKEN_FILE)) return readFileSync(TOKEN_FILE, 'utf8').trim();
  throw new Error('Falta el token de /audit: anticheat/.audit-token.key o $env:AUDIT_TOKEN');
}

const value = <T>(r: { success: boolean; value: unknown }, what: string): T => {
  if (!r.success) throw new Error(`No se pudo leer ${what}: ${JSON.stringify(r.value)}`);
  return r.value as T;
};

async function top3(period: bigint): Promise<ScoreEntry[]> {
  const c = createRpcContract();
  const count = BigInt(value<bigint | number>(await c.playerCountIn.query(period), 'playerCountIn'));
  const rows: ScoreEntry[] = [];
  for (let offset = 0n; offset < count; offset += PAGE) {
    rows.push(...decodeScores(value(await c.getScoresIn.query(period, offset, PAGE), 'getScoresIn')));
  }
  return topScores(rows, 3);
}

it('auditoría del top 3', async () => {
  const auth = token();
  const c = createRpcContract();
  const period = process.env.PERIODO !== undefined && process.env.PERIODO !== ''
    ? BigInt(process.env.PERIODO)
    : BigInt(value<bigint | number>(await c.currentPeriod.query(), 'currentPeriod'));
  const top = await top3(period);
  const lines = [`Periodo ${period}: ${top.length} jugadores en el top 3.`];
  let failed = 0;
  for (const [i, who] of top.entries()) {
    const res = await fetch(`${ANTICHEAT_URL}/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: auth, player: who.address }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || body.ok !== true) throw new Error(`/audit respondió ${res.status}: ${body.error ?? 'sin detalle'}`);
    const r = auditPlayer(Number(who.score), parseAuditGames(body));
    if (r.verdict !== 'OK') failed += 1;
    lines.push(reportLine(i + 1, who, r));
  }
  lines.push(failed === 0 ? 'Todo OK: las partidas del top 3 dan sus puntajes.' : `${failed} con FALLA: no pagues sin revisarlos.`);
  console.log(`\n${lines.join('\n')}\n`);
  expect(failed, 'jugadores con FALLA').toBe(0);
}, 600_000);
