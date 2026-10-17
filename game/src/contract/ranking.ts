export { shortAddress } from '../lib/format';

/**
 * Top del marcador: de mayor a menor puntaje. El contrato devuelve a los jugadores en el orden en
 * que llegaron y el orden es estable, así que en un empate queda primero quien llegó antes.
 */
export function topScores<T extends { score: bigint }>(rows: readonly T[], limit = 10): T[] {
  return [...rows]
    .sort((a, b) => (b.score > a.score ? 1 : b.score < a.score ? -1 : 0))
    .slice(0, Math.max(0, limit));
}
