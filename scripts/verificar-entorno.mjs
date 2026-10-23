#!/usr/bin/env node
// Revisa que tu computadora tenga todo lo del capítulo 2. No instala ni cambia nada.
//   node scripts/verificar-entorno.mjs              revisión rápida
//   node scripts/verificar-entorno.mjs --completo   también descarga y prueba pad y dotns (tarda ~1-2 min la primera vez)
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const completo = process.argv.includes('--completo');
const windows = process.platform === 'win32';
const PAD = '@polkadot-community-foundation/polkadot-app-deploy@0.22.1';
const DOTNS = '@polkadot-community-foundation/dotns-cli@1.0.0';

const color = process.stdout.isTTY ? { ok: '\x1b[32m', mal: '\x1b[31m', ojo: '\x1b[33m', fin: '\x1b[0m' } : { ok: '', mal: '', ojo: '', fin: '' };
const resultados = [];

function correr(comando, timeoutMs = 20_000) {
  const r = spawnSync(comando, { shell: true, encoding: 'utf8', timeout: timeoutMs, windowsHide: true });
  return { ok: r.status === 0, salida: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

function anotar(estado, nombre, detalle, arreglo) {
  resultados.push({ estado, nombre, detalle, arreglo });
}

function version(texto) {
  const m = texto.match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? m.slice(1).map(Number) : null;
}

function alMenos(v, minimo) {
  for (let i = 0; i < 3; i++) {
    if (v[i] !== minimo[i]) return v[i] > minimo[i];
  }
  return true;
}

// Cómo instalar pnpm en cada sistema (el devEngines del proyecto baja después la 12.6.0).
function instalarPnpm() {
  if (windows) return 'Instala pnpm con: winget install -e --id pnpm.pnpm';
  if (process.platform === 'darwin') return 'Instala pnpm con: brew install pnpm';
  return 'Instala pnpm con: curl -fsSL https://get.pnpm.io/install.sh | sh -';
}

// Busca la app de Polkadot Desktop en macOS. Según la versión se llama "Polkadot Desktop.app" o
// "Polkadot Desktop Dev.app", así que acepta cualquier "Polkadot Desktop*.app".
function desktopEnMac() {
  for (const carpeta of ['/Applications', join(process.env.HOME ?? '', 'Applications')]) {
    try {
      if (readdirSync(carpeta).some((n) => n.startsWith('Polkadot Desktop') && n.endsWith('.app'))) return true;
    } catch {
      // La carpeta no existe o no se puede leer: sigue con la otra.
    }
  }
  return false;
}

// Node
{
  const v = version(process.version);
  if (v && alMenos(v, [22, 19, 0])) anotar('ok', 'Node.js', process.version);
  else anotar('mal', 'Node.js', process.version, 'Instala Node 24 LTS (mínimo 22.19). Ver "Paso 4" del capítulo 2.');
}

// pnpm
{
  const r = correr('pnpm --version');
  const v = r.ok ? version(r.salida) : null;
  if (!v) anotar('mal', 'pnpm', 'no se encontró', `${instalarPnpm()} y abre una terminal nueva. Ver "Paso 4".`);
  else if (v[0] < 12) anotar('mal', 'pnpm', r.salida, 'Tu pnpm es viejo: instala pnpm 12.6.0 y quita el anterior del PATH.');
  else anotar('ok', 'pnpm', r.salida);
}

// Git
{
  const r = correr('git --version');
  if (!r.ok) anotar('mal', 'Git', 'no se encontró', 'Instala Git. Ver "Paso 4".');
  else {
    anotar('ok', 'Git', r.salida.replace('git version ', ''));
    const nombre = correr('git config --global user.name').salida;
    const correo = correr('git config --global user.email').salida;
    if (nombre && correo) anotar('ok', 'Git: tu nombre y correo', nombre);
    else anotar('mal', 'Git: tu nombre y correo', 'sin configurar', 'Corre git config --global user.name "Tu Nombre" y git config --global user.email "tu@correo.com".');
    if (windows) {
      const largas = correr('git config --global core.longpaths').salida;
      if (largas === 'true') anotar('ok', 'Git: rutas largas', 'activadas');
      else anotar('ojo', 'Git: rutas largas', 'desactivadas', 'Corre git config --global core.longpaths true');
    }
  }
}

// GitHub CLI: instalado y con sesión
{
  const r = correr('gh --version');
  if (!r.ok) anotar('mal', 'GitHub CLI', 'no se encontró', 'Instálalo. Ver "Paso 4" del capítulo 2.');
  else {
    anotar('ok', 'GitHub CLI', version(r.salida)?.join('.') ?? 'instalado');
    const sesion = correr('gh auth status', 30_000);
    const usuario = sesion.salida.match(/account\s+(\S+)/)?.[1];
    if (sesion.ok && usuario) anotar('ok', 'GitHub: tu sesión', usuario);
    else anotar('mal', 'GitHub: tu sesión', 'sin iniciar', 'Corre gh auth login. Ver "Paso 5" del capítulo 2.');
  }
}

// Windows: política de scripts y carpeta de trabajo
if (windows) {
  const r = correr('powershell -NoProfile -Command "Get-ExecutionPolicy"');
  const politica = r.salida.split(/\r?\n/).pop();
  if (/Restricted|AllSigned/i.test(politica)) {
    anotar('mal', 'PowerShell: política de scripts', politica, 'Corre en PowerShell: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned');
  } else {
    anotar('ok', 'PowerShell: política de scripts', politica);
  }
}
{
  const aqui = process.cwd();
  if (/\s/.test(aqui)) anotar('ojo', 'Carpeta de trabajo', aqui, 'La ruta tiene espacios. Trabaja en una ruta corta y sin espacios, como C:\\dev\\mi-app o ~/dev/mi-app.');
  else anotar('ok', 'Carpeta de trabajo', aqui);
}

// Polkadot Desktop
{
  const mac = process.platform === 'darwin';
  const encontrado = windows ? existsSync(join(process.env.LOCALAPPDATA ?? '', 'Programs', 'polkadot-desktop')) : mac && desktopEnMac();
  if (encontrado) anotar('ok', 'Polkadot Desktop', 'instalado');
  else if (windows || mac) anotar('mal', 'Polkadot Desktop', 'no se encontró', 'Instálalo desde el "Paso 3" del capítulo 2.');
  // En Linux es un AppImage: puede estar en cualquier carpeta, así que no se puede detectar.
  else anotar('ojo', 'Polkadot Desktop', 'revísalo a mano', 'Abre el AppImage y confirma que ya está emparejado con tu teléfono.');
}

// Product SDK: es una dependencia del juego (game/), no algo instalado en la computadora.
// Con pnpm la dependencia queda en el paquete (game/node_modules), no en la raíz.
{
  const SDK_ESPERADO = '0.39.0';
  const sdk = [join(process.cwd(), 'game', 'node_modules'), join(process.cwd(), 'node_modules')]
    .map((carpeta) => join(carpeta, '@parity', 'product-sdk', 'package.json'))
    .find((ruta) => existsSync(ruta));
  if (!existsSync(join(process.cwd(), 'package.json'))) {
    anotar('ojo', 'Product SDK', 'todavía no hay proyecto', 'Entra a la carpeta del tutorial (cd polkadot-devnet-workshop) y corre pnpm install. La plantilla del juego es del capítulo 5.');
  } else if (!sdk) {
    anotar('mal', 'Product SDK', 'sin instalar', 'Corre pnpm install en la raíz del repo.');
  } else {
    let instalada = null;
    try {
      instalada = JSON.parse(readFileSync(sdk, 'utf8')).version ?? null;
    } catch {
      instalada = null;
    }
    if (instalada === SDK_ESPERADO) anotar('ok', 'Product SDK', instalada);
    else anotar('mal', 'Product SDK', instalada ?? 'versión desconocida', `Se esperaba ${SDK_ESPERADO}: no cambies las versiones del proyecto (capítulo 4, sección 10).`);
  }
}

// Versiones que tienen que coincidir con los Hosts. Solo se revisan con el proyecto instalado.
const raiz = process.cwd();
if (existsSync(join(raiz, 'package.json')) && existsSync(join(raiz, 'node_modules'))) {
  // Descriptores del devnet: el alias apunta al paquete de Polkadot Community Foundation.
  {
    const ruta = join(raiz, 'game', 'node_modules', '@parity', 'product-sdk-descriptors', 'package.json');
    let paquete = null;
    try {
      paquete = JSON.parse(readFileSync(ruta, 'utf8'));
    } catch {
      paquete = null;
    }
    if (paquete?.name === '@polkadot-community-foundation/product-sdk-descriptors' && paquete.version === '0.14.0-pcf.1') {
      anotar('ok', 'Descriptores del devnet', `${paquete.name}@${paquete.version}`);
    } else {
      anotar('mal', 'Descriptores del devnet', paquete ? `${paquete.name}@${paquete.version}` : 'sin instalar', 'Corre pnpm install en la raíz del repo.');
    }
  }

  // Una sola versión de @parity/truapi y de polkadot-api en todo el árbol.
  let carpetas = [];
  try {
    carpetas = readdirSync(join(raiz, 'node_modules', '.pnpm'));
  } catch {
    carpetas = [];
  }
  const versiones = (prefijo) => [...new Set(carpetas.filter((n) => n.startsWith(prefijo)).map((n) => n.slice(prefijo.length).split('_')[0]))].sort();
  for (const [nombre, prefijo, esperada, arreglo] of [
    ['@parity/truapi', '@parity+truapi@', '0.25.0', 'Debe ser solo 0.25.0, la versión de TrUAPI de los Hosts. No cambies pnpm-workspace.yaml y corre pnpm install.'],
    ['polkadot-api', 'polkadot-api@', '3.2.1', 'Debe ser solo 3.2.1. No cambies pnpm-workspace.yaml y corre pnpm install.'],
  ]) {
    const encontradas = versiones(prefijo);
    if (encontradas.length === 1 && encontradas[0] === esperada) anotar('ok', nombre, esperada);
    else anotar('mal', nombre, encontradas.length ? encontradas.join(', ') : 'sin instalar', arreglo);
  }
}

// pnpm-workspace.yaml: overrides acotados (padre@versión>hijo) y la excepción de los descriptores.
{
  const ruta = join(raiz, 'pnpm-workspace.yaml');
  if (existsSync(join(raiz, 'package.json')) && existsSync(ruta)) {
    const lineas = readFileSync(ruta, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
    const bloque = (nombre) => {
      const inicio = lineas.findIndex((l) => l.trimEnd() === `${nombre}:`);
      if (inicio < 0) return [];
      const fin = lineas.findIndex((l, i) => i > inicio && l.trim() !== '' && !/^\s/.test(l) && !l.startsWith('#'));
      return lineas.slice(inicio + 1, fin < 0 ? undefined : fin).filter((l) => /^\s/.test(l) && !l.trim().startsWith('#'));
    };

    const overrides = bloque('overrides').map((l) => {
      const m = l.trim().match(/^(['"]?)(.+?)\1\s*:\s*(.*)$/);
      return m ? { clave: m[2], valor: m[3].trim().replace(/^['"]|['"]$/g, '') } : null;
    }).filter(Boolean);
    const globales = overrides.filter((o) => ['@parity/truapi', 'polkadot-api', '@parity/product-sdk-descriptors'].includes(o.clave));
    for (const o of globales) {
      anotar('mal', 'pnpm-workspace.yaml', `override global de ${o.clave}`, 'Usa solo overrides acotados (padre@versión>hijo): los globales rompen pnpm dlx de pad dentro del repo.');
    }
    const truapi = overrides.some((o) => o.clave.endsWith('>@parity/truapi') && o.valor === '0.25.0');
    if (!globales.length && truapi) anotar('ok', 'pnpm-workspace.yaml', 'overrides acotados');
    else if (!globales.length) anotar('mal', 'pnpm-workspace.yaml', 'sin override de @parity/truapi 0.25.0', 'Copia el bloque overrides de la skill (references/versiones.md).');

    const excluidos = bloque('minimumReleaseAgeExclude').map((l) => l.trim().replace(/^-\s*/, '').replace(/^['"]|['"]$/g, ''));
    if (excluidos.includes('@polkadot-community-foundation/product-sdk-descriptors@0.14.0-pcf.1')) {
      anotar('ok', 'minimumReleaseAgeExclude', 'descriptores del devnet');
    } else {
      anotar('mal', 'minimumReleaseAgeExclude', 'sin los descriptores del devnet', 'Sin esto pnpm install se bloquea con los descriptores del devnet.');
    }
  }
}

// pad y dotns (lento la primera vez: pnpm los descarga)
if (completo) {
  for (const [nombre, paquete] of [['pad', PAD], ['dotns', DOTNS]]) {
    process.stdout.write(`Probando ${nombre}… `);
    const r = correr(`pnpm dlx --ignore-scripts ${paquete} --version`, 300_000);
    process.stdout.write('listo\n');
    const v = version(r.salida);
    if (r.ok && v) anotar('ok', nombre, v.join('.'));
    else anotar('mal', nombre, 'no arrancó', `Revisa tu conexión y vuelve a correr: pnpm dlx --ignore-scripts ${paquete} --version`);
  }
} else {
  anotar('ojo', 'pad y dotns', 'sin revisar', 'Corre este script con --completo para descargarlos y probarlos.');
}

// Lo que no se puede revisar desde aquí
anotar('ojo', 'A mano', 'Polkadot App en el teléfono, Kiro y MetaMask', 'Revisa la lista del final del capítulo 2.');

// Reporte
const icono = { ok: `${color.ok}✔${color.fin}`, mal: `${color.mal}✘${color.fin}`, ojo: `${color.ojo}!${color.fin}` };
console.log('\nTu entorno\n');
for (const r of resultados) {
  console.log(`${icono[r.estado]} ${r.nombre.padEnd(32)} ${r.detalle}`);
  if (r.arreglo && r.estado !== 'ok') console.log(`  → ${r.arreglo}`);
}
const fallas = resultados.filter((r) => r.estado === 'mal').length;
console.log(fallas ? `\n${fallas} cosa(s) por arreglar.` : '\nTodo lo que se puede revisar desde aquí está listo.');
process.exit(fallas ? 1 : 0);
