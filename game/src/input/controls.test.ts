import { describe, expect, it } from 'vitest';
import { createGame, start } from '../engine/game';
import { attachControls, keysToDirections, keyUpKeepsRequest } from './controls';

describe('teclado: dos teclas sostenidas', () => {
  it('una tecla → recta', () => {
    expect(keysToDirections(['arriba'])).toEqual({ primary: 'arriba', secondary: null });
  });

  it('arriba y después derecha → derecha con arriba de secundaria', () => {
    expect(keysToDirections(['arriba', 'derecha'])).toEqual({ primary: 'derecha', secondary: 'arriba' });
  });

  it('derecha y después arriba → arriba con derecha de secundaria', () => {
    expect(keysToDirections(['derecha', 'arriba'])).toEqual({ primary: 'arriba', secondary: 'derecha' });
  });

  it('dos paralelas → solo la última', () => {
    expect(keysToDirections(['arriba', 'abajo'])).toEqual({ primary: 'abajo', secondary: null });
  });

  it('ninguna → null', () => {
    expect(keysToDirections([])).toBeNull();
  });
});

describe('teclado: teclas rápidas no se pisan', () => {
  // Sin DOM: window y el escenario son EventTarget y las teclas, Event con `key` y `repeat`.
  const setup = () => {
    const win = new EventTarget();
    (globalThis as { window?: unknown }).window = win;
    const state = createGame(1);
    start(state);
    const detach = attachControls(state, new EventTarget() as HTMLElement, () => false);
    const key = (type: 'keydown' | 'keyup', k: string, repeat = false) =>
      win.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { key: k, repeat, ctrlKey: false, metaKey: false, altKey: false }));
    return { state, key, detach };
  };

  it('sostienes arriba y tocas derecha: al soltar derecha su pedido se queda', () => {
    const { state, key, detach } = setup();
    key('keydown', 'ArrowUp');
    key('keydown', 'ArrowRight');
    key('keyup', 'ArrowRight');
    expect(state.player.nextDir).toBe('derecha');
    expect(state.player.altDir).toBe('arriba');
    detach();
  });

  it('la repetición automática de la tecla sostenida no borra la que acabas de tocar', () => {
    const { state, key, detach } = setup();
    key('keydown', 'ArrowUp');
    key('keydown', 'ArrowRight');
    key('keydown', 'ArrowUp', true);
    expect(state.player.nextDir).toBe('derecha');
    detach();
  });

  it('al soltar una tecla más vieja se pide la que sigue sostenida; al soltar todas, empieza a caducar', () => {
    const { state, key, detach } = setup();
    key('keydown', 'ArrowUp');
    key('keydown', 'ArrowRight');
    key('keyup', 'ArrowUp');
    expect(state.player.nextDir).toBe('derecha');
    expect(state.player.altDir).toBeNull();
    expect(state.player.held).toBe(true);
    key('keyup', 'ArrowRight');
    expect(state.player.held).toBe(false);
    expect(state.player.nextDir).toBe('derecha');
    detach();
  });

  it('keyUpKeepsRequest: solo la más reciente conserva su pedido', () => {
    expect(keyUpKeepsRequest(['arriba', 'derecha'], 'derecha')).toBe(true);
    expect(keyUpKeepsRequest(['arriba', 'derecha'], 'arriba')).toBe(false);
  });
});
