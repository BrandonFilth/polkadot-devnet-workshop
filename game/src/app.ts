// Arma el DOM y conecta motor, dibujo, controles y componentes.
import { createConexion } from './components/Conexion';
import { createFinDePartida, type Mine } from './components/FinDePartida';
import { createHud } from './components/Hud';
import { createOverlay } from './components/Overlay';
import { createRanking } from './components/Ranking';
import { createUsername } from './components/Username';
import { createHub } from './hub/hub';
import { createGame, setPaused, update } from './engine/game';
import { MAZE, parseMaze } from './engine/maze';
import type { Dir } from './engine/types';
import { attachControls } from './input/controls';
import { startLoop } from './loop';
import { createRenderer } from './render/draw';

const DPAD: Array<{ dir: Dir; label: string; path: string }> = [
  { dir: 'arriba', label: 'Arriba', path: 'M12 5 L20 17 L4 17 Z' },
  { dir: 'izquierda', label: 'Izquierda', path: 'M5 12 L17 4 L17 20 Z' },
  { dir: 'abajo', label: 'Abajo', path: 'M12 19 L4 7 L20 7 Z' },
  { dir: 'derecha', label: 'Derecha', path: 'M19 12 L7 20 L7 4 Z' },
];

const LANDSCAPE_PHONE = '(orientation: landscape) and (pointer: coarse)';

export function startApp(root: HTMLElement): void {
  const maze = parseMaze(MAZE);
  const state = createGame(Date.now());

  const header = document.createElement('header');
  header.className = 'hud';

  const stage = document.createElement('main');
  stage.className = 'stage';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Tablero de Polka-Man');
  stage.append(canvas);

  const dpad = document.createElement('nav');
  dpad.className = 'dpad';
  dpad.setAttribute('aria-label', 'Controles');
  for (const { dir, label, path } of DPAD) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.dir = dir;
    button.setAttribute('aria-label', label);
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
    dpad.append(button);
  }

  // Aviso de giro: fuera del escenario, a pantalla completa y por encima de todo.
  const rotate = document.createElement('div');
  rotate.className = 'rotate';
  rotate.setAttribute('role', 'alert');
  rotate.innerHTML = '<p>Gira tu teléfono</p><p class="rotate-hint">Polka-Man se juega en vertical.</p>';
  rotate.hidden = true;

  root.replaceChildren(header, stage, dpad, rotate);

  // Un solo Hub para toda la sesión. El juego no espera al Host.
  const hub = createHub();
  void hub.start();
  const busy = () => hub.getState().busy;

  // Récord del jugador: app.ts es el único dueño de este valor.
  let mine: Mine = null;
  let mineSeq = 0;
  const refreshMine = () => {
    const seq = ++mineSeq;
    mine = null;
    hub.readMine().then(
      (r) => {
        if (seq === mineSeq) mine = r ?? { best: 0n, username: '' };
      },
      () => {
        if (seq === mineSeq) mine = 'error';
      },
    );
  };

  const ranking = createRanking(hub);
  const conexion = createConexion(hub);
  const username = createUsername(stage, hub, () => {
    refreshMine();
    ranking.load();
  });
  const fin = createFinDePartida({
    hub,
    score: () => state.score,
    mine: () => mine,
    onSaved: () => {
      refreshMine();
      ranking.load();
    },
    openUsername: () => username.open(typeof mine === 'object' && mine ? mine.username : ''),
  });

  // Botón Username del título: solo con cuenta conectada.
  const nameButton = document.createElement('button');
  nameButton.type = 'button';
  nameButton.className = 'overlay-secondary';
  nameButton.hidden = true;
  nameButton.addEventListener('click', () => username.open(typeof mine === 'object' && mine ? mine.username : ''));
  let shownName: string | null = null;
  const syncNameButton = () => {
    const label =
      hub.getState().account === null ? '' : typeof mine === 'object' && mine && mine.username !== '' ? mine.username : 'Elige un username';
    if (label === shownName) return;
    shownName = label;
    nameButton.hidden = label === '';
    nameButton.textContent = label;
    nameButton.setAttribute('aria-label', label === 'Elige un username' ? label : `Username: ${label}`);
  };

  // Al pasar de sin cuenta a una cuenta, se relee el récord.
  let hadAccount = hub.getState().account !== null;
  hub.subscribe((s) => {
    const has = s.account !== null;
    if (has && !hadAccount) refreshMine();
    if (!has) {
      mineSeq++;
      mine = null;
    }
    hadAccount = has;
  });

  const hud = createHud(header, state, () =>
    hub.getState().account !== null && typeof mine === 'object' && mine ? mine.best : null,
  );
  hud.sync();
  const overlay = createOverlay(stage, state, {
    titleTop: [conexion.element],
    title: [nameButton, ranking.element],
    fin: [fin.element],
    finAfter: [ranking.element],
    busy,
    onPhase(phase) {
      if (phase === 'titulo') ranking.load();
      if (phase === 'fin') {
        fin.enter();
        ranking.load();
        if (hub.getState().account !== null) refreshMine();
      }
    },
  });
  syncNameButton();
  overlay.sync();
  attachControls(state, stage, dpad, busy);

  // Pausa automática: siempre setPaused(true). Nada reanuda solo.
  const landscape = window.matchMedia(LANDSCAPE_PHONE);
  const syncOrientation = () => {
    rotate.hidden = !landscape.matches;
    if (landscape.matches) setPaused(state, true);
  };
  landscape.addEventListener('change', syncOrientation);
  syncOrientation();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) setPaused(state, true);
  });
  window.addEventListener('blur', () => setPaused(state, true));

  const renderer = createRenderer(stage, canvas, maze);
  // El dibujo usa los orbes que quedan en el estado; start() y cada ronda los reemplazan.
  const scene = {
    orbs: state.orbs,
    power: state.power,
    player: state.player,
    ghosts: state.ghosts,
    frightTimer: state.frightTimer,
  };

  startLoop({
    step(dt) {
      // Mientras se pide girar el teléfono, la partida no avanza.
      if (landscape.matches) setPaused(state, true);
      update(state, dt);
    },
    render(timeMs) {
      scene.orbs = state.orbs;
      scene.power = state.power;
      scene.player = state.player;
      scene.ghosts = state.ghosts;
      scene.frightTimer = state.frightTimer;
      overlay.sync();
      if (state.phase === 'fin') fin.sync();
      if (state.phase === 'titulo') syncNameButton();
      hud.sync();
      renderer.draw(scene, timeMs);
    },
  });
}
