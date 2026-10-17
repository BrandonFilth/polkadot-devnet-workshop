# DotNS: los nombres `.dot`

DotNS es el sistema de nombres de Polkadot. Convierte un nombre fácil de recordar, como
`tu-app.dot`, en la dirección del contenido de tu app. Vive en contratos inteligentes sobre
Asset Hub, así que nadie puede cambiar tu nombre sin tu firma.

Si conoces DNS: DotNS hace lo mismo, pero el registro es tuyo y está en la cadena, no en un
proveedor.

---

## Las piezas

| Pieza | Qué guarda |
|---|---|
| Registry | Quién es el dueño de cada nombre |
| ContentResolver | Los registros de cada nombre: `contenthash` y registros de texto |
| `contenthash` | A qué contenido apunta el nombre (tu app) |
| Registros de texto | Datos extra con una clave, como `manifest` (nombre, descripción e icono) |

Referencia: [dotNS en docs.polkadot.com](https://docs.polkadot.com/reference/apps/).

---

## namehash: el nombre convertido en número

Los contratos no guardan el texto `tu-app.dot`: guardan un hash de 32 bytes llamado *namehash*. Se
calcula de derecha a izquierda, igual que en ENS:

```
node("")          = 0x0000…0000
node("dot")       = keccak256( node("") + keccak256("dot") )
node("tu-app.dot") = keccak256( node("dot") + keccak256("tu-app") )
```

Así, `app.tu-app.dot` es un subnombre de `tu-app.dot`, y solo el dueño del nombre padre puede
crearlo.

---

## contenthash: del nombre al CID

El `contenthash` son bytes que dicen "esto es IPFS, y este es el CID". Este es un `contenthash`
real de la red de pruebas:

```
0x e301 01 70 12 20 9e9b722a669c885e9006f6f77067ae0436a2932294398e993bbf3ea93237fc87
   │    │  │  │  │  └ hash de 32 bytes
   │    │  │  │  └ tamaño del hash
   │    │  │  └ sha2-256
   │    │  └ dag-pb (una carpeta)
   │    └ CID versión 1
   └ ipfs-ns: "lo que sigue es un CID de IPFS"
```

Quítale los dos primeros bytes, escribe el resto en base32 y obtienes
`bafybeie6tnzcuzu4rbpjabxw65ygplqeg2rjgiuuhghjso57h2uten74q4`: la carpeta de una app en Bulletin.

```powershell
dotns content view <nombre> --env devnet   # muestra el contenthash y el CID de un nombre
```

---

## `app.<nombre>.dot` y el `manifest`

Cuando un Host abre un nombre, primero busca `app.tu-app.dot` y, si no existe, usa `tu-app.dot`
([dotli-community](https://github.com/paritytech/dotli-community)).

Esto importa cuando le pones icono a tu app. El icono va en el registro de texto `manifest` del
nombre principal, y con un `manifest` los Hosts esperan la app en `app.tu-app.dot`, con su propio
`contenthash` y un registro `executable`. Si ese subnombre no existe, la tarjeta se ve, pero la app
no abre. `pad` crea los dos registros por ti cuando publicas con un `manifest`.

---

Relacionado: [CID](cid.md) · [Cliente ligero](cliente-ligero.md) · [Bulletin](bulletin.md)
