// Pila de superficies: cuál queda arriba y cuáles quedan inertes debajo. Puro (sin DOM); app.ts lo aplica.
import type { Phase } from '../engine/types';

/**
 * De abajo hacia arriba: juego < inicio/pausa/fin < menú < username < paneles de admin < aviso «sin cuenta»
 * < confirmación de salir de la partida < popup de estados.
 */
export type Capa = 'juego' | 'inicio' | 'pausa' | 'fin' | 'menu' | 'username' | 'admin' | 'aviso' | 'confirmar' | 'tx';

export interface CapasInput {
  phase: Phase;
  menuOpen: boolean;
  usernameOpen: boolean;
  /** Panel de admin abierto (solo desde la pantalla de inicio). */
  adminOpen?: boolean;
  avisoOpen: boolean;
  /** Doble confirmación de salir de la partida abierta. */
  confirmOpen?: boolean;
  txOpen: boolean;
}

/** Pantalla base de cada fase. 'listo' y 'rondaLimpia' no tapan el tablero. */
function base(phase: Phase): Capa {
  if (phase === 'titulo') return 'inicio';
  if (phase === 'pausa') return 'pausa';
  if (phase === 'fin') return 'fin';
  return 'juego';
}

/** Las capas abiertas, en orden; la última es la de arriba. Todas las de abajo son inertes. */
export function capas(i: CapasInput): { top: Capa; inert: Capa[]; open: Capa[] } {
  const open: Capa[] = ['juego'];
  const screen = base(i.phase);
  if (screen !== 'juego') open.push(screen);
  if (i.menuOpen) open.push('menu');
  if (i.usernameOpen) open.push('username');
  if (i.adminOpen) open.push('admin');
  if (i.avisoOpen) open.push('aviso');
  if (i.confirmOpen) open.push('confirmar');
  if (i.txOpen) open.push('tx');
  return { top: open[open.length - 1]!, inert: open.slice(0, -1), open };
}
