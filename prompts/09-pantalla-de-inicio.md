# Fase 9 · Pantalla de inicio y menú

Al terminar tu juego abre en una pantalla de inicio con Jugar, Conectar cuenta y Ranking, y arriba
hay un menú con pestañas para tu username y el ranking. 25 a 35 minutos.

## Antes de pedir

- ¿Qué muestra la pantalla de inicio? (p. ej. "el título, Jugar, Conectar cuenta, Ranking y, ya
  con cuenta, mi username").
- ¿Qué pasa si tocan Jugar sin cuenta? (p. ej. "un aviso, una sola vez, de que sin cuenta no se
  guarda el récord; se juega igual").
- ¿Qué tiene el menú de arriba? (p. ej. "dos pestañas, Username y Ranking; abrirlo pausa la
  partida").
- ¿Cómo se ven las pantallas, el menú y los popups? (p. ej. "con fondo opaco, sin que se vea el
  juego detrás").

Escribe tus respuestas en `SPEC.md`.

## El prompt

```text
Lee SPEC.md (y el spec de esta parte si existe) y AGENTS.md.
Agrega la pantalla de inicio que dice SPEC.md, para que la partida no empiece sola.
Conectar cuenta es una sugerencia que se puede omitir: sin cuenta se juega igual, pero el
récord no se guarda.
Arriba agrega un menú con las pestañas Username y Ranking. El ranking vive en su propia
pestaña y se desplaza si no cabe.
Las pantallas, el menú y los popups tienen fondo opaco.
Si te falta algún dato o hay que decidir algo que no está en SPEC.md, pregúntame antes de
escribir código.
Primero dime tu plan.
```

## Si no sabes

```text
No sé cómo invitar a conectar la cuenta sin obligar a nadie. Dame 3 formas con pros y
contras para alguien que nunca ha usado una wallet, recomiéndame una y no escribas código.
```

## Al terminar, revisa

- El juego abre en la pantalla de inicio y la partida empieza solo al tocar Jugar.
- Sin cuenta, el aviso de que no se guarda el récord sale una sola vez.
- Abrir el menú pausa la partida y nada se reanuda solo al cerrarlo.
- Nada del juego se ve a través del menú ni de los popups.
- Conectar desde la pantalla de inicio se prueba en el Host, con el ciclo de publicar de la
  [fase 7](./07-publica.md).

```text
Escribe tests para estos casos: el juego no empieza hasta tocar Jugar, el aviso sin cuenta
sale una sola vez y abrir el menú pausa la partida. Después dime 3 casos raros que no
consideré.
```

Revisa el `git diff` ([capítulo 4, sección 14](../contenido/04-vibe-coding.md#14-cómo-supervisar-a-la-ia))
y usa el [prompt 1 de `revision.md`](./revision.md#1-qué-decidió-la-ia).

```bash
git add .
git commit -m "fase 9: pantalla de inicio y menú"
git push
```
