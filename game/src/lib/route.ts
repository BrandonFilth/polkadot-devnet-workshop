/**
 * Rutas de la app (en el hash, porque el bundle se sirve desde un CID con base './'). Puro, sin DOM.
 * `partida` marca que hay una partida en curso: el botón Atrás de Android no debe sacarte de ella.
 */
export type Tab = 'jugar' | 'ranking' | 'premios' | 'perfil';
export type Route = Tab | 'partida';

export const TABS: readonly Tab[] = ['jugar', 'ranking', 'premios', 'perfil'];

export const TAB_LABEL: Record<Tab, string> = {
  jugar: 'Jugar',
  ranking: 'Ranking',
  premios: 'Premios',
  perfil: 'Perfil',
};

/** `#/ranking` → 'ranking'. Lo desconocido o vacío → 'jugar'. */
export function parseRoute(hash: string): Route {
  const name = hash.replace(/^#\/?/, '').split(/[/?]/)[0] ?? '';
  if (name === 'partida') return 'partida';
  return (TABS as readonly string[]).includes(name) ? (name as Tab) : 'jugar';
}

export const routeHash = (route: Route): string => `#/${route}`;
