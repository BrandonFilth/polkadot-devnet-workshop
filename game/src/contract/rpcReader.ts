import { BaseError, ContractFunctionRevertedError, createPublicClient, http, type Abi } from 'viem';
import { withTimeout } from '../lib/format';
import { ETH_RPC_URL, LEADERBOARD_ADDRESS, RPC_TIMEOUT_MS } from './config';
import { leaderboardAbi, type LeaderboardContract } from './leaderboard';

/*
 * Lecturas y simulaciones directo al ETH-RPC público de la cadena (eth_call), sin pasar por el
 * Host. Responde rápido, acepta cualquier origen (CORS *) y funciona fuera del Host, así que el
 * ranking se ve en un navegador normal. Las lecturas simultáneas viajan juntas en un lote
 * JSON-RPC. Las firmas siguen yendo por el Host: solo él puede firmar.
 */

type C = LeaderboardContract;
type QueryResult = { success: true; value: unknown } | { success: false; value: unknown };
type QueryOptions = { origin?: string; from?: string; at?: string };
type Query = (...args: unknown[]) => Promise<QueryResult>;

/** Después de un fallo del RPC, ir directo al Host durante este tiempo. */
const RPC_COOLDOWN_MS = 30_000;

const abi = leaderboardAbi as unknown as Abi;
const inputCount = new Map<string, number>();
for (const entry of abi) {
  if (entry.type === 'function') inputCount.set(entry.name, entry.inputs.length);
}

const client = createPublicClient({
  transport: http(ETH_RPC_URL, { timeout: RPC_TIMEOUT_MS, retryCount: 0, batch: { batchSize: 40, wait: 16 } }),
});

const isOptions = (value: unknown): value is QueryOptions =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
  && Object.keys(value).every((k) => k === 'origin' || k === 'from' || k === 'at');

/** Separa las opciones de lectura del final de los argumentos (la ABI dice cuántos hay). */
function splitArgs(name: string, args: unknown[]): { fnArgs: unknown[]; options: QueryOptions } {
  const count = inputCount.get(name) ?? args.length;
  const last = args[args.length - 1];
  if (args.length > count && isOptions(last)) return { fnArgs: args.slice(0, -1), options: last };
  return { fnArgs: args, options: {} };
}

/**
 * Un revert es una respuesta (success: false), no un fallo: devuelve el nombre del error, sus
 * argumentos (por ejemplo `current` de ScoreNotHigher) y los datos crudos.
 */
function asRevert(error: unknown): QueryResult | null {
  if (!(error instanceof BaseError)) return null;
  const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
  if (!(revert instanceof ContractFunctionRevertedError)) return null;
  return {
    success: false,
    value: {
      error: revert.data?.errorName ?? null,
      args: revert.data?.args ?? [],
      raw: revert.raw ?? null,
      message: revert.shortMessage,
    },
  };
}

/**
 * Objeto con la forma del contrato cuyo `fn.query(...args, opts?)` corre por ETH-RPC.
 * `defaultFrom` es msg.sender para lecturas personales y simulaciones (dirección H160).
 */
export function createRpcContract(defaultFrom?: () => string | undefined): C {
  const query = (name: string): Query => async (...args) => {
    const { fnArgs, options } = splitArgs(name, args);
    const account = (options.from ?? defaultFrom?.()) as `0x${string}` | undefined;
    try {
      const value = await client.readContract({
        address: LEADERBOARD_ADDRESS,
        abi,
        functionName: name,
        args: fnArgs,
        ...(account ? { account } : {}),
      });
      return { success: true, value };
    } catch (error) {
      const revert = asRevert(error);
      if (revert) return revert;
      throw error;
    }
  };
  return new Proxy({}, {
    get: (_t, prop) => (typeof prop === 'string' ? { query: query(prop) } : undefined),
  }) as unknown as C;
}

let rpcDownUntil = 0;

/**
 * Lee primero por ETH-RPC; si la red falla o tarda, hace la misma llamada con el contrato del Host
 * (`fallback`). Un revert es una respuesta real y nunca se reintenta en el Host.
 */
export function withHostFallback(rpc: C, fallback: () => C | null): C {
  const query = (name: string): Query => async (...args) => {
    const host = fallback();
    const rawHostQuery = host ? ((host as unknown as Record<string, { query: Query }>)[name]?.query) : undefined;
    // El SDK del Host solo conoce `origin` y `at`: se quita `from`, que es solo del RPC.
    const hostQuery = rawHostQuery && ((...a: unknown[]) => {
      const { fnArgs, options } = splitArgs(name, a);
      const { from: _from, ...hostOptions } = options;
      return rawHostQuery(...fnArgs, ...(Object.keys(hostOptions).length ? [hostOptions] : []));
    });
    if (Date.now() < rpcDownUntil && hostQuery) return hostQuery(...args);
    try {
      const rpcQuery = (rpc as unknown as Record<string, { query: Query }>)[name]!.query;
      return await withTimeout(rpcQuery(...args), RPC_TIMEOUT_MS + 1_000, `${name}() por RPC`);
    } catch (error) {
      if (!hostQuery) throw error;
      console.warn(`[polka-man] RPC falló en ${name}(); uso la Polkadot App`, error);
      rpcDownUntil = Date.now() + RPC_COOLDOWN_MS;
      return hostQuery(...args);
    }
  };
  return new Proxy({}, {
    get: (_t, prop) => (typeof prop === 'string' ? { query: query(prop) } : undefined),
  }) as unknown as C;
}
