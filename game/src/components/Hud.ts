// HUD en DOM: puntaje, ronda, récord, vidas, botón de pausa (escritorio), botón Sonido y botón Menú. Solo toca el DOM cuando cambia un valor.
import { togglePause, type GameState } from '../engine/game';

export interface Hud {
  /** Ajusta el HUD al estado actual. */
  sync(): void;
  /** Botón Menú (recibe el foco al cerrar el menú). */
  readonly menuButton: HTMLButtonElement;
}

const MENU_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v2H4zM4 11h16v2H4zM4 16h16v2H4z"/></svg>';

const PAUSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z"/></svg>';
const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5 L19 12 L8 19 Z"/></svg>';

/** `record()` da el récord del jugador, o null sin cuenta, mientras se lee o si falló la lectura. */
/** `sonido` (opcional) es el botón Sonido con su popover; va antes del botón Menú. */
export function createHud(
  header: HTMLElement,
  state: GameState,
  record: () => bigint | null,
  onMenu: () => void,
  sonido?: HTMLElement,
): Hud {
  const stats = document.createElement('p');
  stats.className = 'hud-stats';
  const score = document.createElement('span');
  const round = document.createElement('span');
  stats.append('PUNTOS ', score, ' · RONDA ', round);

  const best = document.createElement('p');
  best.className = 'hud-best';
  const info = document.createElement('div');
  info.className = 'hud-info';
  info.append(stats, best);

  const lives = document.createElement('span');
  lives.className = 'hud-lives';
  lives.setAttribute('role', 'img');

  const pause = document.createElement('button');
  pause.type = 'button';
  pause.className = 'hud-pause';
  pause.addEventListener('click', () => togglePause(state));

  // Menú: Username y Ranking. En táctil la pausa vive en el botón rojo de abajo (styles.css oculta esta).
  const menu = document.createElement('button');
  menu.type = 'button';
  menu.className = 'hud-menu';
  menu.setAttribute('aria-label', 'Menú: username y ranking');
  menu.setAttribute('aria-haspopup', 'dialog');
  menu.innerHTML = `${MENU_ICON}<span>Menú</span>`;
  menu.addEventListener('click', () => onMenu());

  header.replaceChildren(info, lives, pause, ...(sonido ? [sonido] : []), menu);

  let shownBest: string | null = null;
  let shownScore: number | null = null;
  let shownRound: number | null = null;
  let shownLives: number | null = null;
  let shownPaused: boolean | null = null;

  return {
    menuButton: menu,
    sync() {
      const r = record();
      const bestText = `Récord: ${r === null ? '—' : r.toString()}`;
      if (bestText !== shownBest) {
        shownBest = bestText;
        best.textContent = bestText;
      }
      if (state.score !== shownScore) {
        shownScore = state.score;
        score.textContent = String(state.score);
      }
      if (state.round !== shownRound) {
        shownRound = state.round;
        round.textContent = String(state.round);
      }
      if (state.lives !== shownLives) {
        shownLives = state.lives;
        lives.setAttribute('aria-label', `Vidas: ${state.lives}`);
        lives.replaceChildren(
          ...Array.from({ length: Math.max(0, state.lives) }, () => {
            const dot = document.createElement('span');
            dot.className = 'hud-life';
            return dot;
          }),
        );
      }
      const paused = state.phase === 'pausa';
      if (paused !== shownPaused) {
        shownPaused = paused;
        pause.setAttribute('aria-label', paused ? 'Seguir' : 'Pausa');
        pause.innerHTML = paused ? PLAY_ICON : PAUSE_ICON;
      }
    },
  };
}
