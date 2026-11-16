/**
 * Estados posibles de una tarea persistente.
 * @typedef {'pending'|'in_progress'|'blocked'|'completed'|'discarded'} TaskStatus
 */

export const TASK_STATUS = Object.freeze({
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  BLOCKED: 'blocked',
  COMPLETED: 'completed',
  DISCARDED: 'discarded',
});

/** @type {Readonly<Record<TaskStatus, string>>} */
export const TASK_STATUS_LABELS = Object.freeze({
  pending: 'Pendiente',
  in_progress: 'En progreso',
  blocked: 'Bloqueada',
  completed: 'Completada',
  discarded: 'Descartada',
});

/** Estados que se arrastran de un día laboral al siguiente. */
export const OPEN_TASK_STATUSES = Object.freeze(
  /** @type {TaskStatus[]} */ (['in_progress', 'blocked', 'pending']),
);

/** Orden de presentación en listados. */
export const TASK_STATUS_ORDER = Object.freeze(
  /** @type {TaskStatus[]} */ (['in_progress', 'blocked', 'pending', 'completed', 'discarded']),
);

/**
 * @param {TaskStatus} status
 * @returns {boolean}
 */
export function isOpenTaskStatus(status) {
  return OPEN_TASK_STATUSES.includes(status);
}
