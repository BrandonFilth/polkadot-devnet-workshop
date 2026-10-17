// Tamaño del contrato compilado como lo hace Remix por defecto (0.8.28, sin optimizador).
// El límite de la máquina EVM de Polkadot Hub es 24,576 bytes de código desplegado.
import { compile } from './harness.mjs';

const LIMIT = 24_576;
const { runtimeBytes, warnings } = compile();
console.log(`Leaderboard: ${runtimeBytes} bytes de ${LIMIT} (${((runtimeBytes / LIMIT) * 100).toFixed(1)} %)`);
if (warnings.length) console.log(`\nAvisos del compilador:\n${warnings.join('\n')}`);
process.exit(runtimeBytes <= LIMIT ? 0 : 1);
