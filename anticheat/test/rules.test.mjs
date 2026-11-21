// Reglas del anti-trampas. Correr: pnpm test (dentro de anticheat/)
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyBeat, badSnapshot, GHOST_CHAIN_MAX, LIVES, MAX_SCORE, newGame, ORBS, POWER, PREPARED_TTL_MS, TICKS_PER_SECOND, totals } from '../src/rules.js';

const T0 = 1_800_000_000_000;

/**
 * Avance coherente a partir de lo comido en total: `orbs` y `power` desde el inicio, puntos de fantasmas y el
 * segundo de simulación. La ronda sale de las bolitas comidas (una ronda = todas).
 */
function snap({ orbs, power = 0, ghosts = 0, sec, lives = LIVES, inputs = [] }) {
  const round = 1 + Math.min(Math.floor(orbs / ORBS), Math.floor(power / POWER));
  const orbsLeft = ORBS - (orbs - ORBS * (round - 1));
  const powerLeft = POWER - (power - POWER * (round - 1));
  return { score: orbs * 10 + power * 50 + ghosts, round, lives, orbsLeft, powerLeft, tick: Math.round(sec * TICKS_PER_SECOND), inputs };
}

/** Aplica avances [segundo real, snapshot] en orden; devuelve el último resultado. */
function play(steps) {
  let game = newGame(T0, 7, 'worker');
  let r = { ok: true, game };
  steps.forEach(([sec, s], i) => {
    r = applyBeat(game, i + 1, s, T0 + sec * 1000);
    if (r.ok) game = r.game;
  });
  return r;
}

describe('anti-trampas: partidas honestas pasan', () => {
  it('bolitas a ritmo normal, una especial con 4 fantasmas, pasar de ronda y perder vidas', () => {
    const r = play([
      [20, snap({ orbs: 60, sec: 19 })],
      [40, snap({ orbs: 110, power: 1, ghosts: 3000, sec: 38, inputs: [[100, 'arriba', null], [200, 'soltar', null]] })],
      [60, snap({ orbs: 146, power: 4, ghosts: 3000, sec: 57, lives: 4 })],
      [80, snap({ orbs: 200, power: 4, ghosts: 3000, sec: 76, lives: 4 })],
    ]);
    assert.equal(r.ok, true, r.error);
    assert.equal(r.game.round, 2);
    assert.equal(r.game.inputs, 2);
  });

  it('una pausa larga no cuenta pasos y no invalida la partida', () => {
    const r = play([
      [20, snap({ orbs: 60, sec: 19 })],
      [3600, snap({ orbs: 60, sec: 19 })],
      [3620, snap({ orbs: 110, sec: 38 })],
    ]);
    assert.equal(r.ok, true, r.error);
  });

  it('tras un corte de red, los avances atrasados que llegan juntos se aceptan', () => {
    const r = play([
      [20, snap({ orbs: 60, sec: 19 })],
      [100, snap({ orbs: 110, sec: 38 })],
      [100.2, snap({ orbs: 200, power: 4, sec: 76 })],
      [100.4, snap({ orbs: 250, power: 4, sec: 95 })],
    ]);
    assert.equal(r.ok, true, r.error);
  });

  it('repetir el último avance (reintento por red) se acepta', () => {
    let game = newGame(T0, 1, 'worker');
    const a = applyBeat(game, 1, snap({ orbs: 50, sec: 18 }), T0 + 20_000);
    assert.equal(a.ok, true);
    game = a.game;
    assert.equal(applyBeat(game, 1, snap({ orbs: 50, sec: 18 }), T0 + 25_000).repeated, true);
    // También el de fin, ya cerrada: el juego vuelve a pedir la firma si se cortó la red.
    assert.equal(applyBeat({ ...game, closed: true }, 1, snap({ orbs: 50, sec: 18 }), T0 + 25_000).repeated, true);
    assert.equal(applyBeat({ ...game, closed: true }, 2, snap({ orbs: 60, sec: 30 }), T0 + 40_000).error, 'cerrada');
  });
});

describe('anti-trampas: avances inventados se rechazan', () => {
  it('números imposibles o con mala forma', () => {
    for (const bad of [{ score: 2 ** 256 }, { score: MAX_SCORE + 1 }, { score: 1.5 }, { orbsLeft: 200 }, { powerLeft: 9 }, { tick: -1 }]) {
      assert.notEqual(badSnapshot({ ...snap({ orbs: 1, sec: 1 }), ...bad }), null, JSON.stringify(bad));
    }
    assert.notEqual(badSnapshot({ ...snap({ orbs: 1, sec: 1 }), inputs: [[5, 'volar', null]] }), null);
    assert.notEqual(badSnapshot({ ...snap({ orbs: 1, sec: 1 }), inputs: [[300, 'arriba', null]] }), null); // después del paso actual
  });

  it('un puntaje que no sale de bolitas y fantasmas (999 999 «sueltos»)', () => {
    const r = play([[60, { ...snap({ orbs: 100, sec: 58 }), score: 999_999 }]]);
    assert.equal(r.ok, false);
  });

  it('la simulación no corre más rápido que el reloj', () => {
    const r = play([[10, snap({ orbs: 20, sec: 60 })]]);
    assert.equal(r.ok, false);
    assert.match(r.error, /pasos/);
  });

  it('más de una bolita por casilla recorrida', () => {
    const r = play([[20, snap({ orbs: 140, sec: 19 })]]);
    assert.equal(r.ok, false);
    assert.match(r.error, /bolitas/);
  });

  it('fantasmas sin bolita especial, de más o que no cuadran', () => {
    assert.match(play([[20, snap({ orbs: 50, ghosts: 200, sec: 19 })]]).error, /fantasmas/);
    assert.match(play([[20, snap({ orbs: 50, power: 1, ghosts: GHOST_CHAIN_MAX + 200, sec: 19 })]]).error, /fantasmas/);
    assert.match(play([[20, snap({ orbs: 50, power: 1, ghosts: 300, sec: 19 })]]).error, /cuadran/);
  });

  it('puntaje, ronda o bolitas que bajan; vidas que suben', () => {
    assert.equal(play([[20, snap({ orbs: 60, sec: 19 })], [40, snap({ orbs: 50, sec: 38 })]]).ok, false);
    assert.equal(play([[20, snap({ orbs: 60, sec: 19, lives: 4 })], [40, snap({ orbs: 90, sec: 38 })]]).ok, false);
  });

  it('el mejor guion posible no pasa de una partida casi perfecta', () => {
    // 10 minutos reales de avances inventados, cada uno al máximo que permiten las reglas.
    // Cada 20 s: 120 casillas = 120 bolitas (primero las especiales de la ronda) y todos los fantasmas.
    let game = newGame(T0, 1, 'worker');
    let eaten = 0; // bolitas + especiales, en orden: por ronda, 4 especiales y luego 146 normales
    for (let sec = 20; sec <= 600; sec += 20) {
      eaten += 120;
      const rounds = Math.floor(eaten / (ORBS + POWER));
      const inRound = eaten % (ORBS + POWER);
      const power = POWER * rounds + Math.min(POWER, inRound);
      const orbs = ORBS * rounds + Math.max(0, inRound - POWER);
      const r = applyBeat(game, game.seq + 1, snap({ orbs, power, ghosts: GHOST_CHAIN_MAX * power, sec }), T0 + sec * 1000);
      assert.equal(r.ok, true, r.error);
      game = r.game;
    }
    // Unas 24 rondas «perfectas» en 10 minutos: es el techo de las reglas. La auditoría (volver a jugar la
    // partida) es la que decide si esas teclas de verdad dan ese puntaje.
    assert.ok(game.score > 500_000 && game.score < 700_000, `${game.score}`);
    assert.equal(totals({ score: game.score, round: game.round, orbsLeft: ORBS, powerLeft: POWER }).ghosts >= 0, true);
  });

  it('una partida preparada vence si no empieza en 10 minutos; una partida rechazada ya no acepta nada', () => {
    const game = newGame(T0, 1, 'worker');
    assert.equal(applyBeat(game, 1, snap({ orbs: 1, sec: 1 }), T0 + PREPARED_TTL_MS + 1).error, 'partida vencida');
    assert.equal(applyBeat({ ...game, invalid: 'x' }, 1, snap({ orbs: 1, sec: 1 }), T0 + 20_000).ok, false);
    assert.equal(applyBeat({ ...game, closed: true }, 1, snap({ orbs: 1, sec: 1 }), T0 + 20_000).error, 'cerrada');
  });
});
