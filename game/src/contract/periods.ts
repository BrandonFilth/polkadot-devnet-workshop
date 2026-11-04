/*
 * Periodos del ranking (3 días cada uno, los cuenta el contrato): límites, lista del historial,
 * etiqueta de fechas y contador del reinicio. Funciones puras, sin DOM.
 *
 * Etiqueta: día inicial = startsAt y día final = endsAt (el día en que se reinicia), en la zona del
 * ranking (Monterrey). Mismo mes: «25–28 nov». Meses distintos: «29 nov – 2 dic». El año solo se
 * muestra si el año de alguno de los dos extremos no es el año de `nowSec`, y entonces va en los dos:
 * «29 dic 2026 – 1 ene 2027» o «25–28 nov 2025».
 */
import { RANKING_TIME_ZONE } from './config';

/** Límites de un periodo en segundos Unix: [startsAt, endsAt). */
export interface PeriodRange {
  startsAt: number;
  endsAt: number;
}

/** Límites del periodo `p` a partir de startTime y PERIOD_LENGTH del contrato. */
export function periodRange(start: bigint, length: bigint, p: number): PeriodRange {
  const startsAt = start + BigInt(p) * length;
  return { startsAt: Number(startsAt), endsAt: Number(startsAt + length) };
}

/** Periodos pasados, del más reciente al más viejo: [current-1, current-2, …], hasta `max` y sin bajar de 0. */
export function historyPeriods(current: number, max: number): number[] {
  const out: number[] = [];
  for (let p = current - 1; p >= 0 && out.length < max; p--) out.push(p);
  return out;
}

interface DayParts {
  day: string;
  month: string;
  year: string;
}

function dayParts(sec: number, tz: string): DayParts {
  const parts = new Intl.DateTimeFormat('es-MX', { timeZone: tz, day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(
    new Date(sec * 1000),
  );
  const get = (type: string) => parts.find((x) => x.type === type)?.value ?? '';
  return { day: get('day'), month: get('month').replace(/\.$/, ''), year: get('year') };
}

/** Etiqueta del periodo, por ejemplo «25–28 nov» (ver la regla del año en la cabecera). */
export function formatPeriod(range: PeriodRange, nowSec: number, tz: string = RANKING_TIME_ZONE): string {
  const a = dayParts(range.startsAt, tz);
  const b = dayParts(range.endsAt, tz);
  const thisYear = dayParts(nowSec, tz).year;
  const withYear = a.year !== thisYear || b.year !== thisYear;
  const year = (d: DayParts) => (withYear ? ` ${d.year}` : '');
  if (a.month === b.month && a.year === b.year) return `${a.day}–${b.day} ${b.month}${year(b)}`;
  return `${a.day} ${a.month}${year(a)} – ${b.day} ${b.month}${year(b)}`;
}

/** Tiempo que falta para el reinicio: «Se reinicia en 2 d 5 h», «… 3 h 10 min», «… 12 min» o «… menos de 1 min». */
export function formatCountdown(seconds: number): string {
  const s = Math.floor(seconds);
  if (s >= 86_400) return `Se reinicia en ${Math.floor(s / 86_400)} d ${Math.floor((s % 86_400) / 3_600)} h`;
  if (s >= 3_600) return `Se reinicia en ${Math.floor(s / 3_600)} h ${Math.floor((s % 3_600) / 60)} min`;
  if (s >= 60) return `Se reinicia en ${Math.floor(s / 60)} min`;
  return 'Se reinicia en menos de 1 min';
}
