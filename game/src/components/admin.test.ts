import { describe, expect, it } from 'vitest';
import css from '../styles.css?raw';
import { START_LOCKED_MESSAGE } from '../contract/errors';
import { DATE_REQUIRED, TIME_INVALID } from '../contract/eventStart';
import adminSource from './Admin.ts?raw';
import { ADMIN_NOW_LABEL, adminInfo, adminPreview, formatTimeTyping, PAST_START_WARNING } from './Admin';
import { inicioView } from './Inicio';

const NOV9 = 1_794_204_000;
const PERIOD = 259_200n;

describe('panel de admin: lo que muestra', () => {
  it('sin fecha de inicio: lo dice y deja guardar', () => {
    expect(adminInfo({ current: 0, start: 0n, length: PERIOD, started: false }, NOV9 - 100)).toEqual({
      start: 'Sin fecha de inicio',
      period: 'El ranking todavía no abre',
      locked: false,
      lockedText: null,
    });
  });

  it('con fecha futura: la muestra y deja cambiarla', () => {
    const v = adminInfo({ current: 0, start: BigInt(NOV9), length: PERIOD, started: false }, NOV9 - 100);
    expect(v.start).toBe('9 nov 2026, 00/00/00 (hora de México)');
    expect(v.period).toBe('El ranking todavía no abre');
    expect(v.locked).toBe(false);
  });

  it('con el ranking abierto: periodo actual con sus fechas y formulario bloqueado', () => {
    const v = adminInfo({ current: 1, start: BigInt(NOV9), length: PERIOD, started: true }, NOV9 + 4 * 86_400);
    expect(v.period).toBe('Periodo 1 · 12–15 nov');
    expect(v.locked).toBe(true);
    expect(v.lockedText).toBe(START_LOCKED_MESSAGE);
  });
});

describe('panel de admin: campos', () => {
  it('vista previa de una fecha futura, sin aviso', () => {
    expect(adminPreview('2026-11-09', '00/00/00', NOV9 - 3600)).toEqual({
      ok: true,
      start: BigInt(NOV9),
      text: 'Se guardará: 9 nov 2026, 00/00/00 (hora de México)',
      warning: null,
    });
  });

  it('una hora que ya llegó (como «Usar fecha y hora actual») avisa que abre y se bloquea', () => {
    const p = adminPreview('2026-11-09', '00/00/00', NOV9);
    expect(p.ok && p.warning).toBe(PAST_START_WARNING);
    const past = adminPreview('2026-11-08', '12/00/00', NOV9);
    expect(past.ok && past.warning).toBe(PAST_START_WARNING);
  });

  it('errores de los campos', () => {
    expect(adminPreview('', '00/00/00', NOV9)).toEqual({ ok: false, message: DATE_REQUIRED });
    expect(adminPreview('2026-11-09', '99/00/00', NOV9)).toEqual({ ok: false, message: TIME_INVALID });
  });

  it('la hora se escribe con «/» automáticos y solo dígitos', () => {
    expect(formatTimeTyping('0')).toBe('0');
    expect(formatTimeTyping('093')).toBe('09/3');
    expect(formatTimeTyping('093015')).toBe('09/30/15');
    expect(formatTimeTyping('09/30/15')).toBe('09/30/15');
    expect(formatTimeTyping('09:30:15:99')).toBe('09/30/15');
    expect(formatTimeTyping('ab')).toBe('');
  });

  it('el panel tiene selector de fecha, hora hh/mm/ss y el botón de fecha y hora actual', () => {
    expect(adminSource).toMatch(/type = 'date'/);
    expect(adminSource).toMatch(/placeholder = '00\/00\/00'/);
    expect(ADMIN_NOW_LABEL).toBe('Usar fecha y hora actual');
    expect(adminSource).toMatch(/hub\.setStartTime\(/);
    // Ninguna pantalla firma directo: todo pasa por el Hub (AGENTS.md).
    expect(adminSource).not.toMatch(/\.tx\(/);
  });

  it('usa el modal opaco de siempre', () => {
    expect(adminSource).toMatch(/className = 'modal admin'/);
    expect(adminSource).toMatch(/className = 'modal-box'/);
    expect(css).toMatch(/\.admin-info\s*\{/);
  });
});

describe('botón Admin en la pantalla de inicio', () => {
  const base = { host: 'listo' as const, connected: true, mine: { best: 0n, lifetime: 0n, username: '' }, busy: false };

  it('solo aparece con la cuenta admin conectada', () => {
    expect(inicioView({ ...base, admin: true }).admin).toEqual({ disabled: false });
    expect(inicioView({ ...base, admin: false }).admin).toBeNull();
    expect(inicioView(base).admin).toBeNull();
  });

  it('sin cuenta o fuera del Host nunca aparece, aunque se diga admin', () => {
    expect(inicioView({ ...base, connected: false, admin: true }).admin).toBeNull();
    expect(inicioView({ ...base, host: 'fuera', connected: false, admin: true }).admin).toBeNull();
  });

  it('con una firma en curso queda deshabilitado', () => {
    expect(inicioView({ ...base, admin: true, busy: true }).admin).toEqual({ disabled: true });
  });
});
