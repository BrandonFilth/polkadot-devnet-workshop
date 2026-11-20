// Reglas del anti-trampas. Correr: pnpm test (dentro de anticheat/)
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyBeat, BURST_POINTS, LIVES, MAX_SCORE, newGame, POINTS_PER_SECOND, ROUND_MAX_POINTS } from '../src/rules.js';

const T0 = 1_800_000_000_000;
const s = (score, round = 1, lives = LIVES) => ({ score, round, lives });

/** Aplica avances [segundos desde el inicio, snapshot] en orden y devuelve el último resultado. */
function play(steps) {
  let game = newGame(T0);
  let r = { ok: true, game };
  steps.forEach(([sec, snap], i) => {
    r = applyBeat(game, i + 1, snap, T0 + sec * 1000);
    if (r.ok) game = r.game;
  });
  return r;
}

describe('anti-trampas: partidas honestas pasan', () => {
  it('comer bolitas a ritmo normal, pasar de ronda y perder vidas', () => {
    const r = play([
      [20, s(1000)],
      [27, s(1660, 2)],
      [40, s(2200, 2, 4)],
      [60, s(3500, 2, 4)],
      [62, s(9700, 2, 4)], // cadena de 4 fantasmas de golpe
      [90, s(11000, 3, 3)],
    ]);
    assert.equal(r.ok, true, r.error);
    assert.equal(r.game.score, 11000);
  });

  it('una pausa larga no invalida la partida', () => {
    const r = play([
      [20, s(800)],
      [3600, s(800)],
      [3620, s(1400)],
    ]);
    assert.equal(r.ok, true, r.error);
  });

  it('repetir el último avance (reintento por red) se acepta', () => {
    let game = newGame(T0);
    const a = applyBeat(game, 1, s(500), T0 + 20_000);
    assert.equal(a.ok, true);
    game = a.game;
    const again = applyBeat(game, 1, s(500), T0 + 25_000);
    assert.equal(again.ok, true);
    assert.equal(again.repeated, true);
    assert.equal(applyBeat(game, 2, s(700), T0 + 40_000).ok, true);
  });
});

describe('anti-trampas: trampas se rechazan', () => {
  it('2^256-1, más de MAX_SCORE, decimales o negativos', () => {
    for (const score of [2 ** 256, MAX_SCORE + 1, 1.5, -1, Number.NaN]) {
      assert.equal(play([[20, s(score)]]).ok, false, String(score));
    }
  });

  it('subir más rápido de lo posible', () => {
    const r = play([[10, s(POINTS_PER_SECOND * 10 + BURST_POINTS * 3 + 1)]]);
    assert.equal(r.ok, false);
    assert.match(r.error, /subió/);
  });

  it('999 999 puntos en un minuto', () => {
    assert.equal(play([[60, s(999_999, 3)]]).ok, false);
  });

  it('rondas demasiado rápidas', () => {
    const r = play([[10, s(500, 2)]]);
    assert.equal(r.ok, false);
    assert.match(r.error, /rondas/);
  });

  it('más puntos de los que dan las rondas jugadas', () => {
    // Dentro de la tasa por tiempo (2 h), pero más de lo que da una ronda.
    const r = play([[7200, s(ROUND_MAX_POINTS + 1, 1)]]);
    assert.equal(r.ok, false);
    assert.match(r.error, /rondas/);
  });

  it('puntaje que baja, ronda que baja, vidas que suben', () => {
    assert.equal(play([[20, s(800)], [40, s(700)]]).ok, false);
    assert.equal(play([[30, s(800, 2)], [60, s(900, 1)]]).ok, false);
    assert.equal(play([[20, s(800, 1, 4)], [40, s(900, 1, 5)]]).ok, false);
  });

  it('avances fuera de orden, y una partida rechazada ya no acepta nada', () => {
    let game = newGame(T0);
    assert.equal(applyBeat(game, 2, s(100), T0 + 20_000).ok, false);
    game = { ...game, invalid: 'subió de más' };
    assert.equal(applyBeat(game, 1, s(100), T0 + 20_000).ok, false);
    assert.equal(applyBeat({ ...newGame(T0), closed: true }, 1, s(100), T0 + 20_000).error, 'cerrada');
  });

  it('una partida de más de 6 h ya no acepta avances', () => {
    assert.equal(play([[6 * 3600 + 1, s(100)]]).error, 'partida vencida');
  });
});
