# Fase 8 · Guarda tu récord

Al terminar, dentro del Host conectas tu cuenta y guardas tu récord en tu contrato con una firma.
30 a 40 minutos, más republicar.

## Antes de pedir

Ten a mano tu dominio `.dot` de la fase 7.

- ¿Cuándo ofreces "Guardar récord"? (p. ej. "solo si el puntaje supera mi récord").
- ¿Qué pasa si el jugador rechaza la firma o el permiso de gas? (p. ej. "un mensaje claro y puede
  intentar otra vez").
- ¿Qué ve alguien que abre el juego fuera del Host? (p. ej. "puede jugar y ver el ranking, y un
  aviso para abrirlo en la Polkadot App").
- ¿Qué ve el jugador mientras guarda? (p. ej. "un popup encima del fin: Simulando → Firma en tu
  teléfono → Enviando → Confirmando → Actualizando → Listo, o el error y Cerrar").

Escribe tus respuestas en `SPEC.md`.

## El prompt

```text
Lee SPEC.md (y el spec de esta parte si existe) y AGENTS.md. Usa la skill
polkadot-products-devnet. Mi dominio .dot es <tu-dominio>.dot. Agrega un botón para conectar la cuenta del Host, pide
el permiso de gas y, en la pantalla de fin, guarda el récord en mi contrato como dice
SPEC.md: primero simula, luego pide una sola firma y vuelve a leer el récord.
Mientras guarda, muestra en un popup encima de la pantalla de fin en qué paso va, solo con
pasos que de verdad pasaron.
El proyecto de muestra en ../polkadot-devnet-workshop/game ya resuelve esto: léelo para
entender el flujo, pero escribe el mío y no copies código.
Si te falta algún dato o hay que decidir algo que no está en SPEC.md, pregúntame antes de
escribir código.
Primero dime tu plan.
```

## Si no sabes

```text
No sé cómo explicarle al jugador que hace falta una firma. Dame 3 textos cortos con pros
y contras para alguien que nunca ha usado una wallet, recomiéndame uno y no escribas código.
```

## Al terminar, revisa

Republica con el ciclo de la fase 7 (`pnpm build` → `pad` → Profile → Resolve → Save) y prueba
dentro del Host. Repítelo cada vez que cambies algo:

- Un puntaje mayor a tu récord pide **una** firma; uno menor no pide firma.
- Mientras firmas, los botones quedan deshabilitados.
- Los pasos salen en un popup aparte, encima del fin, y el fin queda bloqueado hasta Cerrar.
- Después de guardar, el ranking muestra tu nuevo récord (puede tardar unos segundos).
- Si rechazas la firma o el permiso de gas, ves un mensaje claro y puedes intentar otra vez.
- En un navegador normal (`pnpm dev`) ves el aviso de abrirlo en el Host, no un error.

```text
Escribe tests para estos casos: puntaje menor no ofrece guardar, botones deshabilitados
mientras hay una firma y mensaje al rechazar la firma. Usa datos de prueba, sin la red
real. Después dime 3 casos raros que no consideré.
```

Revisa el `git diff` ([capítulo 4, sección 14](../contenido/04-vibe-coding.md#14-cómo-supervisar-a-la-ia))
y usa el [prompt 1 de `revision.md`](./revision.md#1-qué-decidió-la-ia). Si te atoras, sigue la
escalera de la [guía, sección 11](../contenido/05-el-juego.md#11-si-te-atoras-y-problemas-comunes).

```bash
git add .
git commit -m "fase 8: guardar récord"
git push
```

## Si te sobra tiempo: username

Reto opcional: que el jugador elija un username que aparece en el ranking en lugar de su dirección.

Antes de pedir: el contrato acepta de 3 a 16 caracteres, solo `a-z`, `0-9` y `_`, y cada username
es único. ¿Qué ve el jugador si el nombre ya está tomado? (p. ej. "Ese username ya existe, prueba
otro").

```text
Lee SPEC.md (y el spec de esta parte si existe) y AGENTS.md.
Agrega un botón para elegir username, con las reglas de mi
contrato. Revisa el nombre antes de pedir la firma y simula antes de enviar.
Si te falta algún dato, pregúntame antes de escribir código. Primero dime tu plan.
```
