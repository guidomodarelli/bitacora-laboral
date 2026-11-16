/**
 * Hoy: captura rápida, tareas activas (arrastradas de días anteriores) y registro del día.
 */
import { ACTIVITY_KIND, ACTIVITY_KIND_LABELS } from '../../constants/records.js';
import { BACKUP_REMINDER_DAYS } from '../../constants/settings.js';
import { ROUTE } from '../../constants/routes.js';
import { TASK_STATUS, TASK_STATUS_ORDER, isOpenTaskStatus } from '../../constants/task-status.js';
import { formatDateLong } from '../../domain/date-format.js';
import { daysBetween, todayKey } from '../../domain/dates.js';
import { parseQuickCapture, resolveTaskReference } from '../../domain/quick-capture.js';
import { countWorkdaysSince } from '../../domain/workdays.js';
import { addActivity, addResult, changeTaskStatus, togglePlannedTask } from '../../services/data-store.js';
import { askStatusNote, emptyState, projectChip, runAction, statusOptions, taskCreateForm, taskSelectOptions } from '../components.js';
import { h, optionElements } from '../dom.js';
import { activityItem, resultItem } from '../record-items.js';
import { showToast } from '../toast.js';
import { loadPreference, savePreference, uiDrafts } from '../ui-state.js';

const CAPTURE_TEXT_KEY = 'capture-text';
const LAST_TASK_PREFERENCE = 'lastCaptureTaskId';

/** @param {import('../../domain/record-grouping.js').Snapshot} snapshot */
function backupReminder(snapshot) {
  const hasData = snapshot.tasks.length > 0 || snapshot.activities.length > 0;
  const { lastBackupAt } = snapshot.settings;
  const daysSinceBackup = lastBackupAt ? daysBetween(lastBackupAt.slice(0, 10), todayKey()) : Infinity;
  if (!hasData || daysSinceBackup < BACKUP_REMINDER_DAYS) return null;
  return h('p', { class: 'banner banner--warning', role: 'status' },
    lastBackupAt ? `Tu último backup tiene ${daysSinceBackup} días. ` : 'Todavía no hiciste ningún backup. ',
    'Los datos viven solo en este navegador: ',
    h('a', { href: `#/${ROUTE.SETTINGS}` }, 'exportá o configurá el backup automático'),
    '.',
  );
}

/** @param {import('../../domain/record-grouping.js').Snapshot} snapshot */
function quickCaptureForm(snapshot) {
  const today = todayKey();
  const rememberedTaskId = loadPreference(LAST_TASK_PREFERENCE, '');
  const rememberedTask = snapshot.tasks.find((task) => task.id === rememberedTaskId && isOpenTaskStatus(task.status));
  const selectedTaskId = uiDrafts.get('capture-task', rememberedTask?.id ?? '');

  const projectSelect = h('select', { name: 'projectId', 'aria-label': 'Proyecto (solo si no elegís tarea)', hidden: Boolean(selectedTaskId), dataset: { focusKey: 'capture-project' } },
    optionElements([{ value: '', label: 'Sin proyecto' }, ...snapshot.projects.filter((project) => !project.archived).map((project) => ({ value: project.id, label: project.name }))], uiDrafts.get('capture-project', '')));
  projectSelect.addEventListener('change', () => uiDrafts.set('capture-project', projectSelect.value));

  const taskSelect = h('select', {
    name: 'taskId',
    'aria-label': 'Tarea',
    dataset: { focusKey: 'capture-task-select' },
    onChange: (event) => {
      uiDrafts.set('capture-task', event.target.value);
      projectSelect.hidden = Boolean(event.target.value);
    },
  }, taskSelectOptions(snapshot.tasks, selectedTaskId, 'Sin tarea'));

  const onSubmit = async (event) => {
    event.preventDefault();
    const form = /** @type {HTMLFormElement} */ (event.currentTarget);
    const values = Object.fromEntries(new FormData(form));
    const parsed = parseQuickCapture(String(values.text ?? ''));
    if (!parsed.text) {
      showToast('Escribí qué hiciste.', { tone: 'error' });
      return;
    }
    let taskId = String(values.taskId ?? '') || null;
    if (parsed.taskQuery) {
      const referencedTask = resolveTaskReference(parsed.taskQuery, snapshot.tasks);
      if (!referencedTask) {
        showToast(`No encontré una tarea que coincida con «@${parsed.taskQuery}».`, { tone: 'error' });
        return;
      }
      taskId = referencedTask.id;
    }
    const date = String(values.date ?? '') || today;
    const projectId = taskId ? null : String(values.projectId ?? '') || null;
    // Se vacía el campo antes de guardar: así lo que el usuario siga escribiendo
    // mientras se guarda no se mezcla con el registro anterior.
    const textInput = /** @type {HTMLInputElement} */ (form.elements.namedItem('text'));
    const pendingText = textInput.value;
    textInput.value = '';
    uiDrafts.delete(CAPTURE_TEXT_KEY);
    uiDrafts.set('capture-task', taskId ?? '');
    taskSelect.value = taskId ?? '';
    projectSelect.hidden = Boolean(taskId);
    const saved = await runAction('today:quickCapture', () => (parsed.isResult
      ? addResult({ date, description: parsed.text, taskId, projectId, links: parsed.links })
      : addActivity({ date, text: parsed.text, taskId, projectId, kind: parsed.kindOverride ?? /** @type {any} */ (values.kind), links: parsed.links })),
    parsed.isResult ? 'Resultado registrado' : 'Actividad registrada');
    if (!saved) {
      textInput.value = pendingText;
      uiDrafts.set(CAPTURE_TEXT_KEY, pendingText);
      return;
    }
    savePreference(LAST_TASK_PREFERENCE, taskId ?? '');
  };

  return h('form', { class: 'card quick-capture', onSubmit, 'aria-label': 'Registrar actividad' },
    h('div', { class: 'quick-capture__main' },
      h('input', {
        name: 'text',
        id: 'quick-capture-input',
        type: 'text',
        autocomplete: 'off',
        'aria-label': 'Qué hiciste',
        placeholder: '¿Qué hiciste? · @tarea · ! decisión · + resultado · pegá links',
        value: uiDrafts.get(CAPTURE_TEXT_KEY, ''),
        dataset: { focusKey: CAPTURE_TEXT_KEY },
        onInput: (event) => uiDrafts.set(CAPTURE_TEXT_KEY, event.target.value),
      }),
      h('button', { type: 'submit', class: 'button button--primary' }, 'Registrar'),
    ),
    h('div', { class: 'quick-capture__options' },
      taskSelect,
      projectSelect,
      h('select', { name: 'kind', 'aria-label': 'Tipo de actividad', dataset: { focusKey: 'capture-kind' } },
        optionElements(Object.values(ACTIVITY_KIND).map((kind) => ({ value: kind, label: ACTIVITY_KIND_LABELS[kind] })), ACTIVITY_KIND.WORK)),
      h('input', { name: 'date', type: 'date', value: today, max: today, 'aria-label': 'Fecha', dataset: { focusKey: 'capture-date' } }),
    ),
    h('p', { class: 'hint' }, h('kbd', {}, '/'), ' enfoca este campo · ', h('kbd', {}, 'Enter'), ' registra · la tarea elegida se recuerda para el próximo registro'),
  );
}

/**
 * @param {import('../../domain/task-history.js').Task} task
 * @param {import('../../domain/record-grouping.js').Snapshot} snapshot
 * @param {boolean} isPlanned
 */
function taskCard(task, snapshot, isPlanned) {
  const today = todayKey();
  const project = snapshot.projects.find((candidate) => candidate.id === task.projectId);
  const workdaysBlocked = task.status === TASK_STATUS.BLOCKED && task.blocker ? countWorkdaysSince(task.blocker.since, today, snapshot.settings) : 0;
  const lastActivity = snapshot.activities.filter((activity) => activity.taskId === task.id).map((activity) => activity.date).sort().at(-1);

  const onStatusChange = (event) => {
    const status = event.target.value;
    const note = askStatusNote(status);
    if (note === null) {
      event.target.value = task.status;
      return;
    }
    runAction('today:changeTaskStatus', () => changeTaskStatus(task.id, status, { dateKey: today, note }), 'Estado actualizado');
  };

  const focusCaptureForTask = () => {
    uiDrafts.set('capture-task', task.id);
    const select = /** @type {HTMLSelectElement|null} */ (document.querySelector('[data-focus-key="capture-task-select"]'));
    if (select) {
      select.value = task.id;
      select.dispatchEvent(new Event('change'));
    }
    document.getElementById('quick-capture-input')?.focus();
  };

  return h('li', { class: `task-card task-card--${task.status}` },
    h('button', {
      type: 'button',
      class: 'plan-toggle',
      'aria-pressed': String(isPlanned),
      'aria-label': `${isPlanned ? 'Quitar del plan de hoy' : 'Planificar para hoy'}: ${task.title}`,
      title: isPlanned ? 'Planificada para hoy' : 'Planificar para hoy',
      onClick: () => runAction('today:togglePlannedTask', () => togglePlannedTask(today, task.id)),
    }, isPlanned ? '★' : '☆'),
    h('div', { class: 'task-card__main' },
      h('a', { href: `#/tareas/${task.id}`, class: 'task-card__title' }, task.title),
      h('div', { class: 'task-card__meta' },
        projectChip(project),
        task.status === TASK_STATUS.BLOCKED
          ? h('span', { class: workdaysBlocked >= snapshot.settings.blockerAlertWorkdays ? 'text-danger' : 'text-muted' },
            `${task.blocker?.reason || 'Sin motivo'} · ${workdaysBlocked} días hábiles`)
          : null,
        lastActivity ? h('span', { class: 'text-muted' }, `Último avance: ${lastActivity === today ? 'hoy' : formatDateLong(lastActivity)}`) : null,
      ),
    ),
    h('div', { class: 'task-card__actions' },
      h('select', { 'aria-label': `Estado de ${task.title}`, onChange: onStatusChange, dataset: { focusKey: `task-status-${task.id}` } }, statusOptions(TASK_STATUS_ORDER, task.status)),
      h('button', { type: 'button', class: 'button button--small', onClick: focusCaptureForTask }, '+ avance'),
    ),
  );
}

/** @param {{snapshot: import('../../domain/record-grouping.js').Snapshot}} context */
export function renderTodayView({ snapshot }) {
  const today = todayKey();
  const plannedTaskIds = new Set(snapshot.dayPlans.find((dayPlan) => dayPlan.date === today)?.taskIds ?? []);
  const openTasks = snapshot.tasks
    .filter((task) => isOpenTaskStatus(task.status))
    .sort((left, right) => Number(plannedTaskIds.has(right.id)) - Number(plannedTaskIds.has(left.id))
      || TASK_STATUS_ORDER.indexOf(left.status) - TASK_STATUS_ORDER.indexOf(right.status)
      || left.title.localeCompare(right.title));
  const todayActivities = snapshot.activities.filter((activity) => activity.date === today).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const todayResults = snapshot.results.filter((result) => result.date === today);
  const completedToday = snapshot.tasks.filter((task) => task.completedOn === today);

  return h('div', { class: 'view' },
    h('header', { class: 'view-header' },
      h('h1', {}, 'Hoy'),
      h('p', { class: 'view-subtitle' }, formatDateLong(today)),
    ),
    backupReminder(snapshot),
    quickCaptureForm(snapshot),
    h('div', { class: 'columns' },
      h('section', { class: 'card' },
        h('div', { class: 'card-header' },
          h('h2', {}, `Tareas activas (${openTasks.length})`),
          h('span', { class: 'hint' }, `★ ${plannedTaskIds.size} planificadas para hoy`),
        ),
        openTasks.length
          ? h('ul', { class: 'task-list' }, openTasks.map((task) => taskCard(task, snapshot, plannedTaskIds.has(task.id))))
          : emptyState('No hay tareas abiertas. Creá una abajo o registrá actividades sueltas.'),
        h('details', { class: 'inline-details', open: openTasks.length === 0 },
          h('summary', {}, 'Nueva tarea'),
          taskCreateForm(snapshot, 'today-new-task'),
        ),
      ),
      h('section', { class: 'card' },
        h('h2', {}, `Registro de hoy (${todayActivities.length + todayResults.length})`),
        completedToday.length ? h('p', { class: 'text-success' }, `✔ Completaste hoy: ${completedToday.map((task) => task.title).join(', ')}`) : null,
        todayActivities.length || todayResults.length
          ? h('ul', { class: 'record-list' },
            todayResults.map((result) => resultItem(result, snapshot)),
            todayActivities.map((activity) => activityItem(activity, snapshot)))
          : emptyState('Todavía no registraste nada hoy.'),
      ),
    ),
  );
}
