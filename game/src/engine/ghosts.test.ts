import { describe, expect, it } from 'vitest';
import { createGame, start, update } from './game';
import {
  createGhost,
  frighten,
  GHOST_COLORS,
  houseCenter,
  updateGhost,
  type Ghost,
  type GhostWorld,
} from './ghosts';
import { MAZE, parseMaze, tileAt } from './maze';
import { OPPOSITE } from './movement';
import {
  DT,
  EYES_SPEED,
  FRIGHT_SPEED_FACTOR,
  GHOST_BASE_SPEED,
  GHOST_SCATTER_CHANCE,
  READY_SECONDS,
  RELEASE_INTERVAL,
} from './rules';
import type { Dir, Vec } from './types';

const maze = parseMaze(MAZE);

function world(playerPos: Vec, playerDir: Dir | null = 'izquierda'): GhostWorld {
  return {
    player: { pos: playerPos, dir: playerDir },
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

/** Cruce de 4 caminos: (4, 3). Llegando por la izquierda ('derecha') puede seguir arriba, abajo o a la derecha. */
const CROSS: Vec = { x: 4, y: 3 };

/** Dirección que elige un fantasma en 'normal' parado en el centro de `pos`. */
function decision(id: number, pos: Vec, dir: Dir, w: GhostWorld): Dir {
  const g = ghostAt(id, pos, 'normal', dir);
  updateGhost(g, w, maze, DT);
  return g.dir;
}

/** Recorrido (posición y dirección en cada paso) de un fantasma en 'normal'. */
function path(id: number, w: GhostWorld, steps = 600): string {
  const g = ghostAt(id, { x: 9, y: 7 });
  const out: string[] = [];
  for (let i = 0; i < steps; i++) {
    updateGhost(g, w, maze, DT);
    out.push(`${g.pos.x.toFixed(4)},${g.pos.y.toFixed(4)},${g.dir}`);
  }
  return out.join(';');
}

describe('colores y regla compartida', () => {
  it('6 colores propios, en orden; ninguno es el rosa de Polka-Man', () => {
    expect(GHOST_COLORS).toEqual(['#ff6b4a', '#9be7b0', '#ffd479', '#7fb8ff', '#c39bff', '#5ee0d0']);
    expect(GHOST_COLORS.some((c) => c.toLowerCase() === '#ff2867')).toBe(false);
  });

  it('GHOST_SCATTER_CHANCE es 1 de cada 4', () => {
    expect(GHOST_SCATTER_CHANCE).toBe(0.25);
  });

  it('sin dispersión, en un cruce va por el camino que más lo acerca a Polka-Man, sin media vuelta', () => {
    const chase = (player: Vec) => decision(0, CROSS, 'derecha', { ...world(player), scatterChance: 0 });
    expect(chase({ x: 4, y: 15 })).toBe('abajo');
    expect(chase({ x: 4, y: 1 })).toBe('arriba');
    expect(chase({ x: 17, y: 3 })).toBe('derecha');
    // Polka-Man justo detrás: no da media vuelta aunque sea lo más cerca.
    expect(chase({ x: 1, y: 3 })).not.toBe('izquierda');
  });

  it('todos los fantasmas siguen la misma regla: mismo inicio y mismo world, mismo recorrido', () => {
    for (const scatterChance of [0, undefined]) {
      const w = () => ({ ...world({ x: 17, y: 19 }, 'derecha'), scatterChance });
      const first = path(0, w());
      for (let id = 1; id < GHOST_COLORS.length; id++) expect(path(id, w())).toBe(first);
    }
  });

  it('con dispersión total elige al azar de forma determinista, sin media vuelta ni cruzar la puerta', () => {
    const run = () => {
      const g = ghostAt(0, { x: 9, y: 7 });
      const w: GhostWorld = { ...world({ x: 17, y: 19 }), scatterChance: 1 };
      const dirs: string[] = [];
      for (let i = 0; i < 20 / DT; i++) {
        const before = g.dir;
        updateGhost(g, w, maze, DT);
        expect(g.dir).not.toBe(OPPOSITE[before]);
        const t = tileAt(maze, Math.round(g.pos.x), Math.round(g.pos.y));
        expect(['pared', 'puerta', 'casa']).not.toContain(t);
        dirs.push(g.dir);
      }
      return dirs.join(',');
    };
    expect(run()).toBe(run());
    // Y no es el recorrido de persecución pura.
    const chase = path(0, { ...world({ x: 17, y: 19 }), scatterChance: 0 }, 20 / DT);
    const scatter = path(0, { ...world({ x: 17, y: 19 }), scatterChance: 1 }, 20 / DT);
    expect(scatter).not.toBe(chase);
  });

  it('con la probabilidad por defecto y semilla fija, cerca de 1 de cada 4 decisiones es al azar', () => {
    const w = world({ x: 4, y: 15 }); // sin scatterChance: usa GHOST_SCATTER_CHANCE
    const n = 1000;
    let other = 0;
    for (let i = 0; i < n; i++) {
      const d = decision(0, CROSS, 'derecha', w); // el mismo rng avanza en cada decisión
      expect(d).not.toBe('izquierda');
      if (d !== 'abajo') other += 1;
    }
    // Al azar elige 1 de 3 caminos y uno de ellos es el de persecución:
    // solo 2 de cada 3 decisiones al azar se notan, así que la parte al azar es other / n * 3 / 2.
    const scatterShare = ((other / n) * 3) / 2;
    expect(scatterShare).toBeGreaterThanOrEqual(0.15);
    expect(scatterShare).toBeLessThanOrEqual(0.35);
    // Y la mayoría persigue.
    expect(other / n).toBeLessThan(0.5);
  });

  it('el azar solo se usa en normal: los ojos no gastan la semilla al decidir', () => {
    const w = world({ x: 9, y: 15 });
    const g = ghostAt(0, CROSS, 'ojos', 'derecha');
    updateGhost(g, w, maze, DT);
    expect(w.rng.seed).toBe(12345);
  });
});

describe('movimiento en normal', () => {
  it('ningún fantasma da media vuelta ni entra a una pared, la puerta o la casa', () => {
    for (let id = 0; id < GHOST_COLORS.length; id++) {
      for (const player of [
        { x: 1, y: 1 },
        { x: 17, y: 19 },
        { x: 9, y: 15 },
      ]) {
        const g = ghostAt(id, { x: 9, y: 7 });
        const w = world(player, 'derecha');
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

  function leave(id: number, player: Vec, scatterChance?: number): Ghost {
    const g = createGhost(maze, id);
    g.mode = 'saliendo';
    const w: GhostWorld = { ...world(player), scatterChance };
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

  it('al salir elige el lado más cerca de Polka-Man', () => {
    for (let id = 0; id < GHOST_COLORS.length; id++) {
      expect(leave(id, { x: 17, y: 7 }, 0).dir).toBe('derecha');
      expect(leave(id, { x: 1, y: 7 }, 0).dir).toBe('izquierda');
    }
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

  it('con houseCooldown en el world se quedan en casa en el centro con su espera', () => {
    const center = houseCenter(maze);
    const g = ghostAt(0, { x: 1, y: 15 }, 'ojos', 'izquierda');
    const w: GhostWorld = { ...world({ x: 9, y: 15 }), houseCooldown: 3 };
    for (let i = 0; i < 20 / DT && g.mode === 'ojos'; i++) updateGhost(g, w, maze, DT);
    expect(g.mode).toBe('casa');
    expect(g.houseTimer).toBe(3);
    expect(g.pos).toEqual(center);
    // En casa no se mueve; la espera la descuenta la partida, no updateGhost.
    for (let i = 0; i < 100; i++) updateGhost(g, w, maze, DT);
    expect(g.mode).toBe('casa');
    expect(g.pos).toEqual(center);
    expect(g.houseTimer).toBe(3);
  });
});
