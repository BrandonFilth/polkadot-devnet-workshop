/**
 * Un solo lugar que convierte una transacción fallida en: qué pasó (en español), por qué y qué
 * debe hacer la app. Todas las escrituras pasan por aquí, así que un fallo nuevo se atiende una vez.
 */

export type TxErrorKind =
  /** El usuario canceló o rechazó la firma en el teléfono. */
  | 'rejected'
  /** Invalid.Payment y a la cuenta de verdad le falta PGAS. */
  | 'no-gas'
  /** Invalid.Payment aunque la cuenta tiene PGAS: la red cobró la comisión en PAS (firma en el pipeline 0). */
  | 'host-payment'
  /** El Host o el SDK no aceptan el pipeline pedido (TX_EXT_VERSION). hub.ts reintenta con el 0. */
  | 'pipeline'
  /** Stale / Future / nonce o vigencia desfasados: la sesión de firma se desfasó. */
  | 'session'
  /** Sin respuesta a tiempo (la tx pudo haber entrado). */
  | 'timeout'
  /** Se cayó la conexión con el Host o la cadena. */
  | 'connection'
  /** Cualquier otra cosa. */
  | 'other';

/** Lo que ofrece la ventana de error. */
export type TxAction = 'retry' | 'reconnect' | 'gas' | 'reload';

export interface TxProblem {
  kind: TxErrorKind;
  message: string;
  /** En orden de preferencia; el primero es el botón principal. */
  actions: TxAction[];
  /** Texto crudo del error, para «Copiar detalles». */
  raw: string;
}

const text = (error: unknown): string => {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)) ?? String(error);
  } catch {
    return String(error);
  }
};

const MAX_DETAIL = 6_000;

const serialise = (value: unknown): string => {
  try {
    return (
      JSON.stringify(value, (_k, v) => {
        if (typeof v === 'bigint') return v.toString();
        if (v instanceof Uint8Array) return `0x${Array.from(v, (b) => b.toString(16).padStart(2, '0')).join('')}`;
        return v;
      }) ?? String(value)
    );
  } catch {
    return String(value);
  }
};

/**
 * Todo lo que trae el error, para diagnosticar: nombre, mensaje, campos propios (los errores del
 * SDK y de polkadot-api guardan ahí el tipo, p. ej. `{ type: 'Invalid', value: { type: 'Payment' } }`)
 * y la cadena de `cause`. Solo para «Copiar detalles»; la clasificación usa el texto corto.
 */
export function errorDetail(error: unknown, depth = 0): string {
  let out: string;
  if (error instanceof Error) {
    out = `${error.name}: ${error.message}`;
    const own: Record<string, unknown> = {};
    for (const key of Object.keys(error)) if (key !== 'stack' && key !== 'cause') own[key] = (error as unknown as Record<string, unknown>)[key];
    if (Object.keys(own).length) out += `\ncampos: ${serialise(own)}`;
    const cause = (error as { cause?: unknown }).cause;
    if (cause !== undefined && depth < 3) out += `\ncausa: ${errorDetail(cause, depth + 1)}`;
  } else {
    out = typeof error === 'string' ? error : serialise(error);
  }
  return out.length > MAX_DETAIL ? `${out.slice(0, MAX_DETAIL)}…` : out;
}

const PIPELINE = /transaction-extension pipeline|extension ?version|txExtVersion|Unsupported(Extrinsic|Transaction|Extension)Version/i;
const STORAGE_DEPOSIT = /StorageDepositNotEnoughFunds|StorageDepositLimitExhausted/;
const PAYMENT = /Invalid\.?\s*Payment/i;
const SESSION = /Invalid\.?\s*(Stale|Future|AncientBirthBlock|BadProof|BadSigner)|\bnonce\b|outdated/i;
const REJECTED = /reject|denied|cancel|declin|user (refused|closed)|SigningRejected/i;
const TIMEOUT = /sin respuesta en|timed? ?out|TxTimeout/i;
const CONNECTION = /disconnect|not connected|websocket|socket|network|Host provider|connection (closed|lost)|ECONN|fetch failed/i;

/**
 * @param pgas Saldo PGAS en unidades base leído justo ahora (null = desconocido).
 * @param low  Saldo debajo del cual un fallo de pago significa «sin PGAS».
 */
export function classifyTxError(error: unknown, pgas: bigint | null, low: bigint, formatPgas: (v: bigint) => string): TxProblem {
  const raw = text(error);
  // El nombre del error de Revive puede venir solo en los campos del error del SDK.
  const full = errorDetail(error);
  if (PIPELINE.test(full)) {
    return { kind: 'pipeline', message: 'La Polkadot App no aceptó el formato nuevo de firma.', actions: ['retry'], raw };
  }
  if (STORAGE_DEPOSIT.test(full)) {
    return {
      // Con el pipeline 1 el depósito de almacenamiento sale de PGAS: sin PGAS no alcanza.
      kind: 'no-gas',
      message: 'Tu cuenta no tiene gas (PGAS) para guardar datos nuevos. Pide gas y reintenta.',
      actions: ['gas', 'retry'],
      raw,
    };
  }
  if (PAYMENT.test(raw)) {
    if (pgas !== null && pgas >= low) {
      return {
        kind: 'host-payment',
        message: `Tienes ${formatPgas(pgas)} PGAS, pero la red cobró la comisión en PAS y tu cuenta no tiene suficiente. Manda unos 0.05 PAS a tu cuenta y reintenta.`,
        actions: ['reconnect', 'reload'],
        raw,
      };
    }
    return {
      kind: 'no-gas',
      message: pgas === null
        ? 'La red rechazó el pago de la comisión. Pide gas (PGAS) y reintenta.'
        : `Te quedan ${formatPgas(pgas)} PGAS: no alcanza para la comisión. Pide más gas y reintenta.`,
      actions: ['gas', 'reconnect'],
      raw,
    };
  }
  if (SESSION.test(raw)) {
    return { kind: 'session', message: 'La sesión de firma se desfasó de la red. Reconecta y reintenta.', actions: ['reconnect', 'reload'], raw };
  }
  if (REJECTED.test(raw)) {
    return { kind: 'rejected', message: 'No se aprobó la firma en la Polkadot App. Puedes intentarlo otra vez.', actions: ['retry'], raw };
  }
  if (TIMEOUT.test(raw)) {
    return {
      kind: 'timeout',
      message: 'La Polkadot App no respondió a tiempo. Revisa tu teléfono; si no ves la solicitud, reconecta y reintenta.',
      actions: ['retry', 'reconnect'],
      raw,
    };
  }
  if (CONNECTION.test(raw)) {
    return { kind: 'connection', message: 'Se perdió la conexión con la Polkadot App. Reconecta y reintenta.', actions: ['reconnect', 'reload'], raw };
  }
  return { kind: 'other', message: raw.replace(/^Error:\s*/, ''), actions: ['retry', 'reconnect'], raw };
}

/** Estos se pueden resolver reconectando una vez en automático, antes de mostrar el error. */
export const autoReconnect = (kind: TxErrorKind) => kind === 'host-payment' || kind === 'session' || kind === 'connection';
