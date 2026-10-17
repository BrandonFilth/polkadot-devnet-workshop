#!/usr/bin/env node
// Revisa que tu computadora tenga todo lo del capítulo 2. No instala ni cambia nada.
//   node scripts/verificar-entorno.mjs              revisión rápida
//   node scripts/verificar-entorno.mjs --completo   también descarga y prueba pad y dotns (tarda ~1-2 min la primera vez)
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const completo = process.argv.includes('--completo');
const windows = process.platform === 'win32';
const PAD = '@polkadot-community-foundation/polkadot-app-deploy@0.16.7';
const DOTNS = '@polkadot-community-foundation/dotns-cli@0.9.5';

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
  if (!v) anotar('mal', 'pnpm', 'no se encontró', 'Instala pnpm 12.6.0 y abre una terminal nueva. Ver "Paso 4".');
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
  const candidatos = windows
    ? [join(process.env.LOCALAPPDATA ?? '', 'Programs', 'polkadot-desktop')]
    : process.platform === 'darwin'
      ? ['/Applications/Polkadot Desktop.app', join(process.env.HOME ?? '', 'Applications/Polkadot Desktop.app')]
      : [];
  if (candidatos.some((p) => existsSync(p))) anotar('ok', 'Polkadot Desktop', 'instalado');
  else if (candidatos.length) anotar('mal', 'Polkadot Desktop', 'no se encontró', 'Instálalo desde el "Paso 3" del capítulo 2.');
  // En Linux es un AppImage: puede estar en cualquier carpeta, así que no se puede detectar.
  else anotar('ojo', 'Polkadot Desktop', 'revísalo a mano', 'Abre el AppImage y confirma que ya está emparejado con tu teléfono.');
}

// Product SDK: es una dependencia del juego (game/), no algo instalado en la computadora.
// Con pnpm la dependencia queda en el paquete (game/node_modules), no en la raíz.
{
  const SDK_ESPERADO = '0.27.0';
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
    else anotar('mal', 'Product SDK', instalada ?? 'versión desconocida', `Se esperaba ${SDK_ESPERADO}: no actualices el SDK (capítulo 4, sección 15).`);
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
