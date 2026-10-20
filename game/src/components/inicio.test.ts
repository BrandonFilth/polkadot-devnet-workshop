import { describe, expect, it } from 'vitest';
// Texto de styles.css (vite.config.js deja pasar este .css a los tests).
import css from '../styles.css?raw';
import { createInicioFlow, INICIO_AYUDA, INICIO_FUERA, INICIO_SUGERENCIA, inicioView } from './Inicio';

/** Cuerpos (juntos) de todas las reglas cuyo selector es exactamente `selector`. */
const rule = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`, 'g');
  return [...css.replace(/\r\n/g, '\n').matchAll(re)].map((m) => m[1]).join('\n');
};

describe('inicio: textos y estilo', () => {
  it('sugerencia corta para conectar y, fuera del Host, dónde abrir el juego; sin signos de exclamación', () => {
    expect(INICIO_SUGERENCIA).toBe('Conéctate para guardar tu récord. Puedes jugar sin conectarte.');
    expect(INICIO_FUERA).toBe('Para conectar abre el juego en la Polkadot App o Desktop.');
    for (const text of [INICIO_SUGERENCIA, INICIO_FUERA, INICIO_AYUDA]) expect(text).not.toMatch(/[!¡]/);
  });

  it('POLKA-MAN no se parte en dos líneas y Jugar no lleva borde', () => {
    const h1 = rule('.inicio h1');
    expect(h1).toMatch(/white-space:\s*nowrap/);
    expect(h1).toMatch(/font-size:\s*clamp\(/);
    expect(rule('.inicio-jugar')).toMatch(/border:\s*0/);
  });

  it('la pantalla es opaca', () => {
    const body = rule('.inicio');
    expect(body).toMatch(/background:\s*var\(--bg\)/);
    expect(css).not.toMatch(/background:\s*rgba\(/);
  });
});

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
