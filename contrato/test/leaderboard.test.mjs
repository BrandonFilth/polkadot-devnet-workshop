// Reglas de Leaderboard.sol. Correr: pnpm test (dentro de contrato/)
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ADMIN, deploy, expectRevert, NOW, player } from './harness.mjs';

const ZERO = '0x0000000000000000000000000000000000000000';
const DAY = 86_400n;
const PERIOD = 3n * DAY;

describe('submitScore', () => {
  it('guarda el primer puntaje y suma al jugador a la lista', async () => {
    const c = await deploy();
    const { events } = await c.send(player(1), 'submitScore', [120n]);
    assert.equal(await c.read('bestScore', [player(1)]), 120n);
    assert.equal(await c.read('playerCount'), 1n);
    assert.equal(events[0].eventName, 'NewHighScore');
    assert.equal(events[0].args.player, player(1));
    assert.equal(events[0].args.score, 120n);
  });

  it('un récord nuevo reemplaza al anterior sin repetir al jugador', async () => {
    const c = await deploy();
    await c.send(player(1), 'submitScore', [120n]);
    await c.send(player(1), 'submitScore', [300n]);
    assert.equal(await c.read('bestScore', [player(1)]), 300n);
    assert.equal(await c.read('playerCount'), 1n);
  });

  it('rechaza un puntaje menor o igual al récord', async () => {
    const c = await deploy();
    await c.send(player(1), 'submitScore', [300n]);
    const e = await expectRevert(c.send(player(1), 'submitScore', [300n]), 'ScoreNotHigher');
    assert.deepEqual(e.args, [300n, 300n]);
    await expectRevert(c.send(player(1), 'submitScore', [50n]), 'ScoreNotHigher');
    assert.equal(await c.read('bestScore', [player(1)]), 300n);
  });

  it('rechaza 0 como primer puntaje', async () => {
    const c = await deploy();
    await expectRevert(c.send(player(1), 'submitScore', [0n]), 'ScoreNotHigher');
    assert.equal(await c.read('playerCount'), 0n);
  });

  it('cada jugador solo cambia su propio puntaje', async () => {
    const c = await deploy();
    await c.send(player(1), 'submitScore', [500n]);
    await c.send(player(2), 'submitScore', [10n]);
    assert.equal(await c.read('bestScore', [player(1)]), 500n);
    assert.equal(await c.read('bestScore', [player(2)]), 10n);
  });
});

describe('setUsername', () => {
  it('pone el username y se puede buscar en los dos sentidos', async () => {
    const c = await deploy();
    const { events } = await c.send(player(1), 'setUsername', ['ana_92']);
    assert.equal(await c.read('usernameOf', [player(1)]), 'ana_92');
    assert.equal(await c.read('playerOf', ['ana_92']), player(1));
    assert.equal(events[0].eventName, 'UsernameSet');
  });

  it('es opcional y se puede poner después de guardar un puntaje', async () => {
    const c = await deploy();
    await c.send(player(1), 'submitScore', [80n]);
    assert.equal(await c.read('usernameOf', [player(1)]), '');
    await c.send(player(1), 'setUsername', ['luis']);
    const [, usernames] = await c.read('getScores', [0n, 10n]);
    assert.deepEqual(usernames, ['luis']);
  });

  it('es único: nadie puede tomar uno que ya está en uso', async () => {
    const c = await deploy();
    await c.send(player(1), 'setUsername', ['ana']);
    await expectRevert(c.send(player(2), 'setUsername', ['ana']), 'UsernameTaken');
  });

  it('al cambiarlo, el anterior queda libre', async () => {
    const c = await deploy();
    await c.send(player(1), 'setUsername', ['ana']);
    await c.send(player(1), 'setUsername', ['ana_pro']);
    assert.equal(await c.read('playerOf', ['ana']), ZERO);
    await c.send(player(2), 'setUsername', ['ana']);
    assert.equal(await c.read('playerOf', ['ana']), player(2));
  });

  it('volver a poner tu mismo username no falla', async () => {
    const c = await deploy();
    await c.send(player(1), 'setUsername', ['ana']);
    await c.send(player(1), 'setUsername', ['ana']);
    assert.equal(await c.read('playerOf', ['ana']), player(1));
  });

  for (const bad of ['ab', 'a'.repeat(17), 'Ana', 'ana luis', 'ana-1', 'ñandú', '']) {
    it(`rechaza un username inválido: "${bad}"`, async () => {
      const c = await deploy();
      await expectRevert(c.send(player(1), 'setUsername', [bad]), 'InvalidUsername');
    });
  }

  it('acepta los límites: 3 y 16 caracteres, a-z, 0-9 y _', async () => {
    const c = await deploy();
    await c.send(player(1), 'setUsername', ['a_1']);
    await c.send(player(2), 'setUsername', ['abcdefghij_12345']);
  });
});

describe('getScores', () => {
  it('devuelve jugadores por páginas, en orden de llegada', async () => {
    const c = await deploy();
    for (let i = 1; i <= 5; i++) await c.send(player(i), 'submitScore', [BigInt(i * 10)]);
    await c.send(player(3), 'setUsername', ['tercero']);

    const [addrs, usernames, scores] = await c.read('getScores', [1n, 2n]);
    assert.deepEqual(addrs, [player(2), player(3)]);
    assert.deepEqual(usernames, ['', 'tercero']);
    assert.deepEqual(scores, [20n, 30n]);
  });

  it('corta la última página y no falla si offset pasa del total', async () => {
    const c = await deploy();
    for (let i = 1; i <= 3; i++) await c.send(player(i), 'submitScore', [1n]);
    assert.equal((await c.read('getScores', [2n, 10n]))[0].length, 1);
    assert.equal((await c.read('getScores', [10n, 10n]))[0].length, 0);
  });

  it('la app puede ordenar de mayor a menor con lo que devuelve', async () => {
    const c = await deploy();
    const puntos = [40n, 900n, 15n, 300n];
    for (const [i, p] of puntos.entries()) await c.send(player(i + 1), 'submitScore', [p]);
    const [addrs, , scores] = await c.read('getScores', [0n, 100n]);
    const top = addrs.map((a, i) => ({ a, s: scores[i] })).sort((x, y) => (y.s > x.s ? 1 : y.s < x.s ? -1 : 0));
    assert.deepEqual(top.map((t) => t.s), [900n, 300n, 40n, 15n]);
    assert.equal(top[0].a, player(2));
  });
});

describe('periodos', () => {
  it('guarda startTime y el periodo dura 3 días', async () => {
    const c = await deploy();
    assert.equal(await c.read('startTime'), NOW);
    assert.equal(await c.read('PERIOD_LENGTH'), 259_200n);
  });

  it('currentPeriod sube cada 3 días', async () => {
    const c = await deploy();
    assert.equal(await c.read('currentPeriod'), 0n);
    c.warp(PERIOD);
    assert.equal(await c.read('currentPeriod'), 1n);
    c.warp(PERIOD - 1n);
    assert.equal(c.now(), NOW + 2n * PERIOD - 1n);
    assert.equal(await c.read('currentPeriod'), 1n);
    c.warp(1n);
    assert.equal(await c.read('currentPeriod'), 2n);
  });

  it('currentPeriod es 2 un segundo antes de los 9 días', async () => {
    const c = await deploy();
    c.warp(3n * PERIOD - 1n);
    assert.equal(await c.read('currentPeriod'), 2n);
  });

  it('periodBounds da el inicio y el fin de un periodo', async () => {
    const c = await deploy();
    assert.deepEqual(await c.read('periodBounds', [2n]), [NOW + 6n * DAY, NOW + 9n * DAY]);
    assert.deepEqual(await c.read('periodBounds', [0n]), [NOW, NOW + PERIOD]);
  });

  it('al cambiar de periodo el ranking empieza vacío y acepta un puntaje menor', async () => {
    const c = await deploy();
    await c.send(player(1), 'submitScore', [500n]);
    c.warp(PERIOD);
    assert.equal(await c.read('bestScore', [player(1)]), 0n);
    assert.equal(await c.read('playerCount'), 0n);
    assert.equal((await c.read('getScores', [0n, 10n]))[0].length, 0);

    await c.send(player(1), 'submitScore', [100n]);
    assert.equal(await c.read('bestScore', [player(1)]), 100n);
    assert.equal(await c.read('playerCount'), 1n);
  });

  it('ScoreNotHigher usa el récord del periodo nuevo', async () => {
    const c = await deploy();
    await c.send(player(1), 'submitScore', [500n]);
    c.warp(PERIOD);
    await c.send(player(1), 'submitScore', [100n]);
    const e = await expectRevert(c.send(player(1), 'submitScore', [100n]), 'ScoreNotHigher');
    assert.deepEqual(e.args, [100n, 100n]);
  });

  it('los periodos anteriores se conservan como historial', async () => {
    const c = await deploy();
    await c.send(player(1), 'submitScore', [500n]);
    await c.send(player(2), 'submitScore', [40n]);
    c.warp(PERIOD);
    await c.send(player(2), 'submitScore', [70n]);

    const [addrs, , scores] = await c.read('getScoresIn', [0n, 0n, 10n]);
    assert.deepEqual(addrs, [player(1), player(2)]);
    assert.deepEqual(scores, [500n, 40n]);
    assert.equal(await c.read('scoreOf', [0n, player(1)]), 500n);
    assert.equal(await c.read('scoreOf', [1n, player(2)]), 70n);
    assert.equal(await c.read('playerCountIn', [0n]), 2n);
    assert.equal(await c.read('playerCountIn', [1n]), 1n);
  });

  it('getScoresIn pagina igual que getScores', async () => {
    const c = await deploy();
    for (let i = 1; i <= 3; i++) await c.send(player(i), 'submitScore', [BigInt(i)]);
    c.warp(PERIOD);
    const [addrs, , scores] = await c.read('getScoresIn', [0n, 1n, 1n]);
    assert.deepEqual(addrs, [player(2)]);
    assert.deepEqual(scores, [2n]);
    assert.equal((await c.read('getScoresIn', [0n, 10n, 10n]))[0].length, 0);
    assert.equal((await c.read('getScoresIn', [7n, 0n, 10n]))[0].length, 0);
  });

  it('NewHighScore trae el periodo', async () => {
    const c = await deploy();
    c.warp(2n * PERIOD);
    const { events } = await c.send(player(1), 'submitScore', [10n]);
    assert.equal(events[0].eventName, 'NewHighScore');
    assert.equal(events[0].args.player, player(1));
    assert.equal(events[0].args.period, 2n);
    assert.equal(events[0].args.score, 10n);
  });

  it('el username es el mismo en todos los periodos', async () => {
    const c = await deploy();
    await c.send(player(1), 'setUsername', ['ana']);
    await c.send(player(1), 'submitScore', [10n]);
    c.warp(PERIOD);
    await c.send(player(1), 'submitScore', [5n]);
    assert.equal(await c.read('usernameOf', [player(1)]), 'ana');
    const [, current] = await c.read('getScores', [0n, 10n]);
    const [, previous] = await c.read('getScoresIn', [0n, 0n, 10n]);
    assert.deepEqual(current, ['ana']);
    assert.deepEqual(previous, ['ana']);
    await expectRevert(c.send(player(2), 'setUsername', ['ana']), 'UsernameTaken');
  });
});

describe('lifetimeBest', () => {
  it('guarda el primer puntaje y emite NewLifetimeBest', async () => {
    const c = await deploy();
    const { events } = await c.send(player(1), 'submitScore', [120n]);
    assert.equal(await c.read('lifetimeBest', [player(1)]), 120n);
    assert.deepEqual(events.map((e) => e.eventName), ['NewHighScore', 'NewLifetimeBest']);
    assert.equal(events[1].args.player, player(1));
    assert.equal(events[1].args.score, 120n);
  });

  it('persiste entre periodos', async () => {
    const c = await deploy();
    await c.send(player(1), 'submitScore', [900n]);
    c.warp(5n * PERIOD);
    assert.equal(await c.read('lifetimeBest', [player(1)]), 900n);
    assert.equal(await c.read('bestScore', [player(1)]), 0n);
  });

  it('un puntaje menor en un periodo nuevo no lo baja ni emite NewLifetimeBest', async () => {
    const c = await deploy();
    await c.send(player(1), 'submitScore', [900n]);
    c.warp(PERIOD);
    const { events } = await c.send(player(1), 'submitScore', [300n]);
    assert.deepEqual(events.map((e) => e.eventName), ['NewHighScore']);
    assert.equal(await c.read('bestScore', [player(1)]), 300n);
    assert.equal(await c.read('lifetimeBest', [player(1)]), 900n);
  });

  it('sube cuando un envío del periodo lo supera', async () => {
    const c = await deploy();
    await c.send(player(1), 'submitScore', [900n]);
    c.warp(PERIOD);
    await c.send(player(1), 'submitScore', [300n]);
    const { events } = await c.send(player(1), 'submitScore', [1_000n]);
    assert.deepEqual(events.map((e) => e.eventName), ['NewHighScore', 'NewLifetimeBest']);
    assert.equal(events[1].args.score, 1_000n);
    assert.equal(await c.read('lifetimeBest', [player(1)]), 1_000n);
  });

  it('solo sube: un récord del periodo que no supera el de por vida no lo cambia', async () => {
    const c = await deploy();
    await c.send(player(1), 'submitScore', [900n]);
    c.warp(PERIOD);
    await c.send(player(1), 'submitScore', [300n]);
    await c.send(player(1), 'submitScore', [600n]);
    assert.equal(await c.read('bestScore', [player(1)]), 600n);
    assert.equal(await c.read('lifetimeBest', [player(1)]), 900n);
  });

  it('es de cada jugador', async () => {
    const c = await deploy();
    await c.send(player(1), 'submitScore', [900n]);
    await c.send(player(2), 'submitScore', [50n]);
    assert.equal(await c.read('lifetimeBest', [player(1)]), 900n);
    assert.equal(await c.read('lifetimeBest', [player(2)]), 50n);
    assert.equal(await c.read('lifetimeBest', [player(3)]), 0n);
  });
});

describe('admin', () => {
  it('quien despliega queda como admin y el constructor no lleva parámetros', async () => {
    const c = await deploy({ start: null });
    assert.equal(await c.read('admin'), ADMIN);
    assert.equal(await c.read('startTime'), 0n);
  });

  it('setAdmin le pasa el puesto a otra dirección y emite AdminChanged', async () => {
    const c = await deploy({ start: null });
    const { events } = await c.send(ADMIN, 'setAdmin', [player(7)]);
    assert.equal(await c.read('admin'), player(7));
    assert.equal(events[0].eventName, 'AdminChanged');
    assert.equal(events[0].args.previousAdmin, ADMIN);
    assert.equal(events[0].args.newAdmin, player(7));
  });

  it('el admin anterior pierde el acceso y el nuevo puede actuar', async () => {
    const c = await deploy({ start: null });
    await c.send(ADMIN, 'setAdmin', [player(7)]);
    await expectRevert(c.send(ADMIN, 'setStartTime', [NOW + DAY]), 'NotAdmin');
    await expectRevert(c.send(ADMIN, 'setAdmin', [ADMIN]), 'NotAdmin');
    await c.send(player(7), 'setStartTime', [NOW + DAY]);
    assert.equal(await c.read('startTime'), NOW + DAY);
    await c.send(player(7), 'setAdmin', [player(8)]);
    assert.equal(await c.read('admin'), player(8));
  });

  it('solo el admin puede llamar setAdmin', async () => {
    const c = await deploy({ start: null });
    await expectRevert(c.send(player(1), 'setAdmin', [player(1)]), 'NotAdmin');
    assert.equal(await c.read('admin'), ADMIN);
  });

  it('setAdmin rechaza la dirección 0x000…', async () => {
    const c = await deploy({ start: null });
    await expectRevert(c.send(ADMIN, 'setAdmin', [ZERO]), 'InvalidAdmin');
    assert.equal(await c.read('admin'), ADMIN);
  });

  it('el admin no tiene ventaja con los puntajes: solo cambia el suyo', async () => {
    const c = await deploy();
    await c.send(player(1), 'submitScore', [500n]);
    await c.send(ADMIN, 'submitScore', [10n]);
    assert.equal(await c.read('bestScore', [player(1)]), 500n);
    assert.equal(await c.read('bestScore', [ADMIN]), 10n);
  });
});

describe('setStartTime', () => {
  it('el admin fija la hora de inicio y emite StartTimeSet', async () => {
    const c = await deploy({ start: null });
    const { events } = await c.send(ADMIN, 'setStartTime', [NOW + DAY]);
    assert.equal(await c.read('startTime'), NOW + DAY);
    assert.equal(events[0].eventName, 'StartTimeSet');
    assert.equal(events[0].args.start, NOW + DAY);
  });

  it('solo el admin puede llamarla', async () => {
    const c = await deploy({ start: null });
    await expectRevert(c.send(player(1), 'setStartTime', [NOW]), 'NotAdmin');
    assert.equal(await c.read('startTime'), 0n);
  });

  it('rechaza 0', async () => {
    const c = await deploy({ start: null });
    await expectRevert(c.send(ADMIN, 'setStartTime', [0n]), 'InvalidStart');
  });

  it('se puede cambiar varias veces mientras la hora de inicio no llega', async () => {
    const c = await deploy({ start: null });
    await c.send(ADMIN, 'setStartTime', [NOW + 5n * DAY]);
    await c.send(ADMIN, 'setStartTime', [NOW + 2n * DAY]);
    c.warp(DAY);
    await c.send(ADMIN, 'setStartTime', [NOW + 10n * DAY]);
    assert.equal(await c.read('startTime'), NOW + 10n * DAY);
  });

  it('acepta la hora actual o una pasada y abre el ranking de inmediato', async () => {
    const actual = await deploy({ start: null });
    await actual.send(ADMIN, 'setStartTime', [NOW]);
    assert.equal(await actual.read('isStarted'), true);

    const pasada = await deploy({ start: null });
    await pasada.send(ADMIN, 'setStartTime', [NOW - 2n * PERIOD]);
    assert.equal(await pasada.read('isStarted'), true);
    assert.equal(await pasada.read('currentPeriod'), 2n);
  });

  it('queda bloqueada en cuanto llega la hora de inicio', async () => {
    const c = await deploy({ start: null });
    await c.send(ADMIN, 'setStartTime', [NOW + DAY]);
    c.warp(DAY - 1n);
    await c.send(ADMIN, 'setStartTime', [NOW + DAY]); // un segundo antes todavía se puede
    c.warp(1n);
    await expectRevert(c.send(ADMIN, 'setStartTime', [NOW + 5n * DAY]), 'StartLocked');
    c.warp(10n * PERIOD);
    await expectRevert(c.send(ADMIN, 'setStartTime', [NOW + 50n * PERIOD]), 'StartLocked');
    assert.equal(await c.read('startTime'), NOW + DAY);
  });

  it('cambiar de admin no desbloquea la hora de inicio', async () => {
    const c = await deploy();
    await c.send(ADMIN, 'setAdmin', [player(7)]);
    await expectRevert(c.send(player(7), 'setStartTime', [NOW + DAY]), 'StartLocked');
  });
});

describe('isStarted', () => {
  it('es false sin hora de inicio', async () => {
    const c = await deploy({ start: null });
    assert.equal(await c.read('isStarted'), false);
  });

  it('es false antes de la hora de inicio y true desde ese segundo', async () => {
    const c = await deploy({ start: NOW + DAY });
    assert.equal(await c.read('isStarted'), false);
    c.warp(DAY - 1n);
    assert.equal(await c.read('isStarted'), false);
    c.warp(1n);
    assert.equal(await c.read('isStarted'), true);
    c.warp(100n * PERIOD);
    assert.equal(await c.read('isStarted'), true);
  });
});

describe('antes de que abra el evento', () => {
  /** Comprueba que nada quedó guardado en el ranking. */
  const rankingVacio = async (c) => {
    assert.equal(await c.read('playerCount'), 0n);
    assert.equal(await c.read('playerCountIn', [0n]), 0n);
    assert.equal(await c.read('bestScore', [player(1)]), 0n);
    assert.equal(await c.read('scoreOf', [0n, player(1)]), 0n);
    assert.equal(await c.read('lifetimeBest', [player(1)]), 0n);
    assert.deepEqual(await c.read('getScores', [0n, 10n]), [[], [], []]);
    assert.deepEqual(await c.read('getScoresIn', [0n, 0n, 10n]), [[], [], []]);
  };

  it('sin hora de inicio no se guarda ningún puntaje', async () => {
    const c = await deploy({ start: null });
    await expectRevert(c.send(player(1), 'submitScore', [120n]), 'NotStarted');
    await expectRevert(c.send(ADMIN, 'submitScore', [120n]), 'NotStarted');
    await rankingVacio(c);
    assert.equal(await c.read('currentPeriod'), 0n);
    await expectRevert(c.read('periodBounds', [0n]), 'NotStarted');
  });

  it('con hora de inicio futura no se guarda ningún puntaje hasta que llegue', async () => {
    const c = await deploy({ start: NOW + DAY });
    await expectRevert(c.send(player(1), 'submitScore', [120n]), 'NotStarted');
    c.warp(DAY - 1n);
    await expectRevert(c.send(player(1), 'submitScore', [120n]), 'NotStarted');
    await rankingVacio(c);
    assert.equal(await c.read('currentPeriod'), 0n);
    assert.deepEqual(await c.read('periodBounds', [0n]), [NOW + DAY, NOW + DAY + PERIOD]);

    c.warp(1n);
    await c.send(player(1), 'submitScore', [120n]);
    assert.equal(await c.read('bestScore', [player(1)]), 120n);
    assert.equal(await c.read('playerCount'), 1n);
    assert.equal(await c.read('lifetimeBest', [player(1)]), 120n);
  });

  it('el username sí se puede poner antes del evento', async () => {
    const c = await deploy({ start: null });
    await c.send(player(1), 'setUsername', ['ana']);
    assert.equal(await c.read('usernameOf', [player(1)]), 'ana');
  });
});

describe('reinicio cada 3 días', () => {
  it('el ranking se reinicia en cada periodo y guarda el historial', async () => {
    const start = NOW + DAY;
    const c = await deploy({ start });
    c.warp(DAY); // abre el evento

    for (let p = 0n; p < 4n; p++) {
      assert.equal(await c.read('currentPeriod'), p);
      assert.equal(await c.read('playerCount'), 0n);
      assert.equal(await c.read('bestScore', [player(1)]), 0n);
      assert.deepEqual(await c.read('getScores', [0n, 10n]), [[], [], []]);

      // Cada periodo acepta un puntaje menor que el del anterior.
      const score = 1_000n - p * 100n;
      const { events } = await c.send(player(1), 'submitScore', [score]);
      assert.equal(events[0].args.period, p);
      assert.equal(await c.read('bestScore', [player(1)]), score);
      assert.equal(await c.read('playerCount'), 1n);

      // Un segundo antes del final sigue siendo el mismo periodo.
      c.warp(PERIOD - 1n);
      assert.equal(await c.read('currentPeriod'), p);
      assert.equal(await c.read('bestScore', [player(1)]), score);
      c.warp(1n);
      assert.equal(c.now(), start + (p + 1n) * PERIOD);
    }

    for (let p = 0n; p < 4n; p++) {
      assert.equal(await c.read('playerCountIn', [p]), 1n);
      assert.equal(await c.read('scoreOf', [p, player(1)]), 1_000n - p * 100n);
    }
    assert.equal(await c.read('lifetimeBest', [player(1)]), 1_000n);
  });
});
