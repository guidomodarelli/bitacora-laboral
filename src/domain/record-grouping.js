/**
 * Recolección de registros por período y agrupación por tarea y proyecto.
 * Es la base para que una misma tarea aparezca una sola vez con todos sus avances.
 */
import { isDateInRange } from './dates.js';
import { statusChangesInRange } from './task-history.js';

/**
 * @typedef {object} Project
 * @property {string} id
 * @property {string} name
 * @property {boolean} archived
 *
 * @typedef {object} Activity
 * @property {string} id
 * @property {string} date
 * @property {string|null} taskId
 * @property {string|null} projectId
 * @property {import('../constants/records.js').ActivityKind} kind
 * @property {string} text
 * @property {import('./links.js').Link[]} links
 * @property {string} createdAt
 * @property {string} updatedAt
 *
 * @typedef {object} WorkResult
 * @property {string} id
 * @property {string} date
 * @property {string|null} taskId
 * @property {string|null} projectId
 * @property {import('../constants/records.js').ResultType} type
 * @property {string} description
 * @property {import('./links.js').Link[]} links
 * @property {string} createdAt
 * @property {string} updatedAt
 *
 * @typedef {object} Snapshot
 * @property {Project[]} projects
 * @property {import('./task-history.js').Task[]} tasks
 * @property {Activity[]} activities
 * @property {WorkResult[]} results
 * @property {Array<{date: string, taskIds: string[], updatedAt: string}>} dayPlans
 * @property {Array<{date: string, text: string, updatedAt: string}>} dailyDrafts
 * @property {Array<object>} summaries
 * @property {Array<{kind: string, body: string, updatedAt: string}>} templates
 * @property {import('../constants/settings.js').AppSettings} settings
 *
 * @typedef {{taskId: string, change: import('./task-history.js').StatusChange}} TaskStatusChange
 *
 * @typedef {object} PeriodRecords
 * @property {Activity[]} activities
 * @property {WorkResult[]} results
 * @property {TaskStatusChange[]} statusChanges
 *
 * @typedef {object} RecordGroup
 * @property {string} key
 * @property {import('./task-history.js').Task|null} task `null` para registros sin tarea.
 * @property {Project|null} project
 * @property {Activity[]} activities
 * @property {WorkResult[]} results
 * @property {import('./task-history.js').StatusChange[]} statusChanges
 */

const LOOSE_GROUP_KEY_PREFIX = 'loose:';

/**
 * @template {{id: string}} RecordWithId
 * @param {RecordWithId[]} records
 * @returns {Map<string, RecordWithId>}
 */
export function indexById(records) {
  return new Map(records.map((record) => [record.id, record]));
}

/**
 * @param {{date: string, createdAt?: string}} left
 * @param {{date: string, createdAt?: string}} right
 */
export function compareByDateAndCreation(left, right) {
  if (left.date !== right.date) return left.date < right.date ? -1 : 1;
  return (left.createdAt ?? '').localeCompare(right.createdAt ?? '');
}

/**
 * @param {import('./dates.js').DateRange} range
 * @param {Snapshot} snapshot
 * @returns {PeriodRecords}
 */
export function collectRecordsInRange(range, snapshot) {
  return {
    activities: snapshot.activities.filter((activity) => isDateInRange(activity.date, range)).sort(compareByDateAndCreation),
    results: snapshot.results.filter((result) => isDateInRange(result.date, range)).sort(compareByDateAndCreation),
    statusChanges: snapshot.tasks.flatMap((task) => statusChangesInRange(task, range).map((change) => ({ taskId: task.id, change }))),
  };
}

/**
 * Agrupa registros por tarea; los registros sin tarea se agrupan por proyecto.
 * Orden: grupos con tarea (por proyecto y título) y luego los sueltos.
 * @param {PeriodRecords} records
 * @param {Snapshot} snapshot
 * @param {{extraTaskIds?: string[]}} [options] Tareas a incluir aunque no tengan registros (p. ej. creadas en el período).
 * @returns {RecordGroup[]}
 */
export function groupRecordsByTask(records, snapshot, { extraTaskIds = [] } = {}) {
  const tasksById = indexById(snapshot.tasks);
  const projectsById = indexById(snapshot.projects);
  /** @type {Map<string, RecordGroup>} */
  const groups = new Map();

  const ensureGroup = (taskId, projectId) => {
    const task = taskId ? tasksById.get(taskId) ?? null : null;
    const key = task ? task.id : `${LOOSE_GROUP_KEY_PREFIX}${projectId ?? ''}`;
    if (!groups.has(key)) {
      const resolvedProjectId = task ? task.projectId : projectId;
      groups.set(key, {
        key,
        task,
        project: resolvedProjectId ? projectsById.get(resolvedProjectId) ?? null : null,
        activities: [],
        results: [],
        statusChanges: [],
      });
    }
    return groups.get(key);
  };

  for (const activity of records.activities) ensureGroup(activity.taskId, activity.projectId).activities.push(activity);
  for (const result of records.results) ensureGroup(result.taskId, result.projectId).results.push(result);
  for (const { taskId, change } of records.statusChanges) ensureGroup(taskId, null).statusChanges.push(change);
  for (const taskId of extraTaskIds) if (tasksById.has(taskId)) ensureGroup(taskId, null);

  return [...groups.values()].sort(compareGroups);
}

/**
 * @param {RecordGroup} left
 * @param {RecordGroup} right
 */
function compareGroups(left, right) {
  if (Boolean(left.task) !== Boolean(right.task)) return left.task ? -1 : 1;
  const projectComparison = (left.project?.name ?? '￿').localeCompare(right.project?.name ?? '￿');
  if (projectComparison !== 0) return projectComparison;
  return (left.task?.title ?? '').localeCompare(right.task?.title ?? '');
}

/**
 * Fechas que tienen al menos una actividad, resultado o cambio de estado.
 * @param {Snapshot} snapshot
 * @returns {Set<string>}
 */
export function collectRecordDates(snapshot) {
  const dates = new Set();
  for (const activity of snapshot.activities) dates.add(activity.date);
  for (const result of snapshot.results) dates.add(result.date);
  for (const task of snapshot.tasks) {
    for (const change of task.statusHistory ?? []) if (change.from !== null) dates.add(change.date);
  }
  return dates;
}
