/**
 * Arma la daily: qué hice el día laboral anterior, qué voy a hacer hoy y bloqueos.
 */
import { ACTIVITY_KIND, ACTIVITY_KIND_LABELS, RESULT_TYPE_LABELS } from '../constants/records.js';
import { TASK_STATUS, TASK_STATUS_LABELS } from '../constants/task-status.js';
import { formatDateLong } from './date-format.js';
import { collectRecordDates, collectRecordsInRange, groupRecordsByTask, indexById } from './record-grouping.js';
import { countWorkdaysSince, previousWorkday } from './workdays.js';

/**
 * @typedef {import('./record-grouping.js').Snapshot} Snapshot
 * @typedef {import('./task-history.js').Task} Task
 *
 * @typedef {object} PreviousDay
 * @property {string|null} dateKey Día cuyos registros se muestran.
 * @property {string|null} expectedDateKey Día laboral anterior según calendario.
 * @property {boolean} isFallback Se usa el último día con registros porque el día laboral anterior no tiene.
 * @property {import('./record-grouping.js').RecordGroup[]} groups
 *
 * @typedef {object} PlanItem
 * @property {Task} task
 * @property {import('./record-grouping.js').Project|null} project
 *
 * @typedef {object} BlockerItem
 * @property {Task} task
 * @property {import('./record-grouping.js').Project|null} project
 * @property {string} reason
 * @property {string} since
 * @property {number} workdaysBlocked
 * @property {boolean} isProlonged Supera el umbral configurado de días hábiles.
 *
 * @typedef {object} Daily
 * @property {string} dateKey
 * @property {PreviousDay} previous
 * @property {{items: PlanItem[], isSuggestion: boolean}} plan
 * @property {BlockerItem[]} blockers
 */

/**
 * Determina qué día usar para «¿Qué hice ayer?». Un lunes usa el viernes; si ese
 * día no tiene registros (vacaciones, olvido), usa el último día con registros.
 * @param {string} dateKey
 * @param {Snapshot} snapshot
 * @returns {{dateKey: string|null, expectedDateKey: string|null, isFallback: boolean}}
 */
export function resolvePreviousRecordDate(dateKey, snapshot) {
  const expectedDateKey = previousWorkday(dateKey, snapshot.settings);
  const recordDates = collectRecordDates(snapshot);
  if (expectedDateKey && recordDates.has(expectedDateKey)) return { dateKey: expectedDateKey, expectedDateKey, isFallback: false };
  const lastRecordDate = [...recordDates].filter((recordDate) => recordDate < dateKey).sort().at(-1);
  if (lastRecordDate) return { dateKey: lastRecordDate, expectedDateKey, isFallback: lastRecordDate !== expectedDateKey };
  return { dateKey: expectedDateKey, expectedDateKey, isFallback: false };
}

/**
 * @param {string} dateKey
 * @param {Snapshot} snapshot
 * @returns {Daily}
 */
export function buildDaily(dateKey, snapshot) {
  const projectsById = indexById(snapshot.projects);
  const tasksById = indexById(snapshot.tasks);
  const projectOf = (task) => (task.projectId ? projectsById.get(task.projectId) ?? null : null);

  const previousDate = resolvePreviousRecordDate(dateKey, snapshot);
  const groups = previousDate.dateKey
    ? groupRecordsByTask(collectRecordsInRange({ start: previousDate.dateKey, end: previousDate.dateKey }, snapshot), snapshot)
    : [];

  const plannedTaskIds = snapshot.dayPlans.find((dayPlan) => dayPlan.date === dateKey)?.taskIds ?? [];
  const plannedTasks = plannedTaskIds.map((taskId) => tasksById.get(taskId)).filter(Boolean);
  const isSuggestion = plannedTasks.length === 0;
  const planTasks = isSuggestion ? snapshot.tasks.filter((task) => task.status === TASK_STATUS.IN_PROGRESS) : plannedTasks;

  const blockers = snapshot.tasks
    .filter((task) => task.status === TASK_STATUS.BLOCKED)
    .map((task) => {
      const since = task.blocker?.since ?? task.createdOn;
      const workdaysBlocked = countWorkdaysSince(since, dateKey, snapshot.settings);
      return {
        task,
        project: projectOf(task),
        reason: task.blocker?.reason ?? '',
        since,
        workdaysBlocked,
        isProlonged: workdaysBlocked >= snapshot.settings.blockerAlertWorkdays,
      };
    })
    .sort((left, right) => right.workdaysBlocked - left.workdaysBlocked);

  return {
    dateKey,
    previous: { ...previousDate, groups },
    plan: { items: planTasks.map((task) => ({ task, project: projectOf(task) })), isSuggestion },
    blockers,
  };
}

/**
 * @param {{task: Task|null, project: {name: string}|null}} item
 */
function describeTaskItem({ task, project }) {
  const projectPrefix = project ? `[${project.name}] ` : '';
  return `${projectPrefix}${task ? task.title : 'Sin tarea'}`;
}

/**
 * Texto listo para pegar en la reunión. El usuario puede editarlo antes de copiar.
 * @param {Daily} daily
 * @returns {string}
 */
export function renderDailyText(daily) {
  const lines = [`Daily · ${formatDateLong(daily.dateKey)}`, ''];

  const previousLabel = daily.previous.dateKey ? ` (${formatDateLong(daily.previous.dateKey)})` : '';
  lines.push(`¿Qué hice ayer?${previousLabel}`);
  if (daily.previous.groups.length === 0) lines.push('• Sin registros.');
  for (const group of daily.previous.groups) {
    lines.push(`• ${describeTaskItem(group)}`);
    for (const activity of group.activities) {
      const kindPrefix = activity.kind === ACTIVITY_KIND.WORK ? '' : `${ACTIVITY_KIND_LABELS[activity.kind]}: `;
      lines.push(`  – ${kindPrefix}${activity.text}`);
    }
    for (const change of group.statusChanges) {
      const note = change.note ? ` (${change.note})` : '';
      lines.push(`  – Pasó a ${TASK_STATUS_LABELS[change.to].toLowerCase()}${note}`);
    }
    for (const result of group.results) lines.push(`  – Resultado (${RESULT_TYPE_LABELS[result.type].toLowerCase()}): ${result.description}`);
  }

  lines.push('', '¿Qué voy a hacer hoy?');
  if (daily.plan.items.length === 0) lines.push('• Sin tareas planificadas.');
  for (const item of daily.plan.items) {
    const statusSuffix = item.task.status === TASK_STATUS.PENDING ? ' (empiezo)' : '';
    lines.push(`• ${describeTaskItem(item)}${statusSuffix}`);
  }

  lines.push('', '¿Tengo bloqueos?');
  if (daily.blockers.length === 0) lines.push('• Sin bloqueos.');
  for (const blocker of daily.blockers) {
    const reason = blocker.reason ? `: ${blocker.reason}` : '';
    const workdayWord = blocker.workdaysBlocked === 1 ? 'día hábil' : 'días hábiles';
    lines.push(`• ${describeTaskItem(blocker)}${reason} (bloqueada hace ${blocker.workdaysBlocked} ${workdayWord})`);
  }

  return lines.join('\n');
}
