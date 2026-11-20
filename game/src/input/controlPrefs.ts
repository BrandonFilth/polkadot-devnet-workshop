// Preferencia de controles táctiles: cruceta (flechas) o joystick fijo. Se guarda en el teléfono (localStorage),
// como Música y Efectos; si no se puede, queda en memoria. Por defecto, cruceta.
import type { StorageLike } from '../audio/prefs';

export type ControlMode = 'cruceta' | 'joystick';

/** Clave en localStorage. Valor: "cruceta" o "joystick". */
export const CONTROL_PREFS_KEY = 'polka-man.controles';

export const CONTROL_MODES: readonly ControlMode[] = ['cruceta', 'joystick'];

export const CONTROL_LABEL: Record<ControlMode, string> = { cruceta: 'Cruceta', joystick: 'Joystick' };

export interface ControlPrefs {
  readonly mode: ControlMode;
  setMode(mode: ControlMode): void;
  /** Avisa en cada cambio. Devuelve la función que deja de escuchar. */
  subscribe(listener: (mode: ControlMode) => void): () => void;
}

const isMode = (v: unknown): v is ControlMode => v === 'cruceta' || v === 'joystick';

export function createControlPrefs(storage: StorageLike | null): ControlPrefs {
  let mode: ControlMode = 'cruceta';
  try {
    const saved = storage?.getItem(CONTROL_PREFS_KEY);
    if (isMode(saved)) mode = saved;
  } catch {
    // Storage bloqueado: cruceta.
  }
  const listeners = new Set<(m: ControlMode) => void>();
  return {
    get mode() {
      return mode;
    },
    setMode(next) {
      if (!isMode(next) || next === mode) return;
      mode = next;
      try {
        storage?.setItem(CONTROL_PREFS_KEY, mode);
      } catch {
        // Sin espacio o bloqueado: sigue en memoria.
      }
      for (const l of listeners) l(mode);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
