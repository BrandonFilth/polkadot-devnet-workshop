// Premios de Leaderboard.sol: wallets y pagos. Correr: pnpm test (dentro de contrato/)
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ADMIN, compile, deploy, expectRevert, NOW, player } from './harness.mjs';

const ZERO = '0x0000000000000000000000000000000000000000';
const TX = (n) => `0x${n.toString(16).padStart(64, '0')}`;
const WALLET = (n) => player(1000 + n);

describe('premios: constantes', () => {
  it('quien despliega es admin; 6 rondas y 3 lugares', async () => {
    const c = await deploy({ start: null });
    assert.equal(await c.read('admin'), ADMIN);
    assert.equal(await c.read('PRIZE_ROUNDS'), 6n);
    assert.equal(await c.read('PRIZE_PLACES'), 3n);
  });

  it('con los premios, el Leaderboard sigue sin parámetros, sin avisos y dentro de 24,576 bytes', () => {
    const { abi, runtimeBytes, warnings } = compile();
    assert.deepEqual(abi.find((e) => e.type === 'constructor').inputs, []);
    assert.ok(runtimeBytes <= 24_576);
    assert.deepEqual(warnings, []);
  });

  it('prizeAmount: 8, 5 y 3 USDT; otro lugar revierte', async () => {
    const c = await deploy({ start: null });
    assert.equal(await c.read('prizeAmount', [1n]), 8n);
    assert.equal(await c.read('prizeAmount', [2n]), 5n);
    assert.equal(await c.read('prizeAmount', [3n]), 3n);
    await expectRevert(c.read('prizeAmount', [0n]), 'InvalidPlace');
    await expectRevert(c.read('prizeAmount', [4n]), 'InvalidPlace');
  });
});

describe('setPayoutWallet', () => {
  it('registra la wallet del jugador y emite PayoutWalletSet', async () => {
    const c = await deploy({ start: null });
    const { events } = await c.send(player(1), 'setPayoutWallet', [WALLET(1)]);
    assert.equal(await c.read('payoutOf', [player(1)]), WALLET(1));
    assert.equal(events[0].eventName, 'PayoutWalletSet');
    assert.equal(events[0].args.player, player(1));
    assert.equal(events[0].args.wallet, WALLET(1));
  });

  it('se puede cambiar cuando quiera y borrar con 0x000…', async () => {
    const c = await deploy({ start: null });
    await c.send(player(1), 'setPayoutWallet', [WALLET(1)]);
    await c.send(player(1), 'setPayoutWallet', [WALLET(2)]);
    assert.equal(await c.read('payoutOf', [player(1)]), WALLET(2));
    await c.send(player(1), 'setPayoutWallet', [ZERO]);
    assert.equal(await c.read('payoutOf', [player(1)]), ZERO);
  });

  it('cada jugador solo cambia la suya', async () => {
    const c = await deploy({ start: null });
    await c.send(player(1), 'setPayoutWallet', [WALLET(1)]);
    await c.send(player(2), 'setPayoutWallet', [WALLET(2)]);
    assert.equal(await c.read('payoutOf', [player(1)]), WALLET(1));
    assert.equal(await c.read('payoutOf', [player(2)]), WALLET(2));
  });

  it('payoutsOf devuelve las wallets en el mismo orden, con 0x000… si no hay', async () => {
    const c = await deploy({ start: null });
    await c.send(player(1), 'setPayoutWallet', [WALLET(1)]);
    await c.send(player(3), 'setPayoutWallet', [WALLET(3)]);
    assert.deepEqual(await c.read('payoutsOf', [[player(1), player(2), player(3)]]), [WALLET(1), ZERO, WALLET(3)]);
    assert.deepEqual(await c.read('payoutsOf', [[]]), []);
  });
});

describe('recordPrize', () => {
  const ready = async () => {
    const c = await deploy({ start: null });
    await c.send(player(1), 'setPayoutWallet', [WALLET(1)]);
    return c;
  };

  it('el admin registra el pago con la wallet del jugador y la hora; emite PrizeRecorded', async () => {
    const c = await ready();
    const { events } = await c.send(ADMIN, 'recordPrize', [1n, 1n, player(1), TX(0xabc)]);
    const p = await c.read('prizeOf', [1n, 1n]);
    assert.deepEqual(p, { player: player(1), wallet: WALLET(1), txHash: TX(0xabc), paidAt: NOW });
    assert.equal(events[0].eventName, 'PrizeRecorded');
    assert.deepEqual(
      [events[0].args.round, events[0].args.place, events[0].args.player, events[0].args.wallet, events[0].args.txHash],
      [1n, 1n, player(1), WALLET(1), TX(0xabc)],
    );
  });

  it('guarda la wallet de ese momento: si el jugador la cambia después, el registro no cambia', async () => {
    const c = await ready();
    await c.send(ADMIN, 'recordPrize', [2n, 3n, player(1), TX(1)]);
    await c.send(player(1), 'setPayoutWallet', [WALLET(9)]);
    assert.equal((await c.read('prizeOf', [2n, 3n])).wallet, WALLET(1));
  });

  it('se puede corregir volviendo a registrar el mismo lugar', async () => {
    const c = await ready();
    await c.send(player(2), 'setPayoutWallet', [WALLET(2)]);
    await c.send(ADMIN, 'recordPrize', [1n, 1n, player(1), TX(1)]);
    await c.send(ADMIN, 'recordPrize', [1n, 1n, player(2), TX(2)]);
    const p = await c.read('prizeOf', [1n, 1n]);
    assert.equal(p.player, player(2));
    assert.equal(p.txHash, TX(2));
  });

  it('solo el admin', async () => {
    const c = await ready();
    await expectRevert(c.send(player(1), 'recordPrize', [1n, 1n, player(1), TX(1)]), 'NotAdmin');
  });

  it('valida ronda (1 a 6), lugar (1 a 3), jugador, hash y que haya wallet', async () => {
    const c = await ready();
    await expectRevert(c.send(ADMIN, 'recordPrize', [0n, 1n, player(1), TX(1)]), 'InvalidRound');
    await expectRevert(c.send(ADMIN, 'recordPrize', [7n, 1n, player(1), TX(1)]), 'InvalidRound');
    await expectRevert(c.send(ADMIN, 'recordPrize', [1n, 0n, player(1), TX(1)]), 'InvalidPlace');
    await expectRevert(c.send(ADMIN, 'recordPrize', [1n, 4n, player(1), TX(1)]), 'InvalidPlace');
    await expectRevert(c.send(ADMIN, 'recordPrize', [1n, 1n, ZERO, TX(1)]), 'InvalidPlayer');
    await expectRevert(c.send(ADMIN, 'recordPrize', [1n, 1n, player(1), TX(0)]), 'InvalidTxHash');
    await expectRevert(c.send(ADMIN, 'recordPrize', [1n, 1n, player(5), TX(1)]), 'NoPayoutWallet');
  });

  it('las rondas 1 y 6 son válidas', async () => {
    const c = await ready();
    await c.send(ADMIN, 'recordPrize', [1n, 1n, player(1), TX(1)]);
    await c.send(ADMIN, 'recordPrize', [6n, 3n, player(1), TX(6)]);
    assert.equal((await c.read('prizeOf', [6n, 3n])).txHash, TX(6));
  });
});

describe('leer premios', () => {
  it('prizesOf devuelve los 3 lugares en orden, vacíos si falta registrar', async () => {
    const c = await deploy({ start: null });
    await c.send(player(1), 'setPayoutWallet', [WALLET(1)]);
    await c.send(player(3), 'setPayoutWallet', [WALLET(3)]);
    await c.send(ADMIN, 'recordPrize', [4n, 1n, player(1), TX(1)]);
    await c.send(ADMIN, 'recordPrize', [4n, 3n, player(3), TX(3)]);
    const list = await c.read('prizesOf', [4n]);
    assert.equal(list.length, 3);
    assert.equal(list[0].player, player(1));
    assert.equal(list[1].player, ZERO);
    assert.equal(list[1].txHash, TX(0));
    assert.equal(list[2].wallet, WALLET(3));
  });

  it('prizeOf y prizesOf rechazan rondas y lugares fuera de rango', async () => {
    const c = await deploy({ start: null });
    await expectRevert(c.read('prizesOf', [0n]), 'InvalidRound');
    await expectRevert(c.read('prizesOf', [7n]), 'InvalidRound');
    await expectRevert(c.read('prizeOf', [1n, 4n]), 'InvalidPlace');
  });
});

describe('admin', () => {
  it('setAdmin pasa el puesto; el anterior pierde el acceso y el nuevo puede registrar', async () => {
    const c = await deploy({ start: null });
    await c.send(player(1), 'setPayoutWallet', [WALLET(1)]);
    const { events } = await c.send(ADMIN, 'setAdmin', [player(7)]);
    assert.equal(events[0].eventName, 'AdminChanged');
    assert.equal(await c.read('admin'), player(7));
    await expectRevert(c.send(ADMIN, 'recordPrize', [1n, 1n, player(1), TX(1)]), 'NotAdmin');
    await c.send(player(7), 'recordPrize', [1n, 1n, player(1), TX(1)]);
  });

  it('solo el admin cambia de admin y nunca a 0x000…', async () => {
    const c = await deploy({ start: null });
    await expectRevert(c.send(player(1), 'setAdmin', [player(1)]), 'NotAdmin');
    await expectRevert(c.send(ADMIN, 'setAdmin', [ZERO]), 'InvalidAdmin');
    assert.equal(await c.read('admin'), ADMIN);
  });
});


