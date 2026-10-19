# Fase 5 · Bolitas especiales y dificultad

Al terminar las bolitas especiales asustan a los fantasmas y el juego se pone más difícil en cada
ronda, con un tope. 25 a 35 minutos.

## Antes de pedir

- ¿Cuánto dura el susto? (p. ej. "6 segundos y menos en cada ronda").
- ¿Cuánto vale comerse un fantasma asustado? (p. ej. "200, y el doble por cada uno seguido").
- ¿Cómo sube la dificultad y dónde se detiene? (p. ej. "fantasmas 5 % más rápidos cada ronda,
  hasta la ronda 9; siempre más lentos que el jugador").

Escribe tus respuestas en `SPEC.md`.

## El prompt

```text
Lee SPEC.md (y el spec de esta parte si existe) y AGENTS.md.
Agrega las bolitas especiales. Al comer una, los fantasmas se asustan por un tiempo: huyen
y el personaje se los puede comer. Un fantasma comido regresa a su casa y vuelve a salir.
Haz que la dificultad suba en cada ronda como dice SPEC.md, con su tope.
Si te falta algún dato o hay que decidir algo que no está en SPEC.md, pregúntame antes de
escribir código.
Primero dime tu plan.
```

## Si no sabes

```text
No sé cómo debería subir la dificultad. Dame 3 opciones concretas, con números
(por ejemplo "un fantasma más cada 3 rondas, hasta 6"), cada una con un pro y un
contra para un juego de celular. Recomiéndame una y no escribas código.
```

## Al terminar, revisa

- Comer una segunda bolita especial no hace cosas raras a los fantasmas que ya estaban asustados.
- En la ronda que dice `SPEC.md`, sale un fantasma más.
- Tocar a un fantasma que ya fue comido (regresando a su casa) no quita vida.
- Después de muchas rondas, los fantasmas siguen siendo más lentos que tú.

```text
Escribe tests para estos casos: la dificultad de cada ronda coincide con SPEC.md, el tope
se respeta y comer dos fantasmas seguidos suma lo que dice SPEC.md.
Después dime 3 casos raros que no consideré.
```

Revisa el `git diff` ([capítulo 4, sección 14](../contenido/04-vibe-coding.md#14-cómo-supervisar-a-la-ia))
y usa el [prompt 1 de `revision.md`](./revision.md#1-qué-decidió-la-ia).

```bash
git add .
git commit -m "fase 5: bolitas especiales y dificultad"
git push
```
