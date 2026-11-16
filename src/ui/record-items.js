/**
 * Filas de actividades, resultados y cambios de estado, editables en línea.
 */
import { TASK_STATUS_LABELS } from '../constants/task-status.js';
import { formatDateShort } from '../domain/date-format.js';
import { todayKey } from '../domain/dates.js';
import { deleteRecord, duplicateActivity, restoreRecord, updateActivity, updateResult } from '../services/data-store.js';
import { kindBadge, linkList, projectChip, resultBadge, runAction } from './components.js';
import { h } from './dom.js';
import { showToast } from './toast.js';

/**
 * @typedef {object} RecordItemOptions
 * @property {boolean} [showDate]
 * @property {boolean} [showTask]
 * @property {boolean} [allowDuplicate]
 */

/**
 * @param {{taskId: string|null, projectId: string|null}} record
 * @param {import('../domain/record-grouping.js').Snapshot} snapshot
 */
function recordContext(record, snapshot) {
  const task = record.taskId ? snapshot.tasks.find((candidate) => candidate.id === record.taskId) : null;
  const projectId = task?.projectId ?? record.projectId;
  const project = projectId ? snapshot.projects.find((candidate) => candidate.id === projectId) : null;
  return { task, project };
}

/**
 * @param {'activities'|'results'} storeName
 * @param {string} recordId
 * @param {string} label
 */
async function deleteWithUndo(storeName, recordId, label) {
  const deleted = await runAction(`recordItems:delete:${storeName}`, () => deleteRecord(storeName, recordId));
  if (!deleted) return;
  showToast(`${label} borrado`, {
    actionLabel: 'Deshacer',
    onAction: () => runAction(`recordItems:restore:${storeName}`, () => restoreRecord(storeName, deleted), 'Restaurado'),
  });
}

/**
 * @param {import('../domain/record-grouping.js').Activity} activity
 * @param {import('../domain/record-grouping.js').Snapshot} snapshot
 * @param {RecordItemOptions} [options]
 */
export function activityItem(activity, snapshot, { showDate = false, showTask = true, allowDuplicate = false } = {}) {
  const { task, project } = recordContext(activity, snapshot);
  const today = todayKey();
  return h('li', { class: 'record-item' },
    h('div', { class: 'record-item__meta' },
      showDate ? h('span', { class: 'record-item__date' }, formatDateShort(activity.date)) : null,
      kindBadge(activity.kind),
      showTask && task ? h('a', { href: `#/tareas/${task.id}`, class: 'record-item__task' }, task.title) : null,
      showTask && !task ? h('span', { class: 'record-item__task record-item__task--none' }, 'Sin tarea') : null,
      showTask ? projectChip(project) : null,
    ),
    h('input', {
      class: 'inline-edit',
      value: activity.text,
      'aria-label': 'Texto de la actividad',
      dataset: { focusKey: `activity-${activity.id}` },
      onChange: (event) => runAction('recordItems:updateActivity', () => updateActivity(activity.id, { text: event.target.value })),
    }),
    linkList(activity.links),
    h('div', { class: 'record-item__actions' },
      allowDuplicate && activity.date !== today
        ? h('button', { type: 'button', class: 'button button--ghost button--small', onClick: () => runAction('recordItems:duplicate', () => duplicateActivity(activity.id, today), 'Copiada a hoy') }, 'Repetir hoy')
        : null,
      h('button', { type: 'button', class: 'icon-button', 'aria-label': `Borrar actividad: ${activity.text}`, onClick: () => deleteWithUndo('activities', activity.id, 'Actividad') }, '🗑'),
    ),
  );
}

/**
 * @param {import('../domain/record-grouping.js').WorkResult} result
 * @param {import('../domain/record-grouping.js').Snapshot} snapshot
 * @param {RecordItemOptions} [options]
 */
export function resultItem(result, snapshot, { showDate = false, showTask = true } = {}) {
  const { task, project } = recordContext(result, snapshot);
  return h('li', { class: 'record-item record-item--result' },
    h('div', { class: 'record-item__meta' },
      showDate ? h('span', { class: 'record-item__date' }, formatDateShort(result.date)) : null,
      resultBadge(result.type),
      showTask && task ? h('a', { href: `#/tareas/${task.id}`, class: 'record-item__task' }, task.title) : null,
      showTask ? projectChip(project) : null,
    ),
    h('input', {
      class: 'inline-edit',
      value: result.description,
      'aria-label': 'Descripción del resultado',
      dataset: { focusKey: `result-${result.id}` },
      onChange: (event) => runAction('recordItems:updateResult', () => updateResult(result.id, { description: event.target.value })),
    }),
    linkList(result.links),
    h('div', { class: 'record-item__actions' },
      h('button', { type: 'button', class: 'icon-button', 'aria-label': `Borrar resultado: ${result.description}`, onClick: () => deleteWithUndo('results', result.id, 'Resultado') }, '🗑'),
    ),
  );
}

/**
 * @param {import('../domain/task-history.js').StatusChange} change
 * @param {import('../domain/task-history.js').Task} task
 * @param {{showTask?: boolean}} [options]
 */
export function statusChangeItem(change, task, { showTask = true } = {}) {
  return h('li', { class: 'record-item record-item--status' },
    h('div', { class: 'record-item__meta' },
      h('span', { class: `badge badge--${change.to}` }, change.from === null ? 'Creada' : `→ ${TASK_STATUS_LABELS[change.to]}`),
      showTask ? h('a', { href: `#/tareas/${task.id}`, class: 'record-item__task' }, task.title) : null,
    ),
    change.note ? h('p', { class: 'record-item__note' }, change.note) : null,
  );
}
