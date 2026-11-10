import { describe, expect, it } from 'vitest';
import {
  decodePrizes,
  parseTxHash,
  parseWallet,
  periodOfRound,
  placeLabel,
  usd,
  PRIZE_AMOUNTS,
  PRIZE_PER_ROUND,
  PRIZE_ROUNDS,
  PRIZE_TOTAL,
  prizeAmountOf,
  roundOfPeriod,
  roundStatus,
  txUrl,
  walletOrNull,
  WALLET_EMPTY,
  WALLET_INVALID,
  winnersOf,
} from './prizes';

const A = `0x${'ab'.repeat(20)}` as const;
const B = `0x${'cd'.repeat(20)}` as const;
const WALLET = '0x52908400098527886E0F7030069857D2E4169EE7'; // checksum EIP-55
const HASH = `0x${'1f'.repeat(32)}`;

describe('premios: montos y rondas', () => {
  it('8, 5 y 3 USDT; 16 por ronda; 6 rondas; 96 en total', () => {
    expect(PRIZE_AMOUNTS).toEqual([8, 5, 3]);
    expect(PRIZE_PER_ROUND).toBe(16);
    expect(PRIZE_ROUNDS).toBe(6);
    expect(PRIZE_TOTAL).toBe(96);
    expect([1, 2, 3].map(prizeAmountOf)).toEqual([8, 5, 3]);
    expect(() => prizeAmountOf(4)).toThrow(RangeError);
    expect(placeLabel(1)).toBe('1.º');
    expect(usd(8)).toBe('$8 USDT');
    expect(usd(5, false)).toBe('$5');
  });

  it('la ronda N es el periodo N-1; después de la 6 no hay ronda con premio', () => {
    expect(roundOfPeriod(0)).toBe(1);
    expect(roundOfPeriod(5)).toBe(6);
    expect(roundOfPeriod(6)).toBeNull();
    expect(periodOfRound(1)).toBe(0);
    expect(periodOfRound(6)).toBe(5);
  });

  it('estado de cada ronda', () => {
    const base = { started: true, currentPeriod: 2, paid: 0 };
    expect(roundStatus(1, { ...base, started: false })).toBe('por-jugar');
    expect(roundStatus(4, base)).toBe('por-jugar');
    expect(roundStatus(3, base)).toBe('en-juego');
    expect(roundStatus(2, base)).toBe('por-pagar');
    expect(roundStatus(2, { ...base, paid: 2 })).toBe('por-pagar');
    expect(roundStatus(1, { ...base, paid: 3 })).toBe('pagada');
  });
});

describe('wallet de premios', () => {
  it('acepta una dirección EVM con o sin checksum y la normaliza', () => {
    expect(parseWallet(WALLET)).toEqual({ ok: true, wallet: WALLET });
    expect(parseWallet(`  ${WALLET.toLowerCase()} `)).toEqual({ ok: true, wallet: WALLET });
    expect(parseWallet(WALLET.toUpperCase().replace('0X', '0x'))).toEqual({ ok: true, wallet: WALLET });
  });

  it('rechaza vacío, texto que no es dirección y la dirección 0x000…', () => {
    expect(parseWallet('')).toEqual({ ok: false, message: WALLET_EMPTY });
    for (const bad of ['0x123', 'hola', `${WALLET}00`, 'TXYZ1234567890123456789012345678901', `0x${'0'.repeat(40)}`]) {
      expect(parseWallet(bad)).toEqual({ ok: false, message: WALLET_INVALID });
    }
  });

  it('los mensajes no asustan: no hablan de perder fondos', () => {
    for (const m of [WALLET_EMPTY, WALLET_INVALID]) expect(m).not.toMatch(/perder|perderás|fondos/i);
  });

  it('walletOrNull: 0x000… y basura → null; una dirección → con checksum', () => {
    expect(walletOrNull(`0x${'0'.repeat(40)}`)).toBeNull();
    expect(walletOrNull(undefined)).toBeNull();
    expect(walletOrNull(WALLET.toLowerCase())).toBe(WALLET);
  });
});

describe('hash del pago', () => {
  it('saca el hash del enlace de BscScan o del hash pegado', () => {
    expect(parseTxHash(HASH)).toBe(HASH);
    expect(parseTxHash(`https://bscscan.com/tx/${HASH.toUpperCase().replace('0X', '0x')}`)).toBe(HASH);
    expect(parseTxHash(` https://bscscan.com/tx/${HASH}?x=1 `)).toBe(HASH);
  });

  it('rechaza lo que no es un hash de 32 bytes, y el hash vacío', () => {
    for (const bad of ['', '0x1234', `${HASH}ff`, `0x${'0'.repeat(64)}`, 'https://bscscan.com/address/0x12']) expect(parseTxHash(bad)).toBeNull();
  });

  it('el enlace del pago apunta al explorador de la red de premios', () => {
    expect(txUrl(HASH)).toBe(`https://bscscan.com/tx/${HASH}`);
  });
});

describe('decodePrizes', () => {
  it('acepta tuplas y objetos y devuelve solo los lugares pagados, con su monto', () => {
    const list = [
      { player: A, wallet: WALLET, txHash: HASH, paidAt: 1_800_000_000n },
      { player: `0x${'0'.repeat(40)}`, wallet: `0x${'0'.repeat(40)}`, txHash: `0x${'0'.repeat(64)}`, paidAt: 0n },
      [B, WALLET, HASH, 1_800_000_100n],
    ];
    const r = decodePrizes(list);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ place: 1, amount: 8, txHash: HASH, paidAt: 1_800_000_000 });
    expect(r[1]).toMatchObject({ place: 3, amount: 3, paidAt: 1_800_000_100 });
    expect(decodePrizes(undefined)).toEqual([]);
  });
});

describe('ganadores para el admin', () => {
  const top = [
    { address: A, username: 'ana', score: 900n, wallet: WALLET as `0x${string}` },
    { address: B, username: '', score: 500n, wallet: null },
    { address: `0x${'ef'.repeat(20)}` as `0x${string}`, username: 'luis', score: 100n },
    { address: `0x${'12'.repeat(20)}` as `0x${string}`, username: 'cuarto', score: 50n },
  ];

  it('solo el top 3, con su monto; registrar si tiene wallet, sin-wallet si no', () => {
    const rows = winnersOf(top, []);
    expect(rows.map((r) => [r.place, r.amount, r.action])).toEqual([
      [1, 8, 'registrar'],
      [2, 5, 'sin-wallet'],
      [3, 3, 'sin-wallet'],
    ]);
  });

  it('un lugar ya registrado queda como pagado', () => {
    const paid = decodePrizes([{ player: A, wallet: WALLET, txHash: HASH, paidAt: 1n }]);
    const rows = winnersOf(top, paid);
    expect(rows[0]!.action).toBe('pagado');
    expect(rows[0]!.paid?.txHash).toBe(HASH);
  });

  it('el orden del ranking decide los lugares (en empate ya viene primero quien llegó antes)', () => {
    const tie = [
      { address: A, username: 'primero', score: 100n, wallet: WALLET as `0x${string}` },
      { address: B, username: 'segundo', score: 100n, wallet: WALLET as `0x${string}` },
    ];
    expect(winnersOf(tie, []).map((r) => r.username)).toEqual(['primero', 'segundo']);
  });
});
