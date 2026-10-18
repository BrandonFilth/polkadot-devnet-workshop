// Top 10 del Leaderboard compartido: cargando, vacío, error con Reintentar y la tabla.
import { shortAddress } from '../contract/ranking';
import type { Hub, RankingRow } from '../hub/hub';

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
      tr.insertCell().textContent = String(i + 1);
      const name = row.username !== '' ? row.username : shortAddress(row.address);
      tr.insertCell().textContent = row.mine ? `${name} (tú)` : name;
      tr.insertCell().textContent = row.score.toString();
    });
    body.replaceChildren(t);
  };

  // Solo cuenta la última lectura pedida.
  let seq = 0;
  const load = () => {
    const mySeq = ++seq;
    status('Cargando…');
    hub.readTop(10).then(
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
