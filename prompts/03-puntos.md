# Fase 3 · Bolitas, puntaje y rondas

Al terminar el personaje come bolitas, el puntaje sube, hay un HUD y al vaciar el laberinto empieza
otra ronda. 20 a 25 minutos.

## Antes de pedir

- ¿Cuánto vale cada bolita? (p. ej. "10 puntos").
- ¿Qué pasa al comerte todas? (p. ej. "vuelven las bolitas y empieza la ronda 2").
- ¿Qué muestra el HUD? (p. ej. "puntaje, ronda, vidas y botón de pausa").

Escribe tus respuestas en `SPEC.md`.

## El prompt

```text
Lee SPEC.md (y el spec de esta parte si existe) y AGENTS.md.
Pon bolitas en los pasillos del laberinto. Cuando el personaje pasa por una, se la come y
el puntaje sube según SPEC.md.
Agrega un HUD arriba con lo que dice SPEC.md.
Cuando ya no quedan bolitas, empieza una nueva ronda con todas las bolitas otra vez.
Si te falta algún dato o hay que decidir algo que no está en SPEC.md, pregúntame antes de
escribir código.
Primero dime tu plan.
```

## Si no sabes

```text
No sé qué debe mostrar el HUD en un celular. Dame 2 o 3 opciones con pros y contras para
una pantalla chica, recomiéndame una y no escribas código.
```

## Al terminar, revisa

- El puntaje sube una sola vez por bolita; pasar otra vez por el mismo lugar no suma.
- La ronda 2 trae todas las bolitas otra vez.
- La pausa congela todo, también el aviso de nueva ronda.

```text
Escribe tests para estos casos: comer una bolita suma una vez, vaciar el laberinto da la
ronda 2 con todas las bolitas. Después dime 3 casos raros que no consideré.
```

Revisa el `git diff` ([capítulo 4, sección 14](../contenido/04-vibe-coding.md#14-cómo-supervisar-a-la-ia))
y usa el [prompt 1 de `revision.md`](./revision.md#1-qué-decidió-la-ia).

```bash
git add .
git commit -m "fase 3: bolitas, puntaje y rondas"
git push
```
