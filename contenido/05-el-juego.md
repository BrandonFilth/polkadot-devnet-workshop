![Polkadot App Hackatón](../img/banner.png "Polkadot App Hackatón")

# Capítulo 5 · El juego

En este capítulo construyes Polka-Man con la IA, en cinco etapas, a partir de una plantilla que ya
dibuja el laberinto. Al final tienes un juego de laberinto que corre en el celular y en la PC, dentro
de Polkadot Desktop o de la Polkadot App, y que guarda tu récord en el contrato `Leaderboard` que
comparten todas las apps del hackatón.

Cada etapa es un prompt copiable, una revisión y un commit, con la forma de trabajar del
[capítulo 4](./04-vibe-coding.md). Calcula de 2 a 3 horas para las cinco etapas.

---

## 1. Qué vas a construir

![Polka-Man en el celular](../img/cap5/polka-man-movil.png "Polka-Man en el celular: HUD arriba, laberinto y D-pad")

Polka-Man es un círculo rosa con boca que recorre un laberinto comiendo orbes mientras lo persiguen
fantasmas. Los nombres, colores y el laberinto son propios del tutorial.

| Regla | Valor |
|---|---|
| Vidas | **5**. Pierdes una al chocar con un fantasma; con 0, fin de la partida |
| Orbe | 10 puntos |
| Orbe especial (los 4 rosas de las esquinas) | 50 puntos y los fantasmas se asustan: puedes **comértelos** |
| Fantasmas comidos en un mismo susto | 200, 400, 800 y 1600 puntos |
| Ronda | Termina al vaciar el laberinto; los orbes vuelven y empieza la siguiente. No hay ronda final |
| Velocidad de los fantasmas | **+5 % cada ronda** sobre la anterior, con tope |
| Número de fantasmas | Empieza en 2 y sale **uno más cada 3 rondas**, hasta 6 |
| Marcador | Tu mejor puntaje se guarda en el contrato `Leaderboard` con una firma desde tu teléfono |

Las fórmulas exactas están en la [sección 11](#11-la-dificultad). Todos los números del juego viven
en un solo archivo, `game/src/engine/rules.ts`.

---

## 2. El proyecto

El juego vive en la carpeta `game/` del repo. La raíz es un workspace de pnpm con un solo paquete
(`game`), así que `pnpm dev`, `pnpm test` y `pnpm build` se corren desde la raíz. La carpeta
`contrato/` sigue siendo un proyecto aparte, igual que en el [capítulo 3](./03-smart-contracts.md).

```text
polkadot-devnet-workshop/
├── package.json            scripts dev, build, test y test:red (llaman a game/)
├── pnpm-workspace.yaml     packages: [game] y el override de @parity/truapi 0.13.1
├── pnpm-lock.yaml
├── contrato/               Leaderboard.sol y sus pruebas (capítulo 3)
├── prompts/                etapa-1.md … etapa-5.md
└── game/
    ├── AGENTS.md           reglas para el agente
    ├── index.html
    ├── vite.config.js      base './', servidor en 127.0.0.1:5173
    └── src/
        ├── main.ts, app.ts, styles.css
        ├── engine/         lógica pura del juego, sin DOM (maze.ts, rules.ts, …)
        ├── render/         draw.ts: dibuja en el canvas
        ├── input/          teclado, swipe y D-pad (etapa 1)
        ├── components/     Overlay.ts, HUD, ranking y fin de partida
        ├── contract/       config.ts, ABI, lecturas y errores del contrato
        ├── hub/            hub.ts: Host, cuenta, gas, lecturas y escrituras
        └── lib/            errores de firma, formato y validación del username
```

Qué trae la plantilla (rama `main`):

- Vite 8.3.1 + TypeScript 5.9.3, sin framework de UI: el juego dibuja en un canvas 2D.
- Todas las dependencias instaladas y con versión fija. Ninguna etapa agrega dependencias.
- Las fuentes JetBrains Mono y Space Mono empaquetadas: la app no carga nada de internet salvo el
  ETH-RPC del devnet.
- El laberinto como datos (`engine/maze.ts`), ya dibujado en el canvas.
- La **capa del contrato completa y probada**, pero sin conectar a la interfaz: `contract/`, `hub/`
  y `lib/`.

La capa del contrato viene hecha porque es la parte que no se puede probar sin teléfono y donde un
error cuesta firmas: simular antes de firmar, una firma a la vez, pedir el gas, reconectar y releer
el contrato. Tiene sus propias pruebas con dobles (`hub/hub.test.ts`) y la etapa 5 solo la usa.

`game/AGENTS.md` le dice al agente qué puede tocar: `src/engine/` sin DOM ni tiempo real, todos los
números en `rules.ts`, la dirección del contrato solo en `src/contract/config.ts`, y nada de
`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `contrato/`, `src/contract/`, `src/hub/` ni
`src/lib/` salvo que el prompt lo pida ([capítulo 4, sección 10](./04-vibe-coding.md#10-agentsmd)).

---

## 3. Arranca la plantilla

Desde la raíz de tu fork ([capítulo 2, paso 9](./02-entorno.md#paso-9--haz-fork-clónalo-y-verifica-todo)):

```bash
pnpm install
pnpm test
pnpm dev
```

- `pnpm test` corre las pruebas de unidad (sin red). `pnpm test:red` corre las lecturas reales
  contra el contrato en el devnet, sin firmas.
- `pnpm dev` levanta el juego en `http://127.0.0.1:5173`. Ábrelo en el navegador: ves el laberinto y
  el aviso «POLKA-MAN · La plantilla funciona. Sigue con la etapa 1.».

**Qué se prueba dónde.** `pnpm dev` sirve para un navegador normal: ves el juego, juegas y lees el
ranking por el ETH-RPC; la app muestra que está fuera del Host. Ni Polkadot Desktop ni la Polkadot
App se conectan a `localhost`. Todo lo que pasa por el Host (Conectar, firmas, permiso de gas en
PGAS, guardar récord y username) se prueba con la app **publicada en un dominio `.dot`** y abierta
desde el Host
([skill, `app-sdk.md`](https://github.com/BrandonFilth/polkadot-products-devnet/blob/main/skills/polkadot-products-devnet/references/app-sdk.md)).
Las etapas 1 a 4 se prueban solo en el navegador. Para la etapa 5 publicas en tu `.dot` con el ciclo
de abajo.

> El Host deriva una cuenta por dominio: tu cuenta en tu `.dot` es distinta de la que tienes en la
> app de un compañero ([sección 12](#12-el-marcador-compartido)).

### Probar dentro del Host: publica en tu .dot

Este es el ciclo del taller para subir el bundle a Bulletin sin conectar tu cuenta a la PC: sin
sesión, sin frase de recuperación y sin keystore de DotNS. La única firma es la del `contenthash`,
en tu teléfono. El [capítulo 6](./06-publicar.md) lo explica a fondo. Fuente: la skill
([`publicar.md`, sección 2](https://github.com/BrandonFilth/polkadot-products-devnet/blob/main/skills/polkadot-products-devnet/references/publicar.md)).
Comprobado con `pad` 0.16.7.

1. Una sola vez: compra tu nombre en la Polkadot App desde `dotns.dot` (9 caracteres o más). El
   nombre es de la cuenta de tu teléfono.
2. Desde la raíz del repo, `pnpm build`. El bundle queda en `game/dist`.
3. Copia el bundle a una carpeta **fuera del proyecto**, para que `pad` no encuentre ningún
   `polkadot-app-deploy.config.ts` al subir por las carpetas (además usarás `--no-manifest`):

   ```powershell
   $d = "$env:TEMP\polkaman"
   Remove-Item -Recurse -Force $d -ErrorAction SilentlyContinue
   Copy-Item -Recurse game\dist "$d\dist"
   Set-Location $d
   ```

4. Define el atajo de `pad` y asegúrate de que no hay sesión ni frase de recuperación:

   ```powershell
   function pad { pnpm dlx --ignore-scripts @polkadot-community-foundation/polkadot-app-deploy@0.16.7 @args }
   pad logout
   Remove-Item Env:MNEMONIC -ErrorAction SilentlyContinue
   ```

5. Genera un nombre temporal sin dígitos (DotNS solo acepta 0 o 2 dígitos al final):

   ```powershell
   $ts = Get-Date -Format 'yyyyMMddHHmmss'
   $tmp = 'tmp' + (-join ($ts.ToCharArray() | ForEach-Object { [char](97 + [int]"$_") })) + '.dot'
   ```

   En macOS o Linux: `tmp="tmp$(date +%Y%m%d%H%M%S | tr '0-9' 'a-j').dot"`.

6. Sube el bundle (tarda de 3 a 4 minutos):

   ```powershell
   pad .\dist $tmp --env devnet --js-merkle --no-manifest
   ```

   Terminó bien si ves `Verified on-chain` y la última línea `CID: bafy…`: ese es el CID raíz. Las
   líneas `bafkrei…` son los trozos. Si dice `pool account N … is not authorized (or its
   authorization expired)`, corre el mismo comando otra vez: se elige otra cuenta del pool.
7. Opcional, sin el Host: `https://<nombre-temporal>.dev-dot.li` muestra el bundle.
8. En la Polkadot App (o en Desktop) abre `dotns.dot` → Profile → tu nombre → Edit, pega el CID en
   `contenthash` y firma en el teléfono. Es la única firma.
9. Abre tu nombre desde el Host y prueba la etapa 5: Conectar, permiso de gas, guardar récord y
   username.

Notas:

- El nombre temporal queda a nombre del worker compartido de `pad` y no se vuelve a usar.
- Nunca le pases tu propio nombre a `pad`: falla porque no es dueño del nombre.
- Cada build nuevo da un CID nuevo; hay que pegarlo otra vez en `contenthash`.
- Cuántas subidas seguidas aguanta el pool con unas 40 personas está **POR VERIFICAR**.

---

## 4. Cómo trabajar cada etapa

Cada etapa tiene un archivo en `prompts/` con lo que vas a tener al terminar, el tiempo estimado, el
prompt en las 5 partes del [capítulo 4](./04-vibe-coding.md#2-anatomía-de-un-prompt), la prueba
manual, los tests que debe agregar, la lista de revisión y el mensaje de commit.

El ciclo es el mismo en las cinco:

1. Pon tu agente en **modo supervisado** ([capítulo 4, sección 9](./04-vibe-coding.md#9-agentes)).
2. Copia el bloque `text` completo de `prompts/etapa-N.md` y pégalo.
3. Revisa el plan antes de que toque archivos. Si propone cambiar algo fuera de `game/src/`, corrígelo.
4. Cuando termine: `pnpm test` y `pnpm build` desde la raíz, y la prueba manual del prompt.
5. `git status` y `git diff`: solo cambios dentro de `game/src/`.
6. Commit con el mensaje del prompt.

Cada etapa terminada también existe como rama del repo original (`etapa-1` … `etapa-5`). Cada una
es la anterior más lo que pide su prompt:

```bash
git switch etapa-3             # mira la solución de la etapa 3 (si tu fork trae las ramas)
git switch -c mi-version       # crea tu propia rama desde ahí y sigue con la etapa 4
git diff etapa-2 etapa-3       # qué agregó exactamente la etapa 3
git switch main                # vuelve a tu trabajo
```

`git switch etapa-3` crea la rama local a partir de `origin/etapa-3` la primera vez. `git diff
etapa-2 etapa-3` necesita las dos ramas locales; si todavía no las tienes, usa `origin/etapa-2` y
`origin/etapa-3`. Que las ramas estén publicadas en el repo original antes del evento está **POR
VERIFICAR**; si tu fork no las trae, usa `upstream` ([sección 14](#14-si-te-atoras)).

---

## 5. Etapa 1 · Polka-Man se mueve

**Objetivo.** Pantalla de título con **JUGAR**, «LISTO», y Polka-Man moviéndose por el laberinto con
flechas o WASD, swipe y D-pad. Gira en los cruces, se detiene en las paredes y cruza el túnel. `P`
pausa y «Seguir» reanuda. Todavía sin orbes ni fantasmas. 25 a 35 minutos.

**Prompt:** [`prompts/etapa-1.md`](../prompts/etapa-1.md). Versión corta:

```text
Objetivo: que Polka-Man se mueva con teclado, swipe y D-pad, con título, "LISTO" y pausa.
Contexto: lee game/AGENTS.md. Agrega a src/engine/rules.ts DT = 1/120, MAX_FRAME_SECONDS = 0.25,
PLAYER_SPEED = 6.0, READY_SECONDS = 1.5, SWIPE_THRESHOLD_PX = 24. Crea src/loop.ts,
src/engine/movement.ts, player.ts, game.ts, src/input/swipe.ts y controls.ts.
Restricciones: no cambies package.json, contrato/, src/contract/, src/hub/ ni src/lib/.
src/engine/ sin DOM ni tiempo real. La pausa automática usa setPaused(state, true), nunca reanuda sola.
Formato de salida: archivos nuevos con sus tests y la lista de archivos que tocaste.
Cómo se comprueba: pnpm test y pnpm build pasan; JUGAR → LISTO → se mueve a la izquierda.
```

**Checks.** JUGAR → «LISTO» → a los 1.5 s avanza a la izquierda. `↑` antes de un cruce gira en el
cruce; `→` a mitad de pasillo da la vuelta al instante. Al cambiar de pestaña queda en PAUSA. En
DevTools a 844 x 390 (teléfono en horizontal) aparece «Gira tu teléfono» a pantalla completa.

**Tests que agrega.** `engine/movement.test.ts` (pasillo, pared, giro guardado, reversa, túnel),
`input/swipe.test.ts` (24 px dispara, 23 no) y `engine/game.test.ts` (fases y pausa).

**Errores comunes de la IA.**

- Pone el aviso «Gira tu teléfono» dentro del escenario. En horizontal el escenario casi no tiene
  alto y el texto queda recortado detrás del HUD y del D-pad. Tiene que ser un elemento propio con
  `position: fixed; inset: 0`.
- Usa `togglePause` para la pausa automática: al volver a la pestaña el juego se reanuda solo.
- Lee `performance.now()` o `Date.now()` dentro de `src/engine/`. El motor solo avanza con `dt`.

**Commit.**

```bash
git add game/src
git commit -m "etapa 1: Polka-Man se mueve"
```

---

## 6. Etapa 2 · Orbes, puntaje y rondas

**Objetivo.** Polka-Man come los orbes (10) y los especiales (50, todavía sin efecto). Arriba hay un
HUD con puntaje, ronda, las 5 vidas y el botón de pausa. Al vaciar el laberinto aparece «RONDA 2» y
los orbes vuelven. 15 a 25 minutos.

**Prompt:** [`prompts/etapa-2.md`](../prompts/etapa-2.md). Versión corta:

```text
Objetivo: comer orbes y especiales, HUD con puntaje, ronda, vidas y pausa, y rondas al vaciar el laberinto.
Contexto: lee game/AGENTS.md. Agrega a rules.ts ORB_POINTS = 10, POWER_POINTS = 50,
ROUND_CLEAR_SECONDS = 1.5. Las vidas del HUD leen LIVES. Crea src/components/Hud.ts.
Restricciones: el estado guarda su propia copia de los orbes; no cambies MAZE ni package.json.
Formato de salida: archivos tocados y cómo probarlo.
Cómo se comprueba: vaciar los 150 orbes da la ronda 2 con 150 orbes y Polka-Man en su inicio.
```

**Checks.** El HUD sube de 10 en 10 al comer. Un orbe comido no vuelve a sumar. El HUD tiene
`aria-label="Vidas: 5"`. Pausar durante «RONDA N» congela el aviso.

**Tests que agrega.** En `engine/game.test.ts`: comer suma, no se come dos veces, vaciar el
laberinto da la ronda 2, pausar en `rondaLimpia` congela el temporizador.

**Errores comunes de la IA.**

- Borra los orbes del arreglo `MAZE` en lugar de una copia en el estado: la ronda 2 empieza vacía.
- Escribe `5` en el HUD en vez de leer `LIVES` de `rules.ts`.

**Commit.**

```bash
git add game/src
git commit -m "etapa 2: orbes, puntaje y rondas"
```

---

## 7. Etapa 3 · Fantasmas y vidas

**Objetivo.** Salen dos fantasmas de la casa del centro, uno al empezar y otro 3 s después, y cada
uno persigue a su manera. Si uno te toca pierdes una vida; al quinto choque aparece el fin con tu
puntaje y «Jugar otra vez». 30 a 40 minutos: es la etapa más larga.

Los fantasmas tienen nombres y colores propios. En la etapa 3 solo salen los dos primeros; los demás
aparecen con la dificultad de la etapa 4.

| # | Nombre | Color | Objetivo |
|---|---|---|---|
| 0 | Bug | `#ff6b4a` | La casilla de Polka-Man |
| 1 | Lag | `#9be7b0` | Donde estaba Polka-Man hace 2 s |
| 2 | Spam | `#ffd479` | Ninguno: en cada cruce elige al azar (con semilla) |
| 3 | Fork | `#7fb8ff` | 4 casillas delante de Polka-Man |
| 4 | Gas | `#c39bff` | Polka-Man si está a más de 6 casillas; si no, su esquina |
| 5 | Nonce | `#5ee0d0` | Recorre las esquinas; si Polka-Man está a 5 o menos, lo persigue |

**Prompt:** [`prompts/etapa-3.md`](../prompts/etapa-3.md). Versión corta:

```text
Objetivo: fantasmas con 6 personalidades (salen 2), choques, 5 vidas y fin de partida.
Contexto: lee game/AGENTS.md. Crea src/engine/rng.ts y ghosts.ts. Agrega a rules.ts
GHOST_BASE_SPEED = 4.0, HITBOX = 0.6, RELEASE_INTERVAL = 3, DEATH_SECONDS = 1.2, LAG_SAMPLES = 8,
LAG_SAMPLE_SECONDS = 0.25, FORK_AHEAD = 4, GAS_RADIUS = 6, NONCE_RADIUS = 5, GHOST_START = 2.
Restricciones: un fantasma en 'normal' nunca da media vuelta; sin Math.random en src/engine/;
ningún fantasma usa el rosa #ff2867.
Formato de salida: archivos tocados y cómo probarlo.
Cómo se comprueba: chocar con un fantasma resta una vida y conserva los orbes; al quinto choque, fin.
```

**Checks.** Sin moverte, las vidas bajan de 5 a 0 y aparece el fin. Bug (naranja) y Lag (verde)
se distinguen del rosa de Polka-Man. «Jugar otra vez» reinicia puntaje, vidas y ronda.

**Tests que agrega.** `engine/ghosts.test.ts` (sin media vuelta, sin entrar a paredes, objetivo de
cada personalidad, salida a los 0 s y 3 s) y casos de choque, vidas y fin en `engine/game.test.ts`.

**Errores comunes de la IA.**

- Usa `Math.random()`: las pruebas dejan de ser repetibles. El azar sale de `rng.ts` con semilla.
- Deja que los fantasmas den media vuelta en un pasillo o que salgan por la puerta de la casa en
  modo normal.
- Copia nombres o colores de un juego conocido. El prompt los fija.

**Commit.**

```bash
git add game/src
git commit -m "etapa 3: fantasmas y vidas"
```

---

## 8. Etapa 4 · Orbes especiales y dificultad

**Objetivo.** Al comer un orbe especial los fantasmas se asustan: dan media vuelta, van más lento y
te los puedes comer (200, 400, 800, 1600). Un fantasma comido regresa a la casa como un par de ojos y
vuelve a salir. La dificultad sube con las fórmulas de la [sección 11](#11-la-dificultad). 25 a 35
minutos.

**Prompt:** [`prompts/etapa-4.md`](../prompts/etapa-4.md). Versión corta:

```text
Objetivo: modo asustado y ojos con la cadena 200/400/800/1600, y la dificultad por ronda.
Contexto: lee game/AGENTS.md. Agrega a rules.ts GHOST_SPEED_GROWTH = 1.05, GHOST_SPEED_CAP = 5.7,
GHOST_MAX = 6, GHOST_EVERY_ROUNDS = 3, FRIGHT_SPEED_FACTOR = 0.5, EYES_SPEED = 12.0,
FRIGHT_BASE_SECONDS = 6, FRIGHT_STEP_SECONDS = 0.5, FRIGHT_MIN_SECONDS = 2, FRIGHT_BLINK_SECONDS = 1.5,
FRIGHT_BLINK_PERIOD = 0.2, GHOST_CHAIN_POINTS = [200, 400, 800, 1600].
ghostSpeed(r) = min(5.7, 4.0 × 1.05^(r−1)); ghostCount(r) = min(6, 2 + floor((r−1)/3));
frightenedSeconds(r) = max(2, 6 − 0.5 × (r−1)).
Restricciones: un solo temporizador de susto por partida; sin números sueltos en ghosts.ts ni game.ts.
Formato de salida: archivos tocados y cómo probarlo.
Cómo se comprueba: rules.test.ts con la tabla exacta; comer dos fantasmas suma 200 + 400.
```

**Checks.** Al comer un especial los fantasmas cambian de color y huyen; parpadean antes de volver
a la normalidad. En la ronda 4 salen 3 fantasmas. Tocar unos ojos no quita vida.

**Tests que agrega.** `engine/rules.test.ts` (la tabla de la sección 11 a 3 decimales, tope en la
ronda 9, nunca tan rápidos como Polka-Man) y casos de susto, cadena, ojos y segundo especial en
`ghosts.test.ts` y `game.test.ts`.

**Errores comunes de la IA.**

- Suma el 5 % sobre la velocidad base en lugar de sobre la ronda anterior (crecimiento lineal en vez
  de compuesto), o no pone el tope. `rules.test.ts` lo detecta.
- Hace que un segundo especial dé media vuelta otra vez a los fantasmas que ya estaban asustados.
- Crea un temporizador de susto por fantasma.

**Commit.**

```bash
git add game/src
git commit -m "etapa 4: orbes especiales y dificultad"
```

---

## 9. Etapa 5 · El marcador compartido

**Objetivo.** El título muestra el top 10 del `Leaderboard`. Dentro del Host conectas tu cuenta,
guardas tu récord al terminar y eliges un username. En un navegador normal ves el ranking y un aviso
para abrir el juego dentro del Host. 30 a 40 minutos, más publicar en tu `.dot` y probar desde el Host
([sección 3](#probar-dentro-del-host-publica-en-tu-dot)).

**Prompt:** [`prompts/etapa-5.md`](../prompts/etapa-5.md). Versión corta:

```text
Objetivo: ranking, conexión de cuenta, guardar récord y username, solo con la API de src/hub/hub.ts.
Contexto: lee game/AGENTS.md. En src/app.ts crea const hub = createHub() una vez y llama hub.start()
sin await. Crea src/components/Conexion.ts, Ranking.ts, FinDePartida.ts (con saveOptions()) y
Username.ts. El HUD muestra "Récord: N" o "Récord: —".
Restricciones: ninguna pantalla llama .tx() ni .query(); solo hub.saveScore y hub.setUsername.
Una firma a la vez (busy). No cambies src/contract/, src/hub/ ni src/lib/.
Formato de salida: archivos tocados, finDePartida.test.ts y cómo probarlo.
Cómo se comprueba: fuera del Host se ve el top 10 y el aviso; dentro, "Guardar récord" pide UNA firma.
```

**Checks.** En el navegador: el top 10 se lee del contrato y en el fin aparece el aviso en lugar del
botón de guardar. Con el juego publicado en tu `.dot` y abierto desde Desktop o la Polkadot App
([sección 3](#probar-dentro-del-host-publica-en-tu-dot)): «Conectar» pide la cuenta y el permiso de
gas; un puntaje mayor a tu récord pide una firma; uno menor dice «No supera tu récord» sin firma. La
prueba completa dentro de Desktop y de la Polkadot App está **POR VERIFICAR**.

**Tests que agrega.** `components/finDePartida.test.ts`: las 7 reglas de `saveOptions()`, su orden
y el estado `disabled` mientras hay una firma en curso.

**Errores comunes de la IA.**

- Llama `.tx()` desde un componente en vez de `hub.saveScore()`: se salta la simulación y la regla de
  una firma a la vez ([capítulo 4, sección 15](./04-vibe-coding.md#15-errores-comunes-de-la-ia-en-este-stack)).
- Copia la dirección del contrato en un componente. Solo vive en `src/contract/config.ts`.
- «Arregla» algo dentro de `src/hub/`. Esa capa ya está probada; si algo falla ahí, pide primero el
  diagnóstico.

**Commit.**

```bash
git add game/src
git commit -m "etapa 5: marcador compartido"
```

---

## 10. El laberinto son datos

El laberinto es un arreglo de 21 textos de 19 caracteres en `game/src/engine/maze.ts`. Se lee a ojo,
la IA lo puede editar sin errores de índice y el diff en git se entiende.

| Carácter | Significado |
|---|---|
| `#` | Pared |
| `.` | Orbe (10 puntos) |
| `o` | Orbe especial (50 puntos, asusta a los fantasmas) |
| ` ` | Pasillo sin orbe |
| `P` | Inicio de Polka-Man |
| `-` | Puerta de la casa de los fantasmas |
| `G` | Interior de la casa |

Una fila cuyo primer y último carácter no son `#` es un túnel: lo que sale por un lado entra por el
otro. El laberinto de la plantilla tiene 146 orbes, 4 especiales y el túnel en la fila 9.

`maze.test.ts` comprueba que todas las casillas se alcanzan desde `P`, que es simétrico y que **no
hay callejones sin salida**: los fantasmas no dan media vuelta, y un callejón los dejaría atrapados.

> **Pídeselo a la IA así:** *"Cambia MAZE en `src/engine/maze.ts` por un laberinto nuevo de 19 x 21,
> simétrico y sin callejones sin salida, con un solo `P`, una sola puerta `-` y 4 orbes especiales.
> No cambies otros archivos. Corre `pnpm test` y arregla el laberinto, no el test."*

---

## 11. La dificultad

| Qué | Fórmula | Constantes en `rules.ts` |
|---|---|---|
| Velocidad de Polka-Man | 6.0 casillas/s, fija | `PLAYER_SPEED` |
| Velocidad de los fantasmas | `min(5.7, 4.0 × 1.05^(ronda − 1))` | `GHOST_BASE_SPEED`, `GHOST_SPEED_GROWTH`, `GHOST_SPEED_CAP` |
| Número de fantasmas | `min(6, 2 + floor((ronda − 1) / 3))` | `GHOST_START`, `GHOST_EVERY_ROUNDS`, `GHOST_MAX` |
| Duración del susto | `max(2, 6 − 0.5 × (ronda − 1))` segundos | `FRIGHT_BASE_SECONDS`, `FRIGHT_STEP_SECONDS`, `FRIGHT_MIN_SECONDS` |
| Fantasma asustado | 50 % de su velocidad de la ronda | `FRIGHT_SPEED_FACTOR` |

El +5 % es compuesto: cada ronda es 5 % más rápida que la anterior. El tope es 5.7 casillas/s (95 %
de Polka-Man) y se alcanza en la ronda 9: con control táctil, un fantasma igual de rápido que el
jugador haría imposible escapar en una recta.

| Ronda | Fantasmas | Velocidad (casillas/s) | Susto (s) |
|---|---|---|---|
| 1 | 2 | 4.000 | 6.0 |
| 2 | 2 | 4.200 | 5.5 |
| 3 | 2 | 4.410 | 5.0 |
| 4 | 3 | 4.631 | 4.5 |
| 5 | 3 | 4.862 | 4.0 |
| 6 | 3 | 5.105 | 3.5 |
| 7 | 4 | 5.360 | 3.0 |
| 8 | 4 | 5.628 | 2.5 |
| 9 | 4 | 5.700 (tope) | 2.0 |
| 10 a 12 | 5 | 5.700 | 2.0 |
| 13 en adelante | 6 | 5.700 | 2.0 |

Para cambiar la dificultad, cambia las constantes, no las fórmulas, y actualiza la tabla de
`rules.test.ts` en el mismo commit.

---

## 12. El marcador compartido

Todas las apps del hackatón usan **el mismo contrato `Leaderboard`**. No hay un ranking por app: el
contrato guarda un récord por cuenta, y cualquier app que conozca su dirección y su ABI lo puede leer
y escribir. Esto es composabilidad: tu juego, el de un compañero y un script cualquiera hablan con
el mismo contrato, que es quien hace cumplir las reglas (solo sube un puntaje mayor, el username es
único) ([capítulo 3, sección 7](./03-smart-contracts.md#7-quién-llama)).

La dirección vive en un solo lugar, `game/src/contract/config.ts`:

```ts
export const LEADERBOARD_ADDRESS = '0xa2625aa8e8790a3322acd045b32f67fba1808542' as const;
```

Es un despliegue de prueba en el devnet (chainId `420420417`). Cuando se publique la dirección
oficial del hackatón, se cambia esa línea y nada más; `leaderboard.test.ts` falla si la dirección
aparece copiada en otro archivo. La dirección oficial está **POR VERIFICAR**. Si quieres tu propio
ranking, despliega tu contrato ([capítulo 3, sección 17](./03-smart-contracts.md#17-despliégalo)) y
pon su dirección ahí.

Consecuencias que vas a ver:

- **Cada app te ve como otra cuenta.** En tu `.dot`, en un `.dot` temporal y en el `.dot` de un
  compañero eres un jugador distinto, con su propio récord
  ([capítulo 3, sección 16](./03-smart-contracts.md#16-tus-tres-cuentas)).
- **El username es único en todo el contrato.** Si alguien ya tomó `ana` en otra app, tú no puedes
  usarlo en la tuya.
- **El contrato no sabe si el puntaje es legítimo.** Cualquiera puede llamar `submitScore` sin jugar
  ([capítulo 3, sección 10](./03-smart-contracts.md#10-lo-que-un-contrato-no-puede-saber)).

---

## 13. Guardar tu récord

`src/hub/hub.ts` hace todo el trabajo y ya está probado. Lo que pasa al tocar «Guardar récord»:

1. **Simula** con `submitScore.query()`. Si el contrato lo va a rechazar, muestra el motivo y **no
   pide firma** ([capítulo 3, sección 15](./03-smart-contracts.md#15-simular-antes-de-enviar)).
2. **Pide una sola firma** con `.tx()`. Mientras firmas, los botones quedan deshabilitados: el Host
   atiende una firma a la vez.
3. **Relee** `bestScore` hasta 3 veces, porque el ETH-RPC puede ir un bloque atrás.

El gas se paga en PGAS. Al conectar, la app pide el permiso `SmartContractAllowance`
([skill, `app-sdk.md`](https://github.com/BrandonFilth/polkadot-products-devnet/blob/main/skills/polkadot-products-devnet/references/app-sdk.md)).
Qué muestra la app según la respuesta:

| Respuesta al permiso de gas | Qué ves |
|---|---|
| Aceptado | La cuenta queda conectada, sin mensaje de error |
| Rechazado | «Rechazaste el permiso de gas. Sin él no puedes guardar; toca Conectar otra vez.» La cuenta queda conectada |
| No disponible (`NotAvailable`) o sin respuesta en 90 s | «Cuenta conectada. El gas se pedirá al guardar.» |

En el último caso la cuenta sí queda conectada. Si al guardar la firma falla por falta de gas, la
app vuelve a pedir el permiso una vez y reintenta.

Otros mensajes:

| Situación | Mensaje |
|---|---|
| Abriste el juego fuera del Host | «Abre Polka-Man dentro de Polkadot Desktop o de la Polkadot App para guardar tu récord. Aquí puedes jugar y ver el ranking.» |
| Hay una firma en curso | «Espera a que termine la firma en curso.» |
| Sin cuenta | «Conecta tu cuenta primero.» |
| El puntaje no supera tu récord | «No supera tu récord» (sin firma) |
| El contrato aceptó, pero el RPC todavía no lo refleja | «Récord enviado. Puede tardar unos segundos en aparecer.» |
| Username inválido | El mensaje de `InvalidUsername`, sin firma |

Fuentes: `game/src/hub/hub.ts`, `game/src/lib/txErrors.ts` y
[`errores-comunes.md`](https://github.com/BrandonFilth/polkadot-products-devnet/blob/main/skills/polkadot-products-devnet/references/errores-comunes.md)
de la skill. El comportamiento de los permisos dentro de Desktop 0.1.3 y de la Polkadot App está
**POR VERIFICAR**.

---

## 14. Si te atoras

Cada etapa tiene su solución en la rama `etapa-N` del repo original, que `gh repo fork --clone` dejó
como `upstream` ([capítulo 2, paso 9](./02-entorno.md#paso-9--haz-fork-clónalo-y-verifica-todo)).
Para traer la carpeta `game/` de una etapa a tu rama, sin tocar lo demás:

```bash
git fetch upstream
git diff upstream/etapa-3 -- game          # mira la diferencia sin cambiar nada
git restore --source=upstream/etapa-3 --staged --worktree -- game
git commit -m "Etapa 3 desde la rama de respaldo"
```

`git restore` con una ruta deja `game/` igual a la etapa: también borra los archivos versionados que
la rama no tiene. Los archivos sin versionar se quedan. Después sigues con el prompt de la etapa
siguiente.

---

## 15. Problemas comunes

<details>
<summary><b>Problemas comunes</b></summary>

- **`pnpm dev` dice que el puerto 5173 está ocupado.** El servidor usa `strictPort`: no se cambia
  solo de puerto, para que la URL del navegador siempre sea `http://127.0.0.1:5173`. Cierra la otra
  terminal que corre `pnpm dev`.
- **El D-pad no aparece en la PC.** Es a propósito: solo se muestra en pantallas táctiles
  (`pointer: coarse`). En DevTools activa la barra de dispositivos con un teléfono.
- **El ranking no carga.** Las lecturas van por el ETH-RPC del devnet
  (`https://eth-rpc-testnet.polkadot.io`). Revisa tu conexión y toca «Reintentar». `pnpm test:red`
  te dice si el contrato responde.
- **No puedo guardar desde el navegador.** Guardar necesita el Host: publica el juego en tu `.dot` y
  ábrelo desde Polkadot Desktop o la Polkadot App
  ([sección 3](#probar-dentro-del-host-publica-en-tu-dot)). El Host no se conecta a `localhost`.
- **La IA cambió `package.json`, `pnpm-lock.yaml` o `pnpm-workspace.yaml`.** Descarta esos cambios
  con `git restore package.json pnpm-lock.yaml pnpm-workspace.yaml game/package.json` y pídele que no
  los toque ([capítulo 4, sección 15](./04-vibe-coding.md#15-errores-comunes-de-la-ia-en-este-stack)).
- **Los tests de una etapa anterior fallan después de un prompt.** No dejes que la IA los borre o
  los salte. Pídele la causa y que corrija el código.

</details>

---

👉 [Capítulo 6 · Publica tu app](./06-publicar.md)
