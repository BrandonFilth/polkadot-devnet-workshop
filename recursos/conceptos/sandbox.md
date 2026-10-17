# Sandbox: tu app corre aislada

Un sandbox es un entorno aislado donde un código corre con capacidades limitadas: puede funcionar,
pero no puede tocar lo que está fuera de él. En Polkadot, cada app (Product) corre dentro de un
sandbox que impone el Host, y todo lo que necesita de fuera se lo pide al Host.

---

## El problema que resuelve

Una página web normal puede hacer muchas cosas por su cuenta. Una app dentro de un Host, no:

| Qué | Pestaña de navegador normal | Product en un Host |
|---|---|---|
| Red | Llama a cualquier URL con `fetch` o `WebSocket` | Solo las URLs que declaró como `ExternalRequest` y el usuario aprobó |
| Cuentas | Lo que el sitio decida pedirte | Una cuenta derivada para su dominio, nunca tu identidad raíz |
| Firmas | Depende de la extensión o la billetera | Cada transacción se aprueba en la Polkadot App de tu teléfono |
| Otras apps | Comparte el navegador con ellas | Origen propio: no lee el almacenamiento de otra app |

Así una app no puede espiar a otra ni firmar por ti.

---

## Cómo funciona

El Host le pone tres restricciones que la app no puede saltarse:

1. **Una cuenta por dominio.** La app recibe una subcuenta derivada para su dominio, no tu
   identidad raíz. La misma persona ve una cuenta distinta en `app-a.dot` y en `app-b.dot`, y las
   apps no pueden ligarlas sin un permiso explícito. La derivación se hace en local, sin ir al
   teléfono.
2. **Una sola salida.** La red, el cliente de cadena, el almacenamiento y la firma están detrás de
   la Host API, a la que la app habla por TrUAPI. La app pide y el Host decide; no hay otro canal.
   Lo que TrUAPI no expone, la app no lo puede hacer.
3. **Permisos puntuales.** Sin permisos, el aislamiento es total. Cada permiso abre una sola cosa:
   `ExternalRequest` las URLs de un patrón, `ChainSubmit` la capacidad de pedir firmas (cada
   transacción se aprueba aparte) y un alias entre dominios con su propio aviso de consentimiento.
   Los permisos se declaran en el manifest de la app; uno nuevo exige publicar otro bundle.

```
  ┌──────── sandbox ────────┐
  │        tu app           │
  │  ✘ fetch / WebSocket    │
  │  ✘ tu llave privada     │
  │  ✘ datos de otra app    │
  └───────────┬─────────────┘
              │ TrUAPI (la única puerta)
              ▼
            Host ── aplica los permisos
         ┌────┼──────────────┐
         ▼    ▼              ▼
       red  cadenas     tu teléfono
  (URLs declaradas)       (firmas)
```

Fuente: [Sandbox and Sub-Accounts in TrUAPI](https://docs.polkadot.com/reference/apps/protocol/truapi/sandbox/)
y [Permissions in Polkadot Desktop](https://docs.polkadot.com/reference/apps/hosts/polkadot-desktop/permissions/).

---

## Dónde lo ves

- La primera vez que abres una app en Polkadot Desktop, te muestra cada permiso que declaró y tú
  lo concedes o lo niegas. Tu decisión se guarda.
- Si niegas un permiso, la llamada de la app responde `PermissionDenied`. Una app bien hecha te
  muestra por qué no puede seguir.
- Cada app te ve con una cuenta distinta, aunque seas la misma persona.
- La documentación marca la lista de permisos como provisional: puede cambiar.

---

Relacionado: [DotNS](dotns.md) · [SCALE](scale.md) · [Cliente ligero](cliente-ligero.md)
