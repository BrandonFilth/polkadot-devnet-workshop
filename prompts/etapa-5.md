# Etapa 5 · El marcador compartido

## Qué vas a tener al terminar

La pantalla de título muestra el top 10 del `Leaderboard` que comparten todas las apps del
hackatón. Dentro de Polkadot Desktop o de la Polkadot App conectas tu cuenta, guardas tu récord al
terminar una partida (la app simula primero y solo pide firma si de verdad supera tu récord) y
eliges un username. En un navegador normal ves el ranking y un aviso de que para guardar tienes que
abrir el juego dentro del Host.

Captura descrita: título «POLKA-MAN», botón JUGAR y debajo la tabla «TOP 10» con posición,
username (o dirección corta) y puntaje; arriba, el aviso «Abre Polka-Man dentro de Polkadot Desktop
o de la Polkadot App para guardar tu récord. Aquí puedes jugar y ver el ranking.»

## Tiempo estimado

30 a 40 minutos, más la prueba dentro de Polkadot Desktop.

## El prompt

```text
Objetivo: conectar el juego al contrato Leaderboard compartido: ranking en el título y en el fin,
conexión de cuenta, guardar récord y username. Solo con la API que ya existe en src/hub/hub.ts.

Contexto:
- Lee primero game/AGENTS.md y respétalo.
- El juego completo ya existe (motor, fantasmas, HUD, overlays). La capa del contrato ya está hecha
  y probada: src/contract/ (config.ts con LEADERBOARD_ADDRESS y ETH_RPC_URL, ranking.ts con
  shortAddress), src/lib/username.ts (isValidUsername), src/contract/errors.ts
  (INVALID_USERNAME_MESSAGE) y src/hub/hub.ts. Úsala; no la modifiques.
- API de src/hub/hub.ts (léela en el archivo):
    type HostPhase = 'buscando' | 'fuera' | 'conectando' | 'listo' | 'error';
    interface HubState { host: HostPhase; message: string;
      account: { h160: `0x${string}`; ss58: string } | null;
      allowance: 'Allocated' | 'Rejected' | 'NotAvailable' | null; busy: boolean }
    type Result = { ok: true; message: string } | { ok: false; message: string; details?: string };
    interface RankingRow { address: `0x${string}`; username: string; score: bigint; mine: boolean }
    interface Hub { getState(); subscribe(listener) => unsubscribe; start(); connect(): Promise<Result>;
      readTop(limit = 10): Promise<RankingRow[]>;
      readMine(): Promise<{ best: bigint; username: string } | null>;   // null = sin cuenta; lanza si la lectura falla
      saveScore(score: number): Promise<Result>; setUsername(name: string): Promise<Result> }
    createHub(): Hub
  saveScore y setUsername ya simulan con .query() antes de firmar, permiten una sola firma a la vez
  (busy) y releen el contrato. Ninguna pantalla llama .query() ni .tx() directamente.
- Arranque (src/app.ts): crea const hub = createHub() una sola vez y llama hub.start() sin await
  (el juego no espera al Host).
- Récord del jugador: src/app.ts es el dueño de un único valor
  mine: { best: bigint; username: string } | null | 'error'.
  Lo relee con hub.readMine() cuando HubState.account pasa de null a una cuenta, al entrar a 'fin'
  con cuenta y tras cada saveScore o setUsername con ok:true. Mientras lee, mine = null; si resuelve,
  mine = r ?? { best: 0n, username: '' }; si lanza, mine = 'error'. El HUD, FinDePartida y el botón
  Username leen ese valor.
- Componentes nuevos en src/components/:
  1. Conexion.ts: se suscribe con hub.subscribe una vez (vive toda la sesión). Muestra el estado del
     Host y hub.getState().message; botón "Conectar" (llama hub.connect() y muestra el message del
     Result) cuando host = 'listo' y no hay cuenta; botón "Reintentar" (hub.start()) cuando
     host = 'error'; con host = 'fuera' muestra el aviso: "Abre Polka-Man dentro de Polkadot Desktop
     o de la Polkadot App para guardar tu récord. Aquí puedes jugar y ver el ranking."
  2. Ranking.ts: top 10 con posición, username (o shortAddress(address) si está vacío) y puntaje; la
     fila con mine = true resaltada; estados "Cargando…", vacío ("Todavía no hay récords") y error
     (el mensaje y un botón "Reintentar" que vuelve a llamar hub.readTop()). Se muestra en el título
     y en el fin. El título llama hub.readTop() al mostrarse (una vez por sesión: el juego no
     regresa a 'titulo'); el fin lo llama al entrar a 'fin'; también se relee tras cada escritura
     con ok:true.
  3. FinDePartida.ts: en el overlay de 'fin' muestra puntaje, récord, el botón que decide
     saveOptions() y el message del último Result. "Jugar otra vez" queda deshabilitado mientras
     hub.getState().busy. Exporta esta función pura:
       export type SaveOption = 'fuera' | 'conectar' | 'cero' | 'cargando' | 'guardar' | 'no-supera';
       export function saveOptions(i: { host: HostPhase; connected: boolean; score: number;
         best: bigint | null | 'error'; busy: boolean }): { option: SaveOption; disabled: boolean };
     best = null mientras se lee mine, 'error' si falló, si no mine.best. Reglas en este orden (gana
     la primera que aplica):
       1. score === 0          → 'cero'      "No supera tu récord" (sin botón)
       2. host === 'fuera'     → 'fuera'     el aviso de fuera del Host (sin botón)
       3. !connected           → 'conectar'  botón "Conecta para guardar" (hub.connect())
       4. best === null        → 'cargando'  botón "Leyendo tu récord…" siempre deshabilitado
       5. best === 'error'     → 'guardar'   botón "Guardar récord" (hub.saveScore(score)); es seguro
                                             porque saveScore simula antes de firmar
       6. BigInt(score) > best → 'guardar'   botón "Guardar récord" (hub.saveScore(score))
       7. en otro caso         → 'no-supera' "No supera tu récord" (sin botón)
     disabled = busy en las filas con botón (la 4 siempre true); en las demás false.
     Tras un saveScore con ok:true y mine.username === '', muestra un enlace "Ponle nombre a tu
     récord" que abre el modal de Username.
  4. Username.ts: modal con un <input> que pasa a minúsculas al escribir; valida con
     isValidUsername antes de enviar (si no pasa, muestra INVALID_USERNAME_MESSAGE sin llamar al
     Hub); envía con hub.setUsername(name); se cierra solo con ok:true; con ok:false muestra el
     message y conserva el texto. Foco atrapado dentro del modal y Escape lo cierra.
- En el título, con cuenta conectada, un botón "Username" muestra el actual (mine.username) o
  "Elige un username" si está vacío, y abre el modal. Sin cuenta el botón no aparece.
- src/components/Hud.ts: agrega "Récord: N" con mine.best; "Récord: —" si no hay cuenta, si
  mine es null o 'error'.
- src/input/controls.ts: en 'fin', Enter y Espacio no hacen nada mientras hub.getState().busy.
- Los overlays ya se pueden desplazar (.overlay tiene overflow-y: auto): el top 10 y el modal deben
  caber en un teléfono de 390 x 667 desplazando.

Restricciones:
- No cambies package.json, game/package.json, pnpm-lock.yaml, pnpm-workspace.yaml, contrato/,
  src/contract/, src/hub/ ni src/lib/. No instales dependencias.
- Nunca llames .tx() ni .query() desde una pantalla: solo hub.saveScore y hub.setUsername. Una firma
  a la vez: respeta busy.
- La dirección del contrato solo vive en src/contract/config.ts. Ninguna URL nueva: sin fetch, CDNs,
  <link>, @import ni url() hacia http(s)://.
- src/engine/ sigue sin DOM. No cambies el laberinto ni los números de rules.ts.
- No borres, saltes ni desactives tests; los de las etapas 1 a 4 siguen pasando.
- Nunca pidas, leas ni muestres frases de recuperación, llaves privadas o archivos .env.

Formato de salida: crea src/components/Conexion.ts, Ranking.ts, FinDePartida.ts, Username.ts y
src/components/finDePartida.test.ts; edita src/app.ts, src/components/Hud.ts,
src/components/Overlay.ts, src/input/controls.ts y src/styles.css. Al final dime qué archivos
tocaste y cómo probarlo.

Cómo se comprueba:
- src/components/finDePartida.test.ts: las 7 filas de saveOptions; la precedencia (score 0 fuera
  del Host → 'cero'; !connected con best null → 'conectar'; best 'error' con score > 0 →
  'guardar'); disabled = busy en las filas con botón y 'cargando' siempre deshabilitado.
- Desde la raíz, pnpm test y pnpm build pasan.
- pnpm dev, http://127.0.0.1:5173 en un navegador normal: el título muestra el top 10 leído del
  contrato y el aviso de fuera del Host; al terminar una partida aparece el aviso en lugar del botón.
- Dentro de Polkadot Desktop (http://localhost:5173): Conectar pide la cuenta y el permiso de gas;
  al terminar con un puntaje mayor a tu récord, "Guardar récord" pide UNA firma en el teléfono y el
  ranking se recarga.
```

## Prueba manual

1. `pnpm dev` y abre `http://127.0.0.1:5173` en Chrome.
2. Fuera del Host: ves el top 10 (puede incluir `prueba_ok` con 1240) y el aviso «Abre Polka-Man
   dentro de Polkadot Desktop…». Juega y pierde: el fin muestra el ranking y el aviso, sin botón de
   guardar.
3. Celular en DevTools (390 x 667): el top 10 se puede desplazar dentro del overlay.
4. Dentro de Polkadot Desktop, abre `http://localhost:5173` (capítulo 2). Toca «Conectar»: el
   teléfono pide la cuenta y el permiso de gas.
5. Juega y termina con más puntos que tu récord: «Guardar récord» pide una firma. Mientras firmas,
   «Jugar otra vez» y Enter no hacen nada. Al terminar, el ranking y el HUD muestran tu récord.
6. Termina con menos puntos: «No supera tu récord», sin firma.
7. Toca «Username», escribe `Ana`: el campo lo pasa a `ana`. Prueba `a`: mensaje de 3 a 16
   caracteres sin firma. Un username válido pide una firma y aparece en el ranking.

Publicar el juego en tu nombre `.dot` es el capítulo 6.

## Tests automáticos que debe agregar

`game/src/components/finDePartida.test.ts`: las 7 filas de `saveOptions()`, su precedencia
(`cero` antes que `fuera`, `conectar` antes que `cargando`, `'error'` → `guardar`) y `disabled`
según `busy`.

## Revísalo antes del commit

- [ ] `pnpm test` y `pnpm build` pasan; siguen los tests de las etapas 1 a 4.
- [ ] Ningún archivo nuevo llama `.tx()` ni `.query()`: busca `\.tx(` y `\.query(` fuera de
      `src/contract/` y `src/hub/`.
- [ ] `createHub()` se llama una sola vez, en `app.ts`.
- [ ] No hay direcciones `0x…` ni URLs nuevas fuera de `src/contract/config.ts`.
- [ ] `git status` solo muestra cambios dentro de `game/src/`.

## Mensaje de commit

```bash
git add game/src
git commit -m "etapa 5: marcador compartido"
```

## Si te atoras

```bash
git fetch upstream
git diff upstream/etapa-5 -- game
git restore --source=upstream/etapa-5 --staged --worktree -- game
git commit -m "Etapa 5 desde la rama de respaldo"
```
