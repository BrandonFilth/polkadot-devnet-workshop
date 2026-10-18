# Etapa 2 · Orbes, puntaje y rondas

## Qué vas a tener al terminar

Polka-Man se come los orbes por donde pasa. Arriba hay un HUD con el puntaje, la ronda, las 5 vidas
y un botón de pausa. Cada orbe vale 10 y cada orbe especial (los 4 rosas de las esquinas) vale 50,
todavía sin efecto. Cuando vacías el laberinto aparece «RONDA 2», los orbes vuelven y Polka-Man
regresa a su inicio.

Captura descrita: en el celular, el HUD arriba («PUNTOS 340 · RONDA 1» y cinco círculos rosas de
vidas), un camino vacío detrás de Polka-Man y el resto de los orbes intactos.

## Tiempo estimado

15 a 25 minutos.

## El prompt

```text
Objetivo: que Polka-Man coma orbes, que haya puntaje, HUD y rondas: al vaciar el laberinto empieza
la ronda siguiente con los orbes completos.

Contexto:
- Lee primero game/AGENTS.md y respétalo.
- Ya existen el motor de la etapa 1 (src/engine/game.ts con createGame, start, setDirection,
  togglePause, setPaused, update y las fases 'titulo', 'listo', 'jugando', 'pausa';
  src/engine/movement.ts, src/engine/player.ts), src/loop.ts, src/input/, src/render/draw.ts,
  src/components/Overlay.ts y src/app.ts. El laberinto tiene 146 orbes y 4 especiales
  (maze.orbs y maze.power, índices r * width + c).
- Agrega a src/engine/rules.ts exactamente: ORB_POINTS = 10, POWER_POINTS = 50,
  ROUND_CLEAR_SECONDS = 1.5. LIVES = 5 ya existe: el HUD la lee de ahí.
- El estado de la partida guarda sus propias copias de los orbes y especiales que quedan (no
  modifiques los Set del laberinto). start() los llena completos.
- Orden de update(state, dt) en 'jugando': mover a Polka-Man → comer el orbe de su casilla
  redondeada (Math.round de x e y, con la columna envuelta por el túnel) → temporizadores.
  Comer un orbe suma ORB_POINTS y lo quita; un especial suma POWER_POINTS y lo quita (sin otro
  efecto en esta etapa). Una casilla ya comida no vuelve a sumar.
- Nueva fase 'rondaLimpia': cuando ya no quedan orbes ni especiales, pasa a 'rondaLimpia' en ese
  mismo paso con phaseTimer = ROUND_CLEAR_SECONDS. Al terminar: round + 1, orbes y especiales
  completos otra vez, Polka-Man en su inicio (9, 15) mirando a la izquierda, y pasa a 'listo'
  (phaseTimer = READY_SECONDS). Agrega 'rondaLimpia' a las fases activas: setPaused(true) en
  'rondaLimpia' guarda resumePhase = 'rondaLimpia', congela phaseTimer, y reanudar vuelve a
  'rondaLimpia' con el mismo tiempo restante. No cambies setPaused, togglePause ni start más allá
  de eso.
- src/components/Hud.ts (nuevo): HUD en DOM dentro del <header class="hud"> que ya existe, con
  puntaje, ronda, vidas (LIVES, fijas en esta etapa, dibujadas como círculos con
  aria-label="Vidas: N") y un botón de pausa que llama togglePause(state). Fuente JetBrains Mono
  (variable --mono de styles.css). Se actualiza solo cuando cambia un valor.
- src/components/Overlay.ts: durante 'rondaLimpia' muestra "RONDA N" con N = la ronda que sigue.
- src/render/draw.ts: dibuja solo los orbes que quedan en el estado.

Restricciones:
- No cambies package.json, game/package.json, pnpm-lock.yaml, pnpm-workspace.yaml, contrato/,
  src/contract/, src/hub/ ni src/lib/. No instales dependencias.
- Todos los números del juego van en src/engine/rules.ts con los nombres y valores de arriba.
- src/engine/ es lógica pura: sin DOM, sin window, sin document, sin tiempo real (todo avanza con dt).
- No cambies el laberinto (MAZE). No borres, saltes ni desactives tests. Todos los tests de la
  etapa 1 siguen pasando.
- Nombres, colores y dibujos originales: nada de Pac-Man.

Formato de salida: crea src/components/Hud.ts, edita src/engine/game.ts, src/engine/rules.ts,
src/components/Overlay.ts, src/render/draw.ts, src/app.ts y los tests; al final dime qué archivos
tocaste y cómo probarlo.

Cómo se comprueba:
- Tests nuevos en src/engine/game.test.ts: comer un orbe suma 10 y comer un especial suma 50;
  pasar dos veces por la misma casilla no suma otra vez; vaciar los 150 (146 + 4) lleva a
  'rondaLimpia' y, tras ROUND_CLEAR_SECONDS, a la ronda 2 con 150 orbes de nuevo y Polka-Man en
  (9, 15); pausar en 'rondaLimpia' congela el temporizador y reanudar vuelve a 'rondaLimpia'.
  (Para vaciar el laberinto en un test puedes dejar un solo orbe en el estado y comerlo.)
- Desde la raíz, pnpm test y pnpm build pasan.
- pnpm dev, http://127.0.0.1:5173: el puntaje sube al comer; el botón de pausa del HUD pausa y
  reanuda.
```

## Prueba manual

1. `pnpm dev` y abre `http://127.0.0.1:5173`.
2. Toca JUGAR y mueve a Polka-Man: los orbes desaparecen a su paso y el puntaje sube de 10 en 10.
3. Cómete un especial rosa: suma 50.
4. Regresa por el mismo pasillo: el puntaje no cambia.
5. El botón de pausa del HUD pausa; tocarlo otra vez (o «Seguir») reanuda.
6. En el celular (DevTools, 390 x 844) el HUD cabe en una línea y no tapa el laberinto.
7. Para ver «RONDA 2» sin comerte los 150 orbes, confía en el test; si quieres verlo, termina una
   ronda completa.

## Tests automáticos que debe agregar

En `game/src/engine/game.test.ts`: comer suma (`ORB_POINTS`, `POWER_POINTS`), no se come dos veces,
vaciar los 150 da ronda 2 con 150 orbes de nuevo y Polka-Man en `P`, y pausar en `rondaLimpia`
congela el temporizador (`ROUND_CLEAR_SECONDS`) y reanudar vuelve a `rondaLimpia`.

## Revísalo antes del commit

- [ ] `pnpm test` y `pnpm build` pasan; los tests de la etapa 1 siguen ahí.
- [ ] `rules.ts` tiene `ORB_POINTS = 10`, `POWER_POINTS = 50`, `ROUND_CLEAR_SECONDS = 1.5`.
- [ ] El HUD lee `LIVES` de `rules.ts` y tiene `aria-label="Vidas: 5"`.
- [ ] El estado tiene su propia copia de los orbes (el laberinto no cambia).
- [ ] `git status` solo muestra cambios dentro de `game/src/`.

## Mensaje de commit

```bash
git add game/src
git commit -m "etapa 2: orbes, puntaje y rondas"
```

## Si te atoras

```bash
git fetch upstream
git diff upstream/etapa-2 -- game
git restore --source=upstream/etapa-2 --staged --worktree -- game
git commit -m "Etapa 2 desde la rama de respaldo"
```
