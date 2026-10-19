# Prompts de revisión

Prompts cortos para revisar el trabajo del agente. Úsalos en cualquier fase. Antes de cada commit
sigue la lista del [capítulo 4, sección 14](../contenido/04-vibe-coding.md#14-cómo-supervisar-a-la-ia)
y revisa los [errores comunes de la sección 15](../contenido/04-vibe-coding.md#15-errores-comunes-de-la-ia-en-este-stack).

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
