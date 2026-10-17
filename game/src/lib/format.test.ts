import { describe, expect, it } from 'vitest';
import { describeError, shortAddress, withTimeout } from './format';

describe('withTimeout', () => {
  it('devuelve el valor si llega a tiempo', async () => {
    await expect(withTimeout(Promise.resolve(7), 1_000, 'prueba')).resolves.toBe(7);
  });

  it('propaga el error original', async () => {
    await expect(withTimeout(Promise.reject(new Error('falló')), 1_000, 'prueba')).rejects.toThrow('falló');
  });

  it('rechaza con «sin respuesta en N s» si tarda demasiado', async () => {
    const never = new Promise<never>(() => undefined);
    await expect(withTimeout(never, 20, 'Firma')).rejects.toThrow('Firma: sin respuesta en 0.02 s');
  });
});

describe('describeError', () => {
  it('usa el mensaje, el texto o el JSON', () => {
    expect(describeError(new Error('uno'))).toBe('uno');
    expect(describeError('dos')).toBe('dos');
    expect(describeError({ n: 3n })).toBe('{"n":"3"}');
  });
});

describe('shortAddress', () => {
  it('acorta solo lo largo', () => {
    expect(shortAddress(`0xabcdef${'0'.repeat(30)}1234`)).toBe('0xabcd…1234');
    expect(shortAddress('corto')).toBe('corto');
    expect(shortAddress(undefined)).toBe('—');
  });
});
