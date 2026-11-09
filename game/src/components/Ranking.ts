// Ranking con dos vistas. Actual: TOP 10 del periodo de 3 días en curso, con sus fechas y cuánto falta
// para el reinicio. Historial: los periodos anteriores (hasta RANKING_HISTORY_PERIODS); al tocar uno se
// ve su TOP 10. Cada vista tiene cargando, vacío y error con Reintentar.
import { notOpenText } from '../contract/eventStart';
import { formatCountdown, formatPeriod, historyPeriods, periodRange } from '../contract/periods';
import { shortAddress } from '../contract/ranking';
import { RANKING_HISTORY_PERIODS } from '../engine/rules';
import type { Hub, RankingRow } from '../hub/hub';

/** Filas que se piden al contrato. */
export const RANKING_TOP = 10;

/** Celdas de una fila: posición, jugador (con «(tú)» si es tuya) y puntaje. */
export function rankingCells(row: RankingRow, index: number): [string, string, string] {
  const name = row.username !== '' ? row.username : shortAddress(row.address);
  return [String(index + 1), row.mine ? `${name} (tú)` : name, row.score.toString()];
}

export interface Ranking {
  readonly element: HTMLElement;
  /** Vuelve a la vista Actual y la lee otra vez. */
  load(): void;
}

type View = 'actual' | 'historial';

const messageOf = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);
const nowSec = () => Date.now() / 1000;

export function createRanking(hub: Hub): Ranking {
  const element = document.createElement('section');
  element.className = 'ranking';
  element.setAttribute('aria-label', 'Ranking');

  const tabs = document.createElement('div');
  tabs.className = 'ranking-vista';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Vista del ranking');
  const tab = (label: string, onClick: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ranking-vista-btn';
    b.setAttribute('role', 'tab');
    b.textContent = label;
    b.addEventListener('click', onClick);
    tabs.append(b);
    return b;
  };
  const actualTab = tab('Actual', () => showActual());
  const historialTab = tab('Historial', () => showHistorial());

  const heading = document.createElement('h2');
  heading.textContent = 'TOP 10';
  const reinicio = document.createElement('p');
  reinicio.className = 'ranking-reinicio';
  reinicio.hidden = true;
  const body = document.createElement('div');
  body.setAttribute('aria-live', 'polite');
  element.append(tabs, heading, reinicio, body);

  const backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.className = 'overlay-secondary';
  backButton.textContent = '← Periodos';
  backButton.addEventListener('click', () => showHistorial());

  /** Mensaje en el cuerpo; con `retry`, un botón Reintentar. `before` va arriba (p. ej. «← Periodos»). */
  const status = (text: string, retry?: () => void, before: Node[] = []) => {
    const p = document.createElement('p');
    p.className = 'ranking-status';
    p.textContent = text;
    if (!retry) {
      body.replaceChildren(...before, p);
      return;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'overlay-secondary';
    button.textContent = 'Reintentar';
    button.addEventListener('click', () => retry());
    body.replaceChildren(...before, p, button);
  };

  // Las listas se desplazan dentro de su caja (alto máximo fijo): muchas filas nunca alargan la pantalla.
  const scrollBox = (child: HTMLElement, label: string) => {
    const scroll = document.createElement('div');
    scroll.className = 'ranking-scroll';
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', label);
    scroll.append(child);
    return scroll;
  };

  const table = (rows: RankingRow[], before: Node[] = []) => {
    const t = document.createElement('table');
    t.className = 'ranking-table';
    const head = t.createTHead().insertRow();
    for (const label of ['#', 'Jugador', 'Puntaje']) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label;
      head.append(th);
    }
    const tbody = t.createTBody();
    rows.forEach((row, i) => {
      const tr = tbody.insertRow();
      if (row.mine) {
        tr.className = 'ranking-mine';
        tr.setAttribute('aria-current', 'true');
      }
      for (const text of rankingCells(row, i)) tr.insertCell().textContent = text;
    });
    body.replaceChildren(...before, scrollBox(t, 'Lista del ranking'));
  };

  const select = (view: View) => {
    for (const [b, v] of [[actualTab, 'actual'], [historialTab, 'historial']] as const) {
      b.setAttribute('aria-selected', String(v === view));
      b.tabIndex = v === view ? 0 : -1;
    }
    reinicio.hidden = true;
  };

  // Solo cuenta la última lectura pedida, sea de la vista que sea.
  let seq = 0;

  const showActual = () => {
    const mySeq = ++seq;
    select('actual');
    heading.textContent = 'TOP 10';
    status('Cargando…');
    Promise.all([hub.readPeriods(), hub.readTop(RANKING_TOP)]).then(
      ([periods, rows]) => {
        if (mySeq !== seq) return;
        // Antes del evento no hay periodo: se dice cuándo abre en vez de mostrar fechas.
        if (!periods.started) {
          heading.textContent = 'TOP 10';
          reinicio.textContent = notOpenText(periods.start);
          reinicio.hidden = false;
          status('Todavía no hay récords');
          return;
        }
        const now = nowSec();
        const range = periodRange(periods.start, periods.length, periods.current);
        heading.textContent = `TOP 10 · ${formatPeriod(range, now)}`;
        reinicio.textContent = formatCountdown(range.endsAt - now);
        reinicio.hidden = false;
        if (rows.length === 0) status('Todavía no hay récords');
        else table(rows);
      },
      (error: unknown) => {
        if (mySeq !== seq) return;
        status(messageOf(error, 'No se pudo leer el ranking'), showActual);
      },
    );
  };

  const showPeriod = (period: number, label: string) => {
    const mySeq = ++seq;
    heading.textContent = `TOP 10 · ${label}`;
    status('Cargando…', undefined, [backButton]);
    hub.readTopIn(period, RANKING_TOP).then(
      (rows) => {
        if (mySeq !== seq) return;
        if (rows.length === 0) status('Nadie jugó en este periodo', undefined, [backButton]);
        else table(rows, [backButton]);
      },
      (error: unknown) => {
        if (mySeq !== seq) return;
        status(messageOf(error, 'No se pudo leer el historial'), () => showPeriod(period, label), [backButton]);
      },
    );
  };

  const showHistorial = () => {
    const mySeq = ++seq;
    select('historial');
    heading.textContent = 'Historial';
    status('Cargando…');
    hub.readPeriods().then(
      (periods) => {
        if (mySeq !== seq) return;
        const past = periods.started ? historyPeriods(periods.current, RANKING_HISTORY_PERIODS) : [];
        if (past.length === 0) {
          status('Todavía no hay periodos anteriores');
          return;
        }
        const now = nowSec();
        const list = document.createElement('ul');
        list.className = 'ranking-periodos';
        for (const p of past) {
          const label = formatPeriod(periodRange(periods.start, periods.length, p), now);
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = label;
          button.addEventListener('click', () => showPeriod(p, label));
          const li = document.createElement('li');
          li.append(button);
          list.append(li);
        }
        body.replaceChildren(scrollBox(list, 'Periodos anteriores'));
      },
      (error: unknown) => {
        if (mySeq !== seq) return;
        status(messageOf(error, 'No se pudo leer el periodo'), showHistorial);
      },
    );
  };

  return { element, load: showActual };
}
