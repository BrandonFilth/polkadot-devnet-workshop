import { defineConfig } from 'vite';

const DESCRIPTORES = '@parity/product-sdk-descriptors/';
const STUB = '\0descriptor-sin-usar:';

// @parity/product-sdk-chain-client importa de forma dinámica los metadatos de todas las cadenas
// (presets de getChainAPI) aunque el juego solo usa devnet-asset-hub. En el build se cambian los
// demás descriptores por un módulo vacío para que no terminen en dist.
export function soloDescriptorDevnet() {
  return {
    name: 'solo-descriptor-devnet',
    apply: 'build',
    enforce: 'pre',
    resolveId(id) {
      if (!id.startsWith(DESCRIPTORES)) return null;
      const subruta = id.slice(DESCRIPTORES.length);
      return subruta === 'devnet-asset-hub' ? null : STUB + subruta;
    },
    load(id) {
      return id.startsWith(STUB) ? 'export {};' : null;
    },
  };
}

export default defineConfig({
  // Rutas relativas: el bundle se sirve desde un CID de Bulletin, no desde la raíz de un dominio.
  base: './',
  plugins: [soloDescriptorDevnet()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  test: {
    projects: [
      {
        test: {
          name: 'unidad',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.red.test.ts'],
          // styles.css llega como texto a los tests de superficies opacas y del ranking (components/ranking.test.ts).
          css: { include: [/styles\.css/] },
        },
      },
      {
        test: {
          name: 'red',
          environment: 'node',
          include: ['src/**/*.red.test.ts'],
          testTimeout: 60_000,
        },
      },
    ],
  },
});
