// Arma el DOM y conecta motor, dibujo, controles y componentes.
// Etapa 0: HUD vacío, laberinto dibujado, zona de controles y el título de la plantilla.
import { createOverlay, showTemplateTitle } from './components/Overlay';
import { MAZE, parseMaze } from './engine/maze';
import type { Dir } from './engine/types';
import { createRenderer } from './render/draw';

const DPAD: Array<{ dir: Dir; label: string; path: string }> = [
  { dir: 'arriba', label: 'Arriba', path: 'M12 5 L20 17 L4 17 Z' },
  { dir: 'izquierda', label: 'Izquierda', path: 'M5 12 L17 4 L17 20 Z' },
  { dir: 'abajo', label: 'Abajo', path: 'M12 19 L4 7 L20 7 Z' },
  { dir: 'derecha', label: 'Derecha', path: 'M19 12 L7 20 L7 4 Z' },
];

export function startApp(root: HTMLElement): void {
  const maze = parseMaze(MAZE);

  const hud = document.createElement('header');
  hud.className = 'hud';

  const stage = document.createElement('main');
  stage.className = 'stage';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Tablero de Polka-Man');
  stage.append(canvas);

  const dpad = document.createElement('nav');
  dpad.className = 'dpad';
  dpad.setAttribute('aria-label', 'Controles');
  for (const { dir, label, path } of DPAD) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.dir = dir;
    button.setAttribute('aria-label', label);
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
    dpad.append(button);
  }

  root.replaceChildren(hud, stage, dpad);

  const overlay = createOverlay(stage);
  showTemplateTitle(overlay);

  const renderer = createRenderer(stage, canvas, maze);
  const scene = { orbs: maze.orbs, power: maze.power };
  const frame = (time: number) => {
    renderer.draw(scene, time);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
