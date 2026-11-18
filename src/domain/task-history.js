/**
 * Historial de estados de una tarea. Las tareas nunca cambian de estado solas:
 * cada cambio lo hace el usuario y queda registrado con su fecha, lo que permite
 * reconstruir el estado de una tarea en cualquier día pasado.
 */
import { TASK_STATUS } from '../constants/task-status.js';
import { isDateInRange } from './dates.js';

/**
 * @typedef {import('../constants/task-status.js').TaskStatus} TaskStatus
 * @typedef {object} StatusChange
 * @property {TaskStatus|null} from `null` en la entrada de creación.
 * @property {TaskStatus} to
 * @property {string} date Fecha de negocio `YYYY-MM-DD`.
 * @property {string} at Timestamp ISO de cuándo se registró.
 * @property {string} note Motivo o comentario (p. ej. causa del bloqueo).
 *
 * @typedef {object} Task
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string|null} projectId
 * @property {TaskStatus} status
 * @property {Array<import('./links.js').Link>} links
 * @property {string} createdOn
 * @property {string|null} completedOn
 * @property {{reason: string, since: string}|null} blocker
 * @property {StatusChange[]} statusHistory
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @param {StatusChange} left
 * @param {StatusChange} right
 */
function compareStatusChanges(left, right) {
  if (left.date !== right.date) return left.date < right.date ? -1 : 1;
  if (left.at === right.at) return 0;
  return left.at < right.at ? -1 : 1;
}

/**
 * @param {Task} task
 * @returns {StatusChange[]} Historial ordenado cronológicamente por fecha de negocio.
 */
export function sortedStatusHistory(task) {
  return [...(task.statusHistory ?? [])].sort(compareStatusChanges);
}

/**
 * Estado que tenía la tarea al final del día indicado.
 * @param {Task} task
 * @param {string} dateKey
 * @returns {TaskStatus|null} `null` si la tarea todavía no existía.
 */
export function statusAt(task, dateKey) {
  if (task.createdOn > dateKey) return null;
  let status = null;
  for (const change of sortedStatusHistory(task)) {
    if (change.date > dateKey) break;
    status = change.to;
  }
  return status ?? task.status;
}

/**
 * Cambios de estado (sin la entrada de creación) dentro del rango.
 * @param {Task} task
 * @param {import('./dates.js').DateRange} range
 * @returns {StatusChange[]}
 */
export function statusChangesInRange(task, range) {
  return sortedStatusHistory(task).filter((change) => change.from !== null && isDateInRange(change.date, range));
}

/**
 * La tarea pasó a completada dentro del rango y seguía completada al cierre.
 * @param {Task} task
 * @param {import('./dates.js').DateRange} range
 */
export function wasCompletedInRange(task, range) {
  return statusAt(task, range.end) === TASK_STATUS.COMPLETED
    && sortedStatusHistory(task).some((change) => change.to === TASK_STATUS.COMPLETED && isDateInRange(change.date, range));
}

/**
 * @param {TaskStatus} status
 * @param {string} dateKey
 * @param {string} atIso
 * @returns {StatusChange[]}
 */
export function createInitialStatusHistory(status, dateKey, atIso) {
  return [{ from: null, to: status, date: dateKey, at: atIso, note: '' }];
}

/**
 * Devuelve una copia de la tarea con el nuevo estado aplicado y registrado.
 * Recalcula `completedOn` y `blocker` a partir del historial.
 * @param {Task} task
 * @param {{status: TaskStatus, dateKey: string, atIso: string, note?: string}} change
 * @returns {Task}
 */
export function applyStatusChange(task, { status, dateKey, atIso, note = '' }) {
  const trimmedNote = note.trim();
  if (status === task.status) {
    if (status !== TASK_STATUS.BLOCKED || !trimmedNote) return task;
    return { ...task, blocker: { reason: trimmedNote, since: task.blocker?.since ?? dateKey }, updatedAt: atIso };
  }
  const statusHistory = [...(task.statusHistory ?? []), { from: task.status, to: status, date: dateKey, at: atIso, note: trimmedNote }];
  return withDerivedStatus(task, statusHistory, atIso);
}

/**
 * Deshace un cambio de estado registrado: lo quita del historial y recalcula el estado vigente.
 * La entrada de creación no se puede deshacer.
 * @param {Task} task
 * @param {string} changeAtIso Timestamp `at` del cambio a deshacer.
 * @param {string} atIso Momento en que se deshace.
 * @returns {Task} La misma tarea si no existe ese cambio.
 */
export function revertStatusChange(task, changeAtIso, atIso) {
  const statusHistory = (task.statusHistory ?? []).filter((change) => change.from === null || change.at !== changeAtIso);
  if (statusHistory.length === (task.statusHistory ?? []).length) return task;
  return withDerivedStatus(task, statusHistory, atIso);
}

/**
 * Un cambio puede registrarse con fecha retroactiva: el estado vigente es el del último cambio por fecha.
 * @param {Task} task
 * @param {StatusChange[]} statusHistory
 * @param {string} atIso
 * @returns {Task}
 */
function withDerivedStatus(task, statusHistory, atIso) {
  const latestChange = sortedStatusHistory({ ...task, statusHistory }).at(-1);
  return {
    ...task,
    statusHistory,
    status: latestChange.to,
    completedOn: latestChange.to === TASK_STATUS.COMPLETED ? latestChange.date : null,
    blocker: latestChange.to === TASK_STATUS.BLOCKED ? { reason: latestChange.note, since: latestChange.date } : null,
    updatedAt: atIso,
  };
}
