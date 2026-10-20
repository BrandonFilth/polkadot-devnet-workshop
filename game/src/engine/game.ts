// Estado de la partida: mutable y serializable (solo datos). Avanza con update(state, dt).
import { createGhosts, frighten, playerTile, updateGhost, type Ghost } from './ghosts';
import { MAZE, parseMaze, tileIndex } from './maze';
import { createPlayer, requestDirections, updatePlayer, type Player } from './player';
import {
  DEATH_SECONDS,
  frightenedSeconds,
  GHOST_CHAIN_POINTS,
  ghostCount,
  ghostSpeed,
  HITBOX,
  LAG_SAMPLE_SECONDS,
  LAG_SAMPLES,
  LIVES,
  ORB_POINTS,
  POWER_POINTS,
  READY_SECONDS,
  RELEASE_INTERVAL,
  ROUND_CLEAR_SECONDS,
} from './rules';
import type { ActivePhase, Dir, Phase, Vec } from './types';

const maze = parseMaze(MAZE);

/** Tolerancia de los temporizadores que se acumulan con sumas de dt. */
const EPS = 1e-9;

export interface GameState {
  /** Semilla del generador; random() la avanza. */
  seed: number;
  phase: Phase;
  /** Fase a la que se regresa al quitar la pausa. */
  resumePhase: ActivePhase | null;
  /** Segundos restantes de la fase 'listo', 'muriendo' o 'rondaLimpia'. */
  phaseTimer: number;
  score: number;
  lives: number;
  round: number;
  player: Player;
  /** Orbes normales que quedan (copia propia; el laberinto no cambia). */
  orbs: Set<number>;
  /** Orbes especiales que quedan (copia propia). */
  power: Set<number>;
  ghosts: Ghost[];
  /** Segundos en 'jugando' desde la última vida o ronda nueva (salida escalonada). */
  releaseClock: number;
  /** Casillas de Polka-Man para Lag, de la más vieja a la más nueva. */
  lagSamples: Vec[];
  /** Segundos acumulados hacia la siguiente muestra de Lag. */
  lagClock: number;
  /** Segundos de susto que quedan; uno solo para toda la partida (0 = sin susto). */
  frightTimer: number;
  /** Fantasmas comidos en el susto actual (índice en GHOST_CHAIN_POINTS). */
  frightChain: number;
}

const ACTIVE: readonly Phase[] = ['listo', 'jugando', 'muriendo', 'rondaLimpia'];

function isActive(phase: Phase): phase is ActivePhase {
  return ACTIVE.includes(phase);
}

/** Orbes y especiales completos otra vez. */
function refillOrbs(state: GameState): void {
  state.orbs = new Set(maze.orbs);
  state.power = new Set(maze.power);
}

/** Polka-Man y fantasmas a sus posiciones de inicio; temporizadores y muestras de Lag de cero. */
function resetPositions(state: GameState): void {
  state.player = createPlayer(maze);
  state.ghosts = createGhosts(maze, ghostCount(state.round));
  state.releaseClock = 0;
  state.lagSamples = [];
  state.lagClock = 0;
  endFright(state);
}

/** Termina el susto y reinicia la cadena; los asustados vuelven a 'normal' sin media vuelta. */
function endFright(state: GameState): void {
  state.frightTimer = 0;
  state.frightChain = 0;
  for (const ghost of state.ghosts) if (ghost.mode === 'asustado') ghost.mode = 'normal';
}

/** Orbe especial: temporizador lleno, cadena desde 200 y los 'normal' se asustan. */
function startFright(state: GameState): void {
  state.frightTimer = frightenedSeconds(state.round);
  state.frightChain = 0;
  for (const ghost of state.ghosts) frighten(ghost);
}

/** Descuenta el susto; al llegar a 0 termina. */
function tickFright(state: GameState, dt: number): void {
  if (state.frightTimer <= 0) return;
  state.frightTimer = Math.max(0, state.frightTimer - dt);
  if (state.frightTimer <= EPS) endFright(state);
}

export function createGame(seed: number): GameState {
  return {
    seed,
    phase: 'titulo',
    resumePhase: null,
    phaseTimer: 0,
    score: 0,
    lives: LIVES,
    round: 1,
    player: createPlayer(maze),
    orbs: new Set(maze.orbs),
    power: new Set(maze.power),
    ghosts: createGhosts(maze, ghostCount(1)),
    releaseClock: 0,
    lagSamples: [],
    lagClock: 0,
    frightTimer: 0,
    frightChain: 0,
  };
}

/** Empieza una partida. Solo desde 'titulo' o 'fin'. */
export function start(state: GameState): void {
  if (state.phase !== 'titulo' && state.phase !== 'fin') return;
  state.score = 0;
  state.lives = LIVES;
  state.round = 1;
  refillOrbs(state);
  resetPositions(state);
  state.resumePhase = null;
  state.phase = 'listo';
  state.phaseTimer = READY_SECONDS;
}

/** Pide una dirección principal y, en diagonal, una secundaria. Solo cuenta en 'listo' y 'jugando'. */
export function setDirections(state: GameState, primary: Dir, secondary: Dir | null): void {
  if (state.phase !== 'listo' && state.phase !== 'jugando') return;
  requestDirections(state.player, primary, secondary);
}

/** Pide una dirección. Solo cuenta en 'listo' y 'jugando'. */
export function setDirection(state: GameState, dir: Dir): void {
  setDirections(state, dir, null);
}

/** Vuelve a la pantalla de inicio. Solo desde 'fin': tablero nuevo, misma semilla. */
export function goToTitle(state: GameState): void {
  if (state.phase !== 'fin') return;
  state.score = 0;
  state.lives = LIVES;
  state.round = 1;
  refillOrbs(state);
  resetPositions(state);
  state.resumePhase = null;
  state.phaseTimer = 0;
  state.phase = 'titulo';
}

/** Pausa (true) o reanuda (false). Idempotente: repetir la llamada no cambia nada. */
export function setPaused(state: GameState, paused: boolean): void {
  if (paused) {
    if (!isActive(state.phase)) return;
    state.resumePhase = state.phase;
    state.phase = 'pausa';
    return;
  }
  if (state.phase !== 'pausa') return;
  state.phase = state.resumePhase ?? 'jugando';
  state.resumePhase = null;
}

export function togglePause(state: GameState): void {
  if (state.phase === 'pausa') setPaused(state, false);
  else setPaused(state, true);
}

/** Come lo que haya en la casilla redondeada de Polka-Man. */
function eat(state: GameState): void {
  const i = tileIndex(maze, Math.round(state.player.pos.x), Math.round(state.player.pos.y));
  if (state.orbs.delete(i)) state.score += ORB_POINTS;
  else if (state.power.delete(i)) {
    state.score += POWER_POINTS;
    startFright(state);
  }
}

/** Siguiente ronda: orbes completos, posiciones de inicio y fantasmas recalculados. */
function nextRound(state: GameState): void {
  state.round += 1;
  refillOrbs(state);
  resetPositions(state);
  state.phase = 'listo';
  state.phaseTimer = READY_SECONDS;
}

function moveGhosts(state: GameState, dt: number): void {
  const world = {
    player: state.player,
    lagSamples: state.lagSamples,
    rng: state,
    speed: ghostSpeed(state.round),
  };
  for (const ghost of state.ghosts) updateGhost(ghost, world, maze, dt);
}

/** Distancia entre centros considerando el túnel. */
function tunnelDistance(a: Vec, b: Vec): number {
  const dx = Math.abs(a.x - b.x);
  return Math.hypot(Math.min(dx, maze.width - dx), a.y - b.y);
}

function touches(state: GameState, ghost: Ghost): boolean {
  return tunnelDistance(ghost.pos, state.player.pos) < HITBOX;
}

/** Come, en orden de índice, a todos los asustados que tocan a Polka-Man. */
function eatGhosts(state: GameState): void {
  for (const ghost of state.ghosts) {
    if (ghost.mode !== 'asustado' || !touches(state, ghost)) continue;
    const k = Math.min(state.frightChain, GHOST_CHAIN_POINTS.length - 1);
    state.score += GHOST_CHAIN_POINTS[k]!;
    state.frightChain += 1;
    ghost.mode = 'ojos';
    ghost.lastTile = -1;
  }
}

/** ¿Algún fantasma peligroso toca a Polka-Man? 'ojos' y 'casa' no hacen nada. */
function hitByGhost(state: GameState): boolean {
  return state.ghosts.some((g) => (g.mode === 'normal' || g.mode === 'saliendo') && touches(state, g));
}

/** Salida escalonada y muestras de Lag. */
function tickTimers(state: GameState, dt: number): void {
  state.releaseClock += dt;
  for (const ghost of state.ghosts) {
    if (ghost.mode === 'casa' && state.releaseClock >= ghost.id * RELEASE_INTERVAL - EPS) {
      ghost.mode = 'saliendo';
    }
  }
  state.lagClock += dt;
  while (state.lagClock >= LAG_SAMPLE_SECONDS - EPS) {
    state.lagClock = Math.max(0, state.lagClock - LAG_SAMPLE_SECONDS);
    state.lagSamples.push(playerTile(maze, state.player.pos));
    if (state.lagSamples.length > LAG_SAMPLES) state.lagSamples.shift();
  }
}

export function update(state: GameState, dt: number): void {
  switch (state.phase) {
    case 'listo':
      state.phaseTimer = Math.max(0, state.phaseTimer - dt);
      if (state.phaseTimer === 0) state.phase = 'jugando';
      break;
    case 'jugando':
      tickFright(state, dt);
      updatePlayer(state.player, maze, dt);
      eat(state);
      if (state.orbs.size === 0 && state.power.size === 0) {
        endFright(state);
        state.phase = 'rondaLimpia';
        state.phaseTimer = ROUND_CLEAR_SECONDS;
        break;
      }
      moveGhosts(state, dt);
      eatGhosts(state);
      if (hitByGhost(state)) {
        endFright(state);
        state.lives -= 1;
        state.phase = 'muriendo';
        state.phaseTimer = DEATH_SECONDS;
        break;
      }
      tickTimers(state, dt);
      break;
    case 'muriendo':
      state.phaseTimer = Math.max(0, state.phaseTimer - dt);
      if (state.phaseTimer === 0) {
        if (state.lives > 0) {
          resetPositions(state);
          state.phase = 'listo';
          state.phaseTimer = READY_SECONDS;
        } else {
          state.phase = 'fin';
        }
      }
      break;
    case 'rondaLimpia':
      state.phaseTimer = Math.max(0, state.phaseTimer - dt);
      if (state.phaseTimer === 0) nextRound(state);
      break;
    default:
      break;
  }
}
