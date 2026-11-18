# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Un único usuario: el propio autor, desarrollador de software. Usa la bitácora para sí mismo, no para un equipo. Durante la jornada registra capturas cortas (qué hizo, qué decidió, qué resultado obtuvo). Antes de la daily de la mañana arma el «ayer / hoy / bloqueos». Al cierre de cada semana y de cada mes genera el prompt para que una IA redacte el resumen y después lo guarda.

## Product Purpose

Recordar qué se hizo, cuándo y para qué tarea, sin depender de la memoria. El objetivo es que la daily, el resumen semanal y el mensual salgan de los registros en minutos, sin reconstruirlos a mano. La bitácora tiene éxito si registrar algo toma segundos y si los reportes no duplican tareas ni pierden avances.

## Positioning

Es local, privada y sin backend. Separa tareas que persisten entre días de actividades fechadas. Las tareas nunca se cierran solas y su historial de estados permite reconstruir cómo estaba cada una en cualquier fecha pasada. Los reportes se consolidan por tarea (una tarea aparece una sola vez por período) y la app no le manda nada a ningún servicio externo: el usuario copia el prompt y lo pega en la IA que prefiera.

## Operating Context

- Se usa sobre todo en escritorio: una ventana del navegador o una PWA instalada al lado del editor. El celular es secundario.
- Uso diario y repetitivo: capturas rápidas con el teclado (`/` enfoca la captura, `Alt+1…7` cambia de sección).
- Rituales:
  - Daily a la mañana: el lunes toma el viernes y se saltean los feriados.
  - Resumen semanal ISO, de lunes a domingo.
  - Resumen mensual armado con los resúmenes semanales y los registros diarios.
- Los registros enlazan tickets, PRs y documentos por URL.

## Capabilities and Constraints

- Secciones: Hoy, Daily, Tareas, Historial, Semanal, Mensual y Ajustes.
- Entidades:
  - **Tareas**, con los estados pendiente, en progreso, bloqueada, completada y descartada.
  - **Actividades**, de tipo avance, reunión, investigación, decisión o nota.
  - **Resultados.**
  - **Plan del día** (★). Marcar una tarea para hoy no cambia su estado.
- Captura rápida:
  - `@tarea` asocia la actividad a una tarea.
  - `!` registra una decisión.
  - `+` registra un resultado.
  - Una URL pegada se guarda como enlace.
- Persistencia y datos:
  - Todo se guarda en IndexedDB y funciona offline.
  - Exportación e importación JSON, fusionando o reemplazando.
  - Backup diario a una carpeta elegida por el usuario (File System Access).
- Restricciones técnicas:
  - HTML, CSS y JavaScript sin dependencias ni paso de build.
  - Se sirve en localhost con `node scripts/serve.js`.
  - La CSP permite solo `'self'`.
- Idioma de la interfaz: español rioplatense (`es-AR`, voseo).

## Evidence on Hand

No hay testimonios, métricas ni usuarios externos, y no hay que inventarlos. El repo es público en GitHub, pero el producto es de uso personal.

## Product Principles

1. Capturar tiene que costar menos que olvidar: la acción de registrar es la más rápida de la app.
2. El estado de una tarea lo cambia el usuario, nunca el calendario.
3. Cada dato se cuenta una sola vez: los reportes consolidan por tarea y dicen de dónde sale cada número.
4. Los datos son del usuario: son locales, se pueden exportar y no salen del navegador sin una acción explícita.
5. Es una herramienta de todos los días: la densidad y la consistencia importan más que el adorno.

## Accessibility & Inclusion

Base WCAG 2.2 AA: contraste, foco visible y uso completo con teclado. No hay requisitos adicionales.
