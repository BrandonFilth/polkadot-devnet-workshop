import { describe, expect, it } from 'vitest';
import { formatCountdown, formatPeriod, historyPeriods, periodRange } from './periods';

const DAY = 86_400;
const LENGTH = 259_200n; // 3 días
/** Medianoche de Monterrey (UTC−6) del día dado, en segundos Unix. `month` empieza en 0. */
const midnight = (year: number, month: number, day: number) => Date.UTC(year, month, day, 6) / 1000;
const range = (startsAt: number) => ({ startsAt, endsAt: startsAt + Number(LENGTH) });
const IN_2026 = midnight(2026, 5, 15);

describe('periodRange', () => {
  const start = BigInt(midnight(2026, 10, 1));
  it.each([0, 1, 5])('periodo %i: [start + p·L, start + (p+1)·L)', (p) => {
    const startsAt = Number(start) + p * 3 * DAY;
    expect(periodRange(start, LENGTH, p)).toEqual({ startsAt, endsAt: startsAt + 3 * DAY });
  });
});

describe('historyPeriods', () => {
  it('sin periodos anteriores: vacío', () => {
    expect(historyPeriods(0, 10)).toEqual([]);
  });

  it('el más reciente primero, sin bajar de 0', () => {
    expect(historyPeriods(1, 10)).toEqual([0]);
    expect(historyPeriods(5, 10)).toEqual([4, 3, 2, 1, 0]);
  });

  it('como máximo `max` periodos', () => {
    expect(historyPeriods(15, 10)).toEqual([14, 13, 12, 11, 10, 9, 8, 7, 6, 5]);
  });
});

describe('formatPeriod (Monterrey)', () => {
  it('mismo mes: «25–28 nov» sin espacios', () => {
    expect(formatPeriod(range(midnight(2026, 10, 25)), IN_2026)).toBe('25–28 nov');
  });

  it('meses distintos: «29 nov – 2 dic» con espacios', () => {
    expect(formatPeriod(range(midnight(2026, 10, 29)), IN_2026)).toBe('29 nov – 2 dic');
  });

  it('cambio de año visto desde 2026: año en los dos extremos', () => {
    expect(formatPeriod(range(midnight(2026, 11, 30)), IN_2026)).toBe('30 dic 2026 – 2 ene 2027');
  });

  it('un periodo de otro año lleva año', () => {
    expect(formatPeriod(range(midnight(2025, 10, 25)), IN_2026)).toBe('25–28 nov 2025');
  });

  it('borde de medianoche: 06:00:00Z ya es el día nuevo, 05:59:59Z todavía el anterior', () => {
    const start = Date.UTC(2026, 10, 25, 6) / 1000;
    expect(formatPeriod(range(start), IN_2026)).toBe('25–28 nov');
    expect(formatPeriod(range(start - 1), IN_2026)).toBe('24–27 nov');
  });
});

describe('formatCountdown', () => {
  it.each([
    [2 * DAY + 5 * 3_600, 'Se reinicia en 2 d 5 h'],
    [3 * 3_600 + 10 * 60, 'Se reinicia en 3 h 10 min'],
    [12 * 60, 'Se reinicia en 12 min'],
    [30, 'Se reinicia en menos de 1 min'],
    [0, 'Se reinicia en menos de 1 min'],
  ])('%i s → %s', (seconds, text) => {
    expect(formatCountdown(seconds)).toBe(text);
  });
});
