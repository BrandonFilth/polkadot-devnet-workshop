# Etapa 4 · Orbes especiales y dificultad

## Qué vas a tener al terminar

Al comerte un orbe especial los fantasmas se asustan: se ponen grises, dan media vuelta, van más
lento y puedes comértelos (200, 400, 800 y 1600 puntos seguidos). El fantasma comido regresa a la
casa como un par de ojos y vuelve a salir. Cada ronda los fantasmas son 5 % más rápidos (con tope)
y cada 3 rondas sale uno más, hasta 6.

Captura descrita: dos fantasmas grises con ojos oscuros huyendo de Polka-Man; uno de ellos
parpadea en blanco porque el susto está por terminar; en la casa, un par de ojos regresando.

## Tiempo estimado

25 a 35 minutos.

## El prompt

```text
Objetivo: que los orbes especiales asusten a los fantasmas, que se puedan comer y que la
dificultad suba con cada ronda.

Contexto:
- Lee primero game/AGENTS.md y respétalo.
- Ya existen: src/engine/ghosts.ts (6 personalidades; modos 'casa', 'saliendo', 'normal'; regla de
  elección en cada centro), src/engine/game.ts (fases 'titulo', 'listo', 'jugando', 'muriendo',
  'rondaLimpia', 'pausa', 'fin'; choques, vidas, rondas), src/engine/rng.ts (random),
  src/engine/rules.ts (incluye GHOST_BASE_SPEED = 4.0, GHOST_START = 2, PLAYER_SPEED = 6.0,
  POWER_POINTS = 50, ghostCount() y ghostSpeed() fijos), src/render/draw.ts.
- Agrega a src/engine/rules.ts exactamente:
  GHOST_SPEED_GROWTH = 1.05, GHOST_SPEED_CAP = 5.7, GHOST_MAX = 6, GHOST_EVERY_ROUNDS = 3,
  FRIGHT_SPEED_FACTOR = 0.5, EYES_SPEED = 12.0, FRIGHT_BASE_SECONDS = 6, FRIGHT_STEP_SECONDS = 0.5,
  FRIGHT_MIN_SECONDS = 2, FRIGHT_BLINK_SECONDS = 1.5, FRIGHT_BLINK_PERIOD = 0.2,
  GHOST_CHAIN_POINTS = [200, 400, 800, 1600].
  Y cambia las fórmulas (también en rules.ts):
  ghostSpeed(r) = min(GHOST_SPEED_CAP, GHOST_BASE_SPEED * GHOST_SPEED_GROWTH ** (r - 1))
  ghostCount(r) = min(GHOST_MAX, GHOST_START + floor((r - 1) / GHOST_EVERY_ROUNDS))
  frightenedSeconds(r) = max(FRIGHT_MIN_SECONDS, FRIGHT_BASE_SECONDS - FRIGHT_STEP_SECONDS * (r - 1))
  Tabla esperada (ronda: fantasmas, velocidad, asustado):
  1: 2, 4.000, 6.0 | 2: 2, 4.200, 5.5 | 3: 2, 4.410, 5.0 | 4: 3, 4.631, 4.5 | 5: 3, 4.862, 4.0 |
  6: 3, 5.105, 3.5 | 7: 4, 5.360, 3.0 | 8: 4, 5.628, 2.5 | 9: 4, 5.700 (tope), 2.0 |
  10-12: 5, 5.700, 2.0 | 13+: 6, 5.700, 2.0.
- Modo 'asustado':
  - Comer un orbe especial pone un temporizador GLOBAL (uno por partida) en frightenedSeconds(round)
    y reinicia la cadena de puntos. Los fantasmas en 'normal' pasan a 'asustado' y dan media vuelta.
    Los que están en 'casa', 'saliendo' u 'ojos' no cambian.
  - Un segundo especial durante el susto reinicia el temporizador a frightenedSeconds(round) y la
    cadena a 200; los que ya están 'asustado' siguen así SIN dar media vuelta otra vez; los 'normal'
    se asustan y dan media vuelta.
  - Un fantasma asustado va a FRIGHT_SPEED_FACTOR * ghostSpeed(round) y en cada cruce elige al azar
    (random()) entre las candidatas sin reversa.
  - Al terminar el temporizador, cada 'asustado' pasa a 'normal' sin dar media vuelta.
  - Al morir Polka-Man o al limpiar la ronda, el susto termina y la cadena se reinicia.
- Modo 'ojos' (fantasma comido): objetivo la salida (9, 7), velocidad EYES_SPEED, puede cruzar la
  puerta; al llegar a la salida baja por la puerta al centro de la casa (9, 9) y pasa a 'saliendo';
  después sale como siempre y queda en 'normal'.
- Choques (distancia entre centros con túnel < HITBOX). Orden dentro de un mismo paso de update:
  primero se comen TODOS los 'asustado' que chocan, en orden de índice: cada uno suma
  GHOST_CHAIN_POINTS[k] (k = fantasmas comidos en este susto, índice máximo 3) y pasa a 'ojos';
  después, si algún 'normal' o 'saliendo' choca, Polka-Man muere en ese mismo paso (los puntos ya
  sumados se conservan). 'ojos' y 'casa' no hacen nada: no quitan vida ni suman.
- Al empezar cada ronda se recalcula ghostCount(round) (en la ronda 4 hay 3 fantasmas).
- src/render/draw.ts: asustados #8b8b86 con ojos #050505; en los últimos FRIGHT_BLINK_SECONDS
  alternan con #f2f2ef cada FRIGHT_BLINK_PERIOD segundos; en modo 'ojos' se dibujan solo los ojos.

Restricciones:
- No cambies package.json, game/package.json, pnpm-lock.yaml, pnpm-workspace.yaml, contrato/,
  src/contract/, src/hub/ ni src/lib/. No instales dependencias.
- Todos los números del juego van en src/engine/rules.ts con los nombres y valores de arriba.
- src/engine/ es lógica pura: sin DOM, sin window, sin document, sin tiempo real, sin Math.random.
- No cambies el laberinto (MAZE). No borres, saltes ni desactives tests; los de las etapas 1 a 3
  siguen pasando.
- Nombres, colores y dibujos originales: nada de Pac-Man.

Formato de salida: edita src/engine/rules.ts, src/engine/ghosts.ts, src/engine/game.ts,
src/render/draw.ts y los tests; crea src/engine/rules.test.ts. Al final dime qué archivos tocaste y
cómo probarlo.

Cómo se comprueba:
- src/engine/rules.test.ts: la tabla de arriba exacta a 3 decimales (fantasmas, velocidad y
  segundos de susto; compara Math.round(v * 1000) / 1000 con el valor de la tabla), el tope 5.7 se alcanza en la ronda 9 y ghostSpeed(r) < PLAYER_SPEED para
  r = 1..100.
- src/engine/ghosts.test.ts y src/engine/game.test.ts: el especial asusta y hace dar media vuelta a
  los 'normal', no a los de la casa; comer dos fantasmas en un susto suma 200 + 400; un fantasma
  comido llega a la casa como 'ojos' y vuelve en 'normal'; un segundo especial reinicia el tiempo y
  la cadena y no hace dar media vuelta a los ya asustados; al acabar el tiempo vuelven a 'normal'
  sin media vuelta; en la ronda 4 hay 3 fantasmas; tocar unos 'ojos' no quita vida ni suma puntos;
  si en el mismo paso chocan un 'asustado' y un 'normal', primero suma 200 y después Polka-Man muere.
- Desde la raíz, pnpm test y pnpm build pasan.
- pnpm dev, http://127.0.0.1:5173: al comer un especial los fantasmas se ponen grises y huyen;
  comerte uno suma 200 y regresa a la casa como ojos.
```

## Prueba manual

1. `pnpm dev` y abre `http://127.0.0.1:5173`. Toca JUGAR.
2. Ve al especial rosa más cercano: los fantasmas que andan fuera se ponen grises y dan la vuelta;
   el que sigue en la casa no cambia.
3. Persigue a uno: al tocarlo suma 200 y se convierte en ojos que regresan a la casa. Un segundo en
   el mismo susto suma 400.
4. Espera: en el último segundo y medio parpadean en blanco y luego vuelven a su color.
5. Toca unos ojos: no pasa nada (no pierdes vida).
6. Si llegas a la ronda 4, cuenta 3 fantasmas.

## Tests automáticos que debe agregar

- `game/src/engine/rules.test.ts`: tabla exacta a 3 decimales (`ghostSpeed`, `ghostCount`,
  `frightenedSeconds`), tope `GHOST_SPEED_CAP` en la ronda 9, `ghostSpeed(r) < PLAYER_SPEED` para
  r = 1…100.
- `game/src/engine/ghosts.test.ts` / `game.test.ts`: susto y media vuelta solo a los `normal`;
  cadena `GHOST_CHAIN_POINTS` 200 + 400; ojos a la casa y regreso en `normal`; segundo especial;
  fin del susto sin media vuelta; 3 fantasmas en la ronda 4; ojos sin efecto; orden asustado →
  muerte en el mismo paso.

## Revísalo antes del commit

- [ ] `pnpm test` y `pnpm build` pasan; siguen los tests de las etapas 1 a 3.
- [ ] `rules.ts` tiene las 12 constantes nuevas y las 3 fórmulas; no hay números sueltos en
      `ghosts.ts` ni `game.ts`.
- [ ] El temporizador del susto es uno solo para toda la partida.
- [ ] `git status` solo muestra cambios dentro de `game/src/`.

## Mensaje de commit

```bash
git add game/src
git commit -m "etapa 4: orbes especiales y dificultad"
```

## Si te atoras

```bash
git fetch upstream
git diff upstream/etapa-4 -- game
git restore --source=upstream/etapa-4 --staged --worktree -- game
git commit -m "Etapa 4 desde la rama de respaldo"
```
