// Revisa una presentación: guarda una captura de cada diapositiva y avisa si dos elementos
// (paneles, cintas, etiquetas sueltas o el pie) quedan a menos de 24 px o se salen del lienzo.
//   node slides/tools/revisar.mjs slides/01-como-funciona.html [carpeta-de-capturas]
// Requiere Google Chrome. No modifica la presentación.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [archivo, salida = join(tmpdir(), 'revisar-slides')] = process.argv.slice(2);
if (!archivo) { console.error('Uso: node slides/tools/revisar.mjs <presentacion.html> [carpeta]'); process.exit(64); }
const CHROME = process.env.CHROME ?? [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => existsSync(p));
if (!CHROME) { console.error('No encontré Chrome. Define la variable CHROME con su ruta.'); process.exit(1); }

mkdirSync(salida, { recursive: true });
const port = 9300 + Math.floor(Math.random() * 500);
const perfil = mkdtempSync(join(tmpdir(), 'revisar-chrome-'));
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
const evaluar = async (expression) => (await enviar('Runtime.evaluate', { expression, returnByValue: true })).result.result.value;

await enviar('Emulation.setDeviceMetricsOverride', { width: 1000, height: 563, deviceScaleFactor: 1, mobile: false });
await enviar('Page.navigate', { url: pathToFileURL(resolve(archivo)).href });
await sleep(3000);

const sonda = `(() => {
  const deck = document.getElementById('deck').getBoundingClientRect();
  const k = 1600 / deck.width, pad = 24;
  const slide = document.querySelector('.slide.on');
  const els = [...slide.querySelectorAll(':scope > .panel, :scope > .tape, :scope > .kicker, :scope > .item'), ...document.querySelectorAll('.foot > *')];
  const caja = (e) => { const r = e.getBoundingClientRect(); return { n: e.textContent.trim().replace(/\\s+/g, ' ').slice(0, 24), x1: (r.left - deck.left) * k, y1: (r.top - deck.top) * k, x2: (r.right - deck.left) * k, y2: (r.bottom - deck.top) * k }; };
  const b = els.map(caja), avisos = [];
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
    const p = b[i], q = b[j];
    if (p.x1 < q.x2 + pad && q.x1 < p.x2 + pad && p.y1 < q.y2 + pad && q.y1 < p.y2 + pad) avisos.push('muy cerca: "' + p.n + '" y "' + q.n + '"');
  }
  for (const e of b) if (e.x1 < 0 || e.y1 < 0 || e.x2 > 1600 || e.y2 > 900) avisos.push('fuera del lienzo: "' + e.n + '"');
  return avisos;
})()`;

const total = await evaluar('slides.length');
let problemas = 0;
for (let n = 1; n <= total; n++) {
  await evaluar(`show(${n - 1})`);
  await sleep(700);
  const avisos = await evaluar(sonda);
  problemas += avisos.length;
  console.log(`${String(n).padStart(2, '0')}: ${avisos.length ? '\n    ' + avisos.join('\n    ') : 'bien'}`);
  const cap = await enviar('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(salida, `${String(n).padStart(2, '0')}.png`), Buffer.from(cap.result.data, 'base64'));
}
console.log(`\nCapturas en ${salida}`);
ws.close();
chrome.kill();
await sleep(1500);
rmSync(perfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
process.exit(problemas ? 1 : 0);
