/**
 * Estados visibles de cada interacción con el Host (conectar, guardar récord, username).
 * Máquina pura: hub.ts la alimenta y las pantallas solo la dibujan (components/Progreso.ts).
 *
 * Qué estado sale de dónde (@parity/product-sdk 0.27.0 → product-sdk-contracts → product-sdk-tx 0.4.7,
 * `submitAndWatch`, que recibe el `onStatus` que pasamos a `.tx()`):
 *  - REAL, de nuestro código: `simulando` (nuestro `.query()`), `actualizando` (nuestra relectura),
 *    `conectando` (sesión de firma + cuenta del Product) y `permiso-gas` (SmartContractAllowance).
 *  - REAL, del SDK: `enviando` ← onStatus('signing'), que el SDK emite en el evento `signed` de PAPI, es
 *    decir DESPUÉS de que aprobaste en el teléfono; `confirmando` ← onStatus('broadcasting') y
 *    onStatus('in-block').
 *  - INFERIDO (pero cierto): `firma`. El SDK no avisa cuando el Host muestra la solicitud de firma. Se pone
 *    justo antes de llamar a `.tx()`; el tiempo entre esa llamada y el evento `signed` es el que esperamos
 *    tu firma (más una simulación corta que hace el SDK para calcular el peso).
 *  Nunca se marca `enviando` ni `confirmando` sin el evento del SDK.
 */
import type { TxErrorKind } from '../lib/txErrors';

export type ProgressOp = 'conectar' | 'guardar' | 'username';

export type ProgressStep =
  | 'conectando'
  | 'permiso-gas'
  | 'simulando'
  | 'firma'
  | 'enviando'
  | 'confirmando'
  | 'actualizando'
  | 'listo'
  | 'error';

export interface Progress {
  op: ProgressOp;
  step: ProgressStep;
  /** Pasos alcanzados, en orden y sin repetir. */
  reached: ProgressStep[];
  message: string;
  kind?: TxErrorKind;
}

export const PROGRESS_TEXT: Record<ProgressStep, string> = {
  conectando: 'Conectando tu cuenta…',
  'permiso-gas': 'Esperando el permiso de gas en tu teléfono…',
  simulando: 'Simulando…',
  firma: 'Esperando tu firma en el teléfono…',
  enviando: 'Enviando a la blockchain…',
  confirmando: 'Confirmando en la blockchain…',
  actualizando: 'Actualizando ranking…',
  listo: 'Listo',
  error: 'No se pudo completar',
};

/** Nombre corto de cada paso en la lista. */
export const STEP_LABEL: Record<ProgressStep, string> = {
  conectando: 'Conectar cuenta',
  'permiso-gas': 'Permiso de gas',
  simulando: 'Simular',
  firma: 'Firmar en el teléfono',
  enviando: 'Enviar',
  confirmando: 'Confirmar en la blockchain',
  actualizando: 'Actualizar ranking',
  listo: 'Listo',
  error: 'Error',
};

/** Los pasos que se muestran en orden para cada operación. */
export const STEPS: Record<ProgressOp, ProgressStep[]> = {
  conectar: ['conectando', 'permiso-gas'],
  guardar: ['simulando', 'firma', 'enviando', 'confirmando', 'actualizando'],
  username: ['simulando', 'firma', 'enviando', 'confirmando', 'actualizando'],
};

/** Título corto por tipo de error (lib/txErrors). */
export const KIND_TITLE: Record<TxErrorKind, string> = {
  rejected: 'Firma rechazada o cancelada',
  timeout: 'Sin respuesta a tiempo',
  'no-gas': 'Sin gas',
  'host-payment': 'Problema de conexión',
  session: 'Problema de conexión',
  connection: 'Problema de conexión',
  other: 'No se pudo completar',
};

/** Pasos que pueden repetirse en una recuperación automática (otra firma, reconectar, pedir gas). */
const RESTART: readonly ProgressStep[] = ['firma', 'conectando', 'permiso-gas'];
const TERMINAL: readonly ProgressStep[] = ['listo', 'error'];

export function begin(op: ProgressOp): Progress {
  const step = STEPS[op][0]!;
  return { op, step, reached: [step], message: PROGRESS_TEXT[step] };
}

/** Avanza solo hacia adelante dentro del orden de la operación. Un paso hacia atrás se ignora. */
export function advance(p: Progress, step: ProgressStep): Progress {
  if (TERMINAL.includes(p.step)) return p;
  if (step === p.step) return p;
  const order = STEPS[p.op];
  const to = order.indexOf(step);
  const from = order.indexOf(p.step);
  const allowed = TERMINAL.includes(step) || RESTART.includes(step) || from === -1 || to === -1 || to >= from;
  if (!allowed) return p;
  // Al reiniciar (otra firma), lo que venía después de ese paso vuelve a estar pendiente.
  const kept = to === -1 ? p.reached : p.reached.filter((s) => order.indexOf(s) === -1 || order.indexOf(s) < to);
  const reached = kept.includes(step) || TERMINAL.includes(step) ? kept : [...kept, step];
  return { ...p, step, reached, message: PROGRESS_TEXT[step] };
}

export function finish(p: Progress, result: { ok: true; message: string } | { ok: false; message: string; kind?: TxErrorKind }): Progress {
  if (result.ok) return { op: p.op, step: 'listo', reached: p.reached, message: result.message };
  const done: Progress = { op: p.op, step: 'error', reached: p.reached, message: result.message };
  if (result.kind) done.kind = result.kind;
  return done;
}

/** Estado del SDK (`onStatus`) → paso visible. Lo que no sabemos mostrar con verdad da null. */
export function stepForSdkStatus(status: unknown): ProgressStep | null {
  if (status === 'signing') return 'enviando';
  if (status === 'broadcasting' || status === 'in-block') return 'confirmando';
  return null;
}

export type StepStatus = 'hecho' | 'actual' | 'pendiente' | 'fallo';

export interface ProgressView {
  steps: Array<{ step: ProgressStep; label: string; status: StepStatus }>;
  line: string;
  tone: 'curso' | 'listo' | 'error';
}

/** Lo que dibuja components/Progreso.ts. null = no se muestra. */
export function progressView(p: Progress | null, ops: readonly ProgressOp[]): ProgressView | null {
  if (!p || !ops.includes(p.op)) return null;
  const order = STEPS[p.op];
  const done = p.step === 'listo' || p.step === 'error';
  // Un paso de recuperación fuera del orden (pedir gas o reconectar al guardar) cuenta dentro de «firma».
  const current: ProgressStep | null = done ? null : order.includes(p.step) ? p.step : 'firma';
  const lastReached = [...p.reached].reverse().find((s) => order.includes(s));
  const steps = order.map((step) => {
    let status: StepStatus = 'pendiente';
    if (step === current) status = 'actual';
    else if (p.step === 'error' && step === lastReached) status = 'fallo';
    else if (p.reached.includes(step)) status = 'hecho';
    return { step, label: STEP_LABEL[step], status };
  });
  let line = p.message;
  if (p.step === 'error' && p.kind) line = `${KIND_TITLE[p.kind]}. ${p.message}`;
  return { steps, line, tone: p.step === 'listo' ? 'listo' : p.step === 'error' ? 'error' : 'curso' };
}
