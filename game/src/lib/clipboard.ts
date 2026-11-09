/**
 * Copia texto al portapapeles. Primero la API moderna; si falla (dentro del Host el iframe puede
 * no tener permiso) usa un <textarea> temporal con execCommand('copy'). Nunca lanza.
 */
export interface ClipboardEnv {
  writeText?: (text: string) => Promise<void>;
  /** Copia con el método viejo; devuelve si funcionó. */
  legacyCopy?: (text: string) => boolean;
}

export async function copyText(text: string, env: ClipboardEnv = browserClipboard()): Promise<boolean> {
  if (env.writeText) {
    try {
      await env.writeText(text);
      return true;
    } catch {
      // sigue con el método viejo
    }
  }
  try {
    return env.legacyCopy?.(text) ?? false;
  } catch {
    return false;
  }
}

/** El portapapeles del navegador. Fuera del navegador (tests en node) queda vacío. */
export function browserClipboard(): ClipboardEnv {
  const env: ClipboardEnv = {};
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    env.writeText = (text) => navigator.clipboard.writeText(text);
  }
  if (typeof document !== 'undefined') {
    env.legacyCopy = (text) => {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      try {
        return document.execCommand('copy');
      } finally {
        area.remove();
      }
    };
  }
  return env;
}
