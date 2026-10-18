# Etapa 1 · Polka-Man se mueve

## Qué vas a tener al terminar

Abres el juego y ves la pantalla de título con el botón **JUGAR**. Al tocarlo aparece «LISTO» un
momento y después Polka-Man (un círculo rosa con boca que abre y cierra) sale hacia la izquierda
desde su casilla de inicio, abajo al centro. Lo mueves con las flechas o WASD en la PC, y con swipe
o el D-pad en el celular. Gira en los cruces, se detiene ante las paredes y cruza el túnel del
centro de un lado al otro. `P` pausa; el botón «Seguir» reanuda. Todavía no come orbes y no hay
fantasmas.

Captura descrita: en un celular de 390 px, el laberinto ocupa el ancho; Polka-Man rosa en el
pasillo de abajo, mirando a la izquierda con la boca entreabierta; debajo, el D-pad de 4 botones.

## Tiempo estimado

25 a 35 minutos (prompt, revisión del plan, pruebas y commit).

## El prompt

Copia todo el bloque y pégalo en tu agente, en modo supervisado (que te muestre el plan antes de
escribir código).

```text
Objetivo: que Polka-Man se mueva por el laberinto con teclado, swipe y D-pad, con pantalla de título,
"LISTO" y pausa. Todavía sin comer orbes y sin fantasmas.

Contexto:
- Lee primero game/AGENTS.md y respétalo.
- El juego vive en game/. Ya existen: src/engine/types.ts (Dir = 'arriba'|'izquierda'|'abajo'|
  'derecha', Vec, Maze, Phase, ActivePhase), src/engine/maze.ts (MAZE, parseMaze, tileAt,
  tileIndex, playerCanEnter), src/engine/rules.ts (MAZE_WIDTH=19, MAZE_HEIGHT=21, LIVES=5),
  src/render/draw.ts (paredes en caché y orbes), src/components/Overlay.ts, src/app.ts, src/styles.css
  (ya trae .stage, .dpad, .overlay y el D-pad visible solo con (pointer: coarse)).
- Coordenadas en casillas: el centro de la casilla (c, r) es (c, r); en pantalla se dibuja en
  ((c + 0.5) * tile, (r + 0.5) * tile). Velocidades en casillas por segundo.
- Agrega a src/engine/rules.ts exactamente estas constantes:
  DT = 1 / 120, MAX_FRAME_SECONDS = 0.25, PLAYER_SPEED = 6.0, READY_SECONDS = 1.5,
  SWIPE_THRESHOLD_PX = 24.
- Archivos nuevos:
  1. src/loop.ts: ciclo de paso fijo. export function startLoop(opts: { step(dt: number): void;
     render(timeMs: number): void; raf?: (cb: FrameRequestCallback) => number; now?: () => number }):
     () => void (devuelve stop). Acumula el tiempo real y llama step(DT) las veces que quepan; el
     delta de cada cuadro se recorta a MAX_FRAME_SECONDS (pestaña dormida). raf y now se inyectan
     para poder probarlo.
  2. src/engine/movement.ts: export function advance(entity: { pos: Vec; dir: Dir | null },
     distance: number, canEnter: (col: number, row: number) => boolean,
     onCenter: (col: number, row: number) => void, width = MAZE_WIDTH): void.
     Mueve sobre un solo eje. Al llegar a un centro (tolerancia 1e-6, se ajusta exacto) llama
     onCenter, que puede cambiar entity.dir; si la casilla siguiente en entity.dir no es transitable,
     se detiene en el centro (dir queda igual pero no avanza). Si en un paso cruza un centro: se
     ajusta exacto al centro, llama onCenter y aplica la distancia sobrante en la nueva dirección (o
     la descarta si se detiene). Nunca cruza más de un centro por paso. Túnel: si x < -0.5 suma
     width; si x >= width - 0.5 resta width.
  3. src/engine/player.ts: Polka-Man { pos, dir, nextDir, mouth (0..1) }. La dirección pedida
     (nextDir) se guarda sin caducar; en cada centro, si la casilla en nextDir es transitable
     (playerCanEnter), gira. Pedir la dirección contraria invierte al instante, aunque esté a mitad de
     casilla. Arranca en la P del laberinto (9, 15) mirando y moviéndose a la izquierda. Velocidad
     PLAYER_SPEED. mouth avanza solo mientras se mueve.
  4. src/engine/game.ts: estado mutable y serializable de la partida con fases 'titulo', 'listo',
     'jugando' y 'pausa'. API: createGame(seed: number), start(state), setDirection(state, dir),
     togglePause(state), setPaused(state, paused: boolean), update(state, dt).
     - El estado tiene phase, resumePhase: ActivePhase | null, phaseTimer (segundos restantes de
       'listo'), score, lives, round, player.
     - start(state): solo desde 'titulo' o 'fin'; pone score = 0, lives = LIVES, round = 1,
       Polka-Man en su inicio, temporizadores en cero, phase = 'listo' y phaseTimer = READY_SECONDS.
       En cualquier otra fase no hace nada.
     - En 'listo' solo baja phaseTimer; al llegar a 0 pasa a 'jugando'. En 'jugando' se mueve
       Polka-Man con advance().
     - setPaused(state, true): si phase es una ActivePhase ('listo' o 'jugando' en esta etapa) guarda
       resumePhase = phase y pone phase = 'pausa'; si ya está en 'pausa', 'titulo' o 'fin' no hace
       nada (idempotente). setPaused(state, false): si phase === 'pausa' vuelve a resumePhase y lo
       limpia; en otras fases no hace nada. togglePause: desde una ActivePhase pausa, desde 'pausa'
       reanuda, en 'titulo'/'fin' nada.
     - update en 'pausa' no cambia nada (ni posiciones ni phaseTimer). Reanudar regresa a la misma
       fase con el mismo tiempo restante.
     - setDirection fuera de 'listo'/'jugando' se ignora (también en 'pausa').
  5. src/input/swipe.ts: export function swipeDirection(dx: number, dy: number,
     threshold = SWIPE_THRESHOLD_PX): Dir | null. Usa el eje dominante; devuelve dirección si ese eje
     mide >= threshold px; si no, null. dy positivo es 'abajo'.
  6. src/input/controls.ts: flechas y WASD con preventDefault llaman setDirection; P y Escape llaman
     togglePause; Enter y Espacio llaman start. Swipe con Pointer Events en .stage: dispara en
     pointermove en cuanto swipeDirection da una dirección (sin esperar a soltar) y reinicia el punto
     de partida para encadenar giros. D-pad: los 4 <button> que ya existen en .dpad
     (data-dir, aria-label Arriba/Izquierda/Abajo/Derecha, 64 x 64 px) reaccionan en pointerdown.
- Cambios en archivos existentes:
  - src/components/Overlay.ts: pantalla de título "POLKA-MAN" con un <button> "JUGAR" de al menos
    48 px de alto y foco visible que llama start(state) (la forma táctil de empezar); overlay
    "LISTO" durante 'listo'; overlay "PAUSA" con un botón "Seguir" que llama
    setPaused(state, false). Los mensajes van en la región aria-live que ya existe. Quita el texto
    de la plantilla.
  - Aviso "Gira tu teléfono": NO lo pongas dentro del overlay del escenario. En horizontal el
    escenario casi no tiene alto (el HUD y el D-pad ocupan la pantalla) y el texto queda recortado.
    Hazlo un elemento propio, hijo directo de #app o de body, con position: fixed; inset: 0;
    fondo #050505; z-index por encima del HUD, el escenario y el D-pad; texto centrado en vertical
    y horizontal, completo y legible en 844 x 390, dentro de las safe areas
    (padding con env(safe-area-inset-*)). Mientras se ve, tapa todo (tampoco se ve el D-pad).
  - src/render/draw.ts: dibuja a Polka-Man #ff2867 con boca que abre y cierra al moverse, mirando a
    su dirección. Si está a menos de 0.5 casillas de un borde (x < 0.5 o x > width - 1.5) dibújalo
    también desplazado +width o -width; el canvas recorta lo que sale.
  - src/app.ts: crea el estado con createGame(Date.now()), conecta startLoop (step = update,
    render = draw), controles y overlays. Pausa automática con setPaused(state, true) (nunca
    togglePause) en visibilitychange cuando document.hidden, en blur de la ventana y cuando el
    teléfono queda en horizontal: matchMedia('(orientation: landscape) and (pointer: coarse)')
    muestra "Gira tu teléfono" y pausa. Nada reanuda solo: al volver la pestaña o al girar a
    vertical se quita el aviso y el juego sigue en PAUSA hasta que el jugador toque "Seguir" o
    pulse P/Escape.
  - src/styles.css: estilos del botón JUGAR/Seguir (min-height 48px, foco visible) y del aviso de
    giro a pantalla completa (position: fixed; inset: 0, ver arriba).

Restricciones:
- No cambies package.json, game/package.json, pnpm-lock.yaml, pnpm-workspace.yaml, contrato/,
  src/contract/, src/hub/ ni src/lib/. No instales dependencias.
- Todos los números del juego van en src/engine/rules.ts con los nombres y valores de arriba.
- src/engine/ es lógica pura: sin DOM, sin window, sin document, sin tiempo real (todo avanza con dt).
- No cambies el laberinto (MAZE). No borres, saltes ni desactives tests.
- Nombres, colores y dibujos originales: nada de Pac-Man.
- La app no hace peticiones de red nuevas (sin fetch, CDNs ni fuentes remotas).

Formato de salida: crea los archivos nuevos de arriba y sus tests, edita los existentes que se
indican y, al final, dime la lista de archivos que tocaste y cómo probarlo.

Cómo se comprueba:
- Tests nuevos (Vitest, importa describe/it/expect de 'vitest'):
  src/engine/movement.test.ts: avanza por un pasillo; se detiene ante una pared; un giro pedido
  antes de un cruce se aplica en el siguiente cruce; la reversa es inmediata a mitad de casilla; la
  distancia sobrante se aplica tras girar en un centro; el túnel funciona en ambos sentidos.
  src/input/swipe.test.ts: 24 px dispara, 23 px no; gana el eje dominante; bajo el umbral da null.
  src/engine/game.test.ts: start desde 'titulo' va a 'listo' y desde 'jugando' no hace nada;
  setPaused(true) dos veces deja 'pausa' y setPaused(true) no reanuda; togglePause alterna;
  setPaused(true) en 'listo' deja 'pausa', update(state, 5) no cambia posiciones ni phaseTimer y
  setPaused(false) vuelve a 'listo' con el mismo tiempo restante; setPaused(true) en 'titulo' no
  hace nada.
- Desde la raíz del repo, pnpm test y pnpm build pasan.
- pnpm dev y abre http://127.0.0.1:5173: JUGAR → LISTO → a los 1.5 s Polka-Man se mueve a la
  izquierda; las flechas lo giran; P pausa y Seguir reanuda; cruza el túnel de la fila del centro.
- En DevTools, dispositivo táctil en horizontal (844 x 390): "Gira tu teléfono" se lee completo,
  centrado, tapando toda la pantalla (sin HUD ni D-pad encima ni texto recortado). Al volver a
  390 x 844 el aviso desaparece y el juego queda en PAUSA.
```

## Prueba manual

1. Desde la raíz del repo: `pnpm dev` y abre `http://127.0.0.1:5173` en Chrome.
2. PC: haz clic en **JUGAR**. Ves «LISTO» y, a los 1.5 s, Polka-Man avanza a la izquierda.
3. Pulsa `↑` antes de un cruce: gira en el cruce, no antes. Pulsa `→` a mitad de pasillo: se da la
   vuelta al instante. Llévalo contra una pared: se detiene en el centro de la casilla.
4. Llévalo al túnel (fila del centro, sale por un lado y entra por el otro sin desaparecer a medias).
5. Pulsa `P`: aparece PAUSA y nada se mueve. Toca «Seguir»: sigue donde iba.
6. Cambia de pestaña y regresa: sigue en PAUSA (no se reanuda solo).
7. Celular: en DevTools activa la barra de dispositivos (390 x 844, táctil). Ves el D-pad. Toca
   JUGAR, desliza el dedo sobre el laberinto (swipe) y usa el D-pad: Polka-Man gira.
8. Gira el dispositivo a horizontal (844 x 390): «Gira tu teléfono» tapa toda la pantalla y se lee
   completo (sin recortes ni el D-pad encima). Vuelve a vertical: el juego sigue en PAUSA hasta que
   tocas «Seguir».

## Tests automáticos que debe agregar

- `game/src/engine/movement.test.ts`: avanza por un pasillo, se detiene ante pared, giro guardado
  que se aplica en el siguiente cruce, reversa inmediata, distancia sobrante aplicada tras girar en
  un centro, túnel en ambos sentidos.
- `game/src/input/swipe.test.ts`: umbral de 24 px (`SWIPE_THRESHOLD_PX`), eje dominante, sin
  dirección bajo el umbral.
- `game/src/engine/game.test.ts`: `start` desde `titulo` → `listo`, desde `jugando` no hace nada;
  `setPaused(true)` dos veces deja `pausa`; `togglePause` alterna; pausa en `listo` congela
  `phaseTimer` y posiciones con `update(state, 5)` y reanuda a `listo` con el mismo tiempo;
  `setPaused(true)` en `titulo` no hace nada.

## Revísalo antes del commit

- [ ] `pnpm test` y `pnpm build` pasan desde la raíz, y los tests nuevos aparecen en la salida.
- [ ] `git status` solo muestra cambios dentro de `game/src/`.
- [ ] `rules.ts` tiene `DT`, `MAX_FRAME_SECONDS`, `PLAYER_SPEED`, `READY_SECONDS` y
      `SWIPE_THRESHOLD_PX` con los valores del prompt, y ningún número suelto en otros archivos.
- [ ] `src/engine/` no usa `window`, `document` ni `performance`.
- [ ] La pausa automática usa `setPaused(state, true)`, nunca `togglePause`.
- [ ] El aviso «Gira tu teléfono» es `position: fixed` a pantalla completa (no vive dentro de
      `.stage`) y se lee entero en 844 x 390.
- [ ] Nada en `src/contract/`, `src/hub/`, `src/lib/`, `package.json` ni `pnpm-lock.yaml`.

## Mensaje de commit

```bash
git add game/src
git commit -m "etapa 1: Polka-Man se mueve"
```

## Si te atoras

La solución de esta etapa está en la rama `etapa-1` del repo original (`upstream`).

```bash
git fetch upstream
git diff upstream/etapa-1 -- game          # mira la diferencia sin cambiar nada
git restore --source=upstream/etapa-1 --staged --worktree -- game
git commit -m "Etapa 1 desde la rama de respaldo"
```

`git restore` con una ruta deja `game/` igual a la etapa (también borra archivos versionados que la
rama no tiene). Tus archivos sin versionar se quedan.
