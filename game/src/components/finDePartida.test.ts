import { describe, expect, it } from 'vitest';
import { finButtons, saveOptions } from './FinDePartida';

describe('finButtons: el popup de fin no lleva el ranking dentro', () => {
  it('con récord por guardar: Guardar, Jugar otra vez, Ver ranking, Inicio', () => {
    expect(finButtons('guardar')).toEqual(['guardar', 'jugar', 'ranking', 'inicio']);
    expect(finButtons('conectar')).toEqual(['guardar', 'jugar', 'ranking', 'inicio']);
    expect(finButtons('cargando')).toEqual(['guardar', 'jugar', 'ranking', 'inicio']);
  });

  it('sin nada que guardar: Jugar otra vez, Ver ranking, Inicio', () => {
    for (const o of ['no-supera', 'cero', 'fuera'] as const) expect(finButtons(o)).toEqual(['jugar', 'ranking', 'inicio']);
  });

  it('«ranking» es un botón que abre su pestaña, nunca una lista', () => {
    for (const o of ['guardar', 'conectar', 'cargando', 'no-supera', 'cero', 'fuera'] as const) {
      expect(finButtons(o).filter((b) => b === 'ranking')).toHaveLength(1);
      expect(finButtons(o)).not.toContain('lista');
    }
  });
});

const base = { host: 'listo' as const, connected: true, score: 500, best: 100n as bigint | null | 'error', busy: false };

describe('saveOptions', () => {
  it('1. score 0 → cero, sin botón', () => {
    expect(saveOptions({ ...base, score: 0 })).toEqual({ option: 'cero', disabled: false });
  });

  it('2. fuera del Host → fuera', () => {
    expect(saveOptions({ ...base, host: 'fuera', connected: false })).toEqual({ option: 'fuera', disabled: false });
  });

  it('3. sin cuenta → conectar', () => {
    expect(saveOptions({ ...base, connected: false })).toEqual({ option: 'conectar', disabled: false });
  });

  it('4. leyendo el récord → cargando, siempre deshabilitado', () => {
    expect(saveOptions({ ...base, best: null })).toEqual({ option: 'cargando', disabled: true });
    expect(saveOptions({ ...base, best: null, busy: true })).toEqual({ option: 'cargando', disabled: true });
  });

  it('5. lectura fallida → guardar (saveScore simula antes de firmar)', () => {
    expect(saveOptions({ ...base, best: 'error' })).toEqual({ option: 'guardar', disabled: false });
  });

  it('6. supera el récord → guardar', () => {
    expect(saveOptions({ ...base, score: 101, best: 100n })).toEqual({ option: 'guardar', disabled: false });
  });

  it('7. no supera el récord → no-supera, sin botón', () => {
    expect(saveOptions({ ...base, score: 100, best: 100n })).toEqual({ option: 'no-supera', disabled: false });
    expect(saveOptions({ ...base, score: 50, best: 100n })).toEqual({ option: 'no-supera', disabled: false });
  });

  describe('precedencia', () => {
    it('score 0 fuera del Host → cero', () => {
      expect(saveOptions({ ...base, score: 0, host: 'fuera', connected: false }).option).toBe('cero');
    });

    it('!connected con best null → conectar', () => {
      expect(saveOptions({ ...base, connected: false, best: null }).option).toBe('conectar');
    });

    it("best 'error' con score > 0 → guardar", () => {
      expect(saveOptions({ ...base, score: 1, best: 'error' }).option).toBe('guardar');
    });

    it('fuera del Host gana a sin cuenta', () => {
      expect(saveOptions({ ...base, host: 'fuera', connected: false, best: null }).option).toBe('fuera');
    });
  });

  describe('disabled = busy en las filas con botón', () => {
    it('conectar y guardar siguen a busy', () => {
      expect(saveOptions({ ...base, connected: false, busy: true })).toEqual({ option: 'conectar', disabled: true });
      expect(saveOptions({ ...base, score: 101, busy: true })).toEqual({ option: 'guardar', disabled: true });
      expect(saveOptions({ ...base, best: 'error', busy: true })).toEqual({ option: 'guardar', disabled: true });
    });

    it('las filas sin botón nunca se deshabilitan', () => {
      expect(saveOptions({ ...base, score: 0, busy: true }).disabled).toBe(false);
      expect(saveOptions({ ...base, host: 'fuera', busy: true }).disabled).toBe(false);
      expect(saveOptions({ ...base, score: 10, best: 100n, busy: true }).disabled).toBe(false);
    });
  });
});
