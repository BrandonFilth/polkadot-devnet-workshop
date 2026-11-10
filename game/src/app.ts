// Arma el DOM y conecta motor, dibujo, controles y componentes.
import { createAudio } from './audio/audio';
import { createAbandonar } from './components/Abandonar';
import { createAdmin } from './components/Admin';
import { createAdminPremios } from './components/AdminPremios';
import { createBilletera } from './components/Billetera';
import { createPerfil, type Payout } from './components/Perfil';
import { createPremios } from './components/Premios';
import { createStoreDialog } from './components/Tiendas';
import { createRanking } from './components/Ranking';
import { createShell, type Shell } from './components/Shell';
import { isAdminAccount, type EventInfo } from './contract/eventStart';
import { parseRoute, routeHash } from './lib/route';
import { createSoundPrefs, safeStorage } from './audio/prefs';
import { capas, type Capa } from './components/capas';
import { createControles } from './components/Controles';
import { createFinDePartida, type Mine } from './components/FinDePartida';
import { createHud } from './components/Hud';
import { createInicio } from './components/Inicio';
import { createMenu, pauseForMenu, type MenuTab } from './components/Menu';
import { createOverlay } from './components/Overlay';
import { createSonidoButton, createSonidoToggles } from './components/Sonido';
import { attachTeclado } from './components/teclado';
import { createTxEstado } from './components/TxEstado';
import { createUsername } from './components/Username';
import { attachAudioDebug, withDebug } from './dev/debug';
import { createHub } from './hub/hub';
import { abandon, createGame, drainEvents, goToTitle, setPaused, update } from './engine/game';
import { MAZE, parseMaze } from './engine/maze';
import {
  CONTROLS_HEIGHT_PX,
  HUD_HEIGHT_PX,
  DPAD_BUTTON_PX,
  DPAD_GAP_PX,
  DPAD_PAD_PX,
  PAUSE_BUTTON_PX,
  RANKING_MAX_HEIGHT_PX,
} from './engine/rules';
import { attachControls } from './input/controls';
import { startLoop } from './loop';
import { createRenderer, type Scene } from './render/draw';
import { addFromEvents, prune, type Effect } from './render/effects';
import { portraitSplit } from './render/layout';

const LANDSCAPE_PHONE = '(orientation: landscape) and (pointer: coarse)';
const PORTRAIT_PHONE = '(orientation: portrait) and (pointer: coarse)';

export function startApp(root: HTMLElement): void {
  const maze = parseMaze(MAZE);
  const state = createGame(Date.now());

  // Las medidas de la pantalla viven en rules.ts; el CSS las lee de aquí.
  root.style.setProperty('--hud-h', `${HUD_HEIGHT_PX}px`);
  root.style.setProperty('--controls-h', `${CONTROLS_HEIGHT_PX}px`);
  root.style.setProperty('--pause-size', `${PAUSE_BUTTON_PX}px`);
  root.style.setProperty('--dpad-btn', `${DPAD_BUTTON_PX}px`);
  root.style.setProperty('--dpad-gap', `${DPAD_GAP_PX}px`);
  root.style.setProperty('--dpad-pad', `${DPAD_PAD_PX}px`);
  root.style.setProperty('--ranking-max-h', `${RANKING_MAX_HEIGHT_PX}px`);

  const header = document.createElement('header');
  header.className = 'hud';

  const stage = document.createElement('main');
  stage.className = 'stage';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Tablero de Polka-Man');
  stage.append(canvas);

  // Flechas y botón de pausa estilo Atari (solo en pantallas táctiles, ver styles.css).
  const controles = createControles(state);

  // Aviso de giro: fuera del escenario, a pantalla completa y por encima de todo.
  const rotate = document.createElement('div');
  rotate.className = 'rotate';
  rotate.setAttribute('role', 'alert');
  rotate.innerHTML = '<p>Gira tu teléfono</p><p class="rotate-hint">Polka-Man se juega en vertical.</p>';
  rotate.hidden = true;

  root.replaceChildren(header, stage, controles.element, rotate);

  // Celular en vertical: la fila del escenario (--maze-h, con el laberinto centrado) y lo demás para los controles.
  const portrait = window.matchMedia(PORTRAIT_PHONE);
  const syncSplit = () => {
    if (!portrait.matches) {
      root.style.removeProperty('--maze-h');
      root.style.removeProperty('--controls-avail');
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
    // Fila del escenario: el laberinto más la mitad de lo que sobra (el laberinto va centrado en ella).
    root.style.setProperty('--maze-h', `${split.stageHeight}px`);
    // Alto real de la fila de controles: las flechas se encogen si no caben (regla .dpad de styles.css).
    root.style.setProperty('--controls-avail', `${split.controlsHeight}px`);
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

  // Sonido: el AudioContext se crea (o se reanuda) en cada gesto. Los listeners de captura en document corren
  // antes que el handler de Jugar, así el contexto ya existe cuando empieza la partida.
  const prefs = createSoundPrefs(safeStorage());
  const audio = createAudio({ prefs });
  const unlockAudio = () => audio.unlock();
  for (const type of ['click', 'keydown', 'touchend', 'pointerup']) document.addEventListener(type, unlockAudio, true);
  if (import.meta.env.DEV) attachAudioDebug(audio);
  const tap = () => audio.tap();
  // «Blip» chiptune en botones, pestañas y enlaces de la interfaz. Los de sonido tienen su propio toque y las
  // flechas del juego no suenan (se tocan sin parar).
  document.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target.closest('button, a[href]') : null;
    if (!target || target.closest('.controles, .sonido-toggle, .hud-sonido-wrap')) return;
    if ((target as HTMLButtonElement).disabled) return;
    audio.blip();
  });

  // Récord del jugador: app.ts es el único dueño de este valor.
  let mine: Mine = null;
  let mineSeq = 0;
  const refreshMine = () => {
    const seq = ++mineSeq;
    mine = null;
    hub.readMine().then(
      (r) => {
        if (seq === mineSeq) mine = r ?? { best: 0n, lifetime: 0n, username: '' };
      },
      () => {
        if (seq === mineSeq) mine = 'error';
      },
    );
  };

  // Admin y hora de inicio del contrato: se leen al arrancar (por ETH-RPC, también fuera del Host), al conectar,
  // al terminar una partida y después de guardar en el panel de admin. null = todavía no se lee o falló.
  let event: EventInfo | null = null;
  let eventSeq = 0;
  const refreshEvent = () => {
    const seq = ++eventSeq;
    hub.readEvent().then(
      (e) => {
        if (seq === eventSeq) event = e;
      },
      () => {
        if (seq === eventSeq) event = null;
      },
    );
  };
  refreshEvent();
  const isAdmin = () => isAdminAccount(event, hub.getState().account?.h160);

  // Capas: lo de abajo de la superficie de arriba queda inerte (applyLayers, más abajo).
  const layers = () => applyLayers();

  // Modal y menú van en #app (no en el escenario) para que su overflow no los recorte.
  const username = createUsername(root, hub, () => refreshMine(), layers);
  const openUsername = () => {
    pauseForMenu(state);
    username.open(typeof mine === 'object' && mine ? mine.username : '');
  };
  // Wallet de premios de la cuenta: se lee al conectar, al terminar una partida y después de guardarla.
  // undefined = todavía no se lee o falló; null = no tiene.
  let payout: Payout = undefined;
  let payoutSeq = 0;
  const refreshPayout = () => {
    const seq = ++payoutSeq;
    if (hub.getState().account === null) {
      payout = undefined;
      return;
    }
    hub.readMyPayout().then(
      (w) => {
        if (seq === payoutSeq) payout = w;
      },
      () => {
        if (seq === payoutSeq) payout = undefined;
      },
    );
  };

  // «Agregar wallet» desde Premios o desde el fin de partida: Perfil con el foco en el campo.
  let shell: Shell | null = null;
  const goToWallet = () => {
    if (state.phase === 'fin') goToTitle(state);
    shell?.go('perfil', { push: true, focus: false });
    perfil.focusWallet();
  };

  const fin = createFinDePartida({
    hub,
    score: () => state.score,
    mine: () => mine,
    onSaved: () => {
      refreshMine();
      refreshPayout();
    },
    openUsername,
    event: () => event,
    payout: () => payout,
    onWallet: () => goToWallet(),
  });

  // Paneles de admin: solo desde Perfil y solo con la cuenta admin.
  const admin = createAdmin(root, hub, () => refreshEvent(), layers);
  const adminPremios = createAdminPremios(root, hub, layers);

  // Salir de una partida con doble confirmación: se pierde el progreso y se vuelve a Jugar.
  const abandonar = createAbandonar(
    root,
    () => {
      menu.close();
      abandon(state);
      shell?.go('jugar');
    },
    layers,
  );
  const askAbandon = () => {
    setPaused(state, true);
    if (state.phase === 'pausa') abandonar.open();
  };

  // Al pasar de sin cuenta a una cuenta, se relee el récord (y el admin, por si cambió en Remix).
  let hadAccount = hub.getState().account !== null;
  hub.subscribe((s) => {
    const has = s.account !== null;
    if (has && !hadAccount) {
      refreshMine();
      refreshEvent();
      refreshPayout();
    }
    if (!has) {
      mineSeq++;
      mine = null;
      payoutSeq++;
      payout = undefined;
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
    onSalir: () => askAbandon(),
  });
  const openMenu = (tab?: MenuTab) => {
    menuOpener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    menu.open(tab);
  };
  const sonidoHud = createSonidoButton(prefs, tap);
  const hud = createHud(
    header,
    state,
    () => (hub.getState().account !== null && typeof mine === 'object' && mine ? mine.best : null),
    () => {
      if (menu.isOpen) return menu.close();
      menuOpener = null;
      menu.open();
    },
    sonidoHud.element,
  );
  hud.sync();

  const overlay = createOverlay(stage, state, {
    fin: [fin.element],
    busy,
    onVerRanking: () => openMenu('ranking'),
    onInicio: () => {
      goToTitle(state);
      shell?.go('jugar');
    },
    onSalir: () => askAbandon(),
    onPhase(phase) {
      if (phase === 'fin') {
        fin.enter();
        refreshEvent();
        if (hub.getState().account !== null) {
          refreshMine();
          refreshPayout();
        }
      }
    },
  });

  // Fuera de la partida: pestañas Jugar · Ranking · Premios · Perfil (components/Shell.ts). Opaco: tapa HUD,
  // escenario y controles. El aviso «sin cuenta» va encima.
  const jugarPanel = document.createElement('div');
  jugarPanel.className = 'jugar';
  const inicio = createInicio(jugarPanel, {
    state,
    hub,
    mine: () => mine,
    onToggle: layers,
    isAdmin,
    billetera: createBilletera(hub).element,
  });
  const rankingTab = createRanking(hub);
  // «Binance» y «Nova Wallet» en Premios y Perfil: diálogo iOS / Android con el enlace a cada tienda.
  const tiendas = createStoreDialog(root, layers);
  const premios = createPremios(hub, { onWallet: () => goToWallet(), onApp: (app) => tiendas.open(app) });
  const perfil = createPerfil({
    hub,
    mine: () => mine,
    payout: () => payout,
    isAdmin,
    billetera: createBilletera(hub).element,
    sonido: createSonidoToggles(prefs, tap).element,
    onUsername: openUsername,
    onAdminInicio: () => {
      if (isAdmin()) admin.open();
    },
    onAdminPremios: () => {
      if (isAdmin()) adminPremios.open();
    },
    onWalletSaved: () => refreshPayout(),
    onApp: (app) => tiendas.open(app),
  });
  shell = createShell(root, {
    // En una partida, ir a otra pestaña la pausa (al volver a Jugar se sigue con Seguir).
    onTab: (tab) => {
      if (tab !== 'jugar') setPaused(state, true);
    },
    panels: {
      jugar: { element: jugarPanel },
      ranking: { element: rankingTab.element, onShow: () => rankingTab.load() },
      premios: { element: premios.element, onShow: () => premios.load() },
      perfil: {
        element: perfil.element,
        onShow: () => {
          refreshPayout();
          refreshEvent();
        },
      },
    },
  });
  const shellRef: Shell = shell;

  // Botón Atrás (Android) e historial: fuera de la partida cambia de pestaña; en una partida no la cierra,
  // la pausa y pregunta si quieres salir (doble confirmación).
  let lastPhase = state.phase;
  window.addEventListener('popstate', () => {
    const route = parseRoute(location.hash);
    if (state.phase === 'titulo') {
      if (route !== 'partida') shellRef.go(route);
      else history.replaceState(null, '', routeHash(shellRef.tab));
      return;
    }
    if (state.phase === 'fin') {
      goToTitle(state);
      shellRef.go(route === 'partida' ? 'jugar' : route);
      return;
    }
    history.pushState(null, '', routeHash('partida'));
    // En otra pestaña durante la partida, Atrás vuelve a Jugar (en pausa); en Jugar pregunta si quieres salir.
    if (shellRef.tab !== 'jugar') {
      shellRef.go('jugar');
      return;
    }
    if (!abandonar.isOpen) askAbandon();
  });
  // En partida solo queda la barra de navegación encima del juego: #app le deja su alto abajo (con-tabbar) y
  // el reparto de la pantalla vertical se recalcula.
  let shownInGame: boolean | null = null;
  const syncMode = () => {
    const inGame = state.phase !== 'titulo';
    if (inGame === shownInGame) return;
    shownInGame = inGame;
    root.classList.toggle('con-tabbar', inGame);
    shellRef.setInGame(inGame);
    syncSplit();
  };
  const syncRoute = () => {
    if (state.phase === lastPhase) return;
    const was = lastPhase;
    lastPhase = state.phase;
    // Empieza una partida: una entrada en el historial para que Atrás no salga de ella.
    if (was === 'titulo') history.pushState(null, '', routeHash('partida'));
    // Vuelve al inicio (fin → Inicio o abandonar): la pestaña sin dejar «partida» atrás.
    if (state.phase === 'titulo') {
      history.replaceState(null, '', routeHash(shellRef.tab));
      shellRef.go(shellRef.tab);
    }
  };

  // Popup de estados: el último en #app, por encima de todo lo demás (salvo «Gira tu teléfono»).
  const tx = createTxEstado(root, hub, layers);
  root.append(rotate);

  const LAYER_ELEMENTS: Record<Exclude<Capa, 'juego' | 'admin'>, HTMLElement> = {
    inicio: shellRef.element,
    pausa: overlay.element,
    fin: overlay.element,
    menu: menu.element,
    username: username.element,
    aviso: inicio.aviso,
    confirmar: abandonar.element,
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
      adminOpen: admin.isOpen || adminPremios.isOpen,
      // El diálogo de las tiendas ocupa el mismo lugar en la pila que el aviso «sin cuenta» (nunca van juntos).
      avisoOpen: inicio.avisoOpen || tiendas.isOpen,
      confirmOpen: abandonar.isOpen,
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
    setInert(header, top === 'inicio' || top === 'username' || top === 'admin' || top === 'aviso' || top === 'confirmar' || top === 'tx');
    for (const [capa, el] of Object.entries(LAYER_ELEMENTS) as Array<[Capa, HTMLElement]>) {
      if (capa === 'pausa' || capa === 'fin' || capa === 'inicio') continue;
      setInert(el, c.inert.includes(capa));
    }
    // El contenedor (y su barra de navegación): en partida se puede tocar sobre el juego, la pausa y el fin,
    // no con el menú, un modal o el popup de estados encima.
    setInert(
      shellRef.element,
      state.phase === 'titulo' ? c.inert.includes('inicio') : !(top === 'juego' || top === 'pausa' || top === 'fin'),
    );
    setInert(tiendas.element, c.inert.includes('aviso'));
    setInert(admin.element, c.inert.includes('admin'));
    setInert(adminPremios.element, c.inert.includes('admin'));
    setInert(overlay.element, c.inert.includes('pausa') || c.inert.includes('fin'));
  }

  overlay.sync();
  inicio.sync();
  syncMode();
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
    if (!document.hidden) return;
    setPaused(state, true);
    // Con la pestaña oculta no hay cuadros: se apagan aquí la música y la sirena (que suena en bucle).
    audio.sync({ phase: state.phase, frightened: state.frightTimer > 0 });
  });
  window.addEventListener('blur', () => setPaused(state, true));

  const renderer = createRenderer(stage, canvas, maze);
  // Destellos y puntos flotantes en curso (decorativos: usan el tiempo del cuadro).
  const effects: Effect[] = [];
  // El dibujo usa los orbes que quedan en el estado; start() y cada ronda los reemplazan.
  const scene: Scene = {
    orbs: state.orbs,
    power: state.power,
    player: state.player,
    ghosts: state.ghosts,
    frightTimer: state.frightTimer,
    death: null,
    effects,
  };

  startLoop({
    step(dt) {
      // Mientras se pide girar el teléfono, la partida no avanza.
      if (landscape.matches) setPaused(state, true);
      // Con otra pestaña encima, la partida tampoco avanza (ni con la tecla P). Se mira la pestaña y no
      // `covers`: en el primer cuadro tras tocar Jugar el contenedor todavía no pasó a modo partida (eso pasa en
      // render), y `covers` seguía en true y pausaba la partida al empezar.
      if (shellRef.tab !== 'jugar') setPaused(state, true);
      update(state, dt);
    },
    render(timeMs) {
      // Un solo drainEvents por cuadro: estos mismos eventos son los que consume el audio.
      const events = drainEvents(state);
      addFromEvents(effects, events, maze, timeMs);
      prune(effects, timeMs);
      // Efectos de sonido con los mismos eventos; música y sirena según la fase y el susto.
      audio.handle(events);
      audio.sync({ phase: state.phase, frightened: state.frightTimer > 0 });
      // La muerte se dibuja desde el phaseTimer de 'muriendo': en pausa queda congelada.
      const dying = state.phase === 'muriendo' || (state.phase === 'pausa' && state.resumePhase === 'muriendo');
      scene.death = dying ? state.phaseTimer : null;
      scene.orbs = state.orbs;
      scene.power = state.power;
      scene.player = state.player;
      scene.ghosts = state.ghosts;
      scene.frightTimer = state.frightTimer;
      overlay.sync();
      inicio.sync();
      syncMode();
      syncRoute();
      if (shellRef.tab === 'perfil') perfil.sync();
      // El contenedor tapa el HUD: el popover de Sonido no queda abierto debajo.
      if (shellRef.covers && sonidoHud.isOpen) sonidoHud.close();
      if (state.phase === 'fin') fin.sync();
      if (menu.isOpen) menu.sync();
      applyLayers();
      hud.sync();
      controles.sync();
      renderer.draw(scene, timeMs);
    },
  });
}
