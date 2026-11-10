// Pestaña Premios: montos por lugar, ronda en curso, cómo cobrar y el historial de pagos de las 6 rondas
// con el enlace a cada transacción.
import { notOpenText } from '../contract/eventStart';
import { formatCountdown, formatPeriod, periodRange } from '../contract/periods';
import {
  placeLabel,
  PRIZE_AMOUNTS,
  PRIZE_PER_ROUND,
  PRIZE_ROUNDS,
  roundOfPeriod,
  roundStatus,
  ROUND_STATUS_TEXT,
  txUrl,
  usd,
  type PrizeRecord,
  type RoundStatus,
} from '../contract/prizes';
import { PRIZE_NETWORK } from '../contract/config';
import type { Hub } from '../hub/hub';
import { shortAddress } from '../lib/format';
import { ICON, medalSvg, textWithUsdt, USDT_HTML } from './icons';
import { textWithApps, type AppId } from './Tiendas';

export type Periods = Awaited<ReturnType<Hub['readPeriods']>>;

/** Texto de la tarjeta de ronda: título y línea de tiempo. */
export function roundCardText(p: Periods | null, nowSec: number): { title: string; line: string } {
  if (!p) return { title: 'Premios en USDT', line: 'Leyendo la ronda…' };
  if (!p.started) return { title: `${PRIZE_ROUNDS} rondas con premio`, line: notOpenText(p.start) };
  const round = roundOfPeriod(p.current);
  const range = periodRange(p.start, p.length, p.current);
  const left = formatCountdown(range.endsAt - nowSec).replace('Se reinicia', 'Cierra');
  if (round === null) return { title: 'Rondas con premio terminadas', line: `Periodo ${p.current + 1} · ${left}` };
  return { title: `Ronda ${round} de ${PRIZE_ROUNDS}`, line: `${formatPeriod(range, nowSec)} · ${left}` };
}

export interface RoundRow {
  round: number;
  label: string;
  status: RoundStatus;
  statusText: string;
  winners: Array<{ place: string; name: string; amount: number; wallet: string; url: string }>;
}

/** Filas del historial: las 6 rondas con su fecha, estado y ganadores pagados. */
export function roundRows(
  p: Periods,
  paid: ReadonlyMap<number, readonly PrizeRecord[]>,
  names: ReadonlyMap<string, string>,
  nowSec: number,
): RoundRow[] {
  const rows: RoundRow[] = [];
  for (let round = 1; round <= PRIZE_ROUNDS; round++) {
    const list = paid.get(round) ?? [];
    const status = roundStatus(round, { started: p.started, currentPeriod: p.current, paid: list.length });
    const label = p.start === 0n ? `Ronda ${round}` : `Ronda ${round} · ${formatPeriod(periodRange(p.start, p.length, round - 1), nowSec)}`;
    rows.push({
      round,
      label,
      status,
      statusText: ROUND_STATUS_TEXT[status],
      winners: list.map((w) => ({
        place: placeLabel(w.place),
        name: names.get(w.player.toLowerCase()) || shortAddress(w.player),
        amount: w.amount,
        wallet: shortAddress(w.wallet),
        url: txUrl(w.txHash),
      })),
    });
  }
  return rows;
}

const nowSec = () => Date.now() / 1000;

/** Tarjeta «Ronda N de 6 · cierra en…» con los tres montos. */
export function createRoundCard(hub: Pick<Hub, 'readPeriods'>): { element: HTMLElement; load(): void } {
  const element = document.createElement('div');
  element.className = 'round-card';
  const icon = document.createElement('span');
  icon.className = 'round-card-icon';
  icon.innerHTML = ICON.premios;
  const text = document.createElement('span');
  text.className = 'round-card-text';
  const title = document.createElement('strong');
  const line = document.createElement('span');
  text.append(title, line);
  const amounts = document.createElement('span');
  amounts.className = 'round-card-amounts';
  amounts.setAttribute('aria-label', `Premios: ${PRIZE_AMOUNTS.map((a, i) => `${placeLabel(i + 1)} ${usd(a)}`).join(', ')}`);
  amounts.innerHTML = PRIZE_AMOUNTS.map((a, i) => `<span data-place="${i + 1}">${usd(a, false)}</span>`).join('');
  element.append(icon, text, amounts);

  const paint = (p: Periods | null) => {
    const t = roundCardText(p, nowSec());
    textWithUsdt(title, t.title);
    line.textContent = t.line;
  };
  let seq = 0;
  const load = () => {
    const mine = ++seq;
    paint(null);
    hub.readPeriods().then(
      (p) => {
        if (mine === seq) paint(p);
      },
      () => {
        if (mine === seq) {
          textWithUsdt(title, 'Premios en USDT');
          line.textContent = 'No se pudo leer la ronda.';
        }
      },
    );
  };
  return { element, load };
}

export interface Premios {
  readonly element: HTMLElement;
  load(): void;
}

export function createPremios(hub: Pick<Hub, 'readPeriods' | 'readPrizes' | 'readTopIn'>, opts: { onWallet(): void; onApp(app: AppId): void }): Premios {
  const element = document.createElement('div');
  element.className = 'premios';

  const hero = document.createElement('div');
  hero.className = 'premios-hero';
  hero.innerHTML =
    `<p class="eyebrow">Premios en ${USDT_HTML}</p>` +
    '<h2>Juega, entra al top 3 y cobra</h2>' +
    '<p class="premios-lead">Cada ronda dura 3 días. Al cerrar, los tres mejores puntajes ganan:</p>';
  const podium = document.createElement('ol');
  podium.className = 'prize-podium';
  podium.setAttribute('aria-label', 'Premio por lugar');
  PRIZE_AMOUNTS.forEach((amount, i) => {
    const place = (i + 1) as 1 | 2 | 3;
    const li = document.createElement('li');
    li.className = `prize-step prize-step--${place}`;
    li.innerHTML =
      `<span class="prize-medal">${medalSvg(place, 40)}</span>` +
      `<span class="sr-only">${placeLabel(place)} lugar:</span>` +
      `<span class="prize-amount">${usd(amount, false)}</span><span class="prize-unit">${USDT_HTML}</span>`;
    podium.append(li);
  });
  const facts = document.createElement('p');
  facts.className = 'premios-facts';
  textWithUsdt(facts, `${usd(PRIZE_PER_ROUND)} por ronda`);
  hero.append(podium, facts);

  const card = createRoundCard(hub);

  const how = document.createElement('section');
  how.className = 'card';
  how.setAttribute('aria-labelledby', 'premios-como');
  how.innerHTML =
    '<h3 id="premios-como">Cómo recibir tu premio</h3>' +
    '<ol class="steps">' +
    '<li><strong>Registra tu wallet</strong> en Perfil. Puedes cambiarla cuando quieras.</li>' +
    `<li><strong>Recomendado:</strong> <span class="paso-apps">tu dirección de depósito de USDT en Binance, red ${PRIZE_NETWORK}. Otra opción: una wallet de autocustodia como Nova Wallet.</span></li>` +
    `<li><strong>Al cerrar cada ronda</strong> se envían los premios por ${PRIZE_NETWORK} y el comprobante aparece aquí abajo.</li>` +
    '</ol>' +
    '<p class="card-note">En un empate gana quien llegó primero a ese puntaje.</p>';
  // «Binance» y «Nova Wallet» abren el diálogo para instalarlas (iOS o Android).
  const appsStep = how.querySelector<HTMLElement>('.paso-apps');
  if (appsStep) textWithApps(appsStep, appsStep.textContent ?? '', (app) => opts.onApp(app));
  const cta = document.createElement('button');
  cta.type = 'button';
  cta.className = 'overlay-action btn-block';
  cta.innerHTML = `${ICON.wallet}<span>Registrar mi wallet</span>`;
  cta.addEventListener('click', () => opts.onWallet());
  how.append(cta);

  const history = document.createElement('section');
  history.className = 'card';
  history.setAttribute('aria-labelledby', 'premios-historial');
  const historyTitle = document.createElement('h3');
  historyTitle.id = 'premios-historial';
  historyTitle.textContent = 'Historial de pagos';
  const historyNote = document.createElement('p');
  historyNote.className = 'card-note';
  historyNote.textContent = 'Cada pago trae el enlace a su transacción para que cualquiera lo compruebe.';
  const list = document.createElement('ol');
  list.className = 'rounds';
  list.setAttribute('aria-live', 'polite');
  history.append(historyTitle, historyNote, list);

  element.append(hero, card.element, how, history);

  const status = (text: string) => {
    const li = document.createElement('li');
    li.className = 'rounds-status';
    li.textContent = text;
    list.replaceChildren(li);
  };

  const render = (rows: RoundRow[]) => {
    list.replaceChildren(
      ...rows.map((r) => {
        const li = document.createElement('li');
        li.className = 'round';
        const head = document.createElement('div');
        head.className = 'round-head';
        const name = document.createElement('span');
        name.className = 'round-name';
        name.textContent = r.label;
        const chip = document.createElement('span');
        chip.className = `chip chip--${r.status}`;
        chip.textContent = r.statusText;
        head.append(name, chip);
        li.append(head);
        if (r.winners.length > 0) {
          const ul = document.createElement('ul');
          ul.className = 'round-winners';
          for (const w of r.winners) {
            const item = document.createElement('li');
            const who = document.createElement('span');
            who.className = 'round-who';
            who.textContent = `${w.place} ${w.name}`;
            const amount = document.createElement('span');
            amount.className = 'round-amount';
            textWithUsdt(amount, usd(w.amount));
            const link = document.createElement('a');
            link.className = 'round-link';
            link.href = w.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.innerHTML = `<span>Ver pago</span>${ICON.enlace}`;
            link.setAttribute('aria-label', `Ver el pago de ${usd(w.amount)} a ${w.name} (${w.wallet})`);
            item.append(who, amount, link);
            ul.append(item);
          }
          li.append(ul);
        }
        return li;
      }),
    );
  };

  let seq = 0;
  const load = () => {
    const mine = ++seq;
    card.load();
    status('Cargando…');
    hub
      .readPeriods()
      .then(async (p) => {
        const rounds = Array.from({ length: PRIZE_ROUNDS }, (_, i) => i + 1).filter((r) => p.started && r - 1 < p.current);
        const paid = new Map<number, PrizeRecord[]>();
        const names = new Map<string, string>();
        await Promise.all(
          rounds.map(async (r) => {
            const [prizes, top] = await Promise.all([hub.readPrizes(r), hub.readTopIn(r - 1, PRIZE_AMOUNTS.length).catch(() => [])]);
            paid.set(r, prizes);
            for (const row of top) if (row.username) names.set(row.address.toLowerCase(), row.username);
          }),
        );
        if (mine === seq) render(roundRows(p, paid, names, nowSec()));
      })
      .catch(() => {
        if (mine === seq) status('No se pudo leer el historial de premios.');
      });
  };

  return { element, load };
}
