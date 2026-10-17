import { describe, expect, it } from 'vitest';
import { shortAddress, topScores } from './ranking';

const row = (id: string, score: bigint) => ({ id, score });

describe('topScores', () => {
  it('ordena de mayor a menor puntaje', () => {
    expect(topScores([row('a', 10n), row('b', 300n), row('c', 120n)]).map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('en un empate conserva el orden de llegada', () => {
    expect(topScores([row('a', 50n), row('b', 90n), row('c', 50n), row('d', 50n)]).map((r) => r.id)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('recorta al límite (10 por defecto) y no cambia la lista original', () => {
    const rows = Array.from({ length: 15 }, (_, i) => row(String(i), BigInt(i)));
    expect(topScores(rows)).toHaveLength(10);
    expect(topScores(rows, 3).map((r) => r.id)).toEqual(['14', '13', '12']);
    expect(rows[0]!.id).toBe('0');
    expect(topScores([], 10)).toEqual([]);
  });

  it('compara bigint mayores que Number.MAX_SAFE_INTEGER', () => {
    const big = BigInt(Number.MAX_SAFE_INTEGER) + 2n;
    expect(topScores([row('a', big - 1n), row('b', big)]).map((r) => r.id)).toEqual(['b', 'a']);
  });
});

describe('shortAddress', () => {
  it('acorta direcciones y deja textos cortos igual', () => {
    expect(shortAddress(`0x42fb${'0'.repeat(32)}53e1`)).toBe('0x42fb…53e1');
    expect(shortAddress('ana')).toBe('ana');
    expect(shortAddress(null)).toBe('—');
  });
});
