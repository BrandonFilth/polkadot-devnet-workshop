import { describe, expect, it } from 'vitest';
import { autoReconnect, classifyTxError } from './txErrors';

const ONE = 10_000_000_000n;
const fmt = (v: bigint) => (Number(v) / 1e10).toFixed(2);
const classify = (error: unknown, pgas: bigint | null) => classifyTxError(error, pgas, ONE, fmt);

describe('clasificación de errores de transacción', () => {
  const payment = new Error('Transaction failed before inclusion: Invalid.Payment');

  it('Invalid.Payment con saldo suficiente es culpa de la firma, no del saldo', () => {
    const p = classify(payment, 229n * ONE);
    expect(p.kind).toBe('host-payment');
    expect(p.message).toContain('229.00 PGAS');
    expect(p.message).not.toMatch(/no tienes gas/i);
    expect(p.actions[0]).toBe('reconnect');
    expect(autoReconnect(p.kind)).toBe(true);
  });

  it('Invalid.Payment con exactamente 1 PGAS también es host-payment', () => {
    expect(classify(payment, ONE).kind).toBe('host-payment');
  });

  it('Invalid.Payment con saldo bajo pide gas', () => {
    const p = classify(payment, ONE / 2n);
    expect(p.kind).toBe('no-gas');
    expect(p.message).toContain('0.50 PGAS');
    expect(p.actions[0]).toBe('gas');
    expect(autoReconnect(p.kind)).toBe(false);
  });

  it('Invalid.Payment sin poder leer el saldo pide gas', () => {
    expect(classify(payment, null).kind).toBe('no-gas');
  });

  it('nonce o vigencia desfasados piden reconectar', () => {
    expect(classify(new Error('Invalid.Stale'), ONE).kind).toBe('session');
    expect(classify('Transaction is outdated', ONE).kind).toBe('session');
    expect(autoReconnect('session')).toBe(true);
  });

  it('firma rechazada se reintenta', () => {
    const p = classify(new Error('Mobile signing rejected: user rejected'), ONE);
    expect(p.kind).toBe('rejected');
    expect(p.actions).toEqual(['retry']);
    expect(classify({ tag: 'SigningRejected' }, ONE).kind).toBe('rejected');
  });

  it('sin respuesta y conexión perdida', () => {
    expect(classify(new Error('Firma: sin respuesta en 300 s'), ONE).kind).toBe('timeout');
    expect(classify(new Error('TxTimeout'), ONE).kind).toBe('timeout');
    expect(autoReconnect('timeout')).toBe(false);
    expect(classify(new Error('WebSocket disconnected'), ONE).kind).toBe('connection');
    expect(classify(new Error('Host provider is not connected'), ONE).kind).toBe('connection');
    expect(autoReconnect('connection')).toBe(true);
  });

  // Textos exactos de @parity/product-sdk-tx 0.4.7 (no es dependencia directa: se arman Error con el mismo name/message).
  const sdkError = (name: string, message: string) => Object.assign(new Error(message), { name });

  it('errores reales del SDK: rechazada, sin respuesta y sin gas', () => {
    expect(classify(sdkError('TxSigningRejectedError', 'Transaction signing was rejected.'), ONE).kind).toBe('rejected');
    const timeout = sdkError('TxTimeoutError', 'Transaction timed out after 300s. The transaction may still be processing on-chain.');
    expect(classify(timeout, ONE).kind).toBe('timeout');
    expect(classify(sdkError('TxValidityError', 'Transaction failed before inclusion: Invalid.Payment'), 0n).kind).toBe('no-gas');
    expect(classify(new Error('Conexión de firma: sin respuesta en 60 s'), ONE).kind).toBe('timeout');
  });

  it('rechazada, sin respuesta y otro dan mensajes distintos', () => {
    const messages = [
      classify(sdkError('TxSigningRejectedError', 'Transaction signing was rejected.'), ONE).message,
      classify(sdkError('TxTimeoutError', 'Transaction timed out after 300s. The transaction may still be processing on-chain.'), ONE).message,
      classify(new Error('algo raro'), ONE).message,
    ];
    expect(new Set(messages).size).toBe(3);
  });

  it('cualquier otro error conserva el texto crudo para los detalles', () => {
    const p = classify({ type: 'Module', value: { type: 'Revive' } }, ONE);
    expect(p.kind).toBe('other');
    expect(p.raw).toContain('Revive');
    expect(autoReconnect(p.kind)).toBe(false);
  });
});
