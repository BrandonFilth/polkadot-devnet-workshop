// Preferencias de sonido (Música y Efectos). Se guardan en localStorage; si no se puede, quedan en memoria.

/** Lo único que se usa de Storage (los tests pasan un objeto propio). */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** Clave en localStorage. Valor: JSON { "musica": boolean, "efectos": boolean }. */
export const SOUND_PREFS_KEY = 'polka-man.sonido';

export interface SoundPrefsValue {
  music: boolean;
  effects: boolean;
}

export interface SoundPrefs {
  readonly music: boolean;
  readonly effects: boolean;
  setMusic(on: boolean): void;
  setEffects(on: boolean): void;
  toggleMusic(): void;
  toggleEffects(): void;
  /** Avisa en cada cambio. Devuelve la función que deja de escuchar. */
  subscribe(listener: (p: SoundPrefsValue) => void): () => void;
}

/** localStorage si existe y se puede tocar (algunos sandbox lo bloquean); si no, null. */
export function safeStorage(): StorageLike | null {
  try {
    const s = globalThis.localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

function read(storage: StorageLike | null): SoundPrefsValue {
  const value = { music: true, effects: true };
  if (!storage) return value;
  try {
    const raw = storage.getItem(SOUND_PREFS_KEY);
    if (raw === null) return value;
    const data: unknown = JSON.parse(raw);
    if (data && typeof data === 'object') {
      const d = data as { musica?: unknown; efectos?: unknown };
      if (typeof d.musica === 'boolean') value.music = d.musica;
      if (typeof d.efectos === 'boolean') value.effects = d.efectos;
    }
  } catch {
    // Storage que lanza o JSON roto: valores por defecto.
  }
  return value;
}

export function createSoundPrefs(storage: StorageLike | null): SoundPrefs {
  const value = read(storage);
  const listeners = new Set<(p: SoundPrefsValue) => void>();

  const commit = () => {
    try {
      storage?.setItem(SOUND_PREFS_KEY, JSON.stringify({ musica: value.music, efectos: value.effects }));
    } catch {
      // Sin espacio o bloqueado: sigue en memoria.
    }
    const snapshot = { ...value };
    for (const l of listeners) l(snapshot);
  };

  const prefs: SoundPrefs = {
    get music() {
      return value.music;
    },
    get effects() {
      return value.effects;
    },
    setMusic(on) {
      if (value.music === on) return;
      value.music = on;
      commit();
    },
    setEffects(on) {
      if (value.effects === on) return;
      value.effects = on;
      commit();
    },
    toggleMusic: () => prefs.setMusic(!value.music),
    toggleEffects: () => prefs.setEffects(!value.effects),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return prefs;
}
