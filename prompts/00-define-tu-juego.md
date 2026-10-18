# Fase 0 · Define tu juego

Al terminar tienes `SPEC.md`: las decisiones de tu juego, sin huecos, antes de escribir código.
15 a 20 minutos.

## Antes de pedir

- Juega 5 minutos el proyecto de muestra
  ([capítulo 5, Juega la muestra](../contenido/05-el-juego.md#juega-la-muestra)) y anota 3 cosas
  que harías distinto. Por ejemplo: "3 vidas en vez de 5", "fantasmas más lentos", "otros colores".
- Ten tu carpeta `mi-juego` con la skill instalada y el primer commit hecho
  ([capítulo 5, sección 4](../contenido/05-el-juego.md#4-crea-tu-repo)).
- Abre el chat de tu agente en modo supervisado
  ([capítulo 4, sección 9](../contenido/04-vibe-coding.md#9-agentes)).

Así se va a ver tu `SPEC.md`. Las secciones que ya conoces vienen del
[capítulo 4, sección 5](../contenido/04-vibe-coding.md#5-specs) y "Casos de prueba" de la
[sección 6](../contenido/04-vibe-coding.md#6-casos-de-prueba). Las dos nuevas son "Reglas y números"
(cada regla con un valor concreto) y "Decisiones por fase" (lo que decidas en cada fase).

```markdown
# Spec: <nombre de tu juego>
## Objetivo
## Usuario
## Qué hace
## Qué no hace
## Reglas y números
## Datos y contrato
## Pantallas y estados
## Casos de prueba
## Fuera de alcance
## Decisiones por fase
```

## El prompt

```text
Quiero hacer un juego tipo Pac-Man para celular que corra en la Polkadot App. Lo voy a
construir en estas fases: proyecto, laberinto y movimiento, bolitas y puntaje,
fantasmas y vidas, bolitas especiales y dificultad, ranking con mi contrato, publicar
y guardar récord. El mejor puntaje se guarda en mi propio contrato Leaderboard.
Usa la skill polkadot-products-devnet.
Antes de escribir código, pregúntame cualquier duda que tengas, de pocas en pocas, para no
dejar puntos vacíos ni decisiones arbitrarias.
Si te digo "no sé", dame opciones y recomiéndame una.
Al terminar, escribe SPEC.md con estas secciones: Objetivo, Usuario, Qué hace, Qué no hace,
Reglas y números, Datos y contrato, Pantallas y estados, Casos de prueba, Fuera de alcance
y Decisiones por fase. No escribas código.
```

## Si no sabes

Cuando una pregunta del agente no la sepas responder, no inventes ni le dejes decidir solo:

```text
No sé qué tan difícil debería ser. Dame 3 opciones con pros y contras para alguien que
juega en el celular por primera vez, recomiéndame una y no escribas código.
```

## Al terminar, revisa

- Cada fila de "Reglas y números" tiene un valor concreto (por ejemplo "Vidas: 3", no "algunas").
- "Qué no hace" y "Casos de prueba" no están vacíos.
- Existe la sección "Decisiones por fase" (puede estar vacía por ahora).
- Pídele que busque huecos:

  ```text
  ¿Qué parte de SPEC.md sigue siendo ambigua o se contradice? No cambies nada todavía.
  ```

Cuando estés de acuerdo con `SPEC.md`, guárdalo en tu repo:

```bash
git add SPEC.md
git commit -m "spec del juego"
git push
```
