import { describe, expect, it } from 'vitest';
import { createSoundPrefs, SOUND_PREFS_KEY, type StorageLike } from './prefs';

const memory = (initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } => {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
};

describe('preferencias de sonido', () => {
  it('por defecto Música y Efectos activados', () => {
    const p = createSoundPrefs(memory());
    expect(p.music).toBe(true);
    expect(p.effects).toBe(true);
    expect(createSoundPrefs(null).music).toBe(true);
  });

  it('se guardan en polka-man.sonido y se leen al volver', () => {
    const s = memory();
    const p = createSoundPrefs(s);
    p.toggleMusic();
    p.setEffects(false);
    expect(JSON.parse(s.data[SOUND_PREFS_KEY]!)).toEqual({ musica: false, efectos: false });
    const again = createSoundPrefs(s);
    expect(again.music).toBe(false);
    expect(again.effects).toBe(false);
    again.toggleEffects();
    expect(createSoundPrefs(s).effects).toBe(true);
  });

  it('storage que lanza en get y set: valores en memoria, sin lanzar', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    const p = createSoundPrefs(broken);
    expect(p.music).toBe(true);
    expect(() => p.setMusic(false)).not.toThrow();
    expect(p.music).toBe(false);
  });

  it('JSON roto o con tipos raros → por defecto', () => {
    expect(createSoundPrefs(memory({ [SOUND_PREFS_KEY]: '{roto' })).music).toBe(true);
    const odd = createSoundPrefs(memory({ [SOUND_PREFS_KEY]: '{"musica":"no","efectos":false}' }));
    expect(odd.music).toBe(true);
    expect(odd.effects).toBe(false);
  });

  it('subscribe avisa en cada cambio y deja de avisar al quitarse', () => {
    const p = createSoundPrefs(memory());
    const seen: Array<{ music: boolean; effects: boolean }> = [];
    const off = p.subscribe((v) => seen.push(v));
    p.toggleMusic();
    p.setMusic(false); // sin cambio: no avisa
    p.toggleEffects();
    off();
    p.toggleMusic();
    expect(seen).toEqual([
      { music: false, effects: true },
      { music: false, effects: false },
    ]);
  });
});
