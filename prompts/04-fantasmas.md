# Fase 4 · Fantasmas y vidas

Al terminar hay fantasmas que te persiguen, pierdes vidas al chocar y aparece una pantalla de fin
con "Jugar otra vez". 30 a 40 minutos.

## Antes de pedir

- ¿Cuántos fantasmas salen y cómo persigue cada uno? (p. ej. "2; uno va directo a ti y otro a
  donde estabas hace un momento").
- ¿Cuántas vidas tienes? (p. ej. "3").
- Al chocar, ¿se conservan las bolitas que ya comiste? (p. ej. "sí, solo vuelves al inicio").
- ¿Qué muestra la pantalla de fin? (p. ej. "tu puntaje y el botón Jugar otra vez").

Escribe tus respuestas en `SPEC.md`.

## El prompt

```text
Lee SPEC.md (y el spec de esta parte si existe) y AGENTS.md.
Agrega los fantasmas que dice SPEC.md, cada uno con su forma de perseguir.
Si un fantasma toca al personaje, se pierde una vida. Sin vidas, aparece la pantalla de
fin con el puntaje y un botón "Jugar otra vez" que reinicia todo.
Los fantasmas deben verse distintos del personaje.
Si te falta algún dato o hay que decidir algo que no está en SPEC.md, pregúntame antes de
escribir código.
Primero dime tu plan.
```

## Si no sabes

```text
No sé cómo hacer que cada fantasma persiga distinto. Dame 3 formas sencillas con pros y
contras para un juego de celular, recomiéndame cuáles usar y no escribas código.
```

## Al terminar, revisa

- Las vidas bajan una por choque, no varias de golpe.
- Al llegar a 0 vidas aparece la pantalla de fin.
- "Jugar otra vez" reinicia puntaje, vidas y ronda.
- Los colores de los fantasmas se distinguen bien del personaje.

```text
Escribe tests para estos casos: un choque quita una sola vida, sin vidas aparece el fin y
"Jugar otra vez" reinicia todo. Después dime 3 casos raros que no consideré.
```

Revisa el `git diff` ([capítulo 4, sección 14](../contenido/04-vibe-coding.md#14-cómo-supervisar-a-la-ia))
y usa el [prompt 2 de `revision.md`](./revision.md#2-qué-puede-fallar-en-un-celular): esta fase es la
de más lógica.

```bash
git add .
git commit -m "fase 4: fantasmas y vidas"
git push
```
