/** Prefijos de la barra de captura rápida. */
export const DECISION_PREFIX = '!';
export const RESULT_PREFIX = '+';

/** `@texto` referencia una tarea existente por su título. */
export const TASK_REFERENCE_PATTERN = /(?:^|\s)@([^\s@]+)/;

/** Separadores que en una referencia `@login-jwt` equivalen a espacios. */
export const TASK_REFERENCE_SEPARATOR_PATTERN = /[-_.]+/g;
