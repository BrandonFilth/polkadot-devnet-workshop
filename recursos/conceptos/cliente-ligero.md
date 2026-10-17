# Cliente ligero: verificar sin confiar

Un cliente ligero es un programa que se conecta a una blockchain sin descargarla entera, y aun así
puede comprobar que lo que le responden es verdad. En Polkadot el más usado es
[smoldot](https://github.com/smol-dot/smoldot), y es tan pequeño que corre dentro de un navegador.

---

## El problema que resuelve

Para leer una blockchain tienes tres opciones:

| Opción | Qué descarga | ¿Confías en alguien? |
|---|---|---|
| Nodo completo | Toda la cadena (cientos de GB) | No, lo verificas todo tú |
| RPC de un proveedor | Nada, solo preguntas | Sí: si el servidor miente, no te enteras |
| Cliente ligero | Solo encabezados de bloque | No: pide pruebas y las verifica |

El cliente ligero es lo que hace posible que una app sin servidor sea segura en un celular.

---

## Cómo funciona

1. Descarga solo los encabezados de bloque: unos cientos de bytes cada uno. Cada encabezado
   trae la *raíz de estado*, un hash que resume todo el estado de la cadena en ese bloque.
2. Para no recorrer millones de bloques, usa *warp sync*: salta directo al bloque más reciente
   siguiendo las pruebas de finalidad de los validadores.
3. Cuando necesita un dato (por ejemplo, el `contenthash` de `tu-app.dot`), se lo pide a un nodo
   completo junto con una prueba Merkle.
4. Recalcula hashes desde el dato hasta la raíz de estado. Si llega exactamente a la raíz del
   encabezado, el dato es auténtico.

```
                raíz de estado (está en el encabezado)
                   /                \
              hash A                hash B   ← el nodo te da estos hashes
             /      \
        hash C     hash D
                   /
            tu dato ← lo que pediste
```

La prueba son solo los hashes del camino. Con ellos recalculas hacia arriba. Si alguien cambia el
dato, el hash de arriba ya no coincide.

Fuente: [Light clients en docs.polkadot.com](https://docs.polkadot.com/reference/tools/light-clients/).

---

## Dónde lo usas sin darte cuenta

- dot.li resuelve los nombres `.dot` con smoldot dentro del navegador. El escudo verde de la
  barra superior significa que lo verificó tu cliente ligero; el naranja, que vino de un RPC externo
  sin verificar ([dotli-community](https://github.com/paritytech/dotli-community)).
- TrUAPI trae dos formas de conectarse a las cadenas: un RPC por WebSocket o smoldot embebido
  ([trinity-user-agents](https://github.com/paritytech/trinity-user-agents)).
- Tu app no lo ve: le pide la cadena al Host, y el Host decide cómo conectarse.

---

Relacionado: [DotNS](dotns.md) · [CID](cid.md)
