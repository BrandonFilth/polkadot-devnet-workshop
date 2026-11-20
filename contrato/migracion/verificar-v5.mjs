// Compara lo que hay en v5 con migracion/migracion.json (salida de leer-v4.mjs). Solo lectura.
// Uso, desde contrato/: node migracion/verificar-v5.mjs 0xDireccionDeV5
import { readFileSync } from 'node:fs';
import { createPublicClient, http, parseAbi } from 'viem';

const V5 = process.argv[2];
if (!/^0x[0-9a-fA-F]{40}$/.test(V5 ?? '')) throw new Error('Uso: node migracion/verificar-v5.mjs 0xDireccionDeV5');
const plan = JSON.parse(readFileSync(new URL('./migracion.json', import.meta.url), 'utf8'));
const abi = parseAbi([
  'function startTime() view returns (uint256)',
  'function migrationOpen() view returns (bool)',
  'function signer() view returns (address)',
  'function getScoresIn(uint256 p, uint256 offset, uint256 limit) view returns (address[] addrs, string[] usernames, uint256[] scores)',
  'function playerCount() view returns (uint256)',
  'function lifetimeBest(address) view returns (uint256)',
  'function usernameOf(address) view returns (string)',
  'function payoutsOf(address[] players) view returns (address[] wallets)',
  'function prizeOf(uint256 round, uint256 place) view returns ((address player, address wallet, bytes32 txHash, uint64 paidAt))',
]);
const client = createPublicClient({ transport: http('https://eth-rpc-testnet.polkadot.io', { timeout: 30_000 }) });
const read = (functionName, args = []) => client.readContract({ address: V5, abi, functionName, args });

const problems = [];
const check = (ok, what) => {
  if (!ok) problems.push(what);
};

check((await read('startTime')).toString() === plan.startTime, 'startTime distinto');
for (const s of plan.scores) {
  const [addrs, , scores] = await read('getScoresIn', [BigInt(s.period), 0n, 1000n]);
  check(JSON.stringify(addrs) === JSON.stringify(s.players), `periodo ${s.period}: jugadores u orden distintos`);
  check(JSON.stringify(scores.map(String)) === JSON.stringify(s.scores), `periodo ${s.period}: puntajes distintos`);
}
const profilePlayers = [...new Set(plan.scores.flatMap((s) => s.players))];
const wallets = await read('payoutsOf', [profilePlayers]);
const step = plan.steps.find((x) => x.startsWith('importProfiles:'));
if (step) {
  const [players, names, ws] = JSON.parse(`[${step.slice('importProfiles:'.length)}]`);
  for (let i = 0; i < players.length; i++) {
    if (names[i]) check((await read('usernameOf', [players[i]])) === names[i], `username de ${players[i]}`);
    if (ws[i] !== '0x0000000000000000000000000000000000000000') {
      check(wallets[profilePlayers.indexOf(players[i])].toLowerCase() === ws[i].toLowerCase(), `wallet de ${players[i]}`);
    }
  }
}
for (const p of plan.prizes) {
  const got = await read('prizeOf', [BigInt(p.round), BigInt(p.place)]);
  check(got.player === p.player && got.wallet === p.wallet && got.txHash === p.txHash && got.paidAt.toString() === p.paidAt, `premio ronda ${p.round} lugar ${p.place}`);
}

console.log(`firmante: ${await read('signer')} · migración abierta: ${await read('migrationOpen')} · jugadores en el periodo actual: ${await read('playerCount')}`);
console.log(problems.length ? `PROBLEMAS:\n- ${problems.join('\n- ')}` : 'Todo coincide con migracion.json. Ya se puede llamar closeMigration.');
