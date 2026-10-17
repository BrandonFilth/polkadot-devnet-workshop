# Vocabulario de interfaz: los nombres de lo que ves en pantalla

Para pedirle a la IA un cambio preciso necesitas el nombre de lo que quieres cambiar. "Muévelo un
poco a la derecha" deja todo a su criterio; "agrega `margin-left` de 8 px" no. Los términos van en
inglés porque así aparecen en el código, en la documentación y en las respuestas de la IA.

---

## Layout

Cómo se acomodan los elementos en la pantalla.

| Término | En español | Qué es | Cómo pedirlo |
|---|---|---|---|
| container | Contenedor | Caja que agrupa otros elementos y limita su ancho | *"Pon todo en un container de máximo 480 px, centrado."* |
| `padding` | Relleno | Espacio entre el borde de un elemento y su contenido | *"Dale 12 px de `padding` a cada card."* |
| `margin` | Margen | Espacio por fuera del borde, que lo separa de los demás | *"Quita el `margin` de arriba del título."* |
| `gap` | Separación | Espacio entre los elementos de una fila, columna o cuadrícula ([MDN](https://developer.mozilla.org/es/docs/Web/CSS/gap)) | *"`gap` de 16 px entre las cards."* |
| grid | Cuadrícula | Acomodo en filas y columnas a la vez | *"Muestra las cards en un grid de 2 columnas."* |
| flex (flexbox) | Caja flexible | Acomodo en una sola dirección, fila o columna | *"Usa flex para poner el icono y el texto en la misma fila."* |
| row / column | Fila / columna | Dirección en la que se acomodan los elementos | *"Cambia esa row a column en el teléfono."* |
| alignment (`justify-content`, `align-items`) | Alineación | Cómo se reparten y alinean los elementos dentro de su contenedor | *"Centra los botones con `justify-content: center`."* |
| breakpoint / responsive | Punto de corte / adaptable | Ancho de pantalla donde el diseño cambia; un diseño responsive se adapta a cada ancho | *"Debajo de 600 px, una sola columna."* |

---

## Componentes

Las piezas que forman una interfaz.

| Término | En español | Qué es | Cómo pedirlo |
|---|---|---|---|
| button | Botón | Control que ejecuta una acción al pulsarlo | *"Agrega un button 'Guardar récord' debajo del puntaje."* |
| input | Campo de texto | Caja donde el usuario escribe | *"Un input para el username, con máximo 16 caracteres."* |
| dropdown / select | Lista desplegable | Control que abre una lista de opciones | *"Un select para elegir la dificultad."* |
| modal / dialog | Ventana modal | Ventana encima de la página que pide atención antes de seguir | *"Pide confirmación en un modal antes de firmar."* |
| toast | Aviso emergente | Mensaje corto que aparece y se va solo | *"Un toast de 3 segundos cuando se guarde."* |
| tooltip | Globo de ayuda | Texto pequeño que aparece al pasar el puntero o enfocar un elemento | *"Un tooltip en el icono de ayuda."* |
| card | Tarjeta | Caja que agrupa información de un mismo tema | *"Cada jugador en una card con su puntaje."* |
| navbar | Barra de navegación | Barra, casi siempre arriba, con los enlaces principales | *"Una navbar con Jugar y Ranking."* |
| sidebar | Barra lateral | Panel a un lado de la pantalla | *"Mueve los filtros a una sidebar."* |
| tab | Pestaña | Opción que cambia el contenido sin cambiar de página | *"Dos tabs: Hoy y Siempre."* |
| badge | Insignia | Etiqueta pequeña con un número o estado | *"Un badge 'Nuevo récord' junto al puntaje."* |
| spinner / loader | Indicador de carga | Animación que indica que algo está en proceso | *"Un spinner en el botón mientras se firma."* |
| skeleton | Esqueleto | Formas grises que ocupan el lugar del contenido mientras carga | *"Un skeleton de 5 filas mientras carga el ranking."* |
| empty state | Estado vacío | Lo que se muestra cuando no hay datos | *"Si no hay jugadores, un empty state con 'Sé el primero'."* |

---

## Estados

Cómo cambia un elemento según lo que pasa.

| Término | En español | Qué es | Cómo pedirlo |
|---|---|---|---|
| hover | Al pasar el puntero | Estado cuando el puntero está encima | *"Aclara el botón en hover."* |
| focus | Enfoque | Estado del elemento seleccionado con el teclado o al tocarlo ([`:focus-visible` en MDN](https://developer.mozilla.org/es/docs/Web/CSS/:focus-visible)) | *"Un borde visible de 2 px en focus."* |
| disabled | Deshabilitado | Estado de un control que no se puede usar | *"El botón `disabled` mientras se firma."* |
| loading | Cargando | Estado mientras algo carga o se procesa | *"Estado de loading al leer el récord."* |
| error | Error | Estado cuando algo falló, con un mensaje que explica qué hacer | *"Si falla, muestra el error debajo del botón, en rojo."* |

El foco visible es lo que usa quien navega con teclado para saber dónde está. No quites el
`outline` de los elementos sin poner otro indicador en su lugar, y cuida que el texto tenga
contraste suficiente con el fondo. La skill `accessibility` del
[capítulo 4](../contenido/04-vibe-coding.md) ayuda a revisarlo, pero una revisión automática no
reemplaza probar la app con teclado y con un lector de pantalla.

---

## Tipografía

| Término | En español | Qué es | Cómo pedirlo |
|---|---|---|---|
| `font-size` | Tamaño de letra | Qué tan grande es el texto | *"`font-size` de 32 px para el puntaje."* |
| `font-weight` | Grosor | Qué tan gruesa es la letra (400 normal, 700 negrita) | *"`font-weight` 700 en los títulos."* |
| `line-height` | Interlineado | Espacio vertical de cada línea de texto | *"`line-height` de 1.5 en los párrafos."* |

---

## Color y tema

| Término | En español | Qué es | Cómo pedirlo |
|---|---|---|---|
| accent | Color de acento | Color que resalta lo importante, como el botón principal | *"Usa el rosa como accent solo en el botón principal."* |
| contrast | Contraste | Diferencia entre el color del texto y el del fondo | *"Sube el contrast del texto gris sobre negro."* |
| dark mode (`prefers-color-scheme`) | Modo oscuro | Versión de colores oscuros; `prefers-color-scheme` detecta la preferencia del sistema | *"Respeta `prefers-color-scheme` y agrega dark mode."* |

---

## Términos de juego

Se usan en el capítulo 5.

| Término | En español | Qué es | Cómo pedirlo |
|---|---|---|---|
| canvas | Lienzo | Área de la página donde se dibuja con código ([Canvas API en MDN](https://developer.mozilla.org/es/docs/Web/API/Canvas_API)) | *"Dibuja el laberinto en un canvas de 448 × 496 px."* |
| sprite | Sprite | Imagen de un personaje u objeto del juego | *"Usa un sprite distinto para cada fantasma."* |
| frame | Cuadro | Cada imagen que se dibuja; varios por segundo forman la animación | *"Que el personaje cambie de sprite cada 8 frames."* |
| game loop | Ciclo del juego | Función que se repite en cada frame: lee controles, mueve y dibuja | *"Usa `requestAnimationFrame` para el game loop."* |
| hitbox / collision | Caja de colisión / choque | Área invisible que se usa para saber si dos objetos se tocan | *"Haz la hitbox del jugador más chica que su sprite."* |
| score | Puntaje | Los puntos de la partida | *"Muestra el score arriba a la izquierda."* |
| HUD | Indicadores en pantalla | Información fija sobre el juego: puntaje, vidas, nivel | *"Un HUD con score, vidas y récord."* |

---

Relacionado: [Capítulo 4 · Programar con IA (vibe coding)](../contenido/04-vibe-coding.md)
