# Prompts de revisión

Prompts cortos para revisar el trabajo del agente. Úsalos en cualquier fase. Antes de cada commit
sigue la lista del [capítulo 4, sección 14](../contenido/04-vibe-coding.md#14-cómo-supervisar-a-la-ia).

## 1. Qué decidió la IA

Después de cada fase, para encontrar decisiones que no tomaste tú.

```text
¿Qué decidiste tú que no estaba en mis specs ni en mi prompt?
```

## 2. Qué puede fallar en un celular

Cuando algo ya funciona en la PC.

```text
¿Qué puede fallar con esto en un celular? Piensa en pestaña en segundo plano, doble toque,
pantalla chica, red lenta.
```

## 3. Explícame el diff

Antes del commit, si no entiendes qué cambió.

```text
Explícame este diff archivo por archivo, en lenguaje simple.
```

## 4. Diagnóstico antes de arreglar

Cuando algo falla. Pega el error exacto.

```text
Falla esto: <error exacto>. Pasa cuando <qué hiciste>.
Dime la causa antes de cambiar código.
```

## 5. Compara con la muestra

Cuando te atoras y quieres ver cómo lo resolvió el proyecto de muestra.

```text
Compara mi <parte del juego> con el proyecto de muestra en ../polkadot-devnet-workshop/game
y dime qué le falta a la mía. No copies código.
```

## 6. Guarda las decisiones

Al final de cada fase, para que `SPEC.md` siga siendo la fuente de verdad.

```text
Agrega a la sección "Decisiones por fase" de SPEC.md las decisiones que tomamos en esta
fase; si alguna cambia un número, actualiza también "Reglas y números".
```

## 7. ¿Esto debería ser una spec?

Antes de una solicitud grande, para decidir si va en un archivo o basta un prompt
([capítulo 4, Cuándo spec y cuándo prompt](../contenido/04-vibe-coding.md#cuándo-spec-y-cuándo-prompt)).

```text
Quiero <tu solicitud>. Antes de hacer nada, dime si esto debería ser una spec o basta un
prompt: cuántas pantallas, reglas con números o casos toca. Si conviene spec, propón el
nombre del archivo y sus secciones. No escribas código.
```

## 8. Revisa una spec con la skill

Antes de pedir código de una spec nueva o que cambió
([capítulo 4, Púlela con la skill](../contenido/04-vibe-coding.md#púlela-con-la-skill)).

```text
Usa la skill polkadot-products-devnet para revisar <archivo de spec>: dime qué choca con
las versiones fijas, la red Products Devnet, el sandbox (sin fetch externo), la publicación
con pad o las reglas de firmas, y propón cambios. No escribas código.
```
