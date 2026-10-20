// Arma el DOM y conecta motor, dibujo, controles y componentes.
import { capas, type Capa } from './components/capas';
import { createControles } from './components/Controles';
import { createFinDePartida, type Mine } from './components/FinDePartida';
import { createHud } from './components/Hud';
import { createInicio } from './components/Inicio';
import { createMenu, pauseForMenu, type MenuTab } from './components/Menu';
import { createOverlay } from './components/Overlay';
import { attachTeclado } from './components/teclado';
import { createTxEstado } from './components/TxEstado';
import { createUsername } from './components/Username';
import { withDebug } from './dev/debug';
import { createHub } from './hub/hub';
import { createGame, goToTitle, setPaused, update } from './engine/game';
import { MAZE, parseMaze } from './engine/maze';
import {
  CONTROLS_HEIGHT_PX,
  HUD_HEIGHT_PX,
  JOYSTICK_KNOB_RADIUS_PX,
  JOYSTICK_RADIUS_PX,
  PAUSE_BUTTON_PX,
  RANKING_MAX_HEIGHT_PX,
} from './engine/rules';
import { attachControls } from './input/controls';
import { startLoop } from './loop';
import { createRenderer } from './render/draw';
import { portraitSplit } from './render/layout';

const LANDSCAPE_PHONE = '(orientation: landscape) and (pointer: coarse)';
const PORTRAIT_PHONE = '(orientation: portrait) and (pointer: coarse)';

export function startApp(root: HTMLElement): void {
  const maze = parseMaze(MAZE);
  const state = createGame(Date.now());

  // Las medidas de la pantalla viven en rules.ts; el CSS las lee de aquí.
  root.style.setProperty('--hud-h', `${HUD_HEIGHT_PX}px`);
  root.style.setProperty('--controls-h', `${CONTROLS_HEIGHT_PX}px`);
  root.style.setProperty('--joy-r', `${JOYSTICK_RADIUS_PX}px`);
  root.style.setProperty('--knob-r', `${JOYSTICK_KNOB_RADIUS_PX}px`);
  root.style.setProperty('--pause-size', `${PAUSE_BUTTON_PX}px`);
  root.style.setProperty('--ranking-max-h', `${RANKING_MAX_HEIGHT_PX}px`);

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

  // Celular en vertical: el laberinto pegado al HUD (--maze-h) y lo que sobra para los controles (styles.css).
  const portrait = window.matchMedia(PORTRAIT_PHONE);
  const syncSplit = () => {
    if (!portrait.matches) {
      root.style.removeProperty('--maze-h');
      return;
    }
    const cs = getComputedStyle(root);
    const px = (name: string) => parseFloat(cs.getPropertyValue(name)) || 0;
    const split = portraitSplit({
      width: root.clientWidth,
      height: root.clientHeight,
      safeTop: px('padding-top'),
      safeRight: px('padding-right'),
      safeBottom: px('padding-bottom'),
      safeLeft: px('padding-left'),
      touch: true,
    });
    root.style.setProperty('--maze-h', `${split.mazeHeight}px`);
  };
  portrait.addEventListener('change', syncSplit);
  window.addEventListener('resize', syncSplit);
  syncSplit();

  // Un solo Hub para toda la sesión. El juego no espera al Host.
  // En desarrollo, `?debug` permite simular estados para las capturas; en el build esta rama no existe.
  const realHub = createHub();
  const hub = import.meta.env.DEV ? withDebug(realHub, state) : realHub;
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

  // Capas: lo de abajo de la superficie de arriba queda inerte (applyLayers, más abajo).
  const layers = () => applyLayers();

  // Modal y menú van en #app (no en el escenario) para que su overflow no los recorte.
  const username = createUsername(root, hub, () => refreshMine(), layers);
  const openUsername = () => {
    pauseForMenu(state);
    username.open(typeof mine === 'object' && mine ? mine.username : '');
  };
  const fin = createFinDePartida({
    hub,
    score: () => state.score,
    mine: () => mine,
    onSaved: () => refreshMine(),
    openUsername,
  });

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

  // El menú devuelve el foco a quien lo abrió (botón Menú, Ranking del inicio o Ver ranking del fin).
  let menuOpener: HTMLElement | null = null;
  const menu = createMenu({
    parent: root,
    state,
    hub,
    mine: () => mine,
    openUsername,
    trigger: () => menuOpener ?? hud.menuButton,
    onToggle: layers,
  });
  const openMenu = (tab?: MenuTab) => {
    menuOpener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    menu.open(tab);
  };
  const hud = createHud(
    header,
    state,
    () => (hub.getState().account !== null && typeof mine === 'object' && mine ? mine.best : null),
    () => {
      if (menu.isOpen) return menu.close();
      menuOpener = null;
      menu.open();
    },
  );
  hud.sync();

  const overlay = createOverlay(stage, state, {
    fin: [fin.element],
    busy,
    onVerRanking: () => openMenu('ranking'),
    onInicio: () => goToTitle(state),
    onPhase(phase) {
      if (phase === 'fin') {
        fin.enter();
        if (hub.getState().account !== null) refreshMine();
      }
    },
  });

  // Pantalla de inicio: opaca, tapa HUD, escenario y controles. El aviso «sin cuenta» va encima.
  const inicio = createInicio(root, {
    state,
    hub,
    mine: () => mine,
    onRanking: () => openMenu('ranking'),
    onUsername: openUsername,
    onToggle: layers,
  });

  // Popup de estados: el último en #app, por encima de todo lo demás (salvo «Gira tu teléfono»).
  const tx = createTxEstado(root, hub, layers);
  root.append(rotate);

  const LAYER_ELEMENTS: Record<Exclude<Capa, 'juego'>, HTMLElement> = {
    inicio: inicio.element,
    pausa: overlay.element,
    fin: overlay.element,
    menu: menu.element,
    username: username.element,
    aviso: inicio.aviso,
    tx: tx.element,
  };
  let top: Capa = 'juego';
  let shownLayers = '';
  const setInert = (el: HTMLElement, inert: boolean) => {
    if (el.inert === inert) return;
    el.inert = inert;
    if (inert) el.setAttribute('aria-hidden', 'true');
    else el.removeAttribute('aria-hidden');
  };
  function applyLayers() {
    const c = capas({
      phase: state.phase,
      menuOpen: menu.isOpen,
      usernameOpen: username.isOpen,
      avisoOpen: inicio.avisoOpen,
      txOpen: tx.isOpen,
    });
    top = c.top;
    const key = c.open.join(',');
    if (key === shownLayers) return;
    shownLayers = key;
    // Tablero y controles: inertes con cualquier superficie encima (pausa y fin los tapan; ahí está Seguir).
    setInert(canvas, top !== 'juego');
    setInert(controles.element, top !== 'juego');
    // HUD: el botón Menú sigue a la mano en pausa, fin y con el menú abierto (lo cierra).
    setInert(header, top === 'inicio' || top === 'username' || top === 'aviso' || top === 'tx');
    for (const [capa, el] of Object.entries(LAYER_ELEMENTS) as Array<[Capa, HTMLElement]>) {
      if (capa === 'pausa' || capa === 'fin') continue;
      setInert(el, c.inert.includes(capa));
    }
    setInert(overlay.element, c.inert.includes('pausa') || c.inert.includes('fin'));
  }

  overlay.sync();
  inicio.sync();
  applyLayers();
  attachControls(state, stage, busy, () => top !== 'juego');
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
      inicio.sync();
      if (state.phase === 'fin') fin.sync();
      if (menu.isOpen) menu.sync();
      applyLayers();
      hud.sync();
      controles.sync();
      renderer.draw(scene, timeMs);
    },
  });
}
