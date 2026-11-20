// Tamaño del contrato compilado como lo hace Remix por defecto (0.8.28, sin optimizador).
// El límite de la máquina EVM de Polkadot Hub es 24,576 bytes de código desplegado.
import { compile } from './harness.mjs';

const LIMIT = 24_576;
// LeaderboardV5 es el contrato en uso; Leaderboard (v4) queda como historial de lo que se migró.
const { runtimeBytes, warnings } = compile('LeaderboardV5');
console.log(`LeaderboardV5: ${runtimeBytes} bytes de ${LIMIT} (${((runtimeBytes / LIMIT) * 100).toFixed(1)} %)`);
if (warnings.length) console.log(`\nAvisos del compilador:\n${warnings.join('\n')}`);
process.exit(runtimeBytes <= LIMIT ? 0 : 1);
