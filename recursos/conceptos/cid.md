# CID: la huella de un archivo

Un CID (*Content Identifier*) es un nombre que se calcula a partir del contenido. No dice dónde
está el archivo, dice qué es. Si cambias un solo byte, el CID cambia por completo.

```
"hola" → bafk2bzacebhobtnwjzylxhnjgej7rxolhyx5eo7pdtncy3kfv7wh56kzvrrjq
"Hola" → bafk2bzacedlgtlbxzqhdtdb2l5tpkdpr5sadxui4jyqvnaalgyo7tbfkogrbq
```

Son dos CID reales, calculados con el Product SDK. Solo cambia una mayúscula y no se parecen en nada.

---

## Dirección vs. contenido

En la web normal pides un archivo por su ubicación: `https://servidor.com/logo.png`. Si el
servidor cambia el archivo, tú no te enteras.

Con un CID pides el archivo por lo que es. Cualquiera puede dártelo (un nodo, un gateway, tu caché)
y tú compruebas que es el correcto volviendo a calcular el CID de lo que recibiste. Si no coincide,
lo descartas.

---

## De qué está hecho

Un CID versión 1 son cuatro piezas pegadas, y luego se escribe en texto:

```
 b          01         55          a0e402      20        4ee0cdb6…
 │          │          │           │           │         │
 base       versión    tipo de     función     tamaño    el hash
 (texto)    del CID    contenido   de hash     del hash  (32 bytes)
```

| Pieza | En el ejemplo | Qué significa |
|---|---|---|
| Base | `b` | El texto está en base32. Por eso los CID empiezan con `b` |
| Versión | `01` | CID v1 |
| Codec | `55` | `raw`: son los bytes tal cual. `70` sería `dag-pb`, un nodo que apunta a otros |
| Multihash | `a0e402` + `20` | Función `blake2b-256` y un hash de 32 bytes. `12` + `20` sería `sha2-256` |
| Digest | `4ee0cdb6…` | El hash del contenido |

Todas las piezas usan el formato *varint* de [multiformats](https://multiformats.io/): un número que
ocupa tantos bytes como necesite. Por eso `blake2b-256` (código `0xb220`) se escribe `a0e402`.

---

## Cómo leer el inicio de un CID

Con práctica, el inicio te dice qué tipo de CID es:

| Empieza con | Codec + hash | Dónde lo vas a ver |
|---|---|---|
| `bafk2bza…` | `raw` + `blake2b-256` | Archivos sueltos en Bulletin, como el icono de tu app |
| `bafkrei…` | `raw` + `sha2-256` | Archivos sueltos en IPFS |
| `bafybei…` | `dag-pb` + `sha2-256` | Carpetas o archivos grandes partidos en pedazos (UnixFS), como tu `dist/` |

---

## Cómo se genera

1. Tomas los bytes del archivo.
2. Les calculas el hash (por ejemplo, `blake2b-256`).
3. Le pones adelante el codec, la función de hash y la versión.
4. Lo escribes en base32 con el prefijo `b`.

Si el archivo es grande o es una carpeta, primero se parte en pedazos. Cada pedazo tiene su propio
CID, y un nodo `dag-pb` los lista en orden. El CID final es el de ese nodo. Así funcionan las
[subidas por partes de Bulletin](https://docs.polkadot.com/reference/apps/infrastructure/bulletin-chain/chunked-upload/).

```js
// Con el Product SDK
import { calculateCid } from '@parity/product-sdk/cloud-storage';
const cid = await calculateCid(new TextEncoder().encode('hola'));
console.log(cid.toString()); // bafk2bzacebhobtnwjzylxhnjgej7rxolhyx5eo7pdtncy3kfv7wh56kzvrrjq
```

---

## Mismo archivo, distintos CID

El CID no solo depende del contenido: también del codec y de la función de hash. El mismo PNG
guardado como UnixFS da un `bafybei…`, y guardado como `raw` + `blake2b-256` da un `bafk2bza…`.
Para la red son dos cosas distintas.

Esto importa cuando alguien te pide un CID en un formato concreto. El icono del `manifest` de tu
app, por ejemplo, va como `raw` + `blake2b-256`, que es como lo sube `pad`. Si lo subes con otra
herramienta que lo empaqueta como UnixFS, el Host no lo encuentra.

---

Relacionado: [CAR](car.md) · [Bulletin](bulletin.md) · [DotNS](dotns.md)
