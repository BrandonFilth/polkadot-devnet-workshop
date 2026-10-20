// Top 10 de tu Leaderboard: cargando, vacío, error con Reintentar y la tabla.
import { shortAddress } from '../contract/ranking';
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
  /** Vuelve a leer el top 10 con hub.readTop(). */
  load(): void;
}

export function createRanking(hub: Hub): Ranking {
  const element = document.createElement('section');
  element.className = 'ranking';
  element.setAttribute('aria-label', 'Ranking');

  const heading = document.createElement('h2');
  heading.textContent = 'TOP 10';
  const body = document.createElement('div');
  body.setAttribute('aria-live', 'polite');
  element.append(heading, body);

  const status = (text: string, retry = false) => {
    const p = document.createElement('p');
    p.className = 'ranking-status';
    p.textContent = text;
    if (!retry) {
      body.replaceChildren(p);
      return;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'overlay-secondary';
    button.textContent = 'Reintentar';
    button.addEventListener('click', () => load());
    body.replaceChildren(p, button);
  };

  const table = (rows: RankingRow[]) => {
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
    // La lista se desplaza dentro de su caja (alto máximo fijo): muchas filas nunca alargan la pantalla.
    const scroll = document.createElement('div');
    scroll.className = 'ranking-scroll';
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', 'Lista del ranking');
    scroll.append(t);
    body.replaceChildren(scroll);
  };

  // Solo cuenta la última lectura pedida.
  let seq = 0;
  const load = () => {
    const mySeq = ++seq;
    status('Cargando…');
    hub.readTop(RANKING_TOP).then(
      (rows) => {
        if (mySeq !== seq) return;
        if (rows.length === 0) status('Todavía no hay récords');
        else table(rows);
      },
      (error: unknown) => {
        if (mySeq !== seq) return;
        status(error instanceof Error ? error.message : 'No se pudo leer el ranking', true);
      },
    );
  };

  return { element, load };
}
