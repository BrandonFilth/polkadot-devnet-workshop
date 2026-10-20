import { describe, expect, it } from 'vitest';
import { createGame, goToTitle, setDirection, setDirections, setPaused, start, togglePause, update, type GameState } from './game';
import { createGhost } from './ghosts';
import { MAZE, parseMaze } from './maze';
import {
  DEATH_SECONDS,
  DT,
  FRIGHT_SPEED_FACTOR,
  frightenedSeconds,
  GHOST_CHAIN_POINTS,
  ghostCount,
  ghostSpeed,
  HITBOX,
  LIVES,
  ORB_POINTS,
  POWER_POINTS,
  READY_SECONDS,
  RELEASE_INTERVAL,
  ROUND_CLEAR_SECONDS,
} from './rules';
import type { Dir, GhostMode, Vec } from './types';

describe('game', () => {
  it('empieza en titulo', () => {
    const s = createGame(1);
    expect(s.phase).toBe('titulo');
    expect(s.lives).toBe(LIVES);
  });

  it('start desde titulo va a listo', () => {
    const s = createGame(1);
    start(s);
    expect(s.phase).toBe('listo');
    expect(s.phaseTimer).toBe(READY_SECONDS);
    expect(s.score).toBe(0);
    expect(s.lives).toBe(LIVES);
    expect(s.round).toBe(1);
    expect(s.player.pos).toEqual({ x: 9, y: 15 });
  });

  it('start desde jugando no hace nada', () => {
    const s = createGame(1);
    start(s);
    update(s, READY_SECONDS);
    expect(s.phase).toBe('jugando');
    update(s, 0.1);
    const pos = { ...s.player.pos };
    start(s);
    expect(s.phase).toBe('jugando');
    expect(s.player.pos).toEqual(pos);
  });

  it('listo pasa a jugando y Polka-Man se mueve a la izquierda', () => {
    const s = createGame(1);
    start(s);
    update(s, READY_SECONDS / 2);
    expect(s.phase).toBe('listo');
    expect(s.player.pos.x).toBe(9);
    update(s, READY_SECONDS / 2);
    expect(s.phase).toBe('jugando');
    update(s, 0.05);
    expect(s.player.pos.x).toBeLessThan(9);
  });

  it('setDirections guarda las dos pedidas solo en listo y jugando', () => {
    const s = createGame(1);
    setDirections(s, 'arriba', 'derecha');
    expect(s.player.nextDir).toBeNull();
    expect(s.player.altDir).toBeNull();
    start(s);
    setDirections(s, 'arriba', 'derecha');
    expect(s.player.nextDir).toBe('arriba');
    expect(s.player.altDir).toBe('derecha');
    setDirection(s, 'abajo');
    expect(s.player.altDir).toBeNull();
    setPaused(s, true);
    setDirections(s, 'izquierda', 'arriba');
    expect(s.player.nextDir).toBe('abajo');
  });

  it('goToTitle solo desde fin: vuelve a titulo con tablero nuevo y la misma semilla', () => {
    const s = createGame(7);
    start(s);
    update(s, READY_SECONDS + 0.5);
    goToTitle(s);
    expect(s.phase).toBe('jugando');
    s.phase = 'fin';
    s.score = 990;
    s.lives = 0;
    s.round = 4;
    s.orbs.clear();
    const seed = s.seed;
    goToTitle(s);
    expect(s.phase).toBe('titulo');
    expect(s.score).toBe(0);
    expect(s.lives).toBe(LIVES);
    expect(s.round).toBe(1);
    expect(s.orbs.size).toBeGreaterThan(0);
    expect(s.player.pos).toEqual({ x: 9, y: 15 });
    expect(s.seed).toBe(seed);
    start(s);
    expect(s.phase).toBe('listo');
  });

  it('setPaused(true) dos veces deja pausa y no reanuda', () => {
    const s = createGame(1);
    start(s);
    update(s, READY_SECONDS);
    setPaused(s, true);
    expect(s.phase).toBe('pausa');
    setPaused(s, true);
    expect(s.phase).toBe('pausa');
    expect(s.resumePhase).toBe('jugando');
    setPaused(s, false);
    expect(s.phase).toBe('jugando');
    expect(s.resumePhase).toBeNull();
  });

  it('togglePause alterna', () => {
    const s = createGame(1);
    start(s);
    update(s, READY_SECONDS);
    togglePause(s);
    expect(s.phase).toBe('pausa');
    togglePause(s);
    expect(s.phase).toBe('jugando');
  });

  it('la pausa en listo congela tiempo y posiciones y reanuda con el mismo tiempo', () => {
    const s = createGame(1);
    start(s);
    update(s, 0.5);
    const timer = s.phaseTimer;
    const pos = { ...s.player.pos };
    setPaused(s, true);
    expect(s.phase).toBe('pausa');
    update(s, 5);
    expect(s.phaseTimer).toBe(timer);
    expect(s.player.pos).toEqual(pos);
    setPaused(s, false);
    expect(s.phase).toBe('listo');
    expect(s.phaseTimer).toBe(timer);
  });

  it('setPaused(true) en titulo no hace nada; togglePause tampoco', () => {
    const s = createGame(1);
    setPaused(s, true);
    expect(s.phase).toBe('titulo');
    expect(s.resumePhase).toBeNull();
    togglePause(s);
    expect(s.phase).toBe('titulo');
  });

  it('setDirection se ignora en pausa y en titulo', () => {
    const s = createGame(1);
    setDirection(s, 'derecha');
    expect(s.player.nextDir).toBeNull();
    start(s);
    setPaused(s, true);
    setDirection(s, 'derecha');
    expect(s.player.nextDir).toBeNull();
    expect(s.player.dir).toBe('izquierda');
  });
});

describe('orbes, puntaje y rondas', () => {
  const maze = parseMaze(MAZE);
  const W = maze.width;

  /** Partida ya en 'jugando', con Polka-Man en (9, 15) mirando a la izquierda. */
  function playing() {
    const s = createGame(1);
    start(s);
    update(s, READY_SECONDS);
    expect(s.phase).toBe('jugando');
    return s;
  }

  it('start llena los 146 orbes y 4 especiales como copia propia', () => {
    const s = playing();
    expect(s.orbs.size).toBe(146);
    expect(s.power.size).toBe(4);
    expect(s.orbs).not.toBe(maze.orbs);
    update(s, 0.1);
    expect(s.orbs.size).toBe(145);
    expect(parseMaze(MAZE).orbs.size).toBe(146);
  });

  it('comer un orbe suma ORB_POINTS', () => {
    const s = playing();
    update(s, 0.1); // x = 8.4 → casilla (8, 15)
    expect(s.score).toBe(ORB_POINTS);
    expect(s.score).toBe(10);
    expect(s.orbs.has(15 * W + 8)).toBe(false);
  });

  it('comer un especial suma POWER_POINTS', () => {
    const s = playing();
    s.player.pos = { x: 2, y: 15 };
    update(s, 0.1); // x = 1.4 → especial (1, 15)
    expect(s.score).toBe(POWER_POINTS);
    expect(s.score).toBe(50);
    expect(s.power.has(15 * W + 1)).toBe(false);
    expect(s.power.size).toBe(3);
  });

  it('pasar dos veces por la misma casilla no suma otra vez', () => {
    const s = playing();
    update(s, 0.1); // come (8, 15)
    expect(s.score).toBe(10);
    setDirection(s, 'derecha');
    update(s, 0.05); // x = 8.7 → casilla 9
    expect(Math.round(s.player.pos.x)).toBe(9);
    setDirection(s, 'izquierda');
    update(s, 0.05); // x = 8.4 → otra vez la casilla 8
    expect(Math.round(s.player.pos.x)).toBe(8);
    expect(s.score).toBe(10);
  });

  it('vaciar los 150 lleva a rondaLimpia y luego a la ronda 2 completa', () => {
    const s = playing();
    s.orbs = new Set([15 * W + 8]);
    s.power = new Set();
    update(s, 0.1);
    expect(s.phase).toBe('rondaLimpia');
    expect(s.phaseTimer).toBe(ROUND_CLEAR_SECONDS);
    expect(s.round).toBe(1);
    update(s, ROUND_CLEAR_SECONDS);
    expect(s.round).toBe(2);
    expect(s.phase).toBe('listo');
    expect(s.phaseTimer).toBe(READY_SECONDS);
    expect(s.orbs.size + s.power.size).toBe(150);
    expect(s.player.pos).toEqual({ x: 9, y: 15 });
    expect(s.player.dir).toBe('izquierda');
  });

  it('pausar en rondaLimpia congela el temporizador y reanudar vuelve a rondaLimpia', () => {
    const s = playing();
    s.orbs = new Set([15 * W + 8]);
    s.power = new Set();
    update(s, 0.1);
    update(s, 0.5);
    const timer = s.phaseTimer;
    expect(timer).toBeCloseTo(ROUND_CLEAR_SECONDS - 0.5);
    setPaused(s, true);
    expect(s.phase).toBe('pausa');
    expect(s.resumePhase).toBe('rondaLimpia');
    update(s, 5);
    expect(s.phaseTimer).toBe(timer);
    expect(s.round).toBe(1);
    setPaused(s, false);
    expect(s.phase).toBe('rondaLimpia');
    expect(s.phaseTimer).toBe(timer);
  });
});

describe('fantasmas, choques y vidas', () => {
  const maze = parseMaze(MAZE);
  const W = maze.width;

  function playing() {
    const s = createGame(1);
    start(s);
    update(s, READY_SECONDS);
    expect(s.phase).toBe('jugando');
    return s;
  }

  /** Pone el fantasma 0 en 'normal' encima de Polka-Man. */
  function ghostOnPlayer(s: ReturnType<typeof createGame>, mode: GhostMode = 'normal') {
    const g = createGhost(maze, 0);
    g.mode = mode;
    g.pos = { ...s.player.pos };
    s.ghosts = [g];
    return g;
  }

  it('la partida empieza con ghostCount(1) fantasmas en casa', () => {
    const s = playing();
    expect(s.ghosts.length).toBe(ghostCount(1));
    expect(s.ghosts.every((g) => g.mode === 'casa')).toBe(true);
  });

  it('chocar con un normal resta una vida y reinicia posiciones conservando los orbes', () => {
    const s = playing();
    update(s, 0.1); // come (8, 15)
    expect(s.orbs.has(15 * W + 8)).toBe(false);
    const orbs = s.orbs.size;
    const score = s.score;
    ghostOnPlayer(s);
    update(s, 0.01);
    expect(s.phase).toBe('muriendo');
    expect(s.phaseTimer).toBe(DEATH_SECONDS);
    expect(s.lives).toBe(LIVES - 1);
    update(s, DEATH_SECONDS);
    expect(s.phase).toBe('listo');
    expect(s.phaseTimer).toBe(READY_SECONDS);
    expect(s.player.pos).toEqual({ x: 9, y: 15 });
    expect(s.ghosts.length).toBe(ghostCount(1));
    expect(s.ghosts.every((g) => g.mode === 'casa')).toBe(true);
    expect(s.ghosts.map((g) => g.pos)).toEqual([maze.house[0], maze.house[1]]);
    expect(s.releaseClock).toBe(0);
    expect(s.orbs.size).toBe(orbs);
    expect(s.orbs.has(15 * W + 8)).toBe(false);
    expect(s.score).toBe(score);
  });

  it('chocar con un fantasma saliendo en (9, 7) resta una vida', () => {
    const s = playing();
    s.player.pos = { x: 9, y: 7 };
    const g = createGhost(maze, 0);
    g.mode = 'saliendo';
    g.dir = 'arriba';
    g.pos = { x: 9, y: 7.3 };
    s.ghosts = [g];
    update(s, 0.001);
    expect(g.mode).toBe('saliendo');
    expect(s.phase).toBe('muriendo');
    expect(s.lives).toBe(LIVES - 1);
  });

  it('un fantasma en casa nunca choca', () => {
    const s = playing();
    // El fantasma 1 sigue en casa durante RELEASE_INTERVAL s.
    const g = createGhost(maze, 1);
    s.ghosts = [g];
    for (let t = 0; t < RELEASE_INTERVAL - 0.5; t += 0.01) {
      g.pos = { ...s.player.pos };
      update(s, 0.01);
      expect(g.mode).toBe('casa');
      expect(s.phase).toBe('jugando');
    }
    expect(s.lives).toBe(LIVES);
    expect(HITBOX).toBe(0.6);
  });

  it('el choque considera el túnel', () => {
    const s = playing();
    s.player.pos = { x: -0.2, y: 9 };
    s.player.dir = 'izquierda';
    const g = createGhost(maze, 0);
    g.mode = 'normal';
    g.dir = 'derecha';
    g.pos = { x: 18.3, y: 9 }; // 0.5 casillas por el túnel
    s.ghosts = [g];
    update(s, 0.001);
    expect(s.phase).toBe('muriendo');
  });

  it('al quinto choque la fase es fin', () => {
    const s = playing();
    for (let i = 1; i <= LIVES; i++) {
      ghostOnPlayer(s);
      update(s, 0.01);
      expect(s.phase).toBe('muriendo');
      expect(s.lives).toBe(LIVES - i);
      update(s, DEATH_SECONDS);
      if (i < LIVES) {
        expect(s.phase).toBe('listo');
        update(s, READY_SECONDS);
      }
    }
    expect(s.phase).toBe('fin');
    expect(s.lives).toBe(0);
    // 'fin' no se pausa.
    setPaused(s, true);
    expect(s.phase).toBe('fin');
  });

  it('pausar en muriendo congela el temporizador y reanudar vuelve a muriendo', () => {
    const s = playing();
    ghostOnPlayer(s);
    update(s, 0.01);
    update(s, 0.5);
    const timer = s.phaseTimer;
    expect(timer).toBeCloseTo(DEATH_SECONDS - 0.5);
    setPaused(s, true);
    expect(s.phase).toBe('pausa');
    expect(s.resumePhase).toBe('muriendo');
    update(s, 5);
    expect(s.phaseTimer).toBe(timer);
    setPaused(s, false);
    expect(s.phase).toBe('muriendo');
    expect(s.phaseTimer).toBe(timer);
  });

  it('start desde fin reinicia puntaje, vidas, ronda, orbes y fantasmas', () => {
    const s = playing();
    s.phase = 'fin';
    s.lives = 0;
    s.score = 1230;
    s.round = 4;
    s.orbs = new Set();
    s.ghosts = [];
    start(s);
    expect(s.phase).toBe('listo');
    expect(s.score).toBe(0);
    expect(s.lives).toBe(LIVES);
    expect(s.round).toBe(1);
    expect(s.orbs.size + s.power.size).toBe(150);
    expect(s.player.pos).toEqual({ x: 9, y: 15 });
    expect(s.ghosts.length).toBe(ghostCount(1));
    expect(s.ghosts.every((g) => g.mode === 'casa')).toBe(true);
  });

  it('en la ronda 4 hay 3 fantasmas', () => {
    const s = playing();
    s.round = 3;
    s.orbs = new Set([15 * W + 8]);
    s.power = new Set();
    update(s, 0.1);
    expect(s.phase).toBe('rondaLimpia');
    update(s, ROUND_CLEAR_SECONDS);
    expect(s.round).toBe(4);
    expect(s.ghosts.length).toBe(3);
    expect(s.ghosts.every((g) => g.mode === 'casa')).toBe(true);
  });

  it('último orbe y choque en el mismo paso: gana rondaLimpia y no se pierde vida', () => {
    const s = playing();
    s.orbs = new Set([15 * W + 8]);
    s.power = new Set();
    ghostOnPlayer(s);
    update(s, 0.1);
    expect(s.phase).toBe('rondaLimpia');
    expect(s.lives).toBe(LIVES);
  });
});

describe('orbes especiales y susto', () => {
  const maze = parseMaze(MAZE);

  function playing() {
    const s = createGame(1);
    start(s);
    update(s, READY_SECONDS);
    expect(s.phase).toBe('jugando');
    return s;
  }

  function ghost(id: number, pos: Vec, mode: GhostMode, dir: Dir) {
    const g = createGhost(maze, id);
    g.pos = { ...pos };
    g.mode = mode;
    g.dir = dir;
    return g;
  }

  /** Polka-Man en (2, 15) mirando a la izquierda: en 0.1 s come el especial (1, 15). */
  function eatPower(s: GameState) {
    s.player.pos = { x: 2, y: 15 };
    s.player.dir = 'izquierda';
    update(s, 0.1);
  }

  it('el especial asusta y da media vuelta a los normal, no a los de la casa', () => {
    const s = playing();
    const out = ghost(0, { x: 5.5, y: 1 }, 'normal', 'derecha');
    const home = createGhost(maze, 1);
    s.ghosts = [out, home];
    eatPower(s);
    expect(s.score).toBe(POWER_POINTS);
    expect(s.frightTimer).toBe(frightenedSeconds(1));
    expect(out.mode).toBe('asustado');
    expect(out.dir).toBe('izquierda');
    expect(out.pos.x).toBeCloseTo(5.5 - FRIGHT_SPEED_FACTOR * ghostSpeed(1) * 0.1);
    expect(home.mode).toBe('casa');
  });

  it('comer dos fantasmas en un susto suma 200 + 400', () => {
    const s = playing();
    s.ghosts = [];
    eatPower(s);
    const before = s.score;
    s.ghosts = [ghost(0, s.player.pos, 'asustado', 'arriba'), ghost(1, s.player.pos, 'asustado', 'abajo')];
    update(s, DT);
    expect(s.score - before).toBe(GHOST_CHAIN_POINTS[0]! + GHOST_CHAIN_POINTS[1]!);
    expect(s.score - before).toBe(600);
    expect(s.ghosts.map((g) => g.mode)).toEqual(['ojos', 'ojos']);
    expect(s.phase).toBe('jugando');
    expect(s.lives).toBe(LIVES);
  });

  it('la cadena no pasa de 1600', () => {
    const s = playing();
    s.ghosts = [];
    eatPower(s);
    const before = s.score;
    s.ghosts = Array.from({ length: 6 }, (_, i) => ghost(i, s.player.pos, 'asustado', 'arriba'));
    update(s, DT);
    expect(s.score - before).toBe(200 + 400 + 800 + 1600 + 1600 + 1600);
  });

  it('un fantasma comido llega a la casa como ojos y vuelve en normal', () => {
    const s = playing();
    s.ghosts = [];
    eatPower(s);
    const g = ghost(0, s.player.pos, 'asustado', 'derecha');
    s.ghosts = [g];
    update(s, DT);
    expect(g.mode).toBe('ojos');
    const modes: string[] = ['ojos'];
    for (let i = 0; i < 20 / DT && g.mode !== 'normal'; i++) {
      update(s, DT);
      if (modes[modes.length - 1] !== g.mode) modes.push(g.mode);
    }
    expect(modes).toEqual(['ojos', 'saliendo', 'normal']);
    expect({ x: Math.round(g.pos.x), y: Math.round(g.pos.y) }).toEqual(maze.exit);
  });

  it('un segundo especial reinicia tiempo y cadena sin dar media vuelta a los asustados', () => {
    const s = playing();
    s.ghosts = [];
    eatPower(s);
    // Pasa 1 s de susto y se come uno: la cadena va en 1.
    for (let i = 0; i < Math.round(1 / DT); i++) update(s, DT);
    expect(s.frightTimer).toBeCloseTo(frightenedSeconds(1) - 1);
    s.ghosts = [ghost(2, s.player.pos, 'asustado', 'arriba')];
    update(s, DT);
    expect(s.frightChain).toBe(1);

    const scared = ghost(0, { x: 5.5, y: 1 }, 'asustado', 'derecha');
    const normal = ghost(1, { x: 5.5, y: 3 }, 'normal', 'derecha');
    s.ghosts = [scared, normal];
    s.player.pos = { x: 16, y: 15 };
    s.player.dir = 'derecha';
    update(s, 0.1); // come el especial (17, 15)
    expect(s.power.size).toBe(2);
    expect(s.frightTimer).toBe(frightenedSeconds(1));
    expect(s.frightChain).toBe(0);
    expect(scared.mode).toBe('asustado');
    expect(scared.dir).toBe('derecha');
    expect(normal.mode).toBe('asustado');
    expect(normal.dir).toBe('izquierda');

    // La cadena empieza otra vez en 200.
    const before = s.score;
    s.ghosts.push(ghost(3, s.player.pos, 'asustado', 'arriba'));
    update(s, DT);
    expect(s.score - before).toBe(200);
  });

  it('el temporizador es uno solo y al acabar vuelven a normal sin media vuelta', () => {
    const s = playing();
    s.ghosts = [];
    eatPower(s);
    const steps = Math.round(frightenedSeconds(1) / DT);
    for (let i = 0; i < steps - 3; i++) update(s, DT);
    expect(s.frightTimer).toBeGreaterThan(0);
    const g = ghost(0, { x: 5.5, y: 1 }, 'asustado', 'derecha');
    s.ghosts = [g];
    for (let i = 0; i < 4; i++) update(s, DT);
    expect(s.frightTimer).toBe(0);
    expect(g.mode).toBe('normal');
    expect(g.dir).toBe('derecha');
  });

  it('tocar unos ojos no quita vida ni suma puntos', () => {
    const s = playing();
    s.ghosts = [ghost(0, s.player.pos, 'ojos', 'arriba')];
    const score = s.score;
    s.player.dir = null;
    for (let i = 0; i < 3; i++) {
      s.ghosts[0]!.pos = { ...s.player.pos };
      update(s, DT);
    }
    expect(s.phase).toBe('jugando');
    expect(s.lives).toBe(LIVES);
    expect(s.score).toBe(score);
  });

  it('asustado y normal en el mismo paso: primero suma 200 y después Polka-Man muere', () => {
    const s = playing();
    s.ghosts = [];
    eatPower(s);
    const before = s.score;
    s.ghosts = [ghost(0, s.player.pos, 'normal', 'arriba'), ghost(1, s.player.pos, 'asustado', 'abajo')];
    update(s, DT);
    expect(s.score - before).toBe(200);
    expect(s.ghosts[1]!.mode).toBe('ojos');
    expect(s.phase).toBe('muriendo');
    expect(s.lives).toBe(LIVES - 1);
    // Morir termina el susto y reinicia la cadena.
    expect(s.frightTimer).toBe(0);
    expect(s.frightChain).toBe(0);
  });

  it('limpiar la ronda termina el susto', () => {
    const s = playing();
    s.ghosts = [];
    s.orbs = new Set();
    s.power = new Set([15 * maze.width + 1, 15 * maze.width + 17]);
    eatPower(s);
    expect(s.frightTimer).toBe(frightenedSeconds(1));
    s.power = new Set([15 * maze.width + 1]);
    eatPower(s);
    expect(s.phase).toBe('rondaLimpia');
    expect(s.frightTimer).toBe(0);
    expect(s.frightChain).toBe(0);
  });
});
