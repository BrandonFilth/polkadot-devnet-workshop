import { describe, expect, it } from 'vitest';
import { formatPgas, PGAS_LOW, PGAS_PRECOMPILE } from './pgas';

describe('PGAS', () => {
  it('arma la dirección del precompile ERC-20 desde PGAS_ASSET_ID', () => {
    expect(PGAS_PRECOMPILE).toBe('0x7735940000000000000000000000000001200000');
  });

  it('PGAS_LOW es 1 PGAS (10 decimales)', () => {
    expect(PGAS_LOW).toBe(10n ** 10n);
    expect(formatPgas(PGAS_LOW)).toBe('1.00');
    expect(formatPgas(25n * 10n ** 9n)).toBe('2.50');
  });
});
