/** Prefijos de la barra de captura rápida. */
export const DECISION_PREFIX = '!';
export const RESULT_PREFIX = '+';

/** `@texto` referencia una tarea existente por su título. */
export const TASK_REFERENCE_PATTERN = /(?:^|\s)@([^\s@]+)/;

/** `@texto` que se está escribiendo justo antes del cursor (puede estar vacío). */
export const TASK_REFERENCE_AT_CARET_PATTERN = /(?:^|\s)@([^\s@]*)$/;

/** Cuántas tareas sugiere el autocompletado de `@`. */
export const TASK_SUGGESTION_LIMIT = 5;

/** Separadores que en una referencia `@login-jwt` equivalen a espacios. */
export const TASK_REFERENCE_SEPARATOR_PATTERN = /[-_.]+/g;
