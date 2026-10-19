// Guarda capturas de diapositivas para las guías: 1280x720 PNG, sin pie ni barra de progreso.
// Cada par <n>=<nombre> guarda la diapositiva n (empieza en 1) como <carpeta>/<nombre>.png.
//   node slides/tools/capturar.mjs <presentacion.html> <carpeta> <n>=<nombre> [<n>=<nombre> …]
//   node slides/tools/capturar.mjs slides/03-smart-contracts.html img/cap3 16=abi 18=cuentas
// Requiere Google Chrome. No modifica la presentación.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const USO = 'Uso: node slides/tools/capturar.mjs <presentacion.html> <carpeta> <n>=<nombre> [<n>=<nombre> …]';
const [archivo, salida, ...pares] = process.argv.slice(2);
const capturas = pares.map((p) => p.match(/^(\d+)=([\w.-]+)$/));
if (!archivo || !salida || !pares.length || capturas.some((c) => !c)) { console.error(USO); process.exit(64); }
if (!existsSync(archivo)) { console.error(`No existe ${archivo}.`); process.exit(64); }
const CHROME = process.env.CHROME ?? [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => existsSync(p));
if (!CHROME) { console.error('No encontré Chrome. Define la variable CHROME con su ruta.'); process.exit(1); }

mkdirSync(salida, { recursive: true });
const port = 9300 + Math.floor(Math.random() * 500);
const perfil = mkdtempSync(join(tmpdir(), 'capturar-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${perfil}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pagina;
for (let i = 0; i < 50 && !pagina; i++) {
  try { pagina = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch { await sleep(200); }
}
const ws = new WebSocket(pagina.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pendientes = new Map();
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pendientes.has(d.id)) { pendientes.get(d.id)(d); pendientes.delete(d.id); } });
const enviar = (method, params = {}) => new Promise((r) => { const n = ++id; pendientes.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluar = async (expression) => (await enviar('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.result.value;

const cerrar = async (codigo) => {
  ws.close();
  chrome.kill();
  await sleep(1500);
  rmSync(perfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  process.exit(codigo);
};

// Lienzo de 1600x900 a escala 0.8: la captura sale en 1280x720.
await enviar('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 0.8, mobile: false });
await enviar('Page.navigate', { url: pathToFileURL(resolve(archivo)).href });
await sleep(3000);
await evaluar('document.fonts.ready.then(() => true)');
await evaluar(`(() => { const s = document.createElement('style'); s.textContent = '.foot,.progress{display:none!important}'; document.head.append(s); return true; })()`);

const total = await evaluar('slides.length');
const fuera = capturas.filter(([, n]) => Number(n) < 1 || Number(n) > total);
if (fuera.length) {
  console.error(`La presentación tiene ${total} diapositivas; fuera de rango: ${fuera.map(([p]) => p).join(', ')}`);
  console.error(USO);
  await cerrar(64);
}
for (const [, n, nombre] of capturas) {
  await evaluar(`show(${Number(n) - 1})`);
  await sleep(700);
  const cap = await enviar('Page.captureScreenshot', { format: 'png' });
  const datos = Buffer.from(cap.result.data, 'base64');
  writeFileSync(join(salida, `${nombre}.png`), datos);
  const kb = Math.round(datos.length / 1024);
  console.log(`${nombre}.png  ${kb} KB${kb > 400 ? ' (más de 400 KB)' : ''}`);
}
await cerrar(0);
