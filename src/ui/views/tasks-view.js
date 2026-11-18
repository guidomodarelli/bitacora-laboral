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
import { formatCount } from '../../domain/text-format.js';
import { addActivity, addResult, deleteTask, ensureProject, togglePlannedTask, updateTask } from '../../services/data-store.js';
import { emptyState, linkEditor, projectChip, projectDatalist, runAction, statusBadge, taskCreateForm } from '../components.js';
import { h, optionElements } from '../dom.js';
import { icon } from '../icons.js';
import { activityItem, resultItem, statusChangeItem } from '../record-items.js';
import { statusMenu } from '../status-menu.js';
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
            h('span', { class: 'text-muted' }, formatCount(activityCountByTask.get(task.id) ?? 0, 'avance', 'avances')),
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

/** Prefijos del valor del selector de tipo: separan actividades de resultados en un mismo campo. */
const RECORD_TYPE_PREFIX = Object.freeze({ ACTIVITY: 'activity:', RESULT: 'result:' });

/**
 * Un solo formulario para registrar un avance o un resultado: el tipo decide qué se guarda.
 * @param {import('../../domain/task-history.js').Task} task
 */
function addRecordForm(task) {
  const today = todayKey();
  const textKey = `task-${task.id}-record-text`;
  const typeKey = `task-${task.id}-record-type`;
  const selectedType = uiDrafts.get(typeKey, `${RECORD_TYPE_PREFIX.ACTIVITY}${ACTIVITY_KIND.WORK}`);

  const onSubmit = async (event) => {
    event.preventDefault();
    const form = /** @type {HTMLFormElement} */ (event.currentTarget);
    const values = Object.fromEntries(new FormData(form));
    const type = String(values.type ?? '');
    const links = isSafeLinkUrl(String(values.link ?? '').trim()) ? [createLink(String(values.link))] : [];
    const date = String(values.date || today);
    const text = String(values.text ?? '');
    const pendingText = uiDrafts.get(textKey, '');
    uiDrafts.delete(textKey);
    const isResult = type.startsWith(RECORD_TYPE_PREFIX.RESULT);
    const saved = await runAction('taskDetail:addRecord', () => (isResult
      ? addResult({ date, description: text, taskId: task.id, type: /** @type {any} */ (type.slice(RECORD_TYPE_PREFIX.RESULT.length)), links })
      : addActivity({ date, text, taskId: task.id, kind: /** @type {any} */ (type.slice(RECORD_TYPE_PREFIX.ACTIVITY.length)), links })),
    isResult ? 'Resultado registrado' : 'Avance registrado');
    if (!saved) uiDrafts.set(textKey, pendingText);
  };

  const typeOption = (value, label) => h('option', { value, selected: value === selectedType }, label);

  return h('form', { class: 'card', onSubmit },
    h('h2', {}, 'Registrar'),
    h('input', { name: 'text', type: 'text', required: true, placeholder: 'Qué avanzaste o qué conseguiste', 'aria-label': 'Qué avanzaste o qué conseguiste', autocomplete: 'off', value: uiDrafts.get(textKey, ''), dataset: { focusKey: textKey }, onInput: (event) => uiDrafts.set(textKey, event.target.value) }),
    h('div', { class: 'form-row' },
      h('select', { name: 'type', 'aria-label': 'Tipo', dataset: { focusKey: typeKey }, onChange: (event) => uiDrafts.set(typeKey, event.target.value) },
        h('optgroup', { label: 'Actividad' }, Object.values(ACTIVITY_KIND).map((kind) => typeOption(`${RECORD_TYPE_PREFIX.ACTIVITY}${kind}`, ACTIVITY_KIND_LABELS[kind]))),
        h('optgroup', { label: 'Resultado (entregable o impacto)' }, Object.values(RESULT_TYPE).map((type) => typeOption(`${RECORD_TYPE_PREFIX.RESULT}${type}`, RESULT_TYPE_LABELS[type])))),
      h('input', { name: 'date', type: 'date', value: today, max: today, 'aria-label': 'Fecha' }),
      h('input', { name: 'link', type: 'url', placeholder: 'Enlace (opcional)', 'aria-label': 'Enlace' }),
    ),
    h('div', { class: 'form-actions' }, h('button', { type: 'submit', class: 'button button--primary' }, 'Registrar')),
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
        onChange: (event) => runAction('taskDetail:updateTitle', () => updateTask(task.id, { title: event.target.value }), 'Título guardado'),
      }),
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
                }, 'Proyecto guardado'),
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
              onChange: (event) => runAction('taskDetail:updateDescription', () => updateTask(task.id, { description: event.target.value }), 'Descripción guardada'),
            })),
          h('div', { class: 'field' }, h('span', {}, 'Enlaces de la tarea'),
            linkEditor(task.links, (links) => runAction('taskDetail:updateLinks', () => updateTask(task.id, { links })), `task-link-${task.id}`)),
        ),
        h('section', { class: 'card' }, h('h2', {}, 'Historial por fecha'), taskTimeline(task, snapshot)),
      ),
      h('div', { class: 'stack' },
        h('section', { class: 'card' },
          h('h2', {}, 'Estado'),
          h('div', { class: 'status-row' },
            statusMenu(task, { menuKey: `detail-status-${task.id}`, allowDate: true }),
            isOpenTaskStatus(task.status)
              ? h('button', { type: 'button', class: 'button button--small plan-button', 'aria-pressed': String(isPlannedToday), onClick: () => runAction('taskDetail:togglePlanned', () => togglePlannedTask(today, task.id)) },
                icon('starOutline', { filled: isPlannedToday }), isPlannedToday ? 'En el plan de hoy' : 'Planificar hoy')
              : null,
          ),
          task.blocker ? h('p', { class: 'text-danger' }, `Bloqueada desde ${formatDateShort(task.blocker.since)}: ${task.blocker.reason || 'sin motivo'}`) : null,
          h('p', { class: 'hint' }, 'El estado se mantiene entre días hasta que lo cambies. Podés registrar el cambio con otra fecha.'),
        ),
        addRecordForm(task),
        h('button', { type: 'button', class: 'button button--danger button--small delete-task', onClick: onDelete }, icon('trash'), 'Borrar tarea'),
      ),
    ),
  );
}

/** @param {{snapshot: import('../../domain/record-grouping.js').Snapshot, param: string|null}} context */
export function renderTasksView({ snapshot, param }) {
  return param ? renderTaskDetail(param, snapshot) : renderTaskList(snapshot);
}
