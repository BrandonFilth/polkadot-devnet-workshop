import { describe, expect, it } from 'vitest';
import { createInicioFlow, INICIO_FUERA, INICIO_SUGERENCIA, inicioView } from './Inicio';

describe('inicio: Jugar y el aviso «sin cuenta»', () => {
  it('en el Host sin cuenta: el primer Jugar muestra el aviso, Jugar igual empieza y el segundo Jugar empieza directo', () => {
    const flow = createInicioFlow();
    expect(flow.avisoVisto).toBe(false);
    expect(flow.jugar({ host: 'listo', connected: false })).toBe('aviso');
    expect(flow.avisoVisto).toBe(true);
    expect(flow.jugarIgual()).toBe('empezar');
    expect(flow.jugar({ host: 'listo', connected: false })).toBe('empezar');
  });

  it('con cuenta: empieza y nunca muestra el aviso', () => {
    const flow = createInicioFlow();
    expect(flow.jugar({ host: 'listo', connected: true })).toBe('empezar');
    expect(flow.avisoVisto).toBe(false);
  });

  it('conectar después del aviso: el siguiente Jugar empieza', () => {
    const flow = createInicioFlow();
    expect(flow.jugar({ host: 'listo', connected: false })).toBe('aviso');
    expect(flow.jugar({ host: 'listo', connected: true })).toBe('empezar');
  });

  it('fuera del Host: empieza, sin aviso', () => {
    const flow = createInicioFlow();
    expect(flow.jugar({ host: 'fuera', connected: false })).toBe('empezar');
    expect(flow.avisoVisto).toBe(false);
  });

  it('buscando, conectando o con error: empieza sin gastar el aviso; con el Host listo el primer Jugar lo muestra', () => {
    const flow = createInicioFlow();
    for (const host of ['buscando', 'conectando', 'error'] as const) {
      expect(flow.jugar({ host, connected: false })).toBe('empezar');
      expect(flow.avisoVisto).toBe(false);
    }
    expect(flow.jugar({ host: 'listo', connected: false })).toBe('aviso');
    expect(flow.avisoVisto).toBe(true);
  });
});

describe('inicio: vista', () => {
  const base = { host: 'listo' as const, connected: false, mine: null, busy: false };

  it('en el Host sin cuenta: Conectar cuenta (recomendado) y la sugerencia', () => {
    const v = inicioView(base);
    expect(v.connect).toEqual({ action: 'conectar', label: 'Conectar cuenta', recommended: true, disabled: false });
    expect(v.suggestion).toBe(INICIO_SUGERENCIA);
    expect(v.username).toBeNull();
  });

  it('fuera del Host: sin botón de conectar y con el texto de la Polkadot App', () => {
    const v = inicioView({ ...base, host: 'fuera' });
    expect(v.connect).toBeNull();
    expect(v.suggestion).toBeNull();
    expect(v.status).toBe(INICIO_FUERA);
    expect(v.username).toBeNull();
  });

  it('buscando la app o con una firma en curso: conectar deshabilitado', () => {
    expect(inicioView({ ...base, host: 'buscando' }).connect).toMatchObject({ action: 'esperar', disabled: true });
    expect(inicioView({ ...base, busy: true }).connect?.disabled).toBe(true);
  });

  it('error del Host: Reintentar', () => {
    expect(inicioView({ ...base, host: 'error' }).connect?.action).toBe('reintentar');
  });

  it('Username solo con cuenta: «Leyendo…» deshabilitado mientras se lee, después el username', () => {
    expect(inicioView({ ...base, connected: true }).username).toEqual({ label: 'Leyendo…', disabled: true });
    expect(inicioView({ ...base, connected: true, mine: { best: 0n, username: '' } }).username).toEqual({
      label: 'Elige un username',
      disabled: false,
    });
    expect(inicioView({ ...base, connected: true, mine: { best: 10n, username: 'ana' } }).username?.label).toBe('ana');
    const v = inicioView({ ...base, connected: true, mine: { best: 10n, username: 'ana' } });
    expect(v.connect).toBeNull();
    expect(v.suggestion).toBeNull();
  });
});
