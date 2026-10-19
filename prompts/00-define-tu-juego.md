# Fase 0 · Define tu juego

Al terminar tienes `SPEC.md` (y, si hace falta, otros `spec-*.md`): las decisiones de tu juego, sin huecos, antes de escribir código.
15 a 20 minutos.

## Antes de pedir

- Juega 5 minutos el proyecto de muestra en `polka-man.dot`
  ([capítulo 5, Prueba la muestra](../contenido/05-el-juego.md#prueba-la-muestra)) y anota 3 cosas
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

Puedes tener varias specs: `SPEC.md` para lo general y, si una parte necesita mucho detalle,
`spec-niveles.md`, `spec-fantasmas.md` o `spec-contrato.md`. Lo grande vive en un archivo para que
el agente no lo deforme en una sesión larga; los cambios pequeños van como prompt. No las escribes
solo: el agente pregunta, propone y escribe; tú revisas y corriges.

## El prompt

```text
Quiero hacer un juego tipo Pac-Man para celular que corra en la Polkadot App. Lo voy a
construir en estas fases: proyecto, laberinto y movimiento, bolitas y puntaje,
fantasmas y vidas, bolitas especiales y dificultad, ranking con mi contrato, publicar
y guardar récord. El mejor puntaje se guarda en mi propio contrato Leaderboard.
Usa la skill polkadot-products-devnet.
Antes de escribir código, pregúntame cualquier duda que tengas, de pocas en pocas, para no
dejar puntos vacíos ni decisiones arbitrarias.
Si te digo "no sé", dame opciones concretas y recomiéndame una.
Al terminar, escribe SPEC.md con estas secciones: Objetivo, Usuario, Qué hace, Qué no hace,
Reglas y números, Datos y contrato, Pantallas y estados, Casos de prueba, Fuera de alcance
y Decisiones por fase. Si una parte necesita mucho detalle, propón un spec aparte
(p. ej. spec-fantasmas.md). No escribas código.
```

Responde en el mismo orden y con los mismos números que use el agente: `1. 3 vidas. 2. Sí. 3. No sé, dame opciones.`

## Si no sabes

Cuando una pregunta del agente no la sepas responder, no inventes ni le dejes decidir solo:

```text
No sé qué tan difícil debería ser. Dame 3 opciones concretas, con números (por ejemplo
"fantasmas 5 % más rápidos por ronda, hasta la ronda 9"), cada una con un pro y un contra
para alguien que juega en el celular. Recomiéndame una y no escribas código.
```

## Al terminar, revisa

- Cada fila de "Reglas y números" tiene un valor concreto (por ejemplo "Vidas: 3", no "algunas").
- "Qué no hace" y "Casos de prueba" no están vacíos.
- Existe la sección "Decisiones por fase" (puede estar vacía por ahora).
- Si el agente propuso specs aparte, cada una dice de qué parte es y `SPEC.md` las menciona.
- Pídele que busque huecos:

  ```text
  ¿Qué parte de SPEC.md sigue siendo ambigua o se contradice? No cambies nada todavía.
  ```

Cuando estés de acuerdo con `SPEC.md`, guárdalo en tu repo. Si crearon otros specs, agrégalos
también por nombre (p. ej. `git add spec-fantasmas.md`).

```bash
git add SPEC.md
git commit -m "spec del juego"
git push
```
