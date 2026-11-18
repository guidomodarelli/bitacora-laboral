/**
 * Consolidación de períodos: semana (lunes a domingo) y mes calendario.
 * La app clasifica cada tarea; la IA solo redacta a partir de esa clasificación.
 */
import {
  MONTHLY_WEEK_SOURCE,
  RECORDS_FALLBACK_REASON,
  SUMMARY_KIND,
  TASK_PERIOD_CATEGORY,
  TASK_REFERENCE_PREFIX,
  buildSummaryId,
} from '../constants/periods.js';
import { TASK_STATUS, isOpenTaskStatus } from '../constants/task-status.js';
import { isDateInRange, monthRangeFromId, weekRangeFromId, weeksTouchingMonth } from './dates.js';
import { collectRecordsInRange, groupRecordsByTask, indexById } from './record-grouping.js';
import { sortedStatusHistory, statusAt, wasCompletedInRange } from './task-history.js';

/**
 * @typedef {import('./record-grouping.js').Snapshot} Snapshot
 * @typedef {import('./dates.js').DateRange} DateRange
 * @typedef {import('./task-history.js').Task} Task
 * @typedef {import('../constants/periods.js').TaskPeriodCategory} TaskPeriodCategory
 *
 * @typedef {import('./record-grouping.js').RecordGroup & {
 *   task: Task,
 *   reference: string,
 *   category: TaskPeriodCategory,
 *   statusAtEnd: import('../constants/task-status.js').TaskStatus|null,
 *   startedInPeriod: boolean,
 *   completedOn: string|null,
 *   blockerReasonAtEnd: string,
 * }} TaskPeriodEntry
 *
 * @typedef {object} PeriodReport
 * @property {DateRange} range
 * @property {TaskPeriodEntry[]} taskEntries
 * @property {import('./record-grouping.js').RecordGroup[]} looseGroups Registros sin tarea, por proyecto.
 * @property {Record<TaskPeriodCategory, number>} categoryCounts
 * @property {number} resultCount
 * @property {boolean} isEmpty
 *
 * @typedef {object} SavedSummary
 * @property {string} id
 * @property {import('../constants/periods.js').SummaryKind} kind
 * @property {string} periodId
 * @property {string} content
 * @property {string} savedAt
 * @property {string} [sourceFingerprint]
 */

/**
 * Asigna referencias estables T1, T2… compartidas entre varios reportes del mismo prompt.
 */
export class TaskReferenceRegistry {
  constructor() {
    /** @type {Map<string, string>} */
    this.referencesByTaskId = new Map();
  }

  /** @param {string} taskId */
  referenceFor(taskId) {
    if (!this.referencesByTaskId.has(taskId)) {
      this.referencesByTaskId.set(taskId, `${TASK_REFERENCE_PREFIX}${this.referencesByTaskId.size + 1}`);
    }
    return this.referencesByTaskId.get(taskId);
  }
}

/**
 * @param {Task} task
 * @param {DateRange} range
 * @returns {TaskPeriodCategory}
 */
export function classifyTaskInRange(task, range) {
  if (wasCompletedInRange(task, range)) return TASK_PERIOD_CATEGORY.COMPLETED;
  const statusAtEnd = statusAt(task, range.end);
  if (statusAtEnd === TASK_STATUS.DISCARDED) return TASK_PERIOD_CATEGORY.DISCARDED;
  if (statusAtEnd === TASK_STATUS.BLOCKED) return TASK_PERIOD_CATEGORY.BLOCKED;
  return TASK_PERIOD_CATEGORY.PROGRESSED;
}

/**
 * @param {Task} task
 * @param {DateRange} range
 * @returns {string|null} Fecha de la última completación dentro del rango.
 */
function completionDateInRange(task, range) {
  return sortedStatusHistory(task)
    .filter((change) => change.to === TASK_STATUS.COMPLETED && isDateInRange(change.date, range))
    .at(-1)?.date ?? null;
}

/**
 * @param {Task} task
 * @param {string} dateKey
 * @returns {string} Motivo del bloqueo vigente en esa fecha.
 */
function blockerReasonAt(task, dateKey) {
  return sortedStatusHistory(task)
    .filter((change) => change.to === TASK_STATUS.BLOCKED && change.date <= dateKey)
    .at(-1)?.note ?? '';
}

/**
 * Reporte de un período: cada tarea tocada aparece una sola vez, con su
 * clasificación según el estado que tenía al cierre del período.
 * @param {DateRange} range
 * @param {Snapshot} snapshot
 * @param {{references?: TaskReferenceRegistry}} [options]
 * @returns {PeriodReport}
 */
export function buildPeriodReport(range, snapshot, { references = new TaskReferenceRegistry() } = {}) {
  const records = collectRecordsInRange(range, snapshot);
  const tasksCreatedInRange = snapshot.tasks.filter((task) => isDateInRange(task.createdOn, range)).map((task) => task.id);
  // Un bloqueo vigente al cierre se reporta aunque la tarea no haya tenido movimiento:
  // es justo lo que la daily ya está avisando.
  const tasksBlockedAtEnd = snapshot.tasks.filter((task) => statusAt(task, range.end) === TASK_STATUS.BLOCKED).map((task) => task.id);
  const groups = groupRecordsByTask(records, snapshot, { extraTaskIds: [...tasksCreatedInRange, ...tasksBlockedAtEnd] });

  /** @type {Record<TaskPeriodCategory, number>} */
  const categoryCounts = { completed: 0, progressed: 0, blocked: 0, discarded: 0 };
  const taskEntries = groups
    .filter((group) => group.task)
    .map((group) => {
      const task = /** @type {Task} */ (group.task);
      const category = classifyTaskInRange(task, range);
      categoryCounts[category] += 1;
      return {
        ...group,
        task,
        reference: references.referenceFor(task.id),
        category,
        statusAtEnd: statusAt(task, range.end),
        startedInPeriod: isDateInRange(task.createdOn, range),
        completedOn: category === TASK_PERIOD_CATEGORY.COMPLETED ? completionDateInRange(task, range) : null,
        blockerReasonAtEnd: category === TASK_PERIOD_CATEGORY.BLOCKED ? blockerReasonAt(task, range.end) : '',
      };
    });
  const looseGroups = groups.filter((group) => !group.task);

  return {
    range,
    taskEntries,
    looseGroups,
    categoryCounts,
    resultCount: records.results.length,
    isEmpty: taskEntries.length === 0 && looseGroups.length === 0,
  };
}

/**
 * Huella de los registros de un período: cambia si se crea, edita o borra algo.
 * Se guarda junto al resumen para detectar resúmenes desactualizados.
 * @param {DateRange} range
 * @param {Snapshot} snapshot
 * @returns {string}
 */
export function computeSourceFingerprint(range, snapshot) {
  const records = collectRecordsInRange(range, snapshot);
  const timestamps = [
    ...records.activities.map((activity) => activity.updatedAt),
    ...records.results.map((result) => result.updatedAt),
    ...records.statusChanges.map(({ change }) => change.at),
  ];
  const latestTimestamp = timestamps.sort().at(-1) ?? '';
  return `${timestamps.length}:${latestTimestamp}`;
}

/**
 * @param {SavedSummary} summary
 * @param {DateRange} range
 * @param {Snapshot} snapshot
 */
export function isSummaryStale(summary, range, snapshot) {
  if (!summary.sourceFingerprint) return false;
  return summary.sourceFingerprint !== computeSourceFingerprint(range, snapshot);
}

/**
 * @param {Snapshot} snapshot
 * @param {import('../constants/periods.js').SummaryKind} kind
 * @param {string} periodId
 * @returns {SavedSummary|null}
 */
export function findSummary(snapshot, kind, periodId) {
  const summaryId = buildSummaryId(kind, periodId);
  return /** @type {SavedSummary|undefined} */ (snapshot.summaries.find((summary) => summary.id === summaryId)) ?? null;
}

/**
 * @param {string} weekId
 * @param {Snapshot} snapshot
 */
export function buildWeeklyReport(weekId, snapshot) {
  const range = weekRangeFromId(weekId);
  const summary = findSummary(snapshot, SUMMARY_KIND.WEEK, weekId);
  return {
    weekId,
    range,
    report: buildPeriodReport(range, snapshot),
    summary,
    isSummaryStale: summary ? isSummaryStale(summary, range, snapshot) : false,
  };
}

/**
 * @typedef {object} MonthlyWeekEntry
 * @property {string} weekId
 * @property {DateRange} weekRange
 * @property {DateRange} monthRange
 * @property {boolean} crossesMonth
 * @property {import('../constants/periods.js').MonthlyWeekSource} source
 * @property {import('../constants/periods.js').RecordsFallbackReason|null} fallbackReason
 * @property {SavedSummary|null} summary
 * @property {PeriodReport|null} report Solo cuando la fuente son los registros diarios.
 *
 * @typedef {object} MonthlyFacts
 * @property {Array<{reference: string, task: Task, project: object|null, completedOn: string}>} completedTasks
 * @property {Array<{result: import('./record-grouping.js').WorkResult, task: Task|null, reference: string|null}>} results
 * @property {Array<{reference: string, task: Task, project: object|null, statusAtEnd: string}>} openTasksAtEnd
 */

/**
 * Consolidación mensual. Usa el resumen semanal solo si la semana cae entera
 * dentro del mes y el resumen está vigente; si no, usa los registros diarios
 * recortados a los días del mes. Agrega hechos verificados calculados de los datos.
 * @param {string} monthId
 * @param {Snapshot} snapshot
 */
export function buildMonthlyReport(monthId, snapshot) {
  const range = monthRangeFromId(monthId);
  const references = new TaskReferenceRegistry();
  const projectsById = indexById(snapshot.projects);
  const tasksById = indexById(snapshot.tasks);
  const projectOf = (task) => (task?.projectId ? projectsById.get(task.projectId) ?? null : null);

  const completedTasks = snapshot.tasks
    .filter((task) => wasCompletedInRange(task, range))
    .map((task) => ({ reference: references.referenceFor(task.id), task, project: projectOf(task), completedOn: completionDateInRange(task, range) }))
    .sort((left, right) => left.completedOn.localeCompare(right.completedOn));

  const results = snapshot.results
    .filter((result) => isDateInRange(result.date, range))
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((result) => {
      const task = result.taskId ? tasksById.get(result.taskId) ?? null : null;
      return { result, task, reference: task ? references.referenceFor(task.id) : null };
    });

  /** @type {MonthlyWeekEntry[]} */
  const weeks = weeksTouchingMonth(monthId).map((segment) => {
    const summary = findSummary(snapshot, SUMMARY_KIND.WEEK, segment.weekId);
    let fallbackReason = null;
    if (segment.crossesMonth) fallbackReason = RECORDS_FALLBACK_REASON.CROSSES_MONTH;
    else if (!summary) fallbackReason = RECORDS_FALLBACK_REASON.MISSING_SUMMARY;
    else if (isSummaryStale(summary, segment.weekRange, snapshot)) fallbackReason = RECORDS_FALLBACK_REASON.STALE_SUMMARY;

    return {
      ...segment,
      source: fallbackReason ? MONTHLY_WEEK_SOURCE.RECORDS : MONTHLY_WEEK_SOURCE.SUMMARY,
      fallbackReason,
      summary,
      report: fallbackReason ? buildPeriodReport(segment.monthRange, snapshot, { references }) : null,
    };
  });

  const openTasksAtEnd = snapshot.tasks
    .filter((task) => {
      const statusAtEnd = statusAt(task, range.end);
      return statusAtEnd !== null && isOpenTaskStatus(statusAtEnd);
    })
    .map((task) => ({ reference: references.referenceFor(task.id), task, project: projectOf(task), statusAtEnd: statusAt(task, range.end) }));

  return {
    monthId,
    range,
    weeks,
    facts: /** @type {MonthlyFacts} */ ({ completedTasks, results, openTasksAtEnd }),
    summary: findSummary(snapshot, SUMMARY_KIND.MONTH, monthId),
  };
}
