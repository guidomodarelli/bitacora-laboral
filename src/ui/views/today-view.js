/**
 * Hoy: captura rápida, tareas activas (arrastradas de días anteriores) y registro del día.
 */
import { TASK_SUGGESTION_LIMIT } from '../../constants/quick-capture.js';
import { ACTIVITY_KIND, ACTIVITY_KIND_LABELS } from '../../constants/records.js';
import { TASK_STATUS, TASK_STATUS_ORDER, isOpenTaskStatus } from '../../constants/task-status.js';
import { formatDateLong, formatDateShort } from '../../domain/date-format.js';
import { todayKey } from '../../domain/dates.js';
import { CAPTURE_PROBLEM, findTaskReferenceAtCaret, resolveCapture, suggestTasksForReference } from '../../domain/quick-capture.js';
import { describeBlockedDuration, formatCount } from '../../domain/text-format.js';
import { countWorkdaysSince } from '../../domain/workdays.js';
import { addActivity, addResult, togglePlannedTask } from '../../services/data-store.js';
import { emptyState, projectChip, runAction, taskCreateForm, taskSelectOptions } from '../components.js';
import { h, optionElements } from '../dom.js';
import { icon } from '../icons.js';
import { activityItem, resultItem } from '../record-items.js';
import { statusMenu } from '../status-menu.js';
import { loadPreference, savePreference, uiDrafts } from '../ui-state.js';

const CAPTURE_TEXT_KEY = 'capture-text';
const CAPTURE_OPTIONS_OPEN_KEY = 'capture-options-open';
const LAST_TASK_PREFERENCE = 'lastCaptureTaskId';
const CAPTURE_INPUT_ID = 'quick-capture-input';
const CAPTURE_PREVIEW_ID = 'quick-capture-preview';
const CAPTURE_SUGGESTIONS_ID = 'quick-capture-suggestions';

/** @type {Readonly<Record<string, string>>} */
const CAPTURE_PROBLEM_MESSAGES = Object.freeze({
  [CAPTURE_PROBLEM.EMPTY]: 'Escribí qué hiciste antes de registrar.',
});

/**
 * Texto de la vista previa: lo mismo que se va a guardar al presionar Enter.
 * @param {ReturnType<typeof resolveCapture>} capture
 * @param {{rawText: string, kind: string, date: string, today: string, isRememberedTask: boolean}} context
 * @returns {{tone: 'idle'|'ready'|'error', text: string}}
 */
function describeCapture(capture, { rawText, kind, date, today, isRememberedTask }) {
  const dateLabel = date === today ? 'hoy' : formatDateShort(date);
  if (!rawText.trim()) {
    if (!capture.task) return { tone: 'idle', text: 'Sin tarea elegida: se registra como actividad suelta.' };
    return { tone: 'idle', text: `Va a «${capture.task.title}»${isRememberedTask ? ' (la última que usaste)' : ''}. Escribí @ para cambiarla.` };
  }
  if (capture.problem === CAPTURE_PROBLEM.UNKNOWN_TASK) {
    return { tone: 'error', text: `Ninguna tarea coincide con «@${capture.parsed.taskQuery}». Probá con otra palabra del título.` };
  }
  if (capture.problem) return { tone: 'error', text: CAPTURE_PROBLEM_MESSAGES[capture.problem] };
  const typeLabel = capture.parsed.isResult ? 'Resultado' : ACTIVITY_KIND_LABELS[capture.parsed.kindOverride ?? kind];
  const parts = [typeLabel, capture.task ? capture.task.title : 'sin tarea', dateLabel];
  if (capture.parsed.links.length) parts.push(formatCount(capture.parsed.links.length, 'enlace', 'enlaces'));
  return { tone: 'ready', text: `Enter registra: ${parts.join(' · ')}` };
}

/** @param {import('../../domain/record-grouping.js').Snapshot} snapshot */
function quickCaptureForm(snapshot) {
  const today = todayKey();
  const rememberedTaskId = loadPreference(LAST_TASK_PREFERENCE, '');
  const rememberedTask = snapshot.tasks.find((task) => task.id === rememberedTaskId && isOpenTaskStatus(task.status));
  const selectedTaskId = uiDrafts.get('capture-task', rememberedTask?.id ?? '');
  const openTasks = snapshot.tasks.filter((task) => isOpenTaskStatus(task.status));
  let suggestions = [];
  let activeSuggestionIndex = 0;

  const textInput = /** @type {HTMLInputElement} */ (h('input', {
    name: 'text',
    id: CAPTURE_INPUT_ID,
    type: 'text',
    autocomplete: 'off',
    role: 'combobox',
    'aria-expanded': 'false',
    'aria-autocomplete': 'list',
    'aria-controls': CAPTURE_SUGGESTIONS_ID,
    'aria-label': 'Qué hiciste',
    'aria-describedby': CAPTURE_PREVIEW_ID,
    placeholder: '¿Qué hiciste?',
    value: uiDrafts.get(CAPTURE_TEXT_KEY, ''),
    dataset: { focusKey: CAPTURE_TEXT_KEY },
  }));

  const projectSelect = /** @type {HTMLSelectElement} */ (h('select', { name: 'projectId', 'aria-label': 'Proyecto (solo si no elegís tarea)', hidden: Boolean(selectedTaskId), dataset: { focusKey: 'capture-project' } },
    optionElements([{ value: '', label: 'Sin proyecto' }, ...snapshot.projects.filter((project) => !project.archived).map((project) => ({ value: project.id, label: project.name }))], uiDrafts.get('capture-project', ''))));
  const taskSelect = /** @type {HTMLSelectElement} */ (h('select', { name: 'taskId', 'aria-label': 'Tarea', dataset: { focusKey: 'capture-task-select' } },
    taskSelectOptions(snapshot.tasks, selectedTaskId, 'Sin tarea')));
  const kindSelect = /** @type {HTMLSelectElement} */ (h('select', { name: 'kind', 'aria-label': 'Tipo de actividad', dataset: { focusKey: 'capture-kind' } },
    optionElements(Object.values(ACTIVITY_KIND).map((kind) => ({ value: kind, label: ACTIVITY_KIND_LABELS[kind] })), uiDrafts.get('capture-kind', ACTIVITY_KIND.WORK))));
  const dateInput = /** @type {HTMLInputElement} */ (h('input', { name: 'date', type: 'date', value: uiDrafts.get('capture-date', today), max: today, 'aria-label': 'Fecha', dataset: { focusKey: 'capture-date' } }));
  const preview = h('p', { id: CAPTURE_PREVIEW_ID, class: 'capture-preview' });
  const suggestionList = h('ul', { id: CAPTURE_SUGGESTIONS_ID, class: 'capture-suggestions', role: 'listbox', 'aria-label': 'Tareas que coinciden', hidden: true });

  const currentCapture = () => resolveCapture(textInput.value, { tasks: snapshot.tasks, selectedTaskId: taskSelect.value || null });

  const refreshPreview = () => {
    const capture = currentCapture();
    const description = describeCapture(capture, {
      rawText: textInput.value,
      kind: kindSelect.value,
      date: dateInput.value || today,
      today,
      isRememberedTask: Boolean(rememberedTask) && taskSelect.value === rememberedTask?.id && !capture.isTaskFromReference,
    });
    preview.textContent = description.text;
    preview.className = `capture-preview capture-preview--${description.tone}`;
    textInput.setAttribute('aria-invalid', String(description.tone === 'error'));
  };

  const renderSuggestions = () => {
    const reference = findTaskReferenceAtCaret(textInput.value, textInput.selectionStart ?? textInput.value.length);
    suggestions = reference ? (reference.query ? suggestTasksForReference(reference.query, openTasks, TASK_SUGGESTION_LIMIT) : openTasks.slice(0, TASK_SUGGESTION_LIMIT)) : [];
    activeSuggestionIndex = Math.min(activeSuggestionIndex, Math.max(suggestions.length - 1, 0));
    suggestionList.replaceChildren(...suggestions.map((task, index) => h('li', {
      id: `${CAPTURE_SUGGESTIONS_ID}-${index}`,
      role: 'option',
      class: 'capture-suggestion',
      'aria-selected': String(index === activeSuggestionIndex),
      // pointerdown para que el input no pierda el foco antes de elegir.
      onPointerdown: (event) => { event.preventDefault(); pickSuggestion(index); },
    }, h('span', {}, task.title), projectChip(snapshot.projects.find((project) => project.id === task.projectId)))));
    const isOpen = suggestions.length > 0;
    suggestionList.hidden = !isOpen;
    textInput.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) textInput.setAttribute('aria-activedescendant', `${CAPTURE_SUGGESTIONS_ID}-${activeSuggestionIndex}`);
    else textInput.removeAttribute('aria-activedescendant');
  };

  const selectTask = (taskId) => {
    taskSelect.value = taskId;
    uiDrafts.set('capture-task', taskId);
    projectSelect.hidden = Boolean(taskId);
  };

  /** Elegir una sugerencia fija la tarea y saca la `@consulta` del texto. */
  const pickSuggestion = (index) => {
    const task = suggestions[index];
    const reference = findTaskReferenceAtCaret(textInput.value, textInput.selectionStart ?? textInput.value.length);
    if (!task || !reference) return;
    const before = textInput.value.slice(0, reference.start).replace(/\s+$/, '');
    const after = textInput.value.slice(reference.end).replace(/^\s+/, '');
    textInput.value = [before, after].filter(Boolean).join(' ');
    const caret = before.length ? before.length + 1 : 0;
    textInput.setSelectionRange(caret, caret);
    uiDrafts.set(CAPTURE_TEXT_KEY, textInput.value);
    selectTask(task.id);
    suggestions = [];
    renderSuggestions();
    refreshPreview();
  };

  textInput.addEventListener('input', () => {
    uiDrafts.set(CAPTURE_TEXT_KEY, textInput.value);
    activeSuggestionIndex = 0;
    renderSuggestions();
    refreshPreview();
  });
  textInput.addEventListener('keydown', (event) => {
    if (suggestions.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      activeSuggestionIndex = (activeSuggestionIndex + step + suggestions.length) % suggestions.length;
      renderSuggestions();
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      pickSuggestion(activeSuggestionIndex);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      suggestions = [];
      suggestionList.hidden = true;
      textInput.setAttribute('aria-expanded', 'false');
      textInput.removeAttribute('aria-activedescendant');
    }
  });
  textInput.addEventListener('blur', () => {
    suggestionList.hidden = true;
    textInput.setAttribute('aria-expanded', 'false');
  });
  taskSelect.addEventListener('change', () => { selectTask(taskSelect.value); refreshPreview(); });
  projectSelect.addEventListener('change', () => uiDrafts.set('capture-project', projectSelect.value));
  kindSelect.addEventListener('change', () => { uiDrafts.set('capture-kind', kindSelect.value); refreshPreview(); });
  dateInput.addEventListener('change', () => { uiDrafts.set('capture-date', dateInput.value || today); refreshPreview(); });

  const onSubmit = async (event) => {
    event.preventDefault();
    const capture = currentCapture();
    if (capture.problem) {
      refreshPreview();
      textInput.focus();
      return;
    }
    const taskId = capture.task?.id ?? null;
    const date = dateInput.value || today;
    const projectId = taskId ? null : projectSelect.value || null;
    const { parsed } = capture;
    // Se vacía el campo antes de guardar: así lo que el usuario siga escribiendo
    // mientras se guarda no se mezcla con el registro anterior.
    const pendingText = textInput.value;
    textInput.value = '';
    uiDrafts.delete(CAPTURE_TEXT_KEY);
    selectTask(taskId ?? '');
    refreshPreview();
    const saved = await runAction('today:quickCapture', () => (parsed.isResult
      ? addResult({ date, description: parsed.text, taskId, projectId, links: parsed.links })
      : addActivity({ date, text: parsed.text, taskId, projectId, kind: parsed.kindOverride ?? /** @type {any} */ (kindSelect.value), links: parsed.links })),
    parsed.isResult ? 'Resultado registrado' : 'Actividad registrada');
    if (!saved) {
      textInput.value = pendingText;
      uiDrafts.set(CAPTURE_TEXT_KEY, pendingText);
      refreshPreview();
      return;
    }
    savePreference(LAST_TASK_PREFERENCE, taskId ?? '');
  };

  refreshPreview();

  return h('form', { class: 'card quick-capture', onSubmit, 'aria-label': 'Registrar actividad' },
    h('div', { class: 'quick-capture__main' },
      h('div', { class: 'quick-capture__field' }, textInput, suggestionList),
      h('button', { type: 'submit', class: 'button button--primary' }, 'Registrar'),
    ),
    preview,
    h('details', {
      class: 'capture-options',
      open: uiDrafts.get(CAPTURE_OPTIONS_OPEN_KEY, false),
      onToggle: (event) => uiDrafts.set(CAPTURE_OPTIONS_OPEN_KEY, event.currentTarget.open),
    },
      h('summary', {}, 'Tarea, tipo y fecha'),
      h('div', { class: 'quick-capture__options' }, taskSelect, projectSelect, kindSelect, dateInput),
    ),
    h('p', { class: 'capture-syntax hint' },
      h('span', {}, h('kbd', {}, '@'), ' tarea'),
      h('span', {}, h('kbd', {}, '!'), ' decisión'),
      h('span', {}, h('kbd', {}, '+'), ' resultado'),
      h('span', {}, 'un enlace pegado se guarda solo'),
    ),
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

  const focusCaptureForTask = () => {
    uiDrafts.set('capture-task', task.id);
    const select = /** @type {HTMLSelectElement|null} */ (document.querySelector('[data-focus-key="capture-task-select"]'));
    if (select) {
      select.value = task.id;
      select.dispatchEvent(new Event('change'));
    }
    document.getElementById(CAPTURE_INPUT_ID)?.focus();
  };

  return h('li', { class: `task-card task-card--${task.status}` },
    h('button', {
      type: 'button',
      class: 'plan-toggle',
      'aria-pressed': String(isPlanned),
      'aria-label': `Plan de hoy: ${task.title}`,
      title: isPlanned ? 'Quitar del plan de hoy' : 'Planificar para hoy',
      onClick: () => runAction('today:togglePlannedTask', () => togglePlannedTask(today, task.id)),
    }, icon('starOutline', { filled: isPlanned })),
    h('div', { class: 'task-card__main' },
      h('a', { href: `#/tareas/${task.id}`, class: 'task-card__title' }, task.title),
      h('div', { class: 'task-card__meta' },
        projectChip(project),
        task.status === TASK_STATUS.BLOCKED
          ? h('span', { class: workdaysBlocked >= snapshot.settings.blockerAlertWorkdays ? 'text-danger' : 'text-muted' },
            `${task.blocker?.reason || 'Sin motivo'} · bloqueada ${describeBlockedDuration(workdaysBlocked)}`)
          : null,
        lastActivity ? h('span', { class: 'text-muted' }, `Último avance: ${lastActivity === today ? 'hoy' : formatDateLong(lastActivity)}`) : null,
      ),
    ),
    h('div', { class: 'task-card__actions' },
      statusMenu(task, { menuKey: `today-status-${task.id}` }),
      h('button', { type: 'button', class: 'button button--small', 'aria-label': `Registrar avance en ${task.title}`, onClick: focusCaptureForTask }, '+ avance'),
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
  const plannedCount = openTasks.filter((task) => plannedTaskIds.has(task.id)).length;

  return h('div', { class: 'view' },
    h('header', { class: 'view-header' },
      h('h1', {}, 'Hoy'),
      h('p', { class: 'view-subtitle' }, formatDateLong(today)),
    ),
    quickCaptureForm(snapshot),
    h('div', { class: 'columns columns--wide-left' },
      h('section', { class: 'card' },
        h('div', { class: 'card-header' },
          h('h2', {}, `Tareas activas (${openTasks.length})`),
          h('span', { class: 'hint' }, plannedCount ? `${formatCount(plannedCount, 'planificada', 'planificadas')} para hoy` : 'Marcá con la estrella lo que vas a hacer hoy'),
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
        completedToday.length ? h('p', { class: 'text-success' }, `Completaste hoy: ${completedToday.map((task) => task.title).join(', ')}`) : null,
        todayActivities.length || todayResults.length
          ? h('ul', { class: 'record-list' },
            todayResults.map((result) => resultItem(result, snapshot)),
            todayActivities.map((activity) => activityItem(activity, snapshot)))
          : emptyState('Todavía no registraste nada hoy.'),
      ),
    ),
  );
}
