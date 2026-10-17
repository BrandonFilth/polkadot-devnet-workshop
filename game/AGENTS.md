# AGENTS.md

## Proyecto
Polka-Man: juego de laberinto (Vite + TypeScript + Canvas 2D, sin framework de UI) que corre en el
navegador y dentro de Polkadot Desktop o la Polkadot App. Guarda récords en el contrato
`Leaderboard` compartido del hackatón.

## Red
- Solo Products Devnet: Asset Hub 1000, chainId 420420417.
- Descriptor: devnet_asset_hub, desde @parity/product-sdk-descriptors/devnet-asset-hub.
- Nunca paseo, paseo_asset_hub, Paseo Next v2 ni "Paseo PassetHub (420420422)".
- El único origen de red de la app es `ETH_RPC_URL` de `src/contract/config.ts`. Nada de CDNs,
  fuentes, `<link>`, `@import` ni `url()` hacia `http(s)://`.

## Versiones
- Exactas, sin ^ ni ~. No actualizar ninguna sin que yo lo pida.
- @parity/product-sdk 0.27.0
- @parity/product-sdk-descriptors 0.11.0
- Override @parity/truapi 0.13.1 en pnpm-workspace.yaml
- pnpm 12.6.0 en devEngines

## Gestor de paquetes
- Solo pnpm. Nunca npm ni yarn.
- No toques `package.json`, `game/package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` ni
  `contrato/`. Todas las dependencias ya están instaladas.

## Reglas del juego
- `src/engine/` es lógica pura: sin DOM, sin `window`, sin `document`, sin tiempo real. Todo avanza
  con `dt` (segundos simulados) y se prueba con Vitest.
- Todos los números del juego viven en `src/engine/rules.ts`, con los nombres que pida el prompt.
- El laberinto (`MAZE` en `src/engine/maze.ts`) solo cambia si yo lo pido.
- La dirección del contrato vive solo en `src/contract/config.ts`.
- No modifiques `src/contract/`, `src/hub/` ni `src/lib/` salvo que el prompt lo pida. Ya están
  completos y probados; úsalos por su API.

## SDK
- Toda la conexión con el Host ya está en `src/hub/hub.ts` (`createHub()`).
- Antes de cada `.tx()` se simula con `.query()`. Una firma a la vez. Ninguna pantalla llama `.tx()`.

## Vite
- base: './' en vite.config.js.

## Secretos
- Nunca pedir, leer, escribir ni mostrar frases de recuperación, llaves privadas o archivos .env.

## Forma de trabajo
- Pasos chicos: un cambio por vez.
- Cada cambio con su test. No borrar, saltar ni desactivar tests.
- Al terminar, decir qué archivos cambiaste y cómo probarlo.

## Comandos (desde la raíz del repo)
- pnpm dev
- pnpm test
- pnpm build
