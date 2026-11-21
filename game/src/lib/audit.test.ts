import { describe, expect, it } from 'vitest';
import { createGame, releaseDirections, setDirections, start, update } from '../engine/game';
import { mulberry32 } from '../engine/replay.fixture';
import { DT } from '../engine/rules';
import type { Dir } from '../engine/types';
import viteConfig from '../../vite.config.js?raw';
import auditRunner from '../../auditoria/top3.audit.ts?raw';
import { auditGame, auditPlayer, parseAuditGames, reportLine, type AuditGame } from './audit';

const DIRS: Dir[] = ['arriba', 'abajo', 'izquierda', 'derecha'];

/** Una partida completa (hasta perder todas las vidas) con pedidos al azar. */
function playToEnd(seed: number, inputSeed: number) {
  const rand = mulberry32(inputSeed);
  const state = createGame(seed);
  start(state);
  for (let step = 0; step < 120 * 3_600 && state.phase !== 'fin'; step++) {
    const r = rand();
    if (r < 0.02) setDirections(state, DIRS[Math.floor(rand() * 4)]!, null);
    else if (r < 0.025) releaseDirections(state);
    update(state, DT);
  }
  return state;
}

const live = playToEnd(42, 7);

/** Como la devuelve /audit: lo del historial del jugador más lo de la partida. */
const recorded = (more: Partial<AuditGame> = {}): AuditGame => ({
  gameId: `0x${'ab'.repeat(32)}`,
  score: live.score,
  seed: live.startSeed,
  seedSource: 'worker',
  ticks: live.tick,
  closed: true,
  invalid: null,
  durationMs: 300_000,
  finishedAt: 2,
  inputs: JSON.parse(JSON.stringify(live.inputs)),
  ...more,
});

describe('auditoría del top 3', () => {
  it('la partida de prueba termina y tiene puntos', () => {
    expect(live.phase).toBe('fin');
    expect(live.score).toBeGreaterThan(0);
  });

  it('una partida honesta pasa: la grabación da el puntaje firmado', () => {
    const r = auditGame(recorded());
    expect(r.verdict).toBe('OK');
    expect(r.replayedScore).toBe(live.score);
    expect(r.inputs).toBe(live.inputs.length);
  });

  it('un puntaje inventado, otra semilla o una grabación vacía o rota fallan', () => {
    expect(auditGame(recorded({ score: live.score + 10_000 })).verdict).toBe('FALLA');
    expect(auditGame(recorded({ seed: live.startSeed + 1 })).verdict).toBe('FALLA');
    expect(auditGame(recorded({ inputs: [] })).verdict).toBe('FALLA');
    expect(auditGame(recorded({ inputs: [[1, 'volar', null]] })).detail).toMatch(/grabación inválida/);
  });

  it('auditPlayer busca la partida con el puntaje del contrato; sin ella, falla', () => {
    const fake = recorded({ gameId: `0x${'cd'.repeat(32)}`, score: live.score, seed: 9, finishedAt: 5 });
    // La más reciente con ese puntaje no pasa, pero otra sí: basta con una.
    expect(auditPlayer(live.score, [fake, recorded()]).verdict).toBe('OK');
    expect(auditPlayer(live.score, [fake]).verdict).toBe('FALLA');
    // Abiertas o invalidadas no cuentan.
    expect(auditPlayer(live.score, [recorded({ closed: false }), recorded({ invalid: 'x' })]).detail).toMatch(/ninguna partida/);
    expect(auditPlayer(live.score + 10, [recorded()]).verdict).toBe('FALLA');
  });

  it('parseAuditGames toma lo que tiene forma de partida y descarta el resto', () => {
    const games = parseAuditGames({ ok: true, games: [recorded(), { gameId: 1 }, null, { ...recorded(), seed: 'x' }] });
    expect(games).toHaveLength(1);
    expect(games[0]!.seed).toBe(live.startSeed);
    expect(parseAuditGames({ ok: false })).toEqual([]);
  });

  it('la auditoría corre aparte (proyecto «auditoria») y lee el token de un archivo ignorado por git', () => {
    expect(viteConfig).toMatch(/name: 'auditoria',\s*\n\s*environment: 'node',\s*\n\s*include: \['auditoria\/\*\*\/\*\.audit\.ts'\]/);
    expect(auditRunner).toContain("'../../anticheat/.audit-token.key'");
    expect(auditRunner).toMatch(/auditPlayer\(Number\(who\.score\), parseAuditGames\(body\)\)/);
  });

  it('reportLine dice el lugar, el veredicto, el jugador y la partida', () => {
    const line = reportLine(1, { address: '0x11', username: 'ana', score: BigInt(live.score) }, auditGame(recorded()));
    expect(line).toMatch(/^1\. OK ana \(0x11\): \d+ puntos\. .*semilla del Worker$/);
  });
});
