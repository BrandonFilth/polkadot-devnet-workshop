// Teclado del celular: mientras escribes, se ocultan los controles y los modales se pegan arriba del área visible.
import { KEYBOARD_MIN_PX } from '../engine/rules';

export interface KeyboardState {
  /** Hay un campo de texto con foco: los controles se ocultan. */
  hideControls: boolean;
  /** El área visible es bastante más baja que la ventana: el teclado está abierto. */
  open: boolean;
  /** Área visible (visualViewport), en px CSS. */
  top: number;
  height: number;
}

export function keyboardState(i: { layoutHeight: number; vvHeight: number; vvTop: number; editableFocused: boolean }): KeyboardState {
  return {
    hideControls: i.editableFocused,
    open: i.layoutHeight - i.vvHeight > KEYBOARD_MIN_PX,
    top: i.vvTop,
    height: i.vvHeight,
  };
}

const isEditable = (el: Element | null) =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable);

/**
 * Pone la clase `teclado` en `root` mientras un campo tiene foco y publica el área visible en
 * `--vv-top` / `--vv-h` (styles.css). Al perder el foco todo vuelve como estaba.
 */
export function attachTeclado(root: HTMLElement): () => void {
  const vv = window.visualViewport;

  const apply = () => {
    const k = keyboardState({
      layoutHeight: window.innerHeight,
      vvHeight: vv?.height ?? window.innerHeight,
      vvTop: vv?.offsetTop ?? 0,
      editableFocused: isEditable(document.activeElement),
    });
    root.classList.toggle('teclado', k.hideControls);
    root.classList.toggle('teclado--abierto', k.hideControls && k.open);
    root.style.setProperty('--vv-top', `${Math.round(k.top)}px`);
    root.style.setProperty('--vv-h', `${Math.round(k.height)}px`);
  };

  // focusout llega antes de que el foco pase al siguiente elemento: se revisa en un microtask.
  const onFocusOut = () => queueMicrotask(apply);

  document.addEventListener('focusin', apply);
  document.addEventListener('focusout', onFocusOut);
  vv?.addEventListener('resize', apply);
  vv?.addEventListener('scroll', apply);
  window.addEventListener('resize', apply);
  apply();

  return () => {
    document.removeEventListener('focusin', apply);
    document.removeEventListener('focusout', onFocusOut);
    vv?.removeEventListener('resize', apply);
    vv?.removeEventListener('scroll', apply);
    window.removeEventListener('resize', apply);
  };
}
