import { describe, expect, it } from 'vitest';
import { createGame, start, update } from '../engine/game';
import { READY_SECONDS } from '../engine/rules';
import { FIRST_RECORD_HINT, MENU_OUTSIDE, pauseForMenu, usernameAction } from './Menu';

const playing = () => {
  const state = createGame(1);
  start(state);
  update(state, READY_SECONDS + 0.1);
  return state;
};

describe('menú: pausa', () => {
  it('abrir el menú pausa una partida en curso', () => {
    const state = playing();
    expect(state.phase).toBe('jugando');
    pauseForMenu(state);
    expect(state.phase).toBe('pausa');
  });

  it('cerrar (no llamar nada) deja la partida en pausa', () => {
    const state = playing();
    pauseForMenu(state);
    update(state, 1);
    expect(state.phase).toBe('pausa');
  });

  it('en el título y en el fin no cambia la fase', () => {
    const title = createGame(1);
    pauseForMenu(title);
    expect(title.phase).toBe('titulo');
    const over = createGame(1);
    over.phase = 'fin';
    pauseForMenu(over);
    expect(over.phase).toBe('fin');
  });
});

describe('menú: username', () => {
  const base = { host: 'listo' as const, connected: true, username: '', best: 0n, busy: false };

  it('fuera del Host explica que conectar y firmar necesita la app, sin botón', () => {
    const v = usernameAction({ ...base, host: 'fuera', connected: false, username: null, best: null });
    expect(v.action).toBe('ninguna');
    expect(v.label).toBeNull();
    expect(v.text).toBe(MENU_OUTSIDE);
  });

  it('buscando la app: botón deshabilitado', () => {
    const v = usernameAction({ ...base, host: 'buscando', connected: false });
    expect(v.action).toBe('esperar');
    expect(v.disabled).toBe(true);
  });

  it('error del Host: Reintentar', () => {
    expect(usernameAction({ ...base, host: 'error', connected: false }).action).toBe('reintentar');
  });

  it('listo sin cuenta: Conectar', () => {
    const v = usernameAction({ ...base, connected: false, username: null, best: null });
    expect(v).toMatchObject({ action: 'conectar', label: 'Conectar', disabled: false });
  });

  it('con cuenta y SIN récord se puede elegir username, con la pista del primer récord', () => {
    const v = usernameAction(base);
    expect(v).toMatchObject({ action: 'elegir', label: 'Elegir username', disabled: false, hint: FIRST_RECORD_HINT });
  });

  it('con username: Cambiar username y sin pista si ya hay récord', () => {
    const v = usernameAction({ ...base, username: 'ana', best: 1200n });
    expect(v).toMatchObject({ action: 'cambiar', label: 'Cambiar username', text: 'Tu username: ana', hint: null });
  });

  it('mientras hay una firma en curso, deshabilitado', () => {
    expect(usernameAction({ ...base, busy: true }).disabled).toBe(true);
    expect(usernameAction({ ...base, connected: false, busy: true }).disabled).toBe(true);
  });
});
