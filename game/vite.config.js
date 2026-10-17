import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas: el bundle se sirve desde un CID de Bulletin, no desde la raíz de un dominio.
  base: './',
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
