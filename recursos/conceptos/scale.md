# SCALE: el idioma binario de Polkadot

SCALE (*Simple Concatenated Aggregate Little-Endian*) es la forma en que Polkadot convierte datos en
bytes. Lo usan las transacciones, el estado de las cadenas y también los mensajes de TrUAPI entre el
Host y tu app ([trinity-user-agents](https://github.com/paritytech/trinity-user-agents)).

Es como JSON, pero en binario y sin nombres de campos. Eso lo hace muy compacto.

---

## Mismo dato, dos formatos

```
JSON:   {"edad":1,"nombre":"hola"}           26 bytes
SCALE:  01 00 00 00  10 68 6f 6c 61           9 bytes
        └ edad (u32) └ "hola"
```

SCALE no escribe `edad` ni `nombre`. Ambos lados ya saben el orden y el tipo de cada campo, porque
comparten la misma definición. En TrUAPI esa definición está en Rust, y de ahí se genera el cliente
TypeScript.

---

## Las reglas básicas

| Tipo | Cómo se codifica | Ejemplo |
|---|---|---|
| Entero fijo (`u32`) | 4 bytes, el menos significativo primero (*little-endian*) | `1` → `01 00 00 00` |
| Entero compacto | Ocupa 1, 2, 4 o más bytes según el tamaño | `1` → `04` |
| Texto o lista | Largo en compacto, luego los elementos | `"hola"` → `10 68 6f 6c 61` |
| Struct | Los campos pegados, en orden | `edad` + `nombre` |
| Enum | Un byte con la variante, luego su contenido | `Some(x)` → `01` + `x` |

¿Por qué `"hola"` empieza con `10`? El largo es 4. En compacto, los números pequeños se guardan
corridos dos bits a la izquierda, y 4 × 4 = 16 = `0x10`.

Especificación completa: [SCALE codec](https://docs.polkadot.com/polkadot-protocol/parachain-basics/data-encoding/).

---

## Por qué te importa

- Si el Host y la app no comparten la misma versión de las definiciones, los bytes no se entienden.
  TrUAPI versiona sus mensajes para eso, pero conviene fijar la versión exacta del SDK que soporta
  el Host donde vas a publicar.
- Casi nunca vas a escribir SCALE a mano: el SDK y PAPI lo hacen por ti.

---

Relacionado: [Cliente ligero](cliente-ligero.md)
