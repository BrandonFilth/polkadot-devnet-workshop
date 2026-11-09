/*
 * Hora de inicio del evento (startTime del contrato), en la hora de México (RANKING_TIME_ZONE).
 * Funciones puras, sin DOM: convertir la fecha (AAAA-MM-DD, la del selector de fecha) y la hora
 * (hh/mm/ss, de 24 horas) a segundos Unix y al revés, y los textos que ve la pantalla.
 */
import { RANKING_TIME_ZONE } from './config';

/** Lo que el contrato dice del evento. `start` = 0n: el admin aún no fija la hora de inicio. */
export interface EventInfo {
  admin: `0x${string}`;
  start: bigint;
}

/** El ranking ya abrió: hay hora de inicio y ya llegó (misma regla que isStarted() del contrato). */
export function eventStarted(start: bigint, nowSec: number): boolean {
  return start !== 0n && BigInt(Math.floor(nowSec)) >= start;
}

/** La cuenta conectada es el admin del contrato (sin importar mayúsculas). */
export function isAdminAccount(event: EventInfo | null, h160: string | null | undefined): boolean {
  return !!event && !!h160 && event.admin.toLowerCase() === h160.toLowerCase();
}

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Fecha y hora de `sec` en la zona `tz`. */
function zoned(sec: number, tz: string): Parts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(sec * 1000));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute'), second: get('second') };
}

const asUtc = (p: Parts) => Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) / 1000;

/** Segundos Unix de una fecha y hora de pared en la zona `tz` (respeta cambios de horario si los hay). */
export function zonedToUnix(p: Parts, tz: string = RANKING_TIME_ZONE): number {
  const wall = asUtc(p);
  let guess = wall;
  // Dos vueltas bastan: la diferencia entre la hora de pared y UTC es el desfase de la zona.
  for (let i = 0; i < 2; i++) guess = wall - (asUtc(zoned(guess, tz)) - guess);
  return guess;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Hora `hh/mm/ss` (24 horas). También acepta `:` como separador. null si no es válida. */
export function parseTime(text: string): { hour: number; minute: number; second: number } | null {
  const m = /^\s*(\d{1,2})[/:](\d{2})[/:](\d{2})\s*$/.exec(text);
  if (!m) return null;
  const [hour, minute, second] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { hour, minute, second };
}

/** Fecha `AAAA-MM-DD` (la del input type="date"). null si no es una fecha real. */
export function parseDate(text: string): { year: number; month: number; day: number } | null {
  const m = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(text);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return { year, month, day };
}

export type StartInput = { ok: true; start: bigint } | { ok: false; message: string };

export const DATE_REQUIRED = 'Elige la fecha de inicio.';
export const TIME_INVALID = 'Escribe la hora como hh/mm/ss, de 00/00/00 a 23/59/59.';

/** Fecha + hora (hora de México) → startTime para el contrato. */
export function startFromInputs(date: string, time: string, tz: string = RANKING_TIME_ZONE): StartInput {
  const d = parseDate(date);
  if (!d) return { ok: false, message: DATE_REQUIRED };
  const t = parseTime(time);
  if (!t) return { ok: false, message: TIME_INVALID };
  const start = zonedToUnix({ ...d, ...t }, tz);
  if (start <= 0) return { ok: false, message: 'La fecha de inicio no es válida.' };
  return { ok: true, start: BigInt(start) };
}

/** Segundos Unix → valores para los campos: fecha `AAAA-MM-DD` y hora `hh/mm/ss` en la hora de México. */
export function inputsFromUnix(sec: number, tz: string = RANKING_TIME_ZONE): { date: string; time: string } {
  const p = zoned(Math.floor(sec), tz);
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}/${pad(p.minute)}/${pad(p.second)}` };
}

/** «9 nov 2026, 00/00/00 (hora de México)». */
export function formatStart(sec: number, tz: string = RANKING_TIME_ZONE): string {
  const p = zoned(Math.floor(sec), tz);
  const month = new Intl.DateTimeFormat('es-MX', { timeZone: tz, month: 'short' })
    .format(new Date(sec * 1000))
    .replace(/\.$/, '');
  return `${p.day} ${month} ${p.year}, ${pad(p.hour)}/${pad(p.minute)}/${pad(p.second)} (hora de México)`;
}

/** Aviso del ranking antes de que abra. */
export function notOpenText(start: bigint, tz: string = RANKING_TIME_ZONE): string {
  return start === 0n ? 'El ranking todavía no tiene fecha de inicio.' : `El ranking abre el ${formatStart(Number(start), tz)}.`;
}
