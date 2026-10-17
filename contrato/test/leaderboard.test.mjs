// Reglas de Leaderboard.sol. Correr: pnpm test (dentro de contrato/)
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deploy, expectRevert, player } from './harness.mjs';

const ZERO = '0x0000000000000000000000000000000000000000';

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
