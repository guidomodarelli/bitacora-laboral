/**
 * Formatos de período y fuentes de consolidación.
 * @typedef {'week'|'month'} SummaryKind
 * @typedef {'summary'|'records'} MonthlyWeekSource
 * @typedef {'crosses_month'|'missing_summary'|'stale_summary'} RecordsFallbackReason
 */

export const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const WEEK_ID_PATTERN = /^(\d{4})-W(\d{2})$/;
export const MONTH_ID_PATTERN = /^(\d{4})-(\d{2})$/;

export const MILLISECONDS_PER_DAY = 86_400_000;
export const DAYS_PER_WEEK = 7;
/** Jueves: la semana ISO pertenece al año de su jueves. */
export const ISO_WEEK_ANCHOR_OFFSET_DAYS = 3;
/** El 4 de enero siempre cae en la semana ISO 1. */
export const ISO_FIRST_WEEK_REFERENCE_DAY = '01-04';

export const SUMMARY_KIND = Object.freeze({
  WEEK: 'week',
  MONTH: 'month',
});

export const MONTHLY_WEEK_SOURCE = Object.freeze({
  SUMMARY: 'summary',
  RECORDS: 'records',
});

export const RECORDS_FALLBACK_REASON = Object.freeze({
  CROSSES_MONTH: 'crosses_month',
  MISSING_SUMMARY: 'missing_summary',
  STALE_SUMMARY: 'stale_summary',
});

/** @type {Readonly<Record<RecordsFallbackReason, string>>} */
export const RECORDS_FALLBACK_REASON_LABELS = Object.freeze({
  crosses_month: 'la semana cruza dos meses: se usan solo los días de este mes',
  missing_summary: 'no hay resumen semanal guardado',
  stale_summary: 'el resumen guardado quedó desactualizado',
});

/**
 * Clasificación de una tarea dentro de un período (semana o tramo de mes).
 * @typedef {'completed'|'progressed'|'blocked'|'discarded'} TaskPeriodCategory
 */
export const TASK_PERIOD_CATEGORY = Object.freeze({
  COMPLETED: 'completed',
  PROGRESSED: 'progressed',
  BLOCKED: 'blocked',
  DISCARDED: 'discarded',
});

/** Etiquetas que ve la IA: son la fuente de verdad del estado de cada tarea. */
/** @type {Readonly<Record<TaskPeriodCategory, string>>} */
export const TASK_PERIOD_CATEGORY_LABELS = Object.freeze({
  completed: 'COMPLETADA',
  progressed: 'CON AVANCES',
  blocked: 'BLOQUEADA',
  discarded: 'DESCARTADA',
});

/** Prefijo de las referencias de tarea dentro de un prompt: T1, T2… */
export const TASK_REFERENCE_PREFIX = 'T';

/**
 * @param {SummaryKind} kind
 * @param {string} periodId `YYYY-Www` o `YYYY-MM`.
 * @returns {string}
 */
export function buildSummaryId(kind, periodId) {
  return `${kind}:${periodId}`;
}
