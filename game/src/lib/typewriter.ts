/**
 * Texto que aparece letra por letra, como un diálogo de RPG. El texto completo va siempre en un <span>
 * solo para lectores de pantalla; la animación es visual (aria-hidden), así que no se anuncian pedazos.
 * Con «reducir movimiento» (o sin requestAnimationFrame, en los tests) el texto sale completo de una vez.
 */

/** Cuántos caracteres se ven a los `ms` milisegundos, a `cps` caracteres por segundo. */
export function typedLength(total: number, ms: number, cps = TYPE_CPS): number {
  if (ms <= 0) return 0;
  return Math.min(total, Math.floor((ms / 1000) * cps));
}

/** Velocidad: rápida, para no hacer esperar. */
export const TYPE_CPS = 60;

const reduced = () =>
  typeof window === 'undefined' || typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const running = new WeakMap<HTMLElement, number>();

/** Escribe `text` en `el` letra por letra. Llamarlo otra vez con otro texto reinicia la animación. */
export function typeInto(el: HTMLElement, text: string): void {
  const prev = running.get(el);
  if (prev !== undefined) cancelAnimationFrame(prev);
  running.delete(el);
  if (el.dataset.typed === text) return;
  el.dataset.typed = text;

  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = text;
  const visible = document.createElement('span');
  visible.setAttribute('aria-hidden', 'true');
  visible.className = 'typed';
  el.replaceChildren(sr, visible);

  if (text === '' || reduced() || typeof requestAnimationFrame !== 'function') {
    visible.textContent = text;
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    const n = typedLength(text.length, now - start);
    visible.textContent = text.slice(0, n);
    if (n < text.length) running.set(el, requestAnimationFrame(step));
    else running.delete(el);
  };
  running.set(el, requestAnimationFrame(step));
}
