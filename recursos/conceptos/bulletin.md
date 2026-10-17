# Bulletin: dónde viven los archivos

Bulletin es una blockchain de Polkadot hecha para guardar datos: el código de tu app, imágenes y
cualquier archivo. Cada cosa que guardas se identifica por su [CID](cid.md) y se puede pedir con el
mismo protocolo que IPFS ([docs](https://docs.polkadot.com/chain-interactions/store-data/bulletin-chain/)).

---

## Tres reglas que la hacen distinta

| Regla | Qué significa para ti |
|---|---|
| No se paga con tokens | Necesitas una autorización: un permiso en la cadena con un cupo de transacciones y de bytes, que vence en un bloque |
| Los datos duran unas dos semanas | Si no los renuevas, se pueden borrar. Vuelve a publicar tu app antes de un evento |
| Hay un límite por transacción | Los archivos grandes se parten en pedazos, y cada pedazo gasta una transacción del cupo |

Fuentes: [autorización](https://docs.polkadot.com/reference/apps/infrastructure/bulletin-chain/authorization/),
[renovación](https://docs.polkadot.com/reference/apps/infrastructure/bulletin-chain/renewal/),
[subidas por partes](https://docs.polkadot.com/reference/apps/infrastructure/bulletin-chain/chunked-upload/).

---

## Cómo sube y baja un archivo

```
subir:  bytes ──► TransactionStorage.store(bytes) ──► la cadena guarda el bloque ──► CID
bajar:  CID   ──► bitswap_v1_get(cid)             ──► bytes ──► recalculas el CID y comparas
```

- Para subir firmas una transacción con los bytes adentro.
- Para bajar no firmas nada: cualquiera puede pedir un CID.
- Si es grande, el SDK lo parte, sube cada pedazo y al final sube una lista `dag-pb` con los CID en
  orden. El CID que recibes es el de esa lista.

En tu app no llamas a nada de esto directo: el Product SDK lo hace con `upload(bytes)` y
`fetch(cid)` a través del Host.

---

## Antes de usarla en tu app

- La autorización vence en un bloque fijo. Revisa cuánto cupo y cuánto tiempo le queda antes de
  subir algo grande.
- Renovar un dato es una transacción más, así que también necesita una firma.
- Una subida por partes gasta una transacción por pedazo, más una por la lista final. Puedes
  quedarte sin transacciones aunque te sobren bytes.

---

Relacionado: [CID](cid.md) · [CAR](car.md) · [DotNS](dotns.md)
