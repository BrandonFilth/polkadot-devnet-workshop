# Fase 10 · Sonido, música y animaciones

Al terminar tu juego tiene animaciones, efectos de sonido de 8 bits y una música de fondo
original, con botones para silenciar la Música y los Efectos por separado. 30 a 40 minutos.

## Antes de pedir

- ¿Qué se anima? (p. ej. "la boca al comer, un destello en cada bolita, los puntos que flotan al
  comerte un fantasma y el personaje que se desinfla al morir").
- ¿Qué suena? (p. ej. "un waka suave al comer, otro sonido para la bolita especial, uno al comerte
  un fantasma, uno al morir y música de fondo de 8 bits").
- ¿Cómo se silencia? (p. ej. "dos botones, Música y Efectos, cada uno por su lado y recordados en
  el dispositivo").
- ¿Qué tan fuerte suena? (p. ej. "la música bajita, para que no tape los efectos").

Escribe tus respuestas en `SPEC.md`.

## El prompt

```text
Lee SPEC.md (y el spec de esta parte si existe) y AGENTS.md.
Agrega las animaciones de SPEC.md solo en el dibujo; la lógica del juego no cambia.
Agrega los efectos retro de ocho bits y una música de fondo original, hechos en código con
la Web Audio API, sin archivos de audio.
El sonido empieza con el primer toque del jugador. Agrega dos botones, Música y Efectos,
que se silencian por separado y se recuerdan en el dispositivo.
Si el Host no deja reproducir audio, el juego sigue funcionando en silencio.
Si te falta algún dato o hay que decidir algo que no está en SPEC.md, pregúntame antes de
escribir código.
Primero dime tu plan.
```

## Si no sabes

```text
No sé qué música poner. Dame 3 ideas de melodías originales de 8 bits, cortas y que se
repitan, con pros y contras para un juego de celular. No copies el tema de ningún juego
conocido. Recomiéndame una y no escribas código.
```

## Al terminar, revisa

- El sonido empieza al tocar Jugar, no antes.
- Silenciar Música no apaga los Efectos, y al revés.
- Al recargar, Música y Efectos siguen como los dejaste.
- Con la pestaña en segundo plano no suena nada.
- Dentro del Host, si no suena, el juego funciona igual (pruébalo con el ciclo de publicar de la
  [fase 7](./07-publica.md)).

```text
Escribe tests para estos casos: nada suena antes del primer toque, Música y Efectos se
silencian por separado y se recuerdan al recargar. Usa un audio falso, sin sonido real.
Después dime 3 casos raros que no consideré.
```

Revisa el `git diff` ([capítulo 4, sección 14](../contenido/04-vibe-coding.md#14-cómo-supervisar-a-la-ia))
y usa el [prompt 2 de `revision.md`](./revision.md#2-qué-puede-fallar-en-un-celular).

```bash
git add .
git commit -m "fase 10: sonido, música y animaciones"
git push
```
