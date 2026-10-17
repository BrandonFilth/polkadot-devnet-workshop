import { describe, expect, it } from 'vitest';
import { isValidUsername } from './username';

// Casos del capítulo 4 §6 (los mismos que prueba el contrato) y los límites de la regla.
describe('isValidUsername (misma regla que Leaderboard.sol)', () => {
  it('acepta a-z, 0-9 y _ de 3 a 16 caracteres', () => {
    for (const ok of ['ana', 'ana_pro', 'abc', 'a'.repeat(16), 'jugador_42', '___']) expect(isValidUsername(ok)).toBe(true);
  });

  it('rechaza mayúsculas, como Ana', () => {
    expect(isValidUsername('Ana')).toBe(false);
  });

  it('rechaza menos de 3 o más de 16 caracteres', () => {
    for (const bad of ['', 'ab', 'a'.repeat(17)]) expect(isValidUsername(bad)).toBe(false);
  });

  it('rechaza espacios, acentos, ñ y otros símbolos', () => {
    for (const bad of ['ana pro', 'josé', 'ñandu', 'ana-pro', 'ana.pro', 'ana\n']) expect(isValidUsername(bad)).toBe(false);
  });
});
