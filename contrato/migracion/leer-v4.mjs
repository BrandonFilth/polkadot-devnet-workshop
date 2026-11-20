// Lee el Leaderboard v4 y arma los argumentos de la migración a v5, listos para pegar en Remix.
// Solo lectura (no firma nada). Uso, desde contrato/: node migracion/leer-v4.mjs
//
// Reglas (decididas con el organizador):
// - Se importan los periodos ya terminados; el periodo en curso NO (empieza vacío en v5).
// - Puntajes de 0 o mayores que MAX_SCORE (los de trampa, como 2^256-1) no se importan.
// - El récord de por vida no se importa: en v5 empieza en cero.
// - Perfiles (username y wallet de premios) de los jugadores de los periodos importados.
// - Premios ya registrados de las 6 rondas, con su wallet y su hora originales.
import { writeFileSync } from 'node:fs';
import { createPublicClient, http, parseAbi } from 'viem';

const V4 = '0xDFd77dEb59eE36444A3403054966AfB3843C93c8';
const RPC = 'https://eth-rpc-testnet.polkadot.io';
const MAX_SCORE = 10_000_000n;
const ZERO = '0x0000000000000000000000000000000000000000';

const abi = parseAbi([
  'function startTime() view returns (uint256)',
  'function currentPeriod() view returns (uint256)',
  'function playerCountIn(uint256) view returns (uint256)',
  'function getScoresIn(uint256 p, uint256 offset, uint256 limit) view returns (address[] addrs, string[] usernames, uint256[] scores)',
  'function payoutsOf(address[] players) view returns (address[] wallets)',
  'function prizesOf(uint256 round) view returns ((address player, address wallet, bytes32 txHash, uint64 paidAt)[] list)',
]);
const client = createPublicClient({ transport: http(RPC, { timeout: 30_000 }) });
const read = (functionName, args = []) => client.readContract({ address: V4, abi, functionName, args });

const start = await read('startTime');
const current = await read('currentPeriod');
const scores = [];
const skipped = [];
const profiles = new Map();

for (let p = 0n; p < current; p++) {
  const n = await read('playerCountIn', [p]);
  const players = [];
  const values = [];
  for (let offset = 0n; offset < n; offset += 50n) {
    const [addrs, names, s] = await read('getScoresIn', [p, offset, 50n]);
    addrs.forEach((a, i) => {
      if (s[i] === 0n || s[i] > MAX_SCORE) {
        skipped.push({ period: Number(p), player: a, username: names[i], score: s[i].toString() });
        return;
      }
      players.push(a);
      values.push(s[i].toString());
      profiles.set(a, names[i]);
    });
  }
  if (players.length) scores.push({ period: Number(p), players, scores: values });
}

const profilePlayers = [...profiles.keys()];
const wallets = profilePlayers.length ? await read('payoutsOf', [profilePlayers]) : [];

const prizes = [];
for (let round = 1n; round <= 6n; round++) {
  const list = await read('prizesOf', [round]);
  list.forEach((pz, i) => {
    if (pz.player === ZERO) return;
    prizes.push({ round: Number(round), place: i + 1, player: pz.player, wallet: pz.wallet, txHash: pz.txHash, paidAt: pz.paidAt.toString() });
  });
}

// Lo que se pega en Remix, en orden. Remix acepta listas como JSON: ["0x…","0x…"].
const steps = [`setStartTime: ${start}`];
for (const s of scores) steps.push(`importScores: ${s.period}, ${JSON.stringify(s.players)}, ${JSON.stringify(s.scores)}`);
if (profilePlayers.length) {
  steps.push(`importProfiles: ${JSON.stringify(profilePlayers)}, ${JSON.stringify(profilePlayers.map((a) => profiles.get(a)))}, ${JSON.stringify(wallets)}`);
}
for (const p of prizes) steps.push(`importPrize: ${p.round}, ${p.place}, ${p.player}, ${p.wallet}, ${p.txHash}, ${p.paidAt}`);
steps.push('closeMigration (después de verificar con verificar-v5.mjs)');

const result = { v4: V4, startTime: start.toString(), periodoActualV4: Number(current), scores, skipped, profiles: profilePlayers.length, prizes, steps };
writeFileSync(new URL('./migracion.json', import.meta.url), JSON.stringify(result, null, 2));
console.log(`startTime ${start} · periodo en curso ${current} (no se importa)`);
for (const s of scores) console.log(`periodo ${s.period}: ${s.players.length} puntajes`);
console.log(`sin importar (0 o más de MAX_SCORE): ${skipped.length}`);
for (const k of skipped) console.log(`  periodo ${k.period} ${k.username || k.player} ${k.score}`);
console.log(`perfiles: ${profilePlayers.length} · premios registrados: ${prizes.length}`);
console.log('\nPasos para Remix (también en migracion/migracion.json):');
steps.forEach((s, i) => console.log(`${i + 1}. ${s}`));
