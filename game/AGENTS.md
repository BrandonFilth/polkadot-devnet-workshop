# AGENTS.md

## Proyecto
Polka-Man: juego de laberinto (Vite + TypeScript + Canvas 2D, sin framework de UI) que corre en el
navegador y dentro de Polkadot Desktop o la Polkadot App. Guarda récords en un contrato
`Leaderboard` propio, desplegado por el mismo proyecto.

## Red
- Solo Products Devnet: Asset Hub 1000, chainId 420420417.
- Descriptor: devnet_asset_hub, desde @parity/product-sdk-descriptors/devnet-asset-hub.
- Nunca paseo, paseo_asset_hub, Paseo Next v2 ni "Paseo PassetHub (420420422)".
- El único origen de red de la app es `ETH_RPC_URL` de `src/contract/config.ts`. Nada de CDNs,
  fuentes, `<link>`, `@import` ni `url()` hacia `http(s)://`.

## Versiones
- Exactas, sin ^ ni ~. No actualizar ninguna sin que yo lo pida.
- @parity/product-sdk 0.39.0
- polkadot-api 3.2.1
- @parity/product-sdk-descriptors como alias npm:@polkadot-community-foundation/product-sdk-descriptors@0.14.0-pcf.1
- @parity/truapi 0.25.0 con overrides acotados (padre@versión>hijo) en pnpm-workspace.yaml. Nunca overrides globales: rompen pnpm dlx de pad.
- pnpm 12.6.0 en devEngines

## Gestor de paquetes
- Solo pnpm. Nunca npm ni yarn.
- No toques `package.json`, `game/package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` ni
  `contrato/`.

## Reglas del juego
- `src/engine/` es lógica pura: sin DOM, sin `window`, sin `document`, sin tiempo real. Todo avanza
  con `dt` (segundos simulados) y se prueba con Vitest.
- Todos los números del juego viven en `src/engine/rules.ts`.
- El laberinto (`MAZE` en `src/engine/maze.ts`) solo cambia si yo lo pido.
- La dirección del contrato vive solo en `src/contract/config.ts`.
- `src/contract/`, `src/hub/` y `src/lib/` tienen sus propios tests; si cambias su API, actualiza los tests.

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
