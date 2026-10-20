import { describe, expect, it } from 'vitest';
import {
  EYES_SPEED,
  FRIGHT_BASE_SECONDS,
  FRIGHT_BLINK_PERIOD,
  FRIGHT_BLINK_SECONDS,
  FRIGHT_MIN_SECONDS,
  FRIGHT_SPEED_FACTOR,
  FRIGHT_STEP_SECONDS,
  frightenedSeconds,
  GHOST_CHAIN_POINTS,
  GHOST_EVERY_ROUNDS,
  GHOST_MAX,
  GHOST_SPEED_CAP,
  GHOST_SPEED_GROWTH,
  ghostCount,
  ghostSpeed,
  HOUSE_COOLDOWN_BASE_SECONDS,
  HOUSE_COOLDOWN_MIN_SECONDS,
  HOUSE_COOLDOWN_STEP_SECONDS,
  houseCooldownSeconds,
  MAX_EVENTS,
  CONTROLS_HEIGHT_PX,
  HUD_HEIGHT_PX,
  JOYSTICK_DEAD_ZONE,
  JOYSTICK_DIAGONAL_HALF_DEG,
  JOYSTICK_KNOB_RADIUS_PX,
  JOYSTICK_RADIUS_PX,
  KEYBOARD_MIN_PX,
  MIN_TILE_PX,
  PAUSE_BUTTON_PX,
  PLAYER_SPEED,
  RANKING_MAX_HEIGHT_PX,
  VIEW_CROP_TILES,
} from './rules';

const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** [ronda, fantasmas, velocidad, segundos de susto] */
const TABLE: ReadonlyArray<[number, number, number, number]> = [
  [1, 2, 4.0, 6.0],
  [2, 2, 4.2, 5.5],
  [3, 2, 4.41, 5.0],
  [4, 3, 4.631, 4.5],
  [5, 3, 4.862, 4.0],
  [6, 3, 5.105, 3.5],
  [7, 4, 5.36, 3.0],
  [8, 4, 5.628, 2.5],
  [9, 4, 5.7, 2.0],
  [10, 5, 5.7, 2.0],
  [11, 5, 5.7, 2.0],
  [12, 5, 5.7, 2.0],
  [13, 6, 5.7, 2.0],
  [20, 6, 5.7, 2.0],
  [100, 6, 5.7, 2.0],
];

describe('rules: dificultad', () => {
  it('constantes con los valores pedidos', () => {
    expect(GHOST_SPEED_GROWTH).toBe(1.05);
    expect(GHOST_SPEED_CAP).toBe(5.7);
    expect(GHOST_MAX).toBe(6);
    expect(GHOST_EVERY_ROUNDS).toBe(3);
    expect(FRIGHT_SPEED_FACTOR).toBe(0.5);
    expect(EYES_SPEED).toBe(12.0);
    expect(FRIGHT_BASE_SECONDS).toBe(6);
    expect(FRIGHT_STEP_SECONDS).toBe(0.5);
    expect(FRIGHT_MIN_SECONDS).toBe(2);
    expect(FRIGHT_BLINK_SECONDS).toBe(1.5);
    expect(FRIGHT_BLINK_PERIOD).toBe(0.2);
    expect(GHOST_CHAIN_POINTS).toEqual([200, 400, 800, 1600]);
  });

  it.each(TABLE)('ronda %i: %i fantasmas, velocidad %f, susto %f s', (r, count, speed, fright) => {
    expect(ghostCount(r)).toBe(count);
    expect(round3(ghostSpeed(r))).toBe(speed);
    expect(round3(frightenedSeconds(r))).toBe(fright);
  });

  it('diagonal del joystick y alto del ranking', () => {
    expect(JOYSTICK_DIAGONAL_HALF_DEG).toBe(32.5);
    // 75° cae dentro del sector diagonal (45 ± 32.5) con margen.
    expect(Math.abs(75 - 45)).toBeLessThan(JOYSTICK_DIAGONAL_HALF_DEG - 1);
    expect(RANKING_MAX_HEIGHT_PX).toBe(320);
  });

  it('pantalla y controles con los valores pedidos', () => {
    expect(VIEW_CROP_TILES).toBe(0.5);
    expect(MIN_TILE_PX).toBe(8);
    expect(HUD_HEIGHT_PX).toBe(44);
    expect(CONTROLS_HEIGHT_PX).toBe(132);
    expect(JOYSTICK_RADIUS_PX).toBe(56);
    expect(JOYSTICK_KNOB_RADIUS_PX).toBe(26);
    expect(JOYSTICK_DEAD_ZONE).toBe(0.3);
    expect(PAUSE_BUTTON_PX).toBe(72);
    expect(KEYBOARD_MIN_PX).toBe(120);
    // El joystick y la pausa caben en la zona de controles.
    expect(JOYSTICK_RADIUS_PX * 2).toBeLessThan(CONTROLS_HEIGHT_PX);
    expect(PAUSE_BUTTON_PX).toBeLessThan(CONTROLS_HEIGHT_PX);
  });

  it('espera en la casa: 5 s en la ronda 1, 0.5 s menos cada ronda, mínimo 2 s', () => {
    expect(HOUSE_COOLDOWN_BASE_SECONDS).toBe(5);
    expect(HOUSE_COOLDOWN_STEP_SECONDS).toBe(0.5);
    expect(HOUSE_COOLDOWN_MIN_SECONDS).toBe(2);
    expect(MAX_EVENTS).toBe(64);
    const rounds = [1, 2, 4, 7, 10];
    expect(rounds.map(houseCooldownSeconds)).toEqual([5, 4.5, 3.5, 2, 2]);
  });

  it('el tope de velocidad se alcanza en la ronda 9', () => {
    expect(ghostSpeed(8)).toBeLessThan(GHOST_SPEED_CAP);
    expect(ghostSpeed(9)).toBe(GHOST_SPEED_CAP);
  });

  it('los fantasmas nunca son tan rápidos como Polka-Man', () => {
    for (let r = 1; r <= 100; r++) expect(ghostSpeed(r)).toBeLessThan(PLAYER_SPEED);
  });
});
