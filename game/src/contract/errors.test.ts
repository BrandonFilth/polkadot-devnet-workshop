import { encodeErrorResult, hexToBytes, toFunctionSelector, type Abi } from 'viem';
import { describe, expect, it } from 'vitest';
import { revertMessage } from './errors';
import { leaderboardAbi } from './leaderboard';

const abi = leaderboardAbi as unknown as Abi;

describe('revertMessage', () => {
  it('forma 1: nombre y argumentos que da viem', () => {
    expect(revertMessage({ error: 'ScoreNotHigher', args: [300n, 200n] })).toBe('Ese puntaje no supera tu récord (300).');
    expect(revertMessage({ error: 'ScoreNotHigher', args: [] })).toBe('Ese puntaje no supera tu récord.');
    expect(revertMessage({ error: 'InvalidUsername', args: [] })).toBe('El username debe tener de 3 a 16 caracteres: a-z, 0-9 o _.');
    expect(revertMessage({ error: 'UsernameTaken' })).toBe('Ese username ya es de otro jugador.');
  });

  it('forma 2: selector de 4 bytes de la firma completa en los datos del revert', () => {
    const data = encodeErrorResult({ abi, errorName: 'ScoreNotHigher', args: [1240n, 10n] });
    // El selector sale de la firma completa, no de `ScoreNotHigher()`.
    expect(data.slice(0, 10)).toBe(toFunctionSelector('ScoreNotHigher(uint256,uint256)'));
    expect(data.slice(0, 10)).not.toBe(toFunctionSelector('ScoreNotHigher()'));
    expect(revertMessage({ type: 'Revive', value: { revert: { data } } })).toBe('Ese puntaje no supera tu récord (1240).');
    expect(revertMessage({ data: data.slice(0, 10) })).toBe('Ese puntaje no supera tu récord.');
    const taken = encodeErrorResult({ abi, errorName: 'UsernameTaken' });
    expect(revertMessage({ raw: hexToBytes(taken) })).toBe('Ese username ya es de otro jugador.');
  });

  it('forma 3: el nombre del error en el JSON serializado', () => {
    expect(revertMessage({ message: 'execution reverted: InvalidUsername()' })).toBe('El username debe tener de 3 a 16 caracteres: a-z, 0-9 o _.');
    expect(revertMessage('revert UsernameTaken')).toBe('Ese username ya es de otro jugador.');
  });

  it('no reconoce otros errores', () => {
    expect(revertMessage({ error: 'Otro' })).toBeNull();
    expect(revertMessage({ data: '0xdeadbeef' })).toBeNull();
    expect(revertMessage(null)).toBeNull();
  });
});
