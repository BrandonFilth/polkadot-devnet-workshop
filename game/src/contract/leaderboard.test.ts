import { describe, expect, it } from 'vitest';
import { decodeScores, leaderboardAbi, toScoreArg } from './leaderboard';

const names = (type: string) =>
  leaderboardAbi
    .filter((e) => e.type === type)
    .map((e) => (e as { name?: string }).name)
    .sort();

describe('ABI de Leaderboard', () => {
  it('trae las 19 funciones, 8 errores y 5 eventos del contrato v3 (admin y hora de inicio)', () => {
    expect(names('function')).toEqual([
      'PERIOD_LENGTH',
      'admin',
      'bestScore',
      'currentPeriod',
      'getScores',
      'getScoresIn',
      'isStarted',
      'lifetimeBest',
      'periodBounds',
      'playerCount',
      'playerCountIn',
      'playerOf',
      'scoreOf',
      'setAdmin',
      'setStartTime',
      'setUsername',
      'startTime',
      'submitScore',
      'usernameOf',
    ]);
    expect(names('error')).toEqual([
      'InvalidAdmin',
      'InvalidStart',
      'InvalidUsername',
      'NotAdmin',
      'NotStarted',
      'ScoreNotHigher',
      'StartLocked',
      'UsernameTaken',
    ]);
    expect(names('event')).toEqual(['AdminChanged', 'NewHighScore', 'NewLifetimeBest', 'StartTimeSet', 'UsernameSet']);
  });

  it('el constructor no lleva parámetros y setStartTime/setAdmin reciben uint256/address', () => {
    const ctor = leaderboardAbi.find((e) => e.type === 'constructor') as { inputs: unknown[] } | undefined;
    expect(ctor?.inputs).toEqual([]);
    const fn = (name: string) => leaderboardAbi.find((e) => (e as { name?: string }).name === name) as { inputs: Array<{ type: string }> };
    expect(fn('setStartTime').inputs.map((i) => i.type)).toEqual(['uint256']);
    expect(fn('setAdmin').inputs.map((i) => i.type)).toEqual(['address']);
  });
});

describe('decodeScores', () => {
  const A = `0x${'a'.repeat(40)}`;
  const B = `0x${'b'.repeat(40)}`;

  it('acepta la tupla de viem', () => {
    expect(decodeScores([[A, B], ['ana', ''], [120n, 7n]])).toEqual([
      { address: A, username: 'ana', score: 120n },
      { address: B, username: '', score: 7n },
    ]);
  });

  it('acepta el objeto del SDK y normaliza números', () => {
    expect(decodeScores({ addrs: [A], usernames: ['ana'], scores: [120] })).toEqual([{ address: A, username: 'ana', score: 120n }]);
  });

  it('con un valor vacío o raro devuelve una lista vacía', () => {
    expect(decodeScores(undefined)).toEqual([]);
    expect(decodeScores([[], [], []])).toEqual([]);
  });
});

describe('toScoreArg', () => {
  it('convierte enteros positivos a bigint', () => {
    expect(toScoreArg(1240)).toBe(1240n);
    expect(toScoreArg(Number.MAX_SAFE_INTEGER)).toBe(BigInt(Number.MAX_SAFE_INTEGER));
  });

  it('rechaza 0, negativos, decimales y números inseguros con RangeError', () => {
    for (const bad of [0, -10, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1, Number.POSITIVE_INFINITY]) {
      expect(() => toScoreArg(bad)).toThrow(RangeError);
    }
  });
});

describe('regla de red y dirección única', () => {
  // Texto de todos los .ts de src/ (Vite los carga como texto crudo).
  const all = import.meta.glob<string>('/src/**/*.ts', { query: '?raw', import: 'default', eager: true });
  const files = Object.entries(all)
    .map(([path, text]) => [path.replace(/^\/src\//, ''), text] as const)
    .filter(([path]) => !path.endsWith('.test.ts') && path !== 'contract/config.ts');

  it('revisa el código fuente', () => {
    const paths = files.map(([path]) => path);
    expect(paths).toContain('hub/hub.ts');
    expect(paths).toContain('contract/rpcReader.ts');
    expect(paths).toContain('main.ts');
  });

  it('ninguna dirección de contrato fuera de contract/config.ts', () => {
    expect(files.filter(([, text]) => /0x[0-9a-fA-F]{40}/.test(text)).map(([path]) => path)).toEqual([]);
  });

  it('ninguna URL http(s):// fuera de contract/config.ts', () => {
    expect(files.filter(([, text]) => /https?:\/\//.test(text)).map(([path]) => path)).toEqual([]);
  });
});
