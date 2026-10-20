# Fase 4 · Fantasmas y vidas

Al terminar hay fantasmas de colores que te persiguen todos con la misma regla, pierdes vidas al
chocar y aparece una pantalla de fin con "Jugar otra vez". 30 a 40 minutos.

## Antes de pedir

- ¿Cuántos fantasmas salen y cómo los distingues? (p. ej. "2 al inicio, uno rojo y uno verde").
- ¿Cómo persiguen? (p. ej. "todos igual: en cada cruce van por el camino que más los acerca, sin
  dar media vuelta; 1 de cada 4 veces eligen al azar para no amontonarse").
- ¿Cuántas vidas tienes y, al chocar, se conservan las bolitas que ya comiste? (p. ej. "3; sí,
  solo vuelves al inicio").
- ¿Qué muestra la pantalla de fin? (p. ej. "tu puntaje y el botón Jugar otra vez").

Escribe tus respuestas en `SPEC.md`.

## El prompt

```text
Lee SPEC.md (y el spec de esta parte si existe) y AGENTS.md.
Agrega los fantasmas que dice SPEC.md. Todos siguen la misma regla para perseguir y se
distinguen solo por su color. El azar usa una semilla, para que los tests den siempre lo mismo.
Si un fantasma toca al personaje, se pierde una vida. Sin vidas, aparece la pantalla de
fin con el puntaje y un botón "Jugar otra vez" que reinicia todo.
Los fantasmas deben verse distintos del personaje.
Si te falta algún dato o hay que decidir algo que no está en SPEC.md, pregúntame antes de
escribir código.
Primero dime tu plan.
```

## Si no sabes

```text
No sé qué regla deberían seguir los fantasmas para perseguir. Dame 3 reglas sencillas,
la misma para todos, que eviten que se amontonen, con pros y contras para un juego de
celular. Recomiéndame una y no escribas código.
```

## Al terminar, revisa

- Las vidas bajan una por choque, no varias de golpe.
- Al llegar a 0 vidas aparece la pantalla de fin.
- "Jugar otra vez" reinicia puntaje, vidas y ronda.
- Los colores de los fantasmas se distinguen bien del personaje.
- Los fantasmas no se amontonan todos en el mismo pasillo.
- Ningún fantasma da media vuelta a mitad de un pasillo.

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
