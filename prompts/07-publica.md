# Fase 7 · Publica en tu .dot

Al terminar tu juego está publicado en tu dominio `.dot` y lo abres desde el Host con el ranking
funcionando. Todavía sin guardar récords. 15 a 20 minutos.

## Antes de pedir

- ¿Cuál es tu dominio `.dot`? Debe tener 9 caracteres o más (p. ej. `mijuegoana.dot`). Lo compras
  una sola vez, antes de la primera subida: en `dotns.dot`, Search → Register → Register →
  Continue → firma en el teléfono
  ([guía](../contenido/05-el-juego.md#compra-tu-dominio-dot-una-sola-vez)).
- ¿Qué vas a revisar dentro del Host? (p. ej. "que el juego carga, que se ve bien en el celular y
  que el ranking aparece").

Escribe tus respuestas en `SPEC.md`.

## El prompt

Esta fase no pide código: el agente solo revisa que tu proyecto esté listo para publicarse.

```text
Lee SPEC.md (y el spec de esta parte si existe) y AGENTS.md. Revisa con la skill que mi
proyecto esté listo para publicarse (rutas, archivos externos, build). No cambies ningún
archivo; solo dime qué falta.
```

Si dice que falta algo, pídeselo en otro prompt corto y vuelve a correr este. Cuando no falte nada,
publica con el ciclo de la guía: `pnpm build` → sube con `pad` → copia el CID → `dotns.dot` →
Profile → Resolve → pega → Save → firma → abre tu `.dot`
([Probar dentro del Host: publica en tu .dot](../contenido/05-el-juego.md#probar-dentro-del-host-publica-en-tu-dot)).
Desde tu repo la carpeta del build es `dist`; en el repo del curso, la muestra usa `game\dist`. Repite el ciclo cada vez que quieras probar algo
dentro del Host; cada build da un CID nuevo.

## Si no sabes

```text
No sé qué cambia entre probar en el navegador y probar dentro del Host. Explícamelo en
lenguaje simple con 3 ejemplos de mi juego. No escribas código.
```

## Al terminar, revisa

- Tu `.dot` abre el juego en Polkadot Desktop o en la Polkadot App.
- El ranking carga dentro del Host.
- El juego se ve bien en el celular, sin barras ni partes cortadas.
- Anota la fecha: Bulletin borra lo publicado a los ~14 días; vuelve a publicar antes de la demo.

Esta fase no cambia código, así que no hay commit. Si el agente corrigió algo antes de publicar,
haz un commit con ese cambio:

```bash
git add .
git commit -m "fase 7: listo para publicar"
git push
```
