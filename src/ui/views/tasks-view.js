/**
 * Tareas: listado filtrable y detalle con el historial de avances por fecha.
 */
import { ACTIVITY_KIND, ACTIVITY_KIND_LABELS, RESULT_TYPE, RESULT_TYPE_LABELS } from '../../constants/records.js';
import { RERENDER_EVENT, ROUTE, buildRouteHash } from '../../constants/routes.js';
import { TASK_STATUS_LABELS, TASK_STATUS_ORDER, isOpenTaskStatus } from '../../constants/task-status.js';
import { formatDateLong, formatDateShort } from '../../domain/date-format.js';
import { todayKey } from '../../domain/dates.js';
import { createLink, isSafeLinkUrl } from '../../domain/links.js';
import { normalizeSearchText } from '../../domain/text-search.js';
import { addActivity, addResult, changeTaskStatus, deleteTask, ensureProject, togglePlannedTask, updateTask } from '../../services/data-store.js';
import { askStatusNote, emptyState, linkEditor, projectChip, projectDatalist, runAction, statusBadge, statusOptions, taskCreateForm } from '../components.js';
import { h, optionElements } from '../dom.js';
import { activityItem, resultItem, statusChangeItem } from '../record-items.js';
import { uiDrafts } from '../ui-state.js';

const STATUS_FILTER_OPEN = 'open';
const STATUS_FILTER_ALL = 'all';

const rerender = () => window.dispatchEvent(new Event(RERENDER_EVENT));

/** @param {import('../../domain/record-grouping.js').Snapshot} snapshot */
function renderTaskList(snapshot) {
  const statusFilter = uiDrafts.get('tasks-status-filter', STATUS_FILTER_OPEN);
  const projectFilter = uiDrafts.get('tasks-project-filter', '');
  const textFilter = normalizeSearchText(uiDrafts.get('tasks-text-filter', ''));

  const lastActivityByTask = new Map();
  const activityCountByTask = new Map();
  for (const activity of snapshot.activities) {
    if (!activity.taskId) continue;
    activityCountByTask.set(activity.taskId, (activityCountByTask.get(activity.taskId) ?? 0) + 1);
    if ((lastActivityByTask.get(activity.taskId) ?? '') < activity.date) lastActivityByTask.set(activity.taskId, activity.date);
  }

  const tasks = snapshot.tasks
    .filter((task) => statusFilter === STATUS_FILTER_ALL || (statusFilter === STATUS_FILTER_OPEN ? isOpenTaskStatus(task.status) : task.status === statusFilter))
    .filter((task) => !projectFilter || task.projectId === projectFilter)
    .filter((task) => !textFilter || normalizeSearchText(`${task.title} ${task.description}`).includes(textFilter))
    .sort((left, right) => TASK_STATUS_ORDER.indexOf(left.status) - TASK_STATUS_ORDER.indexOf(right.status)
      || (lastActivityByTask.get(right.id) ?? right.createdOn).localeCompare(lastActivityByTask.get(left.id) ?? left.createdOn));

  const filterSelect = (draftKey, label, options) => h('label', { class: 'field' }, h('span', {}, label),
    h('select', { dataset: { focusKey: draftKey }, onChange: (event) => { uiDrafts.set(draftKey, event.target.value); rerender(); } },
      optionElements(options, uiDrafts.get(draftKey, options[0].value))));

  return h('div', { class: 'view' },
    h('header', { class: 'view-header' }, h('h1', {}, 'Tareas'), h('p', { class: 'view-subtitle' }, `${tasks.length} de ${snapshot.tasks.length}`)),
    h('section', { class: 'card' },
      h('div', { class: 'form-row' },
        filterSelect('tasks-status-filter', 'Estado', [
          { value: STATUS_FILTER_OPEN, label: 'Abiertas' },
          { value: STATUS_FILTER_ALL, label: 'Todas' },
          ...TASK_STATUS_ORDER.map((status) => ({ value: status, label: TASK_STATUS_LABELS[status] })),
        ]),
        filterSelect('tasks-project-filter', 'Proyecto', [{ value: '', label: 'Todos' }, ...snapshot.projects.map((project) => ({ value: project.id, label: project.name }))]),
        h('label', { class: 'field field--grow' }, h('span', {}, 'Buscar'),
          h('input', {
            type: 'search',
            value: uiDrafts.get('tasks-text-filter', ''),
            placeholder: 'Título o descripción',
            dataset: { focusKey: 'tasks-text-filter' },
            onInput: (event) => { uiDrafts.set('tasks-text-filter', event.target.value); rerender(); },
          })),
      ),
      tasks.length
        ? h('ul', { class: 'task-table' }, tasks.map((task) => h('li', {},
          h('a', { href: buildRouteHash(ROUTE.TASKS, task.id), class: 'task-table__row' },
            statusBadge(task.status),
            h('span', { class: 'task-table__title' }, task.title),
            projectChip(snapshot.projects.find((project) => project.id === task.projectId)),
            h('span', { class: 'text-muted' }, `${activityCountByTask.get(task.id) ?? 0} avances`),
            h('span', { class: 'text-muted' }, lastActivityByTask.has(task.id) ? `último ${formatDateShort(lastActivityByTask.get(task.id))}` : `creada ${formatDateShort(task.createdOn)}`),
          ),
        )))
        : emptyState('No hay tareas con estos filtros.'),
    ),
    h('details', { class: 'card inline-details' }, h('summary', {}, 'Nueva tarea'), taskCreateForm(snapshot, 'tasks-new-task')),
  );
}

/**
 * @param {import('../../domain/task-history.js').Task} task
 * @param {import('../../domain/record-grouping.js').Snapshot} snapshot
 */
function taskTimeline(task, snapshot) {
  /** @type {Map<string, HTMLElement[]>} */
  const itemsByDate = new Map();
  const push = (dateKey, element) => {
    if (!itemsByDate.has(dateKey)) itemsByDate.set(dateKey, []);
    itemsByDate.get(dateKey).push(element);
  };
  for (const change of task.statusHistory) push(change.date, statusChangeItem(change, task, { showTask: false }));
  for (const result of snapshot.results.filter((candidate) => candidate.taskId === task.id)) push(result.date, resultItem(result, snapshot, { showTask: false }));
  for (const activity of snapshot.activities.filter((candidate) => candidate.taskId === task.id).sort((left, right) => left.createdAt.localeCompare(right.createdAt))) {
    push(activity.date, activityItem(activity, snapshot, { showTask: false, allowDuplicate: true }));
  }
  const dates = [...itemsByDate.keys()].sort().reverse();
  return h('ol', { class: 'timeline' }, dates.map((dateKey) => h('li', { class: 'timeline-day' },
    h('h3', {}, formatDateLong(dateKey)),
    h('ul', { class: 'record-list' }, itemsByDate.get(dateKey)),
  )));
}

/**
 * @param {import('../../domain/task-history.js').Task} task
 */
function addProgressForms(task) {
  const today = todayKey();
  const activityKey = `task-${task.id}-activity`;
  const resultKey = `task-${task.id}-result`;

  const onActivitySubmit = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const links = isSafeLinkUrl(String(values.link ?? '').trim()) ? [createLink(String(values.link))] : [];
    const pendingText = uiDrafts.get(activityKey, '');
    uiDrafts.delete(activityKey);
    const saved = await runAction('taskDetail:addActivity', () => addActivity({ date: String(values.date || today), text: String(values.text ?? ''), taskId: task.id, kind: /** @type {any} */ (values.kind), links }), 'Avance registrado');
    if (!saved) uiDrafts.set(activityKey, pendingText);
  };
  const onResultSubmit = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const links = isSafeLinkUrl(String(values.link ?? '').trim()) ? [createLink(String(values.link))] : [];
    const pendingText = uiDrafts.get(resultKey, '');
    uiDrafts.delete(resultKey);
    const saved = await runAction('taskDetail:addResult', () => addResult({ date: String(values.date || today), description: String(values.description ?? ''), taskId: task.id, type: /** @type {any} */ (values.type), links }), 'Resultado registrado');
    if (!saved) uiDrafts.set(resultKey, pendingText);
  };

  return h('div', { class: 'stack' },
    h('form', { class: 'card', onSubmit: onActivitySubmit },
      h('h2', {}, 'Registrar avance'),
      h('input', { name: 'text', type: 'text', required: true, placeholder: 'Qué avanzaste', 'aria-label': 'Qué avanzaste', value: uiDrafts.get(activityKey, ''), dataset: { focusKey: activityKey }, onInput: (event) => uiDrafts.set(activityKey, event.target.value) }),
      h('div', { class: 'form-row' },
        h('select', { name: 'kind', 'aria-label': 'Tipo' }, optionElements(Object.values(ACTIVITY_KIND).map((kind) => ({ value: kind, label: ACTIVITY_KIND_LABELS[kind] })), ACTIVITY_KIND.WORK)),
        h('input', { name: 'date', type: 'date', value: today, max: today, 'aria-label': 'Fecha' }),
        h('input', { name: 'link', type: 'url', placeholder: 'Enlace (opcional)', 'aria-label': 'Enlace' }),
      ),
      h('div', { class: 'form-actions' }, h('button', { type: 'submit', class: 'button button--primary' }, 'Registrar avance')),
    ),
    h('form', { class: 'card', onSubmit: onResultSubmit },
      h('h2', {}, 'Registrar resultado'),
      h('p', { class: 'hint' }, 'Un entregable o impacto real: funcionalidad terminada, bug resuelto, cobertura mejorada…'),
      h('input', { name: 'description', type: 'text', required: true, placeholder: 'Qué conseguiste', 'aria-label': 'Qué conseguiste', value: uiDrafts.get(resultKey, ''), dataset: { focusKey: resultKey }, onInput: (event) => uiDrafts.set(resultKey, event.target.value) }),
      h('div', { class: 'form-row' },
        h('select', { name: 'type', 'aria-label': 'Tipo de resultado' }, optionElements(Object.values(RESULT_TYPE).map((type) => ({ value: type, label: RESULT_TYPE_LABELS[type] })), RESULT_TYPE.FEATURE)),
        h('input', { name: 'date', type: 'date', value: today, max: today, 'aria-label': 'Fecha' }),
        h('input', { name: 'link', type: 'url', placeholder: 'Enlace (opcional)', 'aria-label': 'Enlace' }),
      ),
      h('div', { class: 'form-actions' }, h('button', { type: 'submit', class: 'button' }, 'Registrar resultado')),
    ),
  );
}

/**
 * @param {string} taskId
 * @param {import('../../domain/record-grouping.js').Snapshot} snapshot
 */
function renderTaskDetail(taskId, snapshot) {
  const task = snapshot.tasks.find((candidate) => candidate.id === taskId);
  if (!task) {
    return h('div', { class: 'view' }, h('h1', {}, 'Tarea no encontrada'), h('a', { href: buildRouteHash(ROUTE.TASKS) }, '← Volver a tareas'));
  }
  const today = todayKey();
  const project = snapshot.projects.find((candidate) => candidate.id === task.projectId);
  const isPlannedToday = snapshot.dayPlans.find((dayPlan) => dayPlan.date === today)?.taskIds.includes(task.id) ?? false;
  const datalistId = `task-${task.id}-projects`;

  const onStatusSubmit = (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const status = /** @type {any} */ (values.status);
    const note = String(values.note ?? '').trim() || askStatusNote(status);
    if (note === null) return;
    runAction('taskDetail:changeTaskStatus', () => changeTaskStatus(task.id, status, { dateKey: String(values.date || today), note }), 'Estado actualizado');
  };

  const onDelete = async () => {
    if (!window.confirm(`¿Borrar la tarea «${task.title}»? Sus actividades y resultados se conservan como registros sin tarea.`)) return;
    const deleted = await runAction('taskDetail:deleteTask', () => deleteTask(task.id).then(() => true), 'Tarea borrada');
    if (deleted) window.location.hash = buildRouteHash(ROUTE.TASKS);
  };

  return h('div', { class: 'view' },
    h('a', { href: buildRouteHash(ROUTE.TASKS), class: 'back-link' }, '← Tareas'),
    h('header', { class: 'view-header' },
      h('input', {
        class: 'title-input',
        value: task.title,
        'aria-label': 'Título de la tarea',
        dataset: { focusKey: `task-title-${task.id}` },
        onChange: (event) => runAction('taskDetail:updateTitle', () => updateTask(task.id, { title: event.target.value })),
      }),
      statusBadge(task.status),
    ),
    h('div', { class: 'columns columns--wide-left' },
      h('div', { class: 'stack' },
        h('section', { class: 'card' },
          h('div', { class: 'form-row' },
            h('label', { class: 'field' }, h('span', {}, 'Proyecto'),
              h('input', {
                type: 'text',
                list: datalistId,
                value: project?.name ?? '',
                placeholder: 'Sin proyecto',
                dataset: { focusKey: `task-project-${task.id}` },
                onChange: (event) => runAction('taskDetail:updateProject', async () => {
                  const nextProject = await ensureProject(event.target.value);
                  await updateTask(task.id, { projectId: nextProject?.id ?? null });
                }),
              }),
              projectDatalist(snapshot.projects, datalistId)),
            h('div', { class: 'field' }, h('span', {}, 'Creada'), h('span', {}, formatDateLong(task.createdOn))),
            task.completedOn ? h('div', { class: 'field' }, h('span', {}, 'Completada'), h('span', {}, formatDateLong(task.completedOn))) : null,
          ),
          h('label', { class: 'field' }, h('span', {}, 'Descripción'),
            h('textarea', {
              rows: 3,
              value: task.description,
              dataset: { focusKey: `task-description-${task.id}` },
              onChange: (event) => runAction('taskDetail:updateDescription', () => updateTask(task.id, { description: event.target.value })),
            })),
          h('div', { class: 'field' }, h('span', {}, 'Enlaces de la tarea'),
            linkEditor(task.links, (links) => runAction('taskDetail:updateLinks', () => updateTask(task.id, { links })), `task-link-${task.id}`)),
        ),
        h('section', { class: 'card' }, h('h2', {}, 'Historial por fecha'), taskTimeline(task, snapshot)),
      ),
      h('div', { class: 'stack' },
        h('form', { class: 'card', onSubmit: onStatusSubmit },
          h('h2', {}, 'Estado'),
          h('p', { class: 'hint' }, 'El estado se mantiene entre días hasta que lo cambies. Podés registrar el cambio con otra fecha.'),
          h('div', { class: 'form-row' },
            h('select', { name: 'status', 'aria-label': 'Nuevo estado' }, statusOptions(TASK_STATUS_ORDER, task.status)),
            h('input', { name: 'date', type: 'date', value: today, max: today, 'aria-label': 'Fecha del cambio' }),
          ),
          h('input', { name: 'note', type: 'text', placeholder: 'Nota o motivo del bloqueo (opcional)', 'aria-label': 'Nota del cambio' }),
          task.blocker ? h('p', { class: 'text-danger' }, `Bloqueada desde ${formatDateShort(task.blocker.since)}: ${task.blocker.reason || 'sin motivo'}`) : null,
          h('div', { class: 'form-actions' },
            h('button', { type: 'submit', class: 'button button--primary' }, 'Cambiar estado'),
            isOpenTaskStatus(task.status)
              ? h('button', { type: 'button', class: 'button', 'aria-pressed': String(isPlannedToday), onClick: () => runAction('taskDetail:togglePlanned', () => togglePlannedTask(today, task.id)) },
                isPlannedToday ? '★ Planificada hoy' : '☆ Planificar hoy')
              : null,
          ),
        ),
        addProgressForms(task),
        h('button', { type: 'button', class: 'button button--danger', onClick: onDelete }, 'Borrar tarea'),
      ),
    ),
  );
}

/** @param {{snapshot: import('../../domain/record-grouping.js').Snapshot, param: string|null}} context */
export function renderTasksView({ snapshot, param }) {
  return param ? renderTaskDetail(param, snapshot) : renderTaskList(snapshot);
}
