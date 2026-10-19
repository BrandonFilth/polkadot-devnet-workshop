# Fase 2 · Laberinto y movimiento

Al terminar ves tu laberinto y mueves al personaje con teclado, swipe o D-pad, con pausa.
30 a 35 minutos.

## Antes de pedir

- ¿Qué tamaño tiene tu laberinto y cómo lo quieres editar? (p. ej. "19 x 21, escrito como texto,
  igual que la muestra").
- ¿Con qué se mueve? (p. ej. "flechas en la PC; swipe y D-pad en el celular").
- Si el jugador pide girar antes de llegar a un cruce, ¿qué pasa? (p. ej. "gira al llegar").
- ¿Hay túnel para salir por un lado y entrar por el otro? (p. ej. "sí, uno en medio").

Escribe tus respuestas en `SPEC.md`.

## El prompt

```text
Lee SPEC.md (y el spec de esta parte si existe) y AGENTS.md.
Dibuja el laberinto en el canvas y haz que el personaje se mueva por él con los controles
de SPEC.md. Debe detenerse en las paredes y girar en los cruces.
Agrega un botón de pausa. Si el jugador cambia de pestaña, el juego se pausa y no se
reanuda solo.
Todavía sin bolitas ni fantasmas.
Si te falta algún dato o hay que decidir algo que no está en SPEC.md, pregúntame antes de
escribir código.
Primero dime tu plan.
```

## Si no sabes

```text
No sé cómo conviene guardar el laberinto en el código. Dame 2 o 3 opciones con pros y
contras para un principiante que lo quiere editar a mano, recomiéndame una y no escribas
código.
```

## Al terminar, revisa

- El personaje se detiene en las paredes y no las atraviesa.
- Si pides girar un poco antes del cruce, gira en el cruce.
- En DevTools, con la vista de celular, aparece el D-pad y el swipe funciona.
- Al cambiar de pestaña el juego queda en pausa y no se reanuda solo al volver.

```text
Escribe tests para estos casos: el personaje no entra a una pared, gira en un cruce y el
juego queda en pausa al cambiar de pestaña. Después dime 3 casos raros que no consideré.
```

Revisa el `git diff` ([capítulo 4, sección 14](../contenido/04-vibe-coding.md#14-cómo-supervisar-a-la-ia))
y usa el [prompt 1 de `revision.md`](./revision.md#1-qué-decidió-la-ia).

```bash
git add .
git commit -m "fase 2: laberinto y movimiento"
git push
```
