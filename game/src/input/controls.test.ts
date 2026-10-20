import { describe, expect, it } from 'vitest';
import { keysToDirections } from './controls';

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
