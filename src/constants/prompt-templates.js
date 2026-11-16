/**
 * Plantillas por defecto de los prompts de resumen. Son editables desde Ajustes.
 * @typedef {'weekly'|'monthly'} TemplateKind
 */

export const TEMPLATE_KIND = Object.freeze({
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
});

/** Placeholders disponibles en todas las plantillas. */
export const TEMPLATE_PLACEHOLDER = Object.freeze({
  PERIOD: 'periodo',
  DATA: 'datos',
});

export const TEMPLATE_PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

/** @type {Readonly<Record<TemplateKind, string>>} */
export const DEFAULT_TEMPLATES = Object.freeze({
  weekly: `Actuá como asistente para redactar mi resumen semanal de trabajo.

Período: {{periodo}}

Cómo leer los datos:
1. Ya vienen agrupados por proyecto y por tarea. Cada tarea tiene un identificador [T#]: todos sus avances, aunque estén en días distintos, pertenecen a UNA sola tarea. No la dividas ni la cuentes dos veces.
2. La etiqueta de cada tarea es la fuente de verdad sobre su estado:
   - COMPLETADA: se terminó en esta semana.
   - CON AVANCES: avanzó pero sigue abierta. No la presentes como terminada.
   - BLOQUEADA: estaba bloqueada al cierre de la semana.
   - DESCARTADA: se abandonó en esta semana.
3. "Resultados" son entregables o impactos reales; usalos para los logros.
4. Las actividades marcadas como (decisión) son decisiones tomadas.
5. No inventes información que no esté en los datos.

Devolvé el resumen en español, conciso, con estas secciones:
- Resumen general (2 o 3 oraciones)
- Tareas completadas
- Avances por proyecto y tarea
- Resultados y entregables
- Problemas resueltos
- Decisiones importantes
- Bloqueos pendientes
- Trabajo que continúa la semana siguiente

Datos de la semana:

{{datos}}`,
  monthly: `Actuá como asistente para redactar mi resumen mensual de trabajo.

Período: {{periodo}}

Cómo leer los datos:
1. "Hechos verificados" se calcula directamente de mis registros y es la fuente de verdad sobre qué se completó en el mes, qué resultados hubo y qué sigue abierto. Si un resumen semanal parece contradecirlo, prevalecen los hechos verificados.
2. Cada semana viene como un resumen semanal ya redactado o como registros diarios. Las semanas que cruzan con otro mes vienen recortadas a los días de este mes: no atribuyas a este mes trabajo de fuera de esos días.
3. Una misma tarea [T#] o un mismo entregable puede aparecer en varias semanas: contalo una sola vez y describí su evolución.
4. Distinguí tareas terminadas de tareas que solo tuvieron avances.
5. No inventes información que no esté en los datos.

Devolvé el resumen en español con estas secciones:
- Principales logros del mes
- Funcionalidades y entregables completados
- Evolución de los proyectos
- Problemas importantes resueltos
- Decisiones relevantes
- Tareas que continúan abiertas
- Resultados concretos obtenidos

Datos del mes:

{{datos}}`,
});
