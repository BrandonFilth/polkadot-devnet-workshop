# Fase 6 · Tu contrato y el ranking

Al terminar tu juego muestra el top 10 de **tu** contrato `Leaderboard`, leído de la red, con
estado vacío y error con "Reintentar". 25 a 30 minutos (5 más si despliegas otra vez).

## Antes de pedir

- ¿Reusas el contrato que desplegaste en el capítulo 3 o despliegas uno nuevo? (p. ej. "uno nuevo,
  para empezar con el ranking vacío").
- ¿Qué muestra cada fila del ranking? (p. ej. "posición, username o dirección corta, y puntaje").
- ¿Qué se ve si el ranking está vacío o si no hay red? (p. ej. "Todavía no hay récords" y un botón
  "Reintentar").

Escribe tus respuestas en `SPEC.md`.

Antes del prompt, a mano:

1. Copia `contrato/Leaderboard.sol` del curso a una carpeta `contrato/` de tu repo.
2. Pega la ABI que copiaste de Remix en `src/contract/leaderboard.abi.json` de tu repo.
3. Ten a mano la dirección de tu contrato. Si no guardaste la dirección o la ABI, despliégalo otra
   vez con el [capítulo 3, sección 17](../contenido/03-smart-contracts.md#17-despliégalo).

Si en el capítulo 3 llamaste `submitScore(1240)` desde MetaMask, esa cuenta ya aparece en tu ranking:
es otro jugador ([capítulo 3, sección 16](../contenido/03-smart-contracts.md#16-tus-tres-cuentas)).

## El prompt

```text
Lee SPEC.md (y el spec de esta parte si existe) y AGENTS.md.
Usa la skill polkadot-products-devnet.
Mi contrato Leaderboard está en la dirección <tu-dirección> y su ABI está en
src/contract/leaderboard.abi.json.
En la pantalla de título muestra el top 10 leyendo mi contrato por la red, como dice
SPEC.md, con su estado vacío y un error con "Reintentar" si no hay red.
La dirección debe vivir en un solo archivo.
Si te falta algún dato o hay que decidir algo que no está en SPEC.md, pregúntame antes de
escribir código.
Primero dime tu plan.
```

## Si no sabes

```text
No sé cómo mostrar un ranking vacío o con error. Dame 2 o 3 opciones con pros y contras
para un celular, recomiéndame una y no escribas código.
```

## Al terminar, revisa

- Con `pnpm dev`, el top 10 se lee de **tu** contrato (compara con lo que ves en Remix).
- Con un contrato nuevo se ve el estado vacío.
- Sin red (desconecta el wifi) aparece el error con "Reintentar", y al volver la red funciona.
- La dirección de tu contrato aparece en un solo archivo (búscala en el proyecto).

```text
Escribe tests para estos casos: ranking vacío, ranking con 3 filas en orden y error de red
con Reintentar. Usa datos de prueba, sin la red real. Después dime 3 casos raros que no
consideré.
```

Revisa el `git diff` ([capítulo 4, sección 14](../contenido/04-vibe-coding.md#14-cómo-supervisar-a-la-ia))
y usa el [prompt 1 de `revision.md`](./revision.md#1-qué-decidió-la-ia).

```bash
git add .
git commit -m "fase 6: ranking de mi contrato"
git push
```
