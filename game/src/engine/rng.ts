// Números pseudoaleatorios con semilla (mulberry32). El estado es solo un número: serializable.

/** Avanza `s.seed` y devuelve un número en [0, 1). */
export function random(s: { seed: number }): number {
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
