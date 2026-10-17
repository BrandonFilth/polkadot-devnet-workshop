// Escribe la ABI de Leaderboard.sol en el juego: game/src/contract/leaderboard.abi.json.
// Córrelo con `pnpm abi` cada vez que cambie el contrato.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compile } from './harness.mjs';

const destino = new URL('../../game/src/contract/leaderboard.abi.json', import.meta.url);
mkdirSync(new URL('.', destino), { recursive: true });
const { abi } = compile();
writeFileSync(destino, `${JSON.stringify(abi, null, 2)}\n`);
console.log(`ABI escrita en ${fileURLToPath(destino)} (${abi.length} entradas)`);
