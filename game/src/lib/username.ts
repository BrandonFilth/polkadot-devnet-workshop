/**
 * La misma regla que `isValid()` de Leaderboard.sol: 3 a 16 caracteres, solo a-z, 0-9 y _.
 * El contrato es el dueño de la regla; esta copia solo sirve para avisar al instante.
 */
export function isValidUsername(name: string): boolean {
  return /^[a-z0-9_]{3,16}$/.test(name);
}
