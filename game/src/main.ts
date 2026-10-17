// Fuentes empaquetadas por Vite (subconjunto latino: incluye acentos y ñ). Nada viene de internet.
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/space-mono/latin-400.css';
import '@fontsource/space-mono/latin-700.css';
import './styles.css';
import { startApp } from './app';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Falta <div id="app"> en index.html.');
startApp(root);
