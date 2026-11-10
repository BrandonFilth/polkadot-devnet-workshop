// Pon aquí la dirección de TU PROPIO contrato Leaderboard (el que tú desplegaste).
// Este valor es el contrato de Polka-Man, el que usa polka-man.dot.
// Leaderboard v4: periodos de 3 días, un admin, hora de inicio, wallets de premios y pagos registrados.
export const LEADERBOARD_ADDRESS = '0xDFd77dEb59eE36444A3403054966AfB3843C93c8' as const;
export const ETH_RPC_URL = 'https://eth-rpc-testnet.polkadot.io';
export const CHAIN_ID = 420_420_417;
/** Tu nombre .dot (capítulo 6). La cuenta de cada app sale de este nombre. */
export const PRODUCT_DOMAIN = 'polka-man.dot';
export const DERIVATION_INDEX = 0;
/**
 * Pipeline de extensiones con que se firma en Asset Hub. Desde el runtime 2005005 (5 nov 2026) hay dos:
 * el 0 (el que usa el SDK por defecto) cobra la comisión en PAS; el 1 trae AsPgas y la cobra en PGAS.
 * Ver paritytech/product-sdk#339. Si un Host no acepta el 1, hub.ts reintenta una vez con el 0.
 */
export const TX_EXT_VERSION = 1;
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
/**
 * Explorador de la red por la que el admin envía los premios (BNB Smart Chain, BEP20). Solo se usa para
 * armar el enlace «Ver pago»: la app no hace peticiones a este dominio.
 */
export const PRIZE_TX_URL = 'https://bscscan.com/tx/';
/** Red por la que se envían los premios, tal como se le muestra al jugador. */
export const PRIZE_NETWORK = 'BNB Smart Chain (BEP20)';
/**
 * Nova Wallet y Binance en las tiendas oficiales (App Store y Google Play). Solo son enlaces que abre el
 * jugador desde «Nova Wallet» y «Binance» en Premios y Perfil: la app no hace peticiones a estos dominios.
 */
export const NOVA_WALLET_IOS_URL = 'https://apps.apple.com/app/nova-polkadot-wallet/id1597119355';
export const NOVA_WALLET_ANDROID_URL = 'https://play.google.com/store/apps/details?id=io.novafoundation.nova.market';
export const BINANCE_IOS_URL = 'https://apps.apple.com/app/binance-buy-bitcoin-crypto/id1436799971';
export const BINANCE_ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.binance.dev';
