# Fase 2 · Laberinto y movimiento

Al terminar ves tu laberinto y mueves al personaje con teclado, swipe o un joystick flotante
que aparece donde pones el pulgar y entiende diagonales, con un botón redondo de pausa.
30 a 35 minutos.

## Antes de pedir

- ¿Qué tamaño tiene tu laberinto y cómo lo quieres editar? (p. ej. "19 x 21, escrito como texto,
  igual que la muestra").
- ¿Con qué se mueve? (p. ej. "flechas en la PC; en el celular, swipe y un joystick flotante:
  aparece donde pones el dedo en la zona de abajo y lo sigue, con diagonales; botón redondo
  de pausa a la derecha").
- Si el jugador pide girar antes de llegar a un cruce, ¿qué pasa? (p. ej. "gira al llegar").
- ¿Hay túnel para salir por un lado y entrar por el otro? (p. ej. "sí, uno en medio").

Escribe tus respuestas en `SPEC.md`.

## El prompt

```text
Lee SPEC.md (y el spec de esta parte si existe) y AGENTS.md.
Dibuja el laberinto en el canvas y mueve al personaje con los controles de SPEC.md:
se detiene en las paredes y gira en los cruces.
En el celular, un joystick flotante en la zona de abajo: aparece donde tocas, la base sigue
al dedo si te alejas y entiende diagonales (arriba y a la derecha gira a la derecha en el
primer cruce). Al soltar se desvanece y el personaje sigue hasta la pared. Vibra un poco al
cambiar de dirección si se puede y muestra «Toca y arrastra» en la primera ronda. La página
no se mueve al arrastrar y otro dedo puede tocar la pausa, un botón redondo a la derecha.
Si cambias de pestaña, se pausa y no sigue solo. Todavía sin bolitas ni fantasmas.
Los números van en el archivo de reglas.
Si te falta algo, pregúntame antes de escribir código.
Primero dime tu plan.
```

## Si no sabes

```text
No sé cómo conviene guardar el laberinto en el código. Dame 2 o 3 opciones con pros y
contras para un principiante que lo quiere editar a mano, recomiéndame una y no escribas
código.
```

```text
No sé qué control táctil conviene en el celular. Compárame con pros y contras: joystick
flotante (aparece donde tocas), joystick fijo en una esquina, cruceta de botones y solo
deslizar sobre el laberinto. Piensa en el pulgar que se sale del control y en las diagonales.
Recomiéndame uno y no escribas código.
```

Lo que suele salir: el joystick flotante no se pierde aunque el pulgar se mueva, pero no se ve
hasta que tocas (por eso la pista); el fijo se ve siempre, pero el pulgar se sale de él; la
cruceta es clara, pero no da diagonales; solo deslizar no tapa nada, pero cuesta encadenar giros.

## Al terminar, revisa

- El personaje se detiene en las paredes y no las atraviesa.
- Si pides girar un poco antes del cruce, gira en el cruce.
- En DevTools, con la vista de celular, aparecen la pista «Toca y arrastra» y el botón de pausa,
  y el swipe funciona.
- El joystick aparece donde pones el pulgar.
- Si el dedo sale del círculo no pierdes el control: la base te sigue.
- En diagonal gira en cuanto hay camino: casi arriba y un poco a la derecha, gira a la derecha
  en el siguiente cruce.
- Al soltar, el personaje sigue hasta la pared.
- Con un dedo en el joystick puedes tocar la pausa con otro.
- La página no se mueve al arrastrar.
- Al cambiar de pestaña el juego queda en pausa y no se reanuda solo al volver.

```text
Escribe tests para estos casos: el personaje no entra a una pared, gira en un cruce, el
juego queda en pausa al cambiar de pestaña, el joystick aparece donde tocas, cerca del
centro no da dirección y la base sigue al dedo cuando se aleja. Después dime 3 casos raros
que no consideré.
```

Revisa el `git diff` ([capítulo 4, sección 14](../contenido/04-vibe-coding.md#14-cómo-supervisar-a-la-ia))
y usa el [prompt 1 de `revision.md`](./revision.md#1-qué-decidió-la-ia).

```bash
git add .
git commit -m "fase 2: laberinto y movimiento"
git push
```
