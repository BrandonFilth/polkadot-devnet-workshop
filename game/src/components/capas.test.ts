import { describe, expect, it } from 'vitest';
import { capas, type CapasInput } from './capas';

const none: Omit<CapasInput, 'phase'> = { menuOpen: false, usernameOpen: false, avisoOpen: false, txOpen: false };

describe('capas', () => {
  it('jugando sin nada encima: arriba el juego y nada inerte', () => {
    expect(capas({ ...none, phase: 'jugando' })).toMatchObject({ top: 'juego', inert: [] });
    expect(capas({ ...none, phase: 'listo' }).top).toBe('juego');
  });

  it('fin solo: arriba el popup de fin, el juego inerte', () => {
    expect(capas({ ...none, phase: 'fin' })).toMatchObject({ top: 'fin', inert: ['juego'] });
  });

  it('popup de estados sobre fin: arriba tx y el fin queda bloqueado', () => {
    const c = capas({ ...none, phase: 'fin', txOpen: true });
    expect(c.top).toBe('tx');
    expect(c.inert).toContain('fin');
    expect(c.inert).toContain('juego');
  });

  it('popup de estados sobre el username: el username queda inerte', () => {
    const c = capas({ ...none, phase: 'fin', usernameOpen: true, txOpen: true });
    expect(c.top).toBe('tx');
    expect(c.inert).toEqual(['juego', 'fin', 'username']);
  });

  it('menú sobre la pantalla de inicio', () => {
    expect(capas({ ...none, phase: 'titulo', menuOpen: true })).toMatchObject({ top: 'menu', inert: ['juego', 'inicio'] });
  });

  it('aviso «sin cuenta» sobre inicio, y el popup de estados encima del aviso', () => {
    expect(capas({ ...none, phase: 'titulo', avisoOpen: true }).top).toBe('aviso');
    expect(capas({ ...none, phase: 'titulo', avisoOpen: true, txOpen: true })).toMatchObject({
      top: 'tx',
      inert: ['juego', 'inicio', 'aviso'],
    });
  });

  it('pausa con menú: arriba el menú', () => {
    expect(capas({ ...none, phase: 'pausa', menuOpen: true })).toMatchObject({ top: 'menu', inert: ['juego', 'pausa'] });
  });
});
