# Fase 1 · Tu proyecto

Al terminar tienes un proyecto que arranca en el navegador con un canvas vacío, un test que pasa y
tu `AGENTS.md`. 20 a 25 minutos.

## Antes de pedir

- ¿Cómo se llama tu juego? (p. ej. "Dot-Man")
- ¿En qué orientación se juega? (p. ej. vertical en el celular)
- ¿Vas a usar fuentes o imágenes propias? (p. ej. "una fuente de pixel art"). Van dentro del
  proyecto: la app no descarga nada de internet.
- ¿Qué reglas quieres en tu `AGENTS.md`? (p. ej. "pasos chicos", "cada cambio con su test"). Incluye
  siempre esta: "Todos los números del juego en un solo archivo, con los valores de la sección
  'Reglas y números' de `SPEC.md`".

Escribe tus respuestas en `SPEC.md`.

## El prompt

```text
Lee SPEC.md (y el spec de esta parte si existe). Usa la skill polkadot-products-devnet.
Crea un proyecto Vite + TypeScript con las versiones que indica la skill.
En vite.config usa base './' y el plugin de la skill que deja solo el descriptor del devnet.
Crea el proyecto en esta misma carpeta, sin borrar ni reemplazar SPEC.md, .agents/ ni
skills-lock.json.
Crea AGENTS.md con las reglas de SPEC.md y esta: "Todos los números del juego en un solo
archivo, con los valores de la sección 'Reglas y números' de SPEC.md".
Por ahora solo un canvas vacío en la página y un test que pase.
Si te falta algún dato o hay que decidir algo que no está en SPEC.md, pregúntame antes de
escribir código.
Primero dime tu plan.
```

## Si no sabes

```text
No sé qué archivos debe tener un proyecto Vite mínimo. Dime cuáles son y para qué sirve
cada uno, en lenguaje simple. No escribas código.
```

## Al terminar, revisa

1. `git status` no muestra `SPEC.md`, `.agents/` ni `skills-lock.json` como borrados (si alguno
   aparece, recupéralo con `git restore <archivo>`). Tampoco muestra `node_modules/` ni `dist/`; si
   aparecen, pídele al agente un `.gitignore` con `node_modules` y `dist`.
2. `pnpm test` y `pnpm build` terminan sin errores.
3. `pnpm dev` muestra el canvas en el navegador.
4. `AGENTS.md` dice que los números del juego van en un solo archivo, tomados de `SPEC.md`.
5. Después del `git push`, tu repo se ve en GitHub con estos archivos.

Pídele que revise lo técnico con la skill:

```text
Lee SPEC.md (y el spec de esta parte si existe) y AGENTS.md.
Revisa con la skill polkadot-products-devnet que mi proyecto cumpla sus reglas
(versiones, gestor de paquetes, rutas del build, archivos externos).
No cambies nada; dime qué falta.
```

Y los tests:

```text
Escribe tests para estos casos: la página carga y el canvas existe.
Después dime 3 casos raros que no consideré.
```

Revisa el `git diff` antes de guardar ([capítulo 4, sección 7](../contenido/04-vibe-coding.md#7-pasos-chicos-y-commits)
y [sección 14](../contenido/04-vibe-coding.md#14-cómo-supervisar-a-la-ia)) y usa el
[prompt 1 de `revision.md`](./revision.md#1-qué-decidió-la-ia).

```bash
git add .
git commit -m "fase 1: proyecto base"
git push
```
