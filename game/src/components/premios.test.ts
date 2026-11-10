import { describe, expect, it } from 'vitest';
import { decodePrizes } from '../contract/prizes';
import adminPremiosSource from './AdminPremios.ts?raw';
import premiosSource from './Premios.ts?raw';
import { defaultRound, TX_INPUT_INVALID } from './AdminPremios';
import { walletReminder } from './FinDePartida';
import { perfilView, WALLET_HINT } from './Perfil';
import { roundCardText, roundRows } from './Premios';

const NOV9 = 1_794_204_000;
const PERIOD = 259_200n;
const WALLET = '0x52908400098527886E0F7030069857D2E4169EE7' as const;
const HASH = `0x${'1f'.repeat(32)}`;
const A = `0x${'ab'.repeat(20)}` as `0x${string}`;
const periods = (current: number, started = true) => ({ current, start: BigInt(NOV9), length: PERIOD, started });

describe('tarjeta de la ronda', () => {
  it('antes del evento: cuándo abre', () => {
    expect(roundCardText(periods(0, false), NOV9 - 100)).toEqual({
      title: '6 rondas con premio',
      line: 'El ranking abre el 9 nov 2026, 00/00/00 (hora de México).',
    });
  });

  it('en el evento: ronda N de 6 con sus fechas y cuánto falta', () => {
    const t = roundCardText(periods(1), NOV9 + 4 * 86_400);
    expect(t.title).toBe('Ronda 2 de 6');
    expect(t.line).toBe('12–15 nov · Cierra en 2 d 0 h');
  });

  it('después de la ronda 6: terminadas', () => {
    expect(roundCardText(periods(6), NOV9 + 19 * 86_400).title).toBe('Rondas con premio terminadas');
  });
});

describe('historial de premios', () => {
  it('las 6 rondas con estado; los pagos traen nombre, monto y enlace a la transacción', () => {
    const paid = new Map([[1, decodePrizes([{ player: A, wallet: WALLET, txHash: HASH, paidAt: 1n }])]]);
    const rows = roundRows(periods(2), paid, new Map([[A.toLowerCase(), 'ana']]), NOV9 + 7 * 86_400);
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.status)).toEqual(['por-pagar', 'por-pagar', 'en-juego', 'por-jugar', 'por-jugar', 'por-jugar']);
    expect(rows[0]!.label).toBe('Ronda 1 · 9–12 nov');
    expect(rows[0]!.winners).toEqual([
      { place: '1.º', name: 'ana', amount: 8, wallet: '0x5290…9EE7', url: `https://bscscan.com/tx/${HASH}` },
    ]);
  });

  it('sin fecha de inicio: rondas sin fechas', () => {
    expect(roundRows({ current: 0, start: 0n, length: PERIOD, started: false }, new Map(), new Map(), NOV9)[0]!.label).toBe('Ronda 1');
  });

  it('textos de Premios: montos, red BEP20, Binance recomendado, Nova Wallet como alternativa y empates', () => {
    expect(premiosSource).toMatch(/Binance/);
    expect(premiosSource).toMatch(/Nova Wallet/);
    expect(premiosSource).toMatch(/gana quien llegó primero/);
    expect(premiosSource).toMatch(/PRIZE_NETWORK/);
    expect(premiosSource).not.toMatch(/perder|fondos/i);
  });
});

describe('perfil', () => {
  const base = { host: 'listo' as const, connected: true, mine: { best: 0n, lifetime: 0n, username: 'ana' }, payout: null, busy: false, admin: false };

  it('sin wallet: lo dice y deja registrarla; con wallet: a dónde llegan los premios', () => {
    expect(perfilView(base).wallet).toEqual({ text: 'Todavía no registras una wallet.', saved: false, editable: true, hint: WALLET_HINT });
    const w = perfilView({ ...base, payout: WALLET }).wallet;
    expect(w.text).toBe('Tus premios llegan a 0x5290…9EE7');
    expect(w.saved).toBe(true);
  });

  it('sin cuenta: no se edita la wallet ni se muestra username; fuera del Host dice dónde abrir', () => {
    const v = perfilView({ ...base, connected: false, mine: null });
    expect(v.wallet.editable).toBe(false);
    expect(v.username).toBeNull();
    expect(perfilView({ ...base, host: 'fuera', connected: false }).account.state).toBe('fuera');
  });

  it('el panel de admin solo con la cuenta admin conectada', () => {
    expect(perfilView({ ...base, admin: true }).admin).toBe(true);
    expect(perfilView({ ...base, admin: true, connected: false }).admin).toBe(false);
    expect(perfilView(base).admin).toBe(false);
  });

  it('con una firma en curso no se edita', () => {
    expect(perfilView({ ...base, busy: true }).wallet.editable).toBe(false);
    expect(perfilView({ ...base, busy: true }).username?.disabled).toBe(true);
  });

  it('la recomendación nombra Binance (BEP20) y Nova Wallet sin asustar', () => {
    expect(WALLET_HINT).toMatch(/Binance/);
    expect(WALLET_HINT).toMatch(/BEP20/);
    expect(WALLET_HINT).toMatch(/Nova Wallet/);
    expect(WALLET_HINT).not.toMatch(/perder|fondos/i);
  });
});

describe('recordatorio de la wallet en cada récord', () => {
  it('solo después de guardar; sin wallet invita a agregarla, con wallet dice a dónde llega', () => {
    expect(walletReminder(false, null)).toBeNull();
    expect(walletReminder(true, undefined)).toBeNull();
    expect(walletReminder(true, null)).toEqual({
      text: 'Agrega tu wallet para recibir tu premio en USDT si quedas en el top 3.',
      action: 'Agregar wallet',
    });
    expect(walletReminder(true, WALLET)).toEqual({ text: 'Si quedas en el top 3, tu premio llega a 0x5290…9EE7.', action: 'Cambiar wallet' });
  });
});

describe('panel de pago de premios (admin)', () => {
  it('abre en la última ronda cerrada', () => {
    expect(defaultRound(null)).toBe(1);
    expect(defaultRound({ started: false, current: 0 })).toBe(1);
    expect(defaultRound({ started: true, current: 0 })).toBe(1);
    expect(defaultRound({ started: true, current: 3 })).toBe(3);
    expect(defaultRound({ started: true, current: 9 })).toBe(6);
  });

  it('copia la wallet, valida el enlace o hash y registra con hub.recordPrize; nunca llama .tx()', () => {
    expect(adminPremiosSource).toMatch(/copyText\(wallet\)/);
    expect(adminPremiosSource).toMatch(/parseTxHash\(input\.value\)/);
    expect(adminPremiosSource).toMatch(/hub\.recordPrize\(round, w\.place, w\.player, hash\)/);
    expect(adminPremiosSource).not.toMatch(/\.tx\(/);
    expect(TX_INPUT_INVALID).toMatch(/BscScan/);
  });
});
