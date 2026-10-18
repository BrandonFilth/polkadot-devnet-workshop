import { describe, expect, it } from 'vitest';
import { createGame, start, update } from './game';
import {
  CORNER_BL,
  CORNER_TL,
  CORNER_TR,
  createGhost,
  frighten,
  ghostTarget,
  houseCenter,
  PERSONALITIES,
  updateGhost,
  type Ghost,
  type GhostWorld,
} from './ghosts';
import { MAZE, parseMaze, tileAt } from './maze';
import { OPPOSITE } from './movement';
import {
  DT,
  EYES_SPEED,
  FORK_AHEAD,
  FRIGHT_SPEED_FACTOR,
  GAS_RADIUS,
  GHOST_BASE_SPEED,
  LAG_SAMPLE_SECONDS,
  LAG_SAMPLES,
  NONCE_RADIUS,
  READY_SECONDS,
  RELEASE_INTERVAL,
} from './rules';
import type { Dir, Vec } from './types';

const maze = parseMaze(MAZE);

function world(playerPos: Vec, playerDir: Dir | null = 'izquierda', samples: Vec[] = []): GhostWorld {
  return {
    player: { pos: playerPos, dir: playerDir },
    lagSamples: samples,
    rng: { seed: 12345 },
    speed: GHOST_BASE_SPEED,
  };
}

function ghostAt(id: number, pos: Vec, mode: Ghost['mode'] = 'normal', dir: Dir = 'izquierda'): Ghost {
  const g = createGhost(maze, id);
  g.pos = { ...pos };
  g.mode = mode;
  g.dir = dir;
  return g;
}

describe('personalidades', () => {
  it('6 colores propios; ninguno es el rosa de Polka-Man', () => {
    expect(PERSONALITIES.map((p) => p.name)).toEqual(['Bug', 'Lag', 'Spam', 'Fork', 'Gas', 'Nonce']);
    expect(PERSONALITIES.map((p) => p.color)).toEqual([
      '#ff6b4a',
      '#9be7b0',
      '#ffd479',
      '#7fb8ff',
      '#c39bff',
      '#5ee0d0',
    ]);
    expect(PERSONALITIES.some((p) => p.color.toLowerCase() === '#ff2867')).toBe(false);
  });

  it('Bug apunta a la casilla de Polka-Man', () => {
    const g = ghostAt(0, { x: 9, y: 7 });
    expect(ghostTarget(g, world({ x: 4.3, y: 15 }), maze)).toEqual({ x: 4, y: 15 });
  });

  it('Lag apunta a la muestra más vieja; sin muestras, a Polka-Man', () => {
    const g = ghostAt(1, { x: 9, y: 7 });
    expect(ghostTarget(g, world({ x: 5, y: 15 }), maze)).toEqual({ x: 5, y: 15 });
    const samples = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ];
    expect(ghostTarget(g, world({ x: 5, y: 15 }, 'izquierda', samples), maze)).toEqual({ x: 1, y: 1 });
  });

  it('Lag guarda LAG_SAMPLES muestras, una cada LAG_SAMPLE_SECONDS, y se vacían en cada vida', () => {
    const s = createGame(7);
    start(s);
    update(s, READY_SECONDS);
    s.ghosts = []; // sin fantasmas que interrumpan
    const steps = Math.round((LAG_SAMPLE_SECONDS * 3) / DT);
    for (let i = 0; i < steps; i++) update(s, DT);
    expect(s.lagSamples.length).toBe(3);
    const more = Math.round((LAG_SAMPLE_SECONDS * (LAG_SAMPLES + 4)) / DT);
    for (let i = 0; i < more; i++) update(s, DT);
    expect(s.phase).toBe('jugando');
    expect(s.lagSamples.length).toBe(LAG_SAMPLES);
    // Muerte forzada: al volver a 'listo' no quedan muestras.
    s.ghosts = [ghostAt(0, s.player.pos)];
    update(s, DT);
    expect(s.phase).toBe('muriendo');
    update(s, 10);
    expect(s.lagSamples).toEqual([]);
  });

  it('Spam no tiene objetivo y elige al azar de forma determinista', () => {
    const g = ghostAt(2, { x: 9, y: 7 });
    expect(ghostTarget(g, world({ x: 5, y: 15 }), maze)).toBeNull();
    const run = () => {
      const a = ghostAt(2, { x: 9, y: 7 });
      const w = world({ x: 5, y: 15 });
      const path: string[] = [];
      for (let i = 0; i < 600; i++) {
        updateGhost(a, w, maze, DT);
        path.push(a.dir);
      }
      return path.join(',');
    };
    expect(run()).toBe(run());
  });

  it('Fork apunta FORK_AHEAD casillas delante, recortado al tablero', () => {
    const g = ghostAt(3, { x: 9, y: 7 });
    expect(ghostTarget(g, world({ x: 9, y: 15 }, 'izquierda'), maze)).toEqual({ x: 9 - FORK_AHEAD, y: 15 });
    expect(ghostTarget(g, world({ x: 9, y: 15 }, 'abajo'), maze)).toEqual({ x: 9, y: 19 });
    expect(ghostTarget(g, world({ x: 2, y: 1 }, 'izquierda'), maze)).toEqual({ x: 0, y: 1 });
    expect(ghostTarget(g, world({ x: 2, y: 19 }, 'abajo'), maze)).toEqual({ x: 2, y: 20 });
    expect(ghostTarget(g, world({ x: 16, y: 1 }, 'derecha'), maze)).toEqual({ x: 18, y: 1 });
  });

  it('Gas persigue de lejos y se va a la esquina BL dentro de GAS_RADIUS', () => {
    const far = ghostAt(4, { x: 9, y: 1 });
    expect(ghostTarget(far, world({ x: 9, y: 1 + GAS_RADIUS + 1 }), maze)).toEqual({ x: 9, y: 8 });
    const near = ghostAt(4, { x: 9, y: 1 });
    expect(ghostTarget(near, world({ x: 9, y: 1 + GAS_RADIUS }), maze)).toEqual(CORNER_BL);
  });

  it('Nonce recorre las esquinas y persigue dentro de NONCE_RADIUS', () => {
    const g = ghostAt(5, { x: 9, y: 19 });
    expect(ghostTarget(g, world({ x: 9, y: 19 - NONCE_RADIUS - 1 }), maze)).toEqual(CORNER_TL);
    expect(ghostTarget(g, world({ x: 9, y: 19 - NONCE_RADIUS }), maze)).toEqual({ x: 9, y: 19 - NONCE_RADIUS });
    // En la esquina TL cambia a la siguiente (TR).
    const atCorner = ghostAt(5, { x: 1, y: 1 }, 'normal', 'arriba');
    updateGhost(atCorner, world({ x: 9, y: 19 }), maze, DT);
    expect(atCorner.corner).toBe(1);
    expect(ghostTarget(atCorner, world({ x: 9, y: 19 }), maze)).toEqual(CORNER_TR);
  });
});

describe('movimiento en normal', () => {
  it('ningún fantasma da media vuelta ni entra a una pared, la puerta o la casa', () => {
    for (let id = 0; id < PERSONALITIES.length; id++) {
      for (const player of [
        { x: 1, y: 1 },
        { x: 17, y: 19 },
        { x: 9, y: 15 },
      ]) {
        const g = ghostAt(id, { x: 9, y: 7 });
        const w = world(player, 'derecha', [{ x: 1, y: 19 }]);
        const errors: string[] = [];
        for (let i = 0; i < 20 / DT; i++) {
          const before = g.dir;
          updateGhost(g, w, maze, DT);
          if (g.dir === OPPOSITE[before]) errors.push(`${id} media vuelta en el paso ${i}`);
          const t = tileAt(maze, Math.round(g.pos.x), Math.round(g.pos.y));
          if (t === 'pared' || t === 'puerta' || t === 'casa') errors.push(`${id} en ${t} en el paso ${i}`);
          // Tampoco a mitad de camino hacia una pared (tolerancia de redondeo en los centros).
          const x = Math.round(g.pos.x * 1e6) / 1e6;
          const y = Math.round(g.pos.y * 1e6) / 1e6;
          if (
            tileAt(maze, Math.ceil(x), Math.ceil(y)) === 'pared' ||
            tileAt(maze, Math.floor(x), Math.floor(y)) === 'pared'
          ) {
            errors.push(`${id} entre paredes en el paso ${i}`);
          }
        }
        expect(errors).toEqual([]);
      }
    }
  });
});

describe('salida de la casa', () => {
  function play() {
    const s = createGame(3);
    start(s);
    update(s, READY_SECONDS);
    expect(s.phase).toBe('jugando');
    return s;
  }

  it('el fantasma 0 sale a los 0 s y el 1 a los RELEASE_INTERVAL s de jugando', () => {
    const s = play();
    expect(s.ghosts.length).toBe(2);
    expect(s.ghosts.map((g) => g.mode)).toEqual(['casa', 'casa']);
    update(s, DT);
    expect(s.ghosts[0]!.mode).toBe('saliendo');
    expect(s.ghosts[1]!.mode).toBe('casa');
    const steps = Math.round(RELEASE_INTERVAL / DT);
    for (let i = 1; i < steps - 1; i++) update(s, DT);
    expect(s.ghosts[1]!.mode).toBe('casa');
    update(s, DT);
    expect(s.ghosts[1]!.mode).toBe('saliendo');
  });

  it('los temporizadores no cuentan en listo', () => {
    const s = createGame(3);
    start(s);
    update(s, READY_SECONDS - 0.01);
    expect(s.releaseClock).toBe(0);
    expect(s.ghosts.every((g) => g.mode === 'casa')).toBe(true);
  });

  it('en casa no se mueve', () => {
    const g = createGhost(maze, 1);
    const pos = { ...g.pos };
    updateGhost(g, world({ x: 9, y: 15 }), maze, 1);
    expect(g.pos).toEqual(pos);
  });

  function leave(id: number, player: Vec): Ghost {
    const g = createGhost(maze, id);
    g.mode = 'saliendo';
    const w = world(player);
    for (let i = 0; i < 10 / DT && g.mode === 'saliendo'; i++) {
      updateGhost(g, w, maze, DT);
      const t = tileAt(maze, Math.round(g.pos.x), Math.round(g.pos.y));
      expect(t).not.toBe('pared');
    }
    return g;
  }

  it('al llegar a (9, 7) pasa a normal hacia izquierda o derecha', () => {
    for (let id = 0; id < 3; id++) {
      const g = leave(id, { x: 9, y: 15 });
      expect(g.mode).toBe('normal');
      expect(Math.round(g.pos.y)).toBe(7);
      expect(['izquierda', 'derecha']).toContain(g.dir);
    }
  });

  it('Bug sale a la derecha con Polka-Man en (17, 7) y a la izquierda con (1, 7)', () => {
    expect(leave(0, { x: 17, y: 7 }).dir).toBe('derecha');
    expect(leave(0, { x: 1, y: 7 }).dir).toBe('izquierda');
  });
});

describe('asustado', () => {
  it('frighten asusta y da media vuelta solo a los normal', () => {
    const g = ghostAt(0, { x: 5.5, y: 1 }, 'normal', 'derecha');
    frighten(g);
    expect(g.mode).toBe('asustado');
    expect(g.dir).toBe('izquierda');
    for (const mode of ['casa', 'saliendo', 'ojos', 'asustado'] as const) {
      const other = ghostAt(1, { x: 5.5, y: 1 }, mode, 'derecha');
      frighten(other);
      expect(other.mode).toBe(mode);
      expect(other.dir).toBe('derecha');
    }
  });

  it('va a FRIGHT_SPEED_FACTOR de la velocidad; los ojos a EYES_SPEED', () => {
    const scared = ghostAt(0, { x: 5.5, y: 1 }, 'asustado', 'derecha');
    updateGhost(scared, world({ x: 9, y: 15 }), maze, 0.05);
    expect(scared.pos.x).toBeCloseTo(5.5 + FRIGHT_SPEED_FACTOR * GHOST_BASE_SPEED * 0.05);
    const eyes = ghostAt(0, { x: 5.5, y: 1 }, 'ojos', 'derecha');
    updateGhost(eyes, world({ x: 9, y: 15 }), maze, 0.01);
    expect(eyes.pos.x).toBeCloseTo(5.5 + EYES_SPEED * 0.01);
  });

  it('elige al azar de forma determinista, sin media vuelta ni cruzar la puerta', () => {
    const run = () => {
      const g = ghostAt(0, { x: 9, y: 7 }, 'asustado', 'izquierda');
      const w = world({ x: 9, y: 15 });
      const path: string[] = [];
      for (let i = 0; i < 20 / DT; i++) {
        const before = g.dir;
        updateGhost(g, w, maze, DT);
        expect(g.dir).not.toBe(OPPOSITE[before]);
        const t = tileAt(maze, Math.round(g.pos.x), Math.round(g.pos.y));
        expect(['pared', 'puerta', 'casa']).not.toContain(t);
        path.push(g.dir);
      }
      return path.join(',');
    };
    expect(run()).toBe(run());
  });
});

describe('ojos', () => {
  it('desde cualquier rincón llegan a la casa por la puerta y vuelven en normal', () => {
    const center = houseCenter(maze);
    expect(center).toEqual({ x: 9, y: 9 });
    for (const from of [
      { x: 1, y: 15 },
      { x: 17, y: 19 },
      { x: 1, y: 1 },
      { x: 4, y: 9 },
    ]) {
      const g = ghostAt(0, from, 'ojos', 'izquierda');
      const w = world({ x: 9, y: 15 });
      const modes: string[] = [];
      let reachedCenter = false;
      for (let i = 0; i < 20 / DT && g.mode !== 'normal'; i++) {
        updateGhost(g, w, maze, DT);
        if (modes[modes.length - 1] !== g.mode) modes.push(g.mode);
        // El paso en que vuelve a 'saliendo' lo deja junto al centro de la casa.
        if (g.mode === 'saliendo' && Math.round(g.pos.x) === center.x && Math.round(g.pos.y) === center.y) {
          reachedCenter = true;
        }
        expect(tileAt(maze, Math.round(g.pos.x), Math.round(g.pos.y))).not.toBe('pared');
      }
      expect(reachedCenter).toBe(true);
      expect(modes).toEqual(['ojos', 'saliendo', 'normal']);
      expect({ x: Math.round(g.pos.x), y: Math.round(g.pos.y) }).toEqual(maze.exit);
    }
  });
});
