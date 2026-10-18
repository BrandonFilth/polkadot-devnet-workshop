# Etapa 3 · Fantasmas y vidas

## Qué vas a tener al terminar

Salen dos fantasmas de la casa del centro, uno al empezar y otro 3 segundos después, y persiguen a
Polka-Man cada uno a su manera. Si uno te toca pierdes una vida; con 5 choques se acaba la partida
y aparece el fin con tu puntaje y el botón «Jugar otra vez».

Captura descrita: Polka-Man rosa en el pasillo de abajo; Bug (naranja) saliendo por la puerta de
la casa y Lag (verde menta) todavía adentro subiendo y bajando; en el HUD, 5 vidas.

## Tiempo estimado

30 a 40 minutos. Es la etapa más larga: revisa bien el plan antes de aceptar.

## El prompt

```text
Objetivo: agregar fantasmas con personalidad, choques, vidas y fin de partida.

Contexto:
- Lee primero game/AGENTS.md y respétalo.
- Ya existen: src/engine/game.ts (fases 'titulo', 'listo', 'jugando', 'rondaLimpia', 'pausa';
  createGame(seed), start, setDirection, togglePause, setPaused, update; puntaje y rondas),
  src/engine/movement.ts (advance), src/engine/player.ts, src/engine/maze.ts (tileAt; la puerta '-'
  está en (9, 8), la salida de la casa es (9, 7), el interior 'G' es (8, 9), (9, 9), (10, 9)),
  src/engine/types.ts (GhostMode = 'casa'|'saliendo'|'normal'|'asustado'|'ojos'), src/components/Hud.ts
  y Overlay.ts, src/render/draw.ts.
- Agrega a src/engine/rules.ts exactamente: GHOST_BASE_SPEED = 4.0, HITBOX = 0.6,
  RELEASE_INTERVAL = 3, DEATH_SECONDS = 1.2, LAG_SAMPLES = 8, LAG_SAMPLE_SECONDS = 0.25,
  FORK_AHEAD = 4, GAS_RADIUS = 6, NONCE_RADIUS = 5, GHOST_START = 2, y las funciones
  ghostCount(round) que devuelve GHOST_START y ghostSpeed(round) que devuelve GHOST_BASE_SPEED
  (la etapa 4 las cambia). LIVES = 5 ya existe.
- src/engine/rng.ts (nuevo): mulberry32 con semilla. export function random(s: { seed: number }):
  number avanza s.seed y devuelve un número en [0, 1). El estado de la partida guarda la semilla de
  createGame(seed), así el estado sigue siendo serializable y los tests son deterministas.
- src/engine/ghosts.ts (nuevo): las 6 personalidades (aunque en esta etapa solo salgan 2), en este
  orden; el fantasma i usa la personalidad i:
    0 Bug   #ff6b4a  objetivo: la casilla de Polka-Man.
    1 Lag   #9be7b0  objetivo: donde estaba Polka-Man hace 2 s: guarda LAG_SAMPLES muestras de su
                     casilla, una cada LAG_SAMPLE_SECONDS; usa la más vieja (antes de llenarse,
                     también la más vieja). Con 0 muestras, la casilla actual de Polka-Man.
                     Las muestras se vacían en cada vida nueva y en cada ronda nueva.
    2 Spam  #ffd479  sin objetivo: en cada cruce elige al azar entre las candidatas con random().
    3 Fork  #7fb8ff  objetivo: FORK_AHEAD casillas delante de Polka-Man en su dirección, recortado al
                     tablero (0..18, 0..20).
    4 Gas   #c39bff  objetivo: Polka-Man si está a más de GAS_RADIUS casillas; si no, la esquina
                     BL (1, 19).
    5 Nonce #5ee0d0  recorre las esquinas TL (1, 1) → TR (17, 1) → BR (17, 19) → BL (1, 19),
                     cambia a la siguiente cuando está a menos de 1 casilla; si Polka-Man está a
                     NONCE_RADIUS casillas o menos, lo persigue.
  Ninguno usa el rosa #ff2867 (es de Polka-Man y de los orbes especiales).
  Todas las distancias de objetivos y radios son euclidianas sobre la cuadrícula, sin considerar el
  túnel. Solo el choque considera el túnel.
- Modos de esta etapa:
  - 'casa': el fantasma i espera en la casilla G número i % 3 y no se mueve (el sube y baja de
    ±0.15 casillas es solo dibujo en draw.ts y no cambia el estado).
  - 'saliendo': camino fijo, horizontal hasta la columna de la puerta (9) y luego arriba, cruzando
    la puerta, hasta la salida (9, 7), a ghostSpeed(round). Al llegar al centro de (9, 7) pasa a
    'normal' conservando la dirección 'arriba' con la que llegó y en ese mismo centro elige
    dirección con la regla normal: la reversa ('abajo') es la puerta, que en 'normal' no es
    transitable, y 'arriba' es pared, así que solo quedan 'izquierda' y 'derecha' y gana la que
    acerca al objetivo.
  - 'normal': en cada centro, candidatas = direcciones transitables para su modo, sin la reversa
    (salvo que sea la única); gana la de menor distancia al cuadrado al objetivo; empate en orden
    arriba, izquierda, abajo, derecha. Spam elige al azar con random(). Un fantasma en 'normal'
    nunca da media vuelta.
  - Transitable: los fantasmas entran a orbes, especiales y pasillos; la puerta '-' solo en 'casa',
    'saliendo' u 'ojos'; las casillas 'G' solo los fantasmas. Nunca entran a una pared.
  - Usan advance() de movement.ts para moverse.
- Salida escalonada: el fantasma i sale (pasa de 'casa' a 'saliendo') i * RELEASE_INTERVAL
  segundos después de entrar a 'jugando', en cada ronda y en cada vida. En 'listo' solo baja
  phaseTimer: los temporizadores de salida y las muestras de Lag empiezan a contar al entrar a
  'jugando'.
- La partida tiene ghostCount(round) fantasmas; se recalcula al empezar cada ronda.
- Orden de update(state, dt) en 'jugando': mover a Polka-Man → comer el orbe de su casilla → mover
  fantasmas → choques → temporizadores. Si después de comer quedan 0 orbes, pasa a 'rondaLimpia'
  en ese mismo paso y se omiten el movimiento de fantasmas y los choques.
- Choques: hay choque si la distancia entre centros, considerando el túnel, es < HITBOX.
  Fantasma en 'normal' o 'saliendo' → Polka-Man muere: lives - 1 y fase 'muriendo' con
  phaseTimer = DEATH_SECONDS. Fantasma en 'casa' → nada.
- Al terminar 'muriendo': si quedan vidas, Polka-Man y fantasmas vuelven a sus posiciones de inicio
  (fantasmas en 'casa'), se reinician los temporizadores de salida y las muestras de Lag, los orbes
  que quedaban siguen igual, y pasa a 'listo'. Con 0 vidas pasa a 'fin'.
- Agrega 'muriendo' a las fases activas: pausar en 'muriendo' congela phaseTimer y reanudar vuelve
  a 'muriendo'. 'fin' no es fase activa (no se pausa).
- start(state) también funciona desde 'fin': reinicia puntaje, vidas (LIVES), ronda 1, orbes,
  posiciones y fantasmas en 'casa'.
- src/components/Overlay.ts: en 'fin' muestra el puntaje y un <button> "Jugar otra vez" de al menos
  48 px de alto que llama start(state). Enter y Espacio también llaman start en 'fin'.
- src/components/Hud.ts: las vidas reflejan state.lives (aria-label="Vidas: N").
- src/render/draw.ts: fantasmas con cúpula, cuerpo y 3 picos abajo, en su color, con ojos blancos
  que miran a su dirección. Si un fantasma está a menos de 0.5 casillas de un borde (x < 0.5 o
  x > width - 1.5) dibújalo también desplazado +width o -width, como a Polka-Man.

Restricciones:
- No cambies package.json, game/package.json, pnpm-lock.yaml, pnpm-workspace.yaml, contrato/,
  src/contract/, src/hub/ ni src/lib/. No instales dependencias.
- Todos los números del juego van en src/engine/rules.ts con los nombres y valores de arriba.
- src/engine/ es lógica pura: sin DOM, sin window, sin document, sin tiempo real, sin Math.random
  (usa random() de rng.ts).
- No cambies el laberinto (MAZE). No borres, saltes ni desactives tests; los de las etapas 1 y 2
  siguen pasando.
- Nombres, colores y dibujos originales: nada de Pac-Man.

Formato de salida: crea src/engine/rng.ts, src/engine/ghosts.ts, src/engine/ghosts.test.ts; edita
src/engine/game.ts, src/engine/rules.ts, src/components/Overlay.ts, src/components/Hud.ts,
src/render/draw.ts, src/app.ts (y src/input/controls.ts si hace falta) y src/engine/game.test.ts.
Al final dime qué archivos tocaste y cómo probarlo.

Cómo se comprueba:
- src/engine/ghosts.test.ts (semilla fija): ningún fantasma da media vuelta en 'normal'; nunca entra
  a una pared; el objetivo de cada una de las 6 personalidades; el fantasma 0 sale a los 0 s y el 1
  a los 3 s de 'jugando'; al llegar a (9, 7) pasa a 'normal' con dirección izquierda o derecha
  (nunca arriba ni abajo); Bug con Polka-Man en (17, 7) sale a la derecha y con Polka-Man en (1, 7)
  sale a la izquierda.
- src/engine/game.test.ts: chocar con un 'normal' resta una vida y reinicia posiciones conservando
  los orbes; chocar con un fantasma 'saliendo' en (9, 7) resta una vida; un fantasma en 'casa' nunca
  choca; al quinto choque la fase es 'fin'; pausar en 'muriendo' congela el temporizador; start
  desde 'fin' reinicia puntaje, vidas y ronda; si el último orbe se come en el mismo paso en que un
  fantasma choca, gana 'rondaLimpia' y no se pierde vida.
- Desde la raíz, pnpm test y pnpm build pasan.
- pnpm dev, http://127.0.0.1:5173: salen 2 fantasmas, uno a los 0 s y otro a los 3 s; si te quedas
  quieto te alcanzan y baja una vida; con 5 choques aparece el fin y "Jugar otra vez" reinicia.
```

## Prueba manual

1. `pnpm dev` y abre `http://127.0.0.1:5173`. Toca JUGAR.
2. Al terminar «LISTO» sale Bug (naranja) y 3 s después Lag (verde). Ninguno da media vuelta.
3. Quédate quieto contra una pared: un fantasma te alcanza, Polka-Man muere y el HUD muestra 4
   vidas. Los orbes que ya comiste siguen comidos.
4. Pulsa `P` durante la animación de muerte: queda en PAUSA; «Seguir» la termina.
5. Pierde las 5 vidas: aparece el fin con tu puntaje y «Jugar otra vez». Tócalo (o pulsa Enter):
   puntaje 0, 5 vidas, ronda 1.
6. Cruza el túnel con un fantasma cerca: el fantasma tampoco desaparece a medias.

## Tests automáticos que debe agregar

- `game/src/engine/ghosts.test.ts`: sin media vuelta en `normal`, nunca entra a una pared, objetivo
  de cada personalidad (`LAG_SAMPLES`, `LAG_SAMPLE_SECONDS`, `FORK_AHEAD`, `GAS_RADIUS`,
  `NONCE_RADIUS`), salida a los 0 s y 3 s (`RELEASE_INTERVAL`), al llegar a (9, 7) pasa a `normal`
  hacia izquierda o derecha; (17, 7) → derecha y (1, 7) → izquierda.
- `game/src/engine/game.test.ts`: choque con `normal` resta vida y conserva orbes; choque con
  `saliendo` en (9, 7) resta vida; `casa` nunca choca (`HITBOX`); al quinto choque, `fin`; pausa en
  `muriendo` congela `DEATH_SECONDS`; `start` desde `fin` reinicia; último orbe + choque en el mismo
  paso → `rondaLimpia`.

## Revísalo antes del commit

- [ ] `pnpm test` y `pnpm build` pasan; siguen los tests de las etapas 1 y 2.
- [ ] `rules.ts` tiene las 10 constantes nuevas con sus valores y `ghostCount()` / `ghostSpeed()`.
- [ ] `src/engine/` no usa `Math.random`, `window` ni `document`.
- [ ] Los colores de los fantasmas son los del prompt y ninguno es `#ff2867`.
- [ ] `git status` solo muestra cambios dentro de `game/src/`.

## Mensaje de commit

```bash
git add game/src
git commit -m "etapa 3: fantasmas y vidas"
```

## Si te atoras

```bash
git fetch upstream
git diff upstream/etapa-3 -- game
git restore --source=upstream/etapa-3 --staged --worktree -- game
git commit -m "Etapa 3 desde la rama de respaldo"
```
