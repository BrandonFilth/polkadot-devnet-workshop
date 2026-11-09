// EVM local para probar el contrato: compila con solc usando los mismos ajustes que Remix por
// defecto (0.8.28, sin optimizador) y lo despliega en una @ethereumjs/vm en memoria.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createBlock } from '@ethereumjs/block';
import { createAddressFromString } from '@ethereumjs/util';
import { createVM } from '@ethereumjs/vm';
import { decodeErrorResult, decodeEventLog, decodeFunctionResult, encodeDeployData, encodeFunctionData, getAddress, hexToBytes, toHex } from 'viem';

const require = createRequire(import.meta.url);
const solc = require('solc');

let compiled;

/** Compila Leaderboard.sol una sola vez. */
export function compile() {
  if (compiled) return compiled;
  const file = 'Leaderboard.sol';
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const out = JSON.parse(solc.compile(JSON.stringify({
    language: 'Solidity',
    sources: { [file]: { content: source } },
    settings: {
      optimizer: { enabled: false },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } },
    },
  })));
  const errors = (out.errors ?? []).filter((e) => e.severity === 'error');
  if (errors.length) throw new Error(errors.map((e) => e.formattedMessage).join('\n'));
  const warnings = (out.errors ?? []).filter((e) => e.severity === 'warning');
  const c = out.contracts[file].Leaderboard;
  compiled = {
    abi: c.abi,
    bytecode: `0x${c.evm.bytecode.object}`,
    runtimeBytes: c.evm.deployedBytecode.object.length / 2,
    warnings: warnings.map((w) => w.formattedMessage),
  };
  return compiled;
}

/** Cuentas de prueba: player(1), player(2), ... */
export const player = (n) => getAddress(`0x${n.toString(16).padStart(40, '0')}`);

export class Reverted extends Error {
  constructor(name, args) {
    super(`revirtió con ${name}`);
    this.errorName = name;
    this.args = args;
  }
}

/** Hora (Unix, segundos) del primer bloque de cada despliegue de prueba. */
export const NOW = 1_800_000_000n;

/** Cuenta que despliega el contrato y, por eso, queda como admin. */
export const ADMIN = player(99);

/**
 * Despliega Leaderboard (el constructor no lleva parámetros) desde ADMIN.
 * Después el admin llama setStartTime(start) para abrir el ranking; por defecto start = NOW.
 * Con `{ start: null }` el ranking queda sin hora de inicio.
 * El reloj empieza en NOW y solo avanza con `warp(segundos)`.
 */
export async function deploy({ start = NOW } = {}) {
  const { abi, bytecode } = compile();
  const vm = await createVM();
  let number = 1n;
  let now = NOW;
  const block = () => createBlock({ header: { timestamp: now, number } }, { common: vm.common });
  const run = async (from, data, to) => {
    const r = await vm.evm.runCall({
      caller: createAddressFromString(from),
      origin: createAddressFromString(from),
      to: to ? createAddressFromString(to) : undefined,
      data: hexToBytes(data),
      gasLimit: 30_000_000n,
      skipBalance: true,
      block: block(),
    });
    number += 1n;
    return r;
  };

  const revert = (bytes) => {
    const data = toHex(bytes);
    try {
      const e = decodeErrorResult({ abi, data });
      return new Reverted(e.errorName, e.args ?? []);
    } catch {
      return new Reverted(`(sin decodificar ${data.slice(0, 10)})`, []);
    }
  };

  const created = await run(ADMIN, encodeDeployData({ abi, bytecode }));
  if (created.execResult.exceptionError) throw revert(created.execResult.returnValue);
  const address = created.createdAddress.toString();

  /** Escribe como `from`. Lanza Reverted con el nombre del error del contrato. */
  const send = async (from, functionName, args = []) => {
    const r = await run(from, encodeFunctionData({ abi, functionName, args }), address);
    if (r.execResult.exceptionError) throw revert(r.execResult.returnValue);
    const events = (r.execResult.logs ?? []).map(([, topics, data]) =>
      decodeEventLog({ abi, topics: topics.map((t) => toHex(t)), data: toHex(data) }));
    return { gas: r.execResult.executionGasUsed, events };
  };

  /** Lee una función view. */
  const read = async (functionName, args = []) => {
    const r = await run(player(99), encodeFunctionData({ abi, functionName, args }), address);
    if (r.execResult.exceptionError) throw revert(r.execResult.returnValue);
    return decodeFunctionResult({ abi, functionName, data: toHex(r.execResult.returnValue) });
  };

  /** Adelanta el reloj de los bloques siguientes. */
  const warp = (seconds) => {
    now += BigInt(seconds);
  };

  if (start !== null) await send(ADMIN, 'setStartTime', [start]);

  return { address, send, read, warp, now: () => now };
}

/** Comprueba que la promesa revierta con ese error. */
export async function expectRevert(promise, errorName) {
  try {
    await promise;
  } catch (e) {
    if (e instanceof Reverted && e.errorName === errorName) return e;
    throw e instanceof Reverted ? new Error(`se esperaba ${errorName}, llegó ${e.errorName}`) : e;
  }
  throw new Error(`se esperaba ${errorName}, pero la llamada pasó`);
}
