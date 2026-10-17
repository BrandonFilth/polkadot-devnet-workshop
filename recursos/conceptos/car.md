# CAR: muchos archivos en un solo paquete

Un CAR (*Content Addressable aRchive*) es un archivo que guarda varios bloques con su CID, uno
detrás de otro. Es como un `.zip`, pero en vez de nombres de archivo cada pieza se identifica por
su [CID](cid.md).

---

## Por qué hace falta

Tu app no es un solo archivo: es un `index.html`, unos `.js`, unos `.css` y las imágenes. En IPFS
y Bulletin esa carpeta se guarda como un árbol:

```
bafybei… (carpeta dist/)
├── index.html          → bafk…
├── assets/
│   ├── index-a1b2.js   → bafybei… (partido en pedazos)
│   │   ├── pedazo 1    → bafk…
│   │   └── pedazo 2    → bafk…
│   └── index-c3d4.css  → bafk…
└── icon.png            → bafk…
```

Pedir cada nodo por separado serían decenas de idas y vueltas. Con un CAR pides la raíz y recibes
todo el árbol de una vez.

---

## Cómo está hecho por dentro

```
┌──────────────────────────────┐
│ encabezado                   │  versión 1 + lista de raíces (el CID de la carpeta)
├──────────────────────────────┤
│ tamaño │ CID │ bytes         │  bloque 1
├──────────────────────────────┤
│ tamaño │ CID │ bytes         │  bloque 2
├──────────────────────────────┤
│ …                            │
└──────────────────────────────┘
```

- El encabezado dice cuál es la raíz del árbol.
- Cada bloque trae su CID, así que quien lo recibe puede verificar cada pieza por separado.
- No importa quién te mande el CAR: si un bloque no coincide con su CID, se descarta.

El formato está descrito en la [especificación de CAR](https://ipld.io/specs/transport/car/carv1/).

---

## Dónde lo vas a ver

- dot.li descarga tu app como CAR, la desempaqueta y un Service Worker sirve cada archivo como
  si fuera un servidor local ([dotli-community](https://github.com/paritytech/dotli-community)).
- `pad` puede guardar el CAR que sube con `--dump-car`, por si quieres ver qué se publicó.

Por eso las rutas de tu app tienen que ser relativas (`base: './'` en `vite.config`). No hay un
dominio raíz: los archivos se sirven desde dentro del paquete.

---

Relacionado: [CID](cid.md) · [Bulletin](bulletin.md)
