import { describe, expect, it } from 'vitest';
import {
  DEATH_HOLD_SECONDS,
  DEATH_SECONDS,
  HOUSE_BLINK_PERIOD,
  HOUSE_BLINK_SECONDS,
  MOUTH_STOPPED_OPEN,
} from '../engine/rules';
import { deathFrame, houseBlink, mouthHalf, mouthOpen } from './anim';

describe('mouthOpen', () => {
  it('quieto contra la pared la boca queda a media apertura', () => {
    expect(MOUTH_STOPPED_OPEN).toBe(0.5);
    for (const mouth of [0, 0.25, 0.5, 0.9]) expect(mouthOpen({ mouth, moving: false })).toBe(0.5);
  });

  it('en movimiento sigue a la fase de la boca', () => {
    expect(mouthOpen({ mouth: 0, moving: true })).toBe(1);
    expect(mouthOpen({ mouth: 0.5, moving: true })).toBe(0);
    expect(mouthOpen({ mouth: 0.25, moving: true })).toBeCloseTo(0.5);
    expect(mouthOpen({ mouth: 1, moving: true })).toBe(1);
  });
});

describe('deathFrame', () => {
  const open = mouthHalf(1);

  it('al empezar y durante la espera es la boca normal abierta con tamaño completo', () => {
    expect(deathFrame(DEATH_SECONDS)).toEqual({ half: open, scale: 1 });
    expect(deathFrame(DEATH_SECONDS - DEATH_HOLD_SECONDS / 2)).toEqual({ half: open, scale: 1 });
    expect(deathFrame(DEATH_SECONDS - DEATH_HOLD_SECONDS)).toEqual({ half: open, scale: 1 });
  });

  it('al final la boca se abrió del todo y el cuerpo desapareció', () => {
    const end = deathFrame(0);
    expect(end.half).toBeCloseTo(Math.PI);
    expect(end.scale).toBe(0);
  });

  it('es monótona: la boca solo se abre y el cuerpo solo se encoge', () => {
    let prev = deathFrame(DEATH_SECONDS);
    for (let t = DEATH_SECONDS; t >= 0; t -= 0.01) {
      const f = deathFrame(t);
      expect(f.half).toBeGreaterThanOrEqual(prev.half - 1e-12);
      expect(f.scale).toBeLessThanOrEqual(prev.scale + 1e-12);
      expect(f.scale).toBeGreaterThanOrEqual(0);
      prev = f;
    }
  });
});

describe('houseBlink', () => {
  it('no parpadea sin espera ni antes del último segundo', () => {
    expect(houseBlink(0)).toBe(false);
    expect(houseBlink(-1)).toBe(false);
    expect(houseBlink(HOUSE_BLINK_SECONDS + 0.01)).toBe(false);
    expect(houseBlink(4)).toBe(false);
  });

  it('en el último segundo alterna con el periodo', () => {
    expect(houseBlink(HOUSE_BLINK_PERIOD * 0.5)).toBe(true);
    expect(houseBlink(HOUSE_BLINK_PERIOD * 1.5)).toBe(false);
    expect(houseBlink(HOUSE_BLINK_PERIOD * 2.5)).toBe(true);
  });
});
