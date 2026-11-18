---
name: Bitácora laboral
description: Registro personal de trabajo, sobrio y denso, para capturar en segundos y consolidar sin duplicar.
colors:
  pine-ink: "#2f5d50"
  pine-ink-deep: "#234a3f"
  pine-wash: "#e1ece7"
  warm-paper: "#f6f5f1"
  sheet-white: "#ffffff"
  paper-shade: "#efede7"
  pencil-rule: "#dedad0"
  graphite: "#1f2421"
  faded-graphite: "#5e655f"
  done-green: "#2d7a46"
  done-green-wash: "#e2f2e7"
  amber-note: "#8a5a00"
  amber-note-wash: "#fbf0d9"
  blocker-red: "#b3261e"
  blocker-red-wash: "#fbe4e2"
  progress-blue: "#345c99"
  progress-blue-wash: "#e3ebf7"
  focus-blue: "#3b82c4"
  plan-star: "#a87400"
  on-accent: "#ffffff"
  on-danger: "#ffffff"
  plan-star-dark: "#f0c36a"
  on-accent-dark: "#0f1a16"
  on-danger-dark: "#2a0f0d"
  pine-ink-dark: "#7fc3ac"
  night-paper: "#151917"
  night-sheet: "#1d2320"
  night-shade: "#252c28"
  night-rule: "#344039"
  night-graphite: "#e6ebe7"
  night-faded-graphite: "#a1ada5"
typography:
  headline:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.5
  badge:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.5rem
  mono:
    fontFamily: "ui-monospace, Cascadia Code, Consolas, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  small: "0.375rem"
  medium: "0.625rem"
  pill: "999px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.5rem"
  "6": "2rem"
components:
  button-default:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.small}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-default-hover:
    backgroundColor: "{colors.paper-shade}"
  button-primary:
    backgroundColor: "{colors.pine-ink}"
    textColor: "{colors.sheet-white}"
    rounded: "{rounded.small}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-primary-hover:
    backgroundColor: "{colors.pine-ink-deep}"
  button-ghost:
    textColor: "{colors.pine-ink}"
    rounded: "{rounded.small}"
    padding: "0.5rem 1rem"
  button-danger:
    textColor: "{colors.blocker-red}"
    rounded: "{rounded.small}"
    padding: "0.5rem 1rem"
  input:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.small}"
    padding: "0.5rem 0.75rem"
    height: "2.25rem"
  card:
    backgroundColor: "{colors.sheet-white}"
    rounded: "{rounded.medium}"
    padding: "1rem"
  nav-link-active:
    backgroundColor: "{colors.pine-wash}"
    textColor: "{colors.pine-ink-deep}"
    rounded: "{rounded.small}"
    padding: "0.5rem 0.75rem"
  badge-status:
    rounded: "{rounded.pill}"
    typography: "{typography.badge}"
    padding: "0 0.5rem"
  chip-project:
    textColor: "{colors.faded-graphite}"
    rounded: "{rounded.small}"
    padding: "0 0.5rem"
---

# Design System: Bitácora laboral

## Overview

**Creative North Star: "El cuaderno de campo"**

La bitácora se lee como un cuaderno de campo:
- Hojas blancas sobre papel cálido, una sola tinta verde pino y anotaciones cortas con fecha.
- Es una herramienta de todos los días, abierta al lado del editor, así que la densidad le gana al aire y la consistencia le gana a la sorpresa.
- Cada pantalla responde una pregunta concreta: qué hago hoy, qué digo en la daily, qué pasó esta semana.

La personalidad está en los detalles precisos:
- Fechas con números tabulares.
- Un filete de color a la izquierda que marca el estado de cada tarea.
- La estrella ★ del plan del día como único guiño cálido.

Los componentes son sobrios y precisos: bordes de un píxel, esquinas apenas redondeadas y sombras casi invisibles. Nada compite con el texto que el usuario escribió.

El modo oscuro no es una inversión. Es un cuaderno de noche: un papel verde muy oscuro y la tinta aclarada a verde menta para mantener el contraste.

**Key Characteristics:**
- Un solo acento cromático, el verde pino. Los demás colores son semánticos de estado.
- Tipografía del sistema, sin fuentes web: carga instantánea, offline y nativa en cada SO.
- Escala tipográfica compacta: el cuerpo es de 15px y los títulos no pasan de 24px.
- La profundidad sale del tono y del borde. La sombra es una ayuda mínima.
- Los estados se comunican con color y además con texto o forma (badge con etiqueta, filete lateral, tachado).

## Colors

Una paleta de papel y grafito, con una tinta verde pino y una familia semántica de estados, cada uno con su lavado suave.

### Primary
- **Verde pino** (#2f5d50; en oscuro, #7fc3ac): la única tinta de acción. Aparece en:
  - el botón primario;
  - los enlaces y el borde de la captura rápida;
  - los `summary` desplegables;
  - la estadística de acento.
- **Verde pino profundo** (#234a3f): el hover del primario y el texto de la sección activa en la navegación.
- **Lavado de pino** (#e1ece7): fondo de la sección activa, de las píldoras marcadas y de los badges de reunión e investigación, y filete de la línea de tiempo.

### Neutral
- **Papel cálido** (#f6f5f1; en oscuro, #151917): fondo de la página.
- **Hoja blanca** (#ffffff; en oscuro, #1d2320): superficie de tarjetas, campos y botones.
- **Sombra de papel** (#efede7; en oscuro, #252c28): superficie secundaria (hover, estadísticas, bloques de prompt, badges neutros).
- **Renglón de lápiz** (#dedad0; en oscuro, #344039): todos los bordes y divisores.
- **Grafito** (#1f2421; en oscuro, #e6ebe7): texto principal y fondo de los toasts neutros.
- **Grafito gastado** (#5e655f; en oscuro, #a1ada5): texto secundario, etiquetas de campo, fechas y pistas.

### Semantic
Cada estado tiene su tinta y su lavado, y se usan siempre en pareja (texto en tinta sobre lavado).
- **Verde hecho** (#2d7a46 sobre #e2f2e7): tareas completadas, resultados y toasts de éxito.
- **Azul en curso** (#345c99 sobre #e3ebf7): tareas en progreso (badge y filete) y banners informativos.
- **Rojo bloqueo** (#b3261e sobre #fbe4e2): tareas bloqueadas, bloqueos prolongados, acciones destructivas y toasts de error.
- **Ámbar de nota** (#8a5a00 sobre #fbf0d9): decisiones y avisos (por ejemplo, un resumen desactualizado).
- **Azul de foco** (#3b82c4): anillo de foco del teclado, y nada más.
- **Estrella del plan** (#a87400; en oscuro, #f0c36a): la estrella activa del plan del día, y nada más. Tiene al menos 3:1 contra la hoja.
- **Texto sobre tinta** (`--color-on-accent` y `--color-on-danger`): blanco en claro, tinta casi negra en oscuro. Todo texto sobre verde pino o rojo bloqueo usa estos tokens, nunca `#fff` fijo.

### Named Rules
**La regla de una sola tinta.** El verde pino es el único color sin significado de estado. Si algo es verde pino, se puede hacer clic o es la sección activa.

**La regla de la cifra que celebra.** Una estadística solo se pinta de verde hecho cuando es mayor que cero. Un cero va en grafito.

**La regla de la pareja.** Un color semántico nunca va solo sobre la hoja blanca en un área grande: va como texto sobre su propio lavado, o como filete de 3px.

## Typography

**Body Font:** system-ui (con -apple-system, Segoe UI, Roboto, sans-serif)
**Label/Mono Font:** ui-monospace (con Cascadia Code, Consolas, monospace)

**Character:** una sola familia del sistema en tres pesos (400, 500 y 600) que suena a herramienta del SO y no a sitio web. La mono queda para el texto que sale de la app: la daily y los prompts.

### Hierarchy
- **Headline** (600, 1.5rem, 1.25): el título de cada vista (`h1`).
- **Title** (600, 1.0625rem, 1.25): el título de cada tarjeta (`h2`).
- **Subtitle** (600, 0.9375rem): los subgrupos dentro de una tarjeta (`h3`).
- **Body** (400, 0.9375rem, 1.5): registros, descripciones y formularios.
- **Label** (500, 0.8125rem): las etiquetas de los campos, las pistas y los metadatos de los registros.
- **Badge** (600, 0.75rem, altura de línea 1.5rem): estados y tipos.
- **Link kind** (700, 0.6875rem, en mayúsculas): el prefijo PR, TICKET o DOC de los enlaces.
- **Stat** (600, 1.75rem, números tabulares): las cifras de los resúmenes de período.
- **Mono** (400, 0.875rem): el texto de la daily y la vista previa de los prompts.

### Named Rules
**La regla de los números tabulares.** Toda fecha o cifra que se compara en columna usa `font-variant-numeric: tabular-nums`.

**La regla de la mayúscula inicial.** Las fechas largas en español salen en minúscula de `Intl`. Se capitalizan con `::first-letter` y nunca con `text-transform: capitalize`, que rompería «de».

## Layout

- **Contenedor:** columna centrada de 78rem como máximo, con un margen de 1rem (0.75rem por debajo de 40rem).
- **Espaciado:** escala de 4px (`--space-1` a `--space-6`: 4, 8, 12, 16, 24 y 32px). Entre tarjetas va 16px, dentro de cada tarjeta 16px y entre filas de formulario 12px.
- **Grilla:**
  - Las vistas de dos columnas usan `auto-fit` con columnas de 24rem como mínimo.
  - Hoy, la Daily y el detalle de tarea usan una proporción 3:2 (`columns--wide-left`) que pasa a una sola columna por debajo de 52rem.
- **Encabezado:** fijo arriba, con fondo de hoja al 92% de opacidad y un desenfoque de 6px. A la derecha quedan el indicador de backup y la ayuda. La navegación se desplaza en horizontal sin barra visible; por debajo de 40rem baja a su propia fila, se desvanece en el borde derecho para avisar que sigue y la sección activa se desplaza a la vista.
- **Formularios:** `form-row` con `flex-wrap`; los campos crecen desde 9 a 14rem y las acciones quedan alineadas abajo.
- **Celular:**
  - Con puntero táctil, todo control mide al menos 44px (`--touch-target-min`).
  - Un `select` nunca es más ancho que su contenedor.
  - La captura rápida se apila en vertical.
  - Las acciones de cada tarea bajan a su propia fila por debajo de 34rem.
  - No hay scroll horizontal.

## Elevation & Depth

El sistema es casi plano:
- La profundidad sale del tono (papel cálido detrás, hoja blanca adelante) y del renglón de un píxel.
- La sombra de la tarjeta es una ayuda casi imperceptible.
- Solo el toast flota de verdad, porque está por encima del contenido.

### Shadow Vocabulary
- **Apoyo de hoja** (`box-shadow: 0 1px 2px rgb(30 35 30 / 6%), 0 2px 8px rgb(30 35 30 / 4%)`; en oscuro, `0 1px 2px rgb(0 0 0 / 30%)`): todas las tarjetas.
- **Toast** (`box-shadow: 0 6px 20px rgb(0 0 0 / 20%)`): las notificaciones flotantes.
- **Panel emergente** (`box-shadow: 0 8px 24px rgb(0 0 0 / 14%)`): el menú de estado, las sugerencias de `@` y el panel de ayuda. Aparecen con 180ms en `--ease-out-expo` desde 4px arriba.

### Named Rules
**La regla de la hoja apoyada.** Una tarjeta se distingue por su borde y su tono, no por su sombra. Si al quitar la sombra se pierde la jerarquía, el problema está en otro lado.

## Shapes

- Esquinas apenas redondeadas: 6px (`small`) en campos, botones, chips y banners, y 10px (`medium`) en tarjetas y toasts.
- Las píldoras (999px) quedan para los badges, las etiquetas y los selectores de día.
- Los bordes son de 1px. El filete de estado de las tareas y el borde de los avisos son de 3px y van del lado izquierdo.
- Los estados vacíos usan un borde punteado.

## Components

### Buttons
- **Forma:** esquinas suaves (0.375rem), 2.25rem de alto (1.875rem en `--small`) y peso 500.
- **Por defecto:** hoja blanca con renglón de lápiz. En hover pasa a sombra de papel con un borde en grafito gastado, y al presionar baja 1px.
- **Primario:** fondo y borde verde pino con texto blanco; en hover, verde pino profundo. En oscuro el texto pasa a #0f1a16 para el contraste.
- **Ghost:** transparente, con texto verde pino.
- **Peligro:** transparente, con texto y borde en rojo bloqueo; en hover se llena con el lavado rojo.
- **Ícono:** de 2rem como mínimo, transparente y en grafito gastado; en hover pasa a sombra de papel.

### Chips and Badges
- **Badge de estado:** píldora de 0.75rem en peso 600, con texto en la tinta del estado sobre su lavado. «Descartada» además va tachada.
- **Chip de proyecto:** rectángulo de esquina suave, con borde de lápiz, texto en grafito gastado y 0.75rem.

### Cards / Containers
- **Esquinas:** 0.625rem.
- **Fondo:** hoja blanca.
- **Borde:** renglón de lápiz de 1px.
- **Sombra:** apoyo de hoja.
- **Relleno:** 1rem.

### Inputs / Fields
- **Estilo:** hoja blanca, renglón de lápiz de 1px, 0.375rem de esquina y 2.25rem de alto como mínimo.
- **Hover:** el borde pasa a grafito gastado.
- **Foco:** contorno de 2px en azul de foco con 2px de separación (es el anillo global de `:focus-visible`).
- **Edición en línea:** sin borde ni fondo en reposo. El borde aparece en hover y la hoja blanca con borde de foco aparece al editar.

### Icons
- Íconos SVG propios en `src/ui/icons.js`: grilla de 16, trazo de 1.75px redondeado, sin relleno salvo la estrella activa.
- Nunca emojis ni glifos Unicode como ícono.

### Status menu (signature)
- Una píldora con el estado en su tinta sobre su lavado y una flecha; abre un panel con los cinco estados como radios.
- Elegir no aplica: el cambio se confirma con «Aplicar». Si se elige «Bloqueada», el motivo se escribe en el mismo panel. El detalle de tarea suma la fecha del cambio.
- Cada cambio deja un aviso con «Deshacer». Escape o un clic afuera cierran el panel sin tocar nada.

### Navigation
- Enlaces de 500 en grafito gastado; en hover, fondo de sombra de papel.
- La sección activa (`aria-current="page"`) usa el lavado de pino con texto en verde pino profundo, o en verde menta en modo oscuro.

### Task card (signature)
Una fila de grilla de tres columnas:
- la estrella del plan;
- el título con sus metadatos;
- las acciones (cambiar el estado y abrir la tarea).

El borde izquierdo de 3px lleva el estado: azul en curso, rojo bloqueo o renglón neutro.

### Quick capture (signature)
La única tarjeta con un borde verde pino de 1.5px. El campo principal mide 1.0625rem y 2.75rem de alto, porque es la acción más frecuente de la app.
- Debajo del campo, una línea de vista previa dice exactamente qué se va a guardar (tipo, tarea, fecha y enlaces). Los errores aparecen ahí mismo en rojo bloqueo, no en un aviso.
- Escribir `@` abre una lista de tareas abiertas que se filtra mientras se escribe; Enter o Tab elige.
- Tarea, tipo y fecha viven plegados en «Tarea, tipo y fecha».

### Backup indicator
Un enlace discreto del encabezado («Backup: hace 2 días»). Pasa al lavado ámbar con texto en negrita solo cuando no hay backup o tiene más días que el umbral del recordatorio.

## Do's and Don'ts

### Do:
- **Do** usar el verde pino solo para acciones, enlaces y la sección activa.
- **Do** escribir los estados como texto en la tinta del estado sobre su lavado (por ejemplo, #b3261e sobre #fbe4e2), con su etiqueta.
- **Do** mantener los bordes de 1px en renglón de lápiz (#dedad0) y la sombra mínima de apoyo de hoja.
- **Do** usar números tabulares en fechas y cifras.
- **Do** probar cada cambio en modo claro y en modo oscuro.
- **Do** pedir confirmación con un botón explícito («Aplicar») en todo cambio que altere el historial, y ofrecer «Deshacer».

### Don't:
- **Don't** agregar un segundo acento decorativo ni gradientes. Todo color nuevo tiene que significar un estado.
- **Don't** cargar fuentes web. La CSP solo permite `'self'` y la app tiene que funcionar offline.
- **Don't** comunicar un estado solo con color: siempre va acompañado de texto, forma o tachado.
- **Don't** usar `text-transform: capitalize` en fechas en español.
- **Don't** subir los títulos más allá de 1.5rem. Es una herramienta, no una página de presentación.
- **Don't** usar `window.prompt`, `window.alert` ni banners permanentes para avisos recurrentes.
