// Revisa una presentación: guarda una captura de cada diapositiva y avisa si dos elementos
// (paneles, cintas, etiquetas sueltas, el pie o el logo) quedan a menos de 24 px o se salen del lienzo.
// También avisa si un texto o elemento se sale de su caja (panel, terminal, ventana, tarjeta).
// Un elemento que monta el borde a propósito lleva el atributo data-sobresale.
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
  const els = [...slide.querySelectorAll(':scope > .panel, :scope > .tape, :scope > .kicker, :scope > .item'), ...document.querySelectorAll('.foot > *, .brand')];
  const caja = (e) => { const r = e.getBoundingClientRect(); return { n: (e.textContent.trim() || e.alt || '').replace(/\\s+/g, ' ').slice(0, 24), x1: (r.left - deck.left) * k, y1: (r.top - deck.top) * k, x2: (r.right - deck.left) * k, y2: (r.bottom - deck.top) * k }; };
  const b = els.map(caja), avisos = [];
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
    const p = b[i], q = b[j];
    if (p.x1 < q.x2 + pad && q.x1 < p.x2 + pad && p.y1 < q.y2 + pad && q.y1 < p.y2 + pad) avisos.push('muy cerca: "' + p.n + '" y "' + q.n + '"');
  }
  for (const e of b) if (e.x1 < 0 || e.y1 < 0 || e.x2 > 1600 || e.y2 > 900) avisos.push('fuera del lienzo: "' + e.n + '"');
  return avisos;
})()`;

// Desbordes: una caja (con overflow distinto de visible, borde o fondo) cuyo contenido se sale
// de su borde interior, o un nodo de texto que se sale de su caja más cercana.
const sondaDesborde = `(() => {
  const EXENTO = '[data-sobresale]';
  const slide = document.querySelector('.slide.on');
  const transparente = (c) => c === 'transparent' || /rgba\\(.*,\\s*0\\)$/.test(c);
  const esCaja = (e) => {
    if (e.closest('svg')) return false;
    const s = getComputedStyle(e);
    if (['inline', 'contents', 'none'].includes(s.display)) return false;
    if (s.overflowX !== 'visible' || s.overflowY !== 'visible') return true;
    for (const l of ['Top', 'Right', 'Bottom', 'Left'])
      if (parseFloat(s['border' + l + 'Width']) > 0 && s['border' + l + 'Style'] !== 'none' && !transparente(s['border' + l + 'Color'])) return true;
    return !transparente(s.backgroundColor) || s.backgroundImage !== 'none';
  };
  const cajas = [...slide.querySelectorAll('*')].filter(esCaja);
  const enCajas = new Set(cajas);
  const nombre = (e) => e.tagName.toLowerCase() + [...e.classList].slice(0, 2).map((c) => '.' + c).join('');
  const corto = (t) => t.trim().replace(/\\s+/g, ' ').slice(0, 24);
  const interior = (a) => {
    const r = a.getBoundingClientRect(), s = getComputedStyle(a);
    return { l: r.left + parseFloat(s.borderLeftWidth), t: r.top + parseFloat(s.borderTopWidth), r: r.right - parseFloat(s.borderRightWidth), b: r.bottom - parseFloat(s.borderBottomWidth) };
  };
  const rectTexto = (t) => { const g = document.createRange(); g.selectNodeContents(t); return g.getBoundingClientRect(); };
  const sale = (r, i, tol) => r.width > 0 && (r.left < i.l - tol || r.top < i.t - tol || r.right > i.r + tol || r.bottom > i.b + tol);
  const culpable = (c) => {
    const i = interior(c);
    const w = document.createTreeWalker(c, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const e = n.nodeType === 1 ? n : n.parentElement;
      if (e.closest(EXENTO)) continue;
      if (n.nodeType === 3) { if (n.textContent.trim() && sale(rectTexto(n), i, 1)) return true; }
      else if (!n.closest('svg') || n.tagName === 'svg') { if (sale(n.getBoundingClientRect(), i, 1)) return true; }
    }
    return false;
  };
  const avisos = new Set();
  for (const c of cajas) {
    if (c.closest(EXENTO) || !c.getClientRects().length) continue;
    if ((c.scrollWidth > c.clientWidth + 1 || c.scrollHeight > c.clientHeight + 1) && culpable(c))
      avisos.add('desborda: ' + nombre(c) + ' "' + corto(c.textContent) + '"');
  }
  const w = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    const p = t.parentElement;
    if (!t.textContent.trim() || p.closest(EXENTO) || p.closest('svg')) continue;
    let a = p;
    while (a && a !== slide && !enCajas.has(a)) a = a.parentElement;
    if (!a || a === slide) continue;
    if (sale(rectTexto(t), interior(a), 2)) avisos.add('desborda: "' + corto(t.textContent) + '" en ' + nombre(a));
  }
  return [...avisos];
})()`;

const total = await evaluar('slides.length');
let problemas = 0;
for (let n = 1; n <= total; n++) {
  await evaluar(`show(${n - 1})`);
  await sleep(700);
  const avisos = [...await evaluar(sonda), ...await evaluar(sondaDesborde)];
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
