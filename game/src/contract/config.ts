// Pon aquí la dirección de TU PROPIO contrato Leaderboard (el que tú desplegaste).
// Este valor es el contrato de Polka-Man, el que usa polka-man.dot.
// TODO: poner aquí la dirección del Leaderboard v2 (periodos de 3 días) cuando se despliegue en Remix. Hasta entonces pnpm test:red falla.
export const LEADERBOARD_ADDRESS = '0x0aAf511a454c6A522b37210ca6931Cde1c400Ac9' as const;
export const ETH_RPC_URL = 'https://eth-rpc-testnet.polkadot.io';
export const CHAIN_ID = 420_420_417;
/** Tu nombre .dot (capítulo 6). La cuenta de cada app sale de este nombre. */
export const PRODUCT_DOMAIN = 'polka-man.dot';
export const DERIVATION_INDEX = 0;
export const PGAS_ASSET_ID = 2_000_000_000;
export const TOKEN_DECIMALS = 10;
export const PRODUCT_CONTEXT_TIMEOUT_MS = 3_000;
export const SIGN_TIMEOUT_MS = 300_000;
export const READ_TIMEOUT_MS = 20_000;
export const RPC_TIMEOUT_MS = 8_000;
/** Máximo de jugadores que se leen para armar el top (en páginas de 50). */
export const MAX_PLAYERS_READ = 1_000;
/** Zona horaria de las fechas del ranking (UTC−6 todo el año). */
export const RANKING_TIME_ZONE = 'America/Monterrey';
