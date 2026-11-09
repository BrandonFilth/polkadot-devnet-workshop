import { describe, expect, it } from 'vitest';
import {
  DATE_REQUIRED,
  eventStarted,
  formatStart,
  inputsFromUnix,
  isAdminAccount,
  notOpenText,
  parseDate,
  parseTime,
  startFromInputs,
  TIME_INVALID,
  zonedToUnix,
} from './eventStart';

/** 9 nov 2026, 00:00:00 en México (UTC−6) = 06:00 UTC. */
const NOV9 = 1_794_204_000;

describe('hora de México ↔ Unix', () => {
  it('9 nov 2026 00/00/00 en México es 1794204000', () => {
    expect(zonedToUnix({ year: 2026, month: 11, day: 9, hour: 0, minute: 0, second: 0 })).toBe(NOV9);
    expect(startFromInputs('2026-11-09', '00/00/00')).toEqual({ ok: true, start: BigInt(NOV9) });
  });

  it('respeta horas, minutos y segundos', () => {
    expect(startFromInputs('2026-11-09', '13/45/30')).toEqual({ ok: true, start: BigInt(NOV9 + 13 * 3600 + 45 * 60 + 30) });
  });

  it('ida y vuelta: inputsFromUnix da los mismos campos', () => {
    expect(inputsFromUnix(NOV9)).toEqual({ date: '2026-11-09', time: '00/00/00' });
    expect(inputsFromUnix(NOV9 + 23 * 3600 + 59 * 60 + 59)).toEqual({ date: '2026-11-09', time: '23/59/59' });
    for (const sec of [NOV9, NOV9 + 1, 1_800_000_000, 1_767_225_600]) {
      const v = inputsFromUnix(sec);
      expect(startFromInputs(v.date, v.time)).toEqual({ ok: true, start: BigInt(sec) });
    }
  });

  it('otra zona con horario de verano también cuadra', () => {
    // 1 jul 2026 12:00 en Nueva York (UTC−4) = 16:00 UTC.
    expect(zonedToUnix({ year: 2026, month: 7, day: 1, hour: 12, minute: 0, second: 0 }, 'America/New_York')).toBe(
      Date.UTC(2026, 6, 1, 16) / 1000,
    );
  });

  it('formatStart dice la fecha, la hora hh/mm/ss y la zona', () => {
    expect(formatStart(NOV9)).toBe('9 nov 2026, 00/00/00 (hora de México)');
  });
});

describe('campos del panel de admin', () => {
  it('parseTime acepta hh/mm/ss de 24 horas (y «:»)', () => {
    expect(parseTime('00/00/00')).toEqual({ hour: 0, minute: 0, second: 0 });
    expect(parseTime('23/59/59')).toEqual({ hour: 23, minute: 59, second: 59 });
    expect(parseTime('9/05/07')).toEqual({ hour: 9, minute: 5, second: 7 });
    expect(parseTime('09:05:07')).toEqual({ hour: 9, minute: 5, second: 7 });
  });

  it('parseTime rechaza horas fuera de rango o mal escritas', () => {
    for (const bad of ['24/00/00', '12/60/00', '12/00/60', '12/00', '', 'aa/bb/cc', '12/0/00']) expect(parseTime(bad)).toBeNull();
  });

  it('parseDate solo acepta fechas reales AAAA-MM-DD', () => {
    expect(parseDate('2026-11-09')).toEqual({ year: 2026, month: 11, day: 9 });
    for (const bad of ['', '2026-02-30', '2026-13-01', '09/11/2026']) expect(parseDate(bad)).toBeNull();
  });

  it('startFromInputs explica qué falta', () => {
    expect(startFromInputs('', '00/00/00')).toEqual({ ok: false, message: DATE_REQUIRED });
    expect(startFromInputs('2026-11-09', '25/00/00')).toEqual({ ok: false, message: TIME_INVALID });
  });
});

describe('evento y admin', () => {
  it('eventStarted: sin fecha, antes y desde el segundo de inicio', () => {
    expect(eventStarted(0n, NOV9 + 10)).toBe(false);
    expect(eventStarted(BigInt(NOV9), NOV9 - 1)).toBe(false);
    expect(eventStarted(BigInt(NOV9), NOV9)).toBe(true);
    expect(eventStarted(BigInt(NOV9), NOV9 + 0.5)).toBe(true);
  });

  it('isAdminAccount compara sin mayúsculas y es false sin cuenta o sin evento', () => {
    const admin = `0x${'Ab'.repeat(20)}` as `0x${string}`;
    const event = { admin, start: 0n };
    expect(isAdminAccount(event, admin.toLowerCase())).toBe(true);
    expect(isAdminAccount(event, `0x${'1'.repeat(40)}`)).toBe(false);
    expect(isAdminAccount(event, null)).toBe(false);
    expect(isAdminAccount(null, admin)).toBe(false);
  });

  it('notOpenText: sin fecha o con la fecha de apertura', () => {
    expect(notOpenText(0n)).toBe('El ranking todavía no tiene fecha de inicio.');
    expect(notOpenText(BigInt(NOV9))).toBe('El ranking abre el 9 nov 2026, 00/00/00 (hora de México).');
  });
});
