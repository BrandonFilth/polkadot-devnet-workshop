// Arma el DOM y conecta motor, dibujo, controles y componentes.
import { createConexion } from './components/Conexion';
import { createControles } from './components/Controles';
import { createFinDePartida, type Mine } from './components/FinDePartida';
import { createHud } from './components/Hud';
import { createMenu, pauseForMenu } from './components/Menu';
import { createOverlay } from './components/Overlay';
import { createRanking } from './components/Ranking';
import { attachTeclado } from './components/teclado';
import { createUsername } from './components/Username';
import { createHub } from './hub/hub';
import { createGame, setPaused, update } from './engine/game';
import { MAZE, parseMaze } from './engine/maze';
import {
  CONTROLS_HEIGHT_PX,
  HUD_HEIGHT_PX,
  JOYSTICK_KNOB_RADIUS_PX,
  JOYSTICK_RADIUS_PX,
  PAUSE_BUTTON_PX,
} from './engine/rules';
import { attachControls } from './input/controls';
import { startLoop } from './loop';
import { createRenderer } from './render/draw';

const LANDSCAPE_PHONE = '(orientation: landscape) and (pointer: coarse)';

export function startApp(root: HTMLElement): void {
  const maze = parseMaze(MAZE);
  const state = createGame(Date.now());

  // Las medidas de la pantalla viven en rules.ts; el CSS las lee de aquí.
  root.style.setProperty('--hud-h', `${HUD_HEIGHT_PX}px`);
  root.style.setProperty('--controls-h', `${CONTROLS_HEIGHT_PX}px`);
  root.style.setProperty('--joy-r', `${JOYSTICK_RADIUS_PX}px`);
  root.style.setProperty('--knob-r', `${JOYSTICK_KNOB_RADIUS_PX}px`);
  root.style.setProperty('--pause-size', `${PAUSE_BUTTON_PX}px`);

  const header = document.createElement('header');
  header.className = 'hud';

  const stage = document.createElement('main');
  stage.className = 'stage';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Tablero de Polka-Man');
  stage.append(canvas);

  // Joystick y botón de pausa estilo Atari (solo en pantallas táctiles, ver styles.css).
  const controles = createControles(state);

  // Aviso de giro: fuera del escenario, a pantalla completa y por encima de todo.
  const rotate = document.createElement('div');
  rotate.className = 'rotate';
  rotate.setAttribute('role', 'alert');
  rotate.innerHTML = '<p>Gira tu teléfono</p><p class="rotate-hint">Polka-Man se juega en vertical.</p>';
  rotate.hidden = true;

  root.replaceChildren(header, stage, controles.element, rotate);

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
  // Modal y menú van en #app (no en el escenario) para que su overflow no los recorte.
  const username = createUsername(root, hub, () => {
    refreshMine();
    ranking.load();
  });
  const openUsername = () => {
    pauseForMenu(state);
    username.open(typeof mine === 'object' && mine ? mine.username : '');
  };
  const fin = createFinDePartida({
    hub,
    score: () => state.score,
    mine: () => mine,
    onSaved: () => {
      refreshMine();
      ranking.load();
    },
    openUsername,
  });

  // Botón Username del título: solo con cuenta conectada.
  const nameButton = document.createElement('button');
  nameButton.type = 'button';
  nameButton.className = 'overlay-secondary';
  nameButton.hidden = true;
  nameButton.addEventListener('click', openUsername);
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

  const menu = createMenu({
    parent: root,
    state,
    hub,
    mine: () => mine,
    openUsername,
    trigger: () => hud.menuButton,
  });
  const hud = createHud(
    header,
    state,
    () => (hub.getState().account !== null && typeof mine === 'object' && mine ? mine.best : null),
    () => (menu.isOpen ? menu.close() : menu.open()),
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
  attachControls(state, stage, busy);
  attachTeclado(root);

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
      if (menu.isOpen) menu.sync();
      hud.sync();
      controles.sync();
      renderer.draw(scene, timeMs);
    },
  });
}
