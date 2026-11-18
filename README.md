# Bitácora laboral

Bitácora personal para registrar tareas, actividades diarias y resultados, preparar la daily y armar prompts de resumen semanal y mensual. HTML, CSS y JavaScript sin dependencias ni backend: todo se guarda en IndexedDB, en tu navegador.

## Uso

Publicada en **https://guidomodarelli.github.io/bitacora-laboral/**: abrila y desde el menú del navegador instalala como app. Tus datos quedan en tu navegador; el sitio no tiene backend.

Para correrla localmente:

```bash
node scripts/serve.js
```

Abrí `http://localhost:4173` (el puerto se cambia con `BITACORA_PORT`). Desde el menú del navegador podés instalarla como app para usarla offline y en su propia ventana.

> No abras `index.html` con doble clic (`file://`): los módulos, el portapapeles, el modo offline y la persistencia del almacenamiento necesitan `localhost`.

### Captura rápida (pantalla Hoy)

| Escribís | Resultado |
|---|---|
| `Implementé endpoints` | Actividad de la tarea elegida (se recuerda la última) |
| `@autent implementé endpoints` | Asocia a la tarea cuyo título coincide con «autent» (al escribir `@` se sugieren tareas; Enter o Tab elige) |
| `! usar JWT` | Registra una decisión |
| `+ login en producción` | Registra un resultado |
| Una URL pegada | Se guarda como enlace (PR, ticket o doc, según la URL) |

Debajo del campo, una línea muestra exactamente qué se va a guardar. Tarea, tipo y fecha están plegados en «Tarea, tipo y fecha».

Atajos: `/` enfoca la captura, `Alt+1…7` cambia de sección. El botón `?` del encabezado los resume.

### Estados

El estado se cambia desde la píldora de cada tarea: elegís el nuevo estado (y el motivo, si es un bloqueo), confirmás con «Aplicar» y el aviso ofrece «Deshacer».

## Modelo

- **Tareas**: persisten entre días. Su estado solo cambia cuando lo cambiás vos, y cada cambio queda en `statusHistory` con su fecha. Así se reconstruye el estado de una tarea en cualquier fecha pasada.
- **Actividades**: acciones con fecha, asociadas a una tarea o sueltas (por proyecto). Tipos: avance, reunión, investigación, decisión y nota.
- **Resultados**: entregables o impactos reales, con fecha propia.
- **Plan del día**: tareas marcadas con ★ para hoy. Marcarlas no cambia su estado.

## Reglas de consolidación

- **Daily**: «ayer» es el día laboral anterior (el lunes usa el viernes, y se saltean los feriados). Si ese día no tiene registros, se usa el último día que sí tenga y se avisa.
- **Semanal**: la semana va de lunes a domingo (ISO). Cada tarea aparece una sola vez, clasificada según su estado al cierre de la semana: `COMPLETADA`, `CON AVANCES`, `BLOQUEADA` o `DESCARTADA`. Una tarea bloqueada al cierre entra aunque no haya tenido movimiento en la semana.
- **Mensual**: para cada semana que toca el mes, se usa el resumen semanal guardado solo si la semana cae entera dentro del mes y el resumen sigue vigente. En los demás casos se usan los registros diarios recortados a los días del mes. El prompt agrega «Hechos verificados» (completadas, resultados y tareas abiertas), calculados directamente de los datos.
- Un resumen queda **desactualizado** cuando cambian los registros de su período (se compara una huella de esos registros).

## Datos

En **Ajustes** podés:

- Exportar e importar JSON, fusionando (gana el registro con `updatedAt` más reciente) o reemplazando todo.
- Configurar el backup automático diario a una carpeta (Chrome/Edge).
- Pedir almacenamiento persistente.

La CSP de `index.html` impide cualquier conexión a otros orígenes.

## Estructura

```
src/constants/   vocabulario, estados, almacenamiento, plantillas
src/domain/      lógica pura (fechas, días laborales, historial, daily, consolidación, prompts)
src/db/          IndexedDB y migraciones
src/services/    data-store (memoria + persistencia), backups, APIs del navegador
src/ui/          shell, componentes y vistas
tests/           node:test sobre el dominio
```

## Tests

```bash
node --test "tests/**/*.test.js"
```
