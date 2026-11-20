export { shortAddress } from '../lib/format';

/**
 * Top del marcador: de mayor a menor puntaje. El contrato devuelve a los jugadores en el orden en
 * que llegaron y el orden es estable, así que en un empate queda primero quien llegó antes. Los descalificados
 * (puntaje 0) no se muestran.
 */
export function topScores<T extends { score: bigint }>(rows: readonly T[], limit = 10): T[] {
  // Un puntaje 0 es un jugador descalificado (disqualify de LeaderboardV5): no aparece.
  return rows
    .filter((r) => r.score > 0n)
    .sort((a, b) => (b.score > a.score ? 1 : b.score < a.score ? -1 : 0))
    .slice(0, Math.max(0, limit));
}
