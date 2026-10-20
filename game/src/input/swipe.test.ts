import { describe, expect, it } from 'vitest';
import { SWIPE_THRESHOLD_PX } from '../engine/rules';
import { swipeDirection, swipeDirections } from './swipe';

describe('swipeDirection', () => {
  it('usa un umbral de 24 px', () => {
    expect(SWIPE_THRESHOLD_PX).toBe(24);
    expect(swipeDirection(24, 0)).toBe('derecha');
    expect(swipeDirection(23, 0)).toBeNull();
    expect(swipeDirection(0, -24)).toBe('arriba');
    expect(swipeDirection(0, -23)).toBeNull();
  });

  it('gana el eje dominante', () => {
    expect(swipeDirection(30, 20)).toBe('derecha');
    expect(swipeDirection(-30, 20)).toBe('izquierda');
    expect(swipeDirection(10, 40)).toBe('abajo');
    expect(swipeDirection(-10, -40)).toBe('arriba');
  });

  it('dy positivo es abajo', () => {
    expect(swipeDirection(0, 50)).toBe('abajo');
  });

  it('un swipe diagonal pide dos direcciones; uno recto, una', () => {
    expect(swipeDirections(30, -30)).toEqual({ primary: 'derecha', secondary: 'arriba' });
    expect(swipeDirections(10, -40)).toEqual({ primary: 'arriba', secondary: 'derecha' });
    expect(swipeDirections(-40, 2)).toEqual({ primary: 'izquierda', secondary: null });
    expect(swipeDirections(10, 10)).toBeNull();
  });

  it('bajo el umbral da null', () => {
    expect(swipeDirection(0, 0)).toBeNull();
    expect(swipeDirection(20, 20)).toBeNull();
    expect(swipeDirection(-10, 15)).toBeNull();
  });
});
