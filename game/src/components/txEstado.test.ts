import { describe, expect, it } from 'vitest';
import { advance, begin, finish } from '../hub/progress';
import txSource from './TxEstado.ts?raw';
import { canCopyDetails, diagnosticReport, txPopupView } from './TxEstado';

describe('popup de estados: «Copiar detalles»', () => {
  const failed = finish(advance(begin('username'), 'firma'), {
    ok: false,
    message: 'Tienes 54.98 PGAS, pero la Polkadot App no aplicó el pago de la comisión.',
    kind: 'host-payment',
    details: 'intento 1: host-payment · PGAS 54.98\nError: Invalid.Payment',
  });

  it('solo en un error que trae detalles', () => {
    expect(canCopyDetails(failed)).toBe(true);
    expect(canCopyDetails(finish(begin('guardar'), { ok: false, message: 'Revirtió.' }))).toBe(false);
    expect(canCopyDetails(finish(begin('guardar'), { ok: true, message: 'ok' }))).toBe(false);
    expect(canCopyDetails(begin('guardar'))).toBe(false);
    expect(canCopyDetails(null)).toBe(false);
  });

  it('el reporte trae operación, pasos, tipo, mensaje, cuenta, contrato, navegador y el error completo', () => {
    const r = diagnosticReport(failed, {
      account: { h160: `0x${'1'.repeat(40)}`, ss58: '5Cuenta' },
      allowance: 'Allocated',
      userAgent: 'PolkadotApp/1.2 Android',
      now: new Date('2026-11-05T15:44:00Z'),
    });
    for (const part of [
      'fecha: 2026-11-05T15:44:00.000Z',
      'operación: username',
      'pasos alcanzados: simulando → firma',
      'tipo: host-payment',
      'mensaje: Tienes 54.98 PGAS',
      `cuenta H160: 0x${'1'.repeat(40)}`,
      'cuenta SS58: 5Cuenta',
      'permiso de gas: Allocated',
      'chainId 420420417',
      'navegador: PolkadotApp/1.2 Android',
      'Error: Invalid.Payment',
    ]) {
      expect(r).toContain(part);
    }
  });

  it('el botón usa el portapapeles y solo aparece cuando el popup se puede cerrar', () => {
    expect(txSource).toMatch(/copyText\(report/);
    expect(txSource).toMatch(/copy\.hidden = !\(view\.closable && canCopyDetails\(s\.progress\)\)/);
  });
});

describe('popup de estados', () => {
  it('sin progreso: cerrado', () => {
    expect(txPopupView(null, false, null).open).toBe(false);
  });

  it('en curso: abierto y no se puede cerrar', () => {
    const p = advance(begin('guardar'), 'firma');
    expect(txPopupView(p, true, null)).toEqual({ open: true, closable: false, title: 'Guardando récord', tone: 'curso' });
    expect(txPopupView(begin('conectar'), true, null).title).toBe('Conectando');
    expect(txPopupView(begin('username'), true, null).title).toBe('Guardando username');
  });

  it('listo sin cerrar: abierto, se puede cerrar y dice Listo', () => {
    const p = finish(begin('guardar'), { ok: true, message: 'Récord guardado: 500.' });
    expect(txPopupView(p, false, null)).toEqual({ open: true, closable: true, title: 'Listo', tone: 'listo' });
  });

  it('error por firma rechazada: título del tipo de error', () => {
    const p = finish(advance(begin('guardar'), 'firma'), { ok: false, message: 'No se aprobó.', kind: 'rejected' });
    expect(txPopupView(p, false, null)).toMatchObject({ open: true, closable: true, title: 'Firma rechazada o cancelada', tone: 'error' });
  });

  it('cerrado el mismo resultado: queda cerrado', () => {
    const p = finish(begin('guardar'), { ok: true, message: 'ok' });
    expect(txPopupView(p, false, p).open).toBe(false);
  });

  it('una operación nueva después de cerrar lo vuelve a abrir', () => {
    const old = finish(begin('guardar'), { ok: true, message: 'ok' });
    const next = begin('username');
    expect(txPopupView(next, true, old)).toMatchObject({ open: true, closable: false });
  });
});
