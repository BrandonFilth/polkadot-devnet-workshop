// Pon aquí la dirección de TU PROPIO contrato Leaderboard (el que tú desplegaste).
// Este valor es el contrato de Polka-Man, el que usa polka-man.dot.
// Leaderboard v3: periodos de 3 días, un admin y hora de inicio que fija el admin desde la app.
export const LEADERBOARD_ADDRESS = '0x079D136B033AF0317fdA178d6C9C323f0996afce' as const;
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
