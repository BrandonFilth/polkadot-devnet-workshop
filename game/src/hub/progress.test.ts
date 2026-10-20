import { describe, expect, it } from 'vitest';
import { advance, begin, finish, KIND_TITLE, PROGRESS_TEXT, progressView, stepForSdkStatus, type Progress, type ProgressStep } from './progress';

const walk = (p: Progress, ...steps: ProgressStep[]) => steps.reduce(advance, p);

describe('progreso: estados del SDK', () => {
  it('solo signing, broadcasting e in-block se muestran', () => {
    expect(stepForSdkStatus('signing')).toBe('enviando');
    expect(stepForSdkStatus('broadcasting')).toBe('confirmando');
    expect(stepForSdkStatus('in-block')).toBe('confirmando');
    expect(stepForSdkStatus('finalized')).toBeNull();
    expect(stepForSdkStatus('error')).toBeNull();
    expect(stepForSdkStatus('x')).toBeNull();
    expect(stepForSdkStatus(undefined)).toBeNull();
  });
});

describe('progreso: máquina de estados', () => {
  it('empieza en el primer paso de la operación', () => {
    expect(begin('guardar')).toEqual({ op: 'guardar', step: 'simulando', reached: ['simulando'], message: 'Simulando…' });
    expect(begin('conectar').step).toBe('conectando');
  });

  it('solo avanza: un paso hacia atrás se ignora', () => {
    const p = walk(begin('guardar'), 'firma', 'enviando', 'confirmando');
    expect(advance(p, 'enviando')).toBe(p);
    expect(advance(p, 'simulando')).toBe(p);
    expect(p.message).toBe(PROGRESS_TEXT.confirmando);
  });

  it('los pasos de recuperación pueden repetirse', () => {
    const p = walk(begin('guardar'), 'firma', 'enviando', 'confirmando', 'firma');
    expect(p.step).toBe('firma');
    expect(p.reached).toEqual(['simulando', 'firma']);
    const gas = walk(begin('username'), 'firma', 'permiso-gas', 'firma');
    expect(gas.step).toBe('firma');
    expect(gas.reached).toEqual(['simulando', 'permiso-gas', 'firma']);
  });

  it('los estados finales siempre se permiten y después nada cambia', () => {
    const p = advance(begin('guardar'), 'error');
    expect(p.step).toBe('error');
    expect(advance(p, 'firma')).toBe(p);
    expect(advance(walk(begin('conectar'), 'permiso-gas'), 'listo').step).toBe('listo');
  });

  it('reached se acumula sin repetir', () => {
    const p = walk(begin('guardar'), 'firma', 'firma', 'enviando', 'confirmando', 'confirmando', 'actualizando');
    expect(p.reached).toEqual(['simulando', 'firma', 'enviando', 'confirmando', 'actualizando']);
  });

  it('finish: ok → listo con el mensaje; fallo → error con su tipo', () => {
    const p = walk(begin('guardar'), 'firma');
    expect(finish(p, { ok: true, message: 'Récord guardado: 5.' })).toMatchObject({ step: 'listo', message: 'Récord guardado: 5.' });
    const failed = finish(p, { ok: false, message: 'No se aprobó.', kind: 'rejected' });
    expect(failed).toMatchObject({ step: 'error', message: 'No se aprobó.', kind: 'rejected' });
    expect(finish(p, { ok: false, message: 'Revirtió.' }).kind).toBeUndefined();
  });
});

describe('progreso: vista', () => {
  it('marca hecho, actual y pendiente solo con lo que de verdad pasó', () => {
    const v = progressView(walk(begin('guardar'), 'firma'), ['guardar'])!;
    expect(v.steps.map((s) => s.status)).toEqual(['hecho', 'actual', 'pendiente', 'pendiente', 'pendiente']);
    expect(v.line).toBe('Esperando tu firma en el teléfono…');
    expect(v.tone).toBe('curso');
  });

  it('si el SDK nunca dijo signing, «Enviar» no queda hecho', () => {
    const p = finish(walk(begin('guardar'), 'firma'), { ok: false, message: 'No se aprobó la firma.', kind: 'rejected' });
    const v = progressView(p, ['guardar'])!;
    expect(v.steps.map((s) => s.status)).toEqual(['hecho', 'fallo', 'pendiente', 'pendiente', 'pendiente']);
    expect(v.line).toBe(`${KIND_TITLE.rejected}. No se aprobó la firma.`);
    expect(v.tone).toBe('error');
  });

  it('listo deja todo lo alcanzado como hecho y muestra el mensaje final', () => {
    const p = finish(walk(begin('username'), 'firma', 'enviando', 'confirmando', 'actualizando'), { ok: true, message: 'Username guardado: ana.' });
    const v = progressView(p, ['username'])!;
    expect(v.steps.every((s) => s.status === 'hecho')).toBe(true);
    expect(v.line).toBe('Username guardado: ana.');
    expect(v.tone).toBe('listo');
  });

  it('se oculta para operaciones que la pantalla no pidió o sin progreso', () => {
    expect(progressView(begin('guardar'), ['username'])).toBeNull();
    expect(progressView(null, ['guardar'])).toBeNull();
  });

  it('un paso de recuperación muestra su texto y deja «firma» como actual', () => {
    const v = progressView(walk(begin('guardar'), 'firma', 'permiso-gas'), ['guardar'])!;
    expect(v.line).toBe(PROGRESS_TEXT['permiso-gas']);
    expect(v.steps.find((s) => s.step === 'firma')!.status).toBe('actual');
  });

  it('títulos distintos para rechazada, sin respuesta y otro', () => {
    expect(new Set([KIND_TITLE.rejected, KIND_TITLE.timeout, KIND_TITLE.other]).size).toBe(3);
  });
});
