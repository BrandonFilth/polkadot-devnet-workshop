import { describe, expect, it } from 'vitest';
import { keyboardState } from './teclado';

describe('teclado del celular', () => {
  it('con un campo con foco se ocultan los controles', () => {
    expect(keyboardState({ layoutHeight: 800, vvHeight: 800, vvTop: 0, editableFocused: true }).hideControls).toBe(true);
  });

  it('sin foco todo vuelve como estaba', () => {
    expect(keyboardState({ layoutHeight: 800, vvHeight: 480, vvTop: 0, editableFocused: false }).hideControls).toBe(false);
  });

  it('el teclado está abierto si el área visible baja más del mínimo', () => {
    expect(keyboardState({ layoutHeight: 800, vvHeight: 480, vvTop: 0, editableFocused: true }).open).toBe(true);
    expect(keyboardState({ layoutHeight: 800, vvHeight: 760, vvTop: 0, editableFocused: true }).open).toBe(false);
  });

  it('pasa el área visible tal cual', () => {
    expect(keyboardState({ layoutHeight: 844, vvHeight: 430, vvTop: 37, editableFocused: true })).toMatchObject({ top: 37, height: 430 });
  });
});
