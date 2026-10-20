import { describe, expect, it } from 'vitest';
import { advance, begin, finish } from '../hub/progress';
import { txPopupView } from './TxEstado';

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
