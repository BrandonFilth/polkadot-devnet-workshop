import { createPublicClient, erc20Abi, http } from 'viem';
import { ETH_RPC_URL, PGAS_ASSET_ID, RPC_TIMEOUT_MS, TOKEN_DECIMALS } from './config';

/*
 * Saldo PGAS directo del ETH-RPC de la cadena, por el precompile ERC-20 de assets
 * (0x{assetId en 8 hex}000…01200000). No toca el Host, así que responde aunque la conexión de la
 * Polkadot App sea lo que está atorado.
 */
export const PGAS_PRECOMPILE = `0x${PGAS_ASSET_ID.toString(16).padStart(8, '0')}${'0'.repeat(24)}01200000` as const;

const client = createPublicClient({ transport: http(ETH_RPC_URL, { timeout: RPC_TIMEOUT_MS, retryCount: 1 }) });

/** PGAS de una cuenta H160 en unidades base (10 decimales), o null si ahora no se puede leer. */
export async function readPgas(h160: string): Promise<bigint | null> {
  try {
    return await client.readContract({
      address: PGAS_PRECOMPILE,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [h160 as `0x${string}`],
    });
  } catch (error) {
    console.warn('[polka-man] PGAS por RPC', error);
    return null;
  }
}

/**
 * Debajo de este saldo el propio Host recarga PGAS. Arriba de él, un pago fallido no es falta
 * de PGAS (1 PGAS).
 */
export const PGAS_LOW = 10n ** BigInt(TOKEN_DECIMALS);

export const formatPgas = (value: bigint) => (Number(value) / 10 ** TOKEN_DECIMALS).toFixed(2);
