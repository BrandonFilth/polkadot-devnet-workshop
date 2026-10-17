/** Rechaza si `promise` no termina en `ms`. El mensaje («sin respuesta en N s») lo reconoce txErrors. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}: sin respuesta en ${ms / 1000} s`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Texto legible de cualquier error. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)) ?? String(error);
  } catch {
    return String(error);
  }
}

/** `0x1234567890abcdef…` → `0x1234…cdef`. */
export function shortAddress(value: string | null | undefined): string {
  if (!value) return '—';
  return value.length < 16 ? value : `${value.slice(0, 6)}…${value.slice(-4)}`;
}
