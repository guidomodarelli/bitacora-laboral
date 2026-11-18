/**
 * Daily: texto generado y editable con las tres preguntas, más el plan del día.
 */
import { RERENDER_EVENT } from '../../constants/routes.js';
import { AUTOSAVE_DEBOUNCE_MS } from '../../constants/timing.js';
import { isOpenTaskStatus } from '../../constants/task-status.js';
import { buildDaily, renderDailyText } from '../../domain/daily-builder.js';
import { formatDateLong } from '../../domain/date-format.js';
import { isDateKey, todayKey } from '../../domain/dates.js';
import { describeBlockedDuration } from '../../domain/text-format.js';
import { clearDailyDraft, saveDailyDraft, togglePlannedTask } from '../../services/data-store.js';
import { copyButton, emptyState, projectChip, runAction, statusBadge } from '../components.js';
import { h } from '../dom.js';
import { uiDrafts } from '../ui-state.js';

const DAILY_DATE_KEY = 'daily-date';
/** El texto se muestra entero, sin scroll interno, dentro de estos límites de alto. */
const DAILY_TEXT_MIN_ROWS = 8;
const DAILY_TEXT_MAX_ROWS = 40;

/** @param {string} text */
const rowsForText = (text) => Math.min(DAILY_TEXT_MAX_ROWS, Math.max(DAILY_TEXT_MIN_ROWS, text.split('\n').length + 1));
/** @type {ReturnType<typeof setTimeout>|undefined} */
let draftSaveTimer;

/** @param {{snapshot: import('../../domain/record-grouping.js').Snapshot}} context */
export function renderDailyView({ snapshot }) {
  const dateKey = uiDrafts.get(DAILY_DATE_KEY, todayKey());
  const daily = buildDaily(dateKey, snapshot);
  const generatedText = renderDailyText(daily);
  const draft = snapshot.dailyDrafts.find((candidate) => candidate.date === dateKey);
  const plannedTaskIds = new Set(snapshot.dayPlans.find((dayPlan) => dayPlan.date === dateKey)?.taskIds ?? []);
  const openTasks = snapshot.tasks.filter((task) => isOpenTaskStatus(task.status));

  const draftStatus = h('span', { class: 'hint', role: 'status' }, draft ? 'Editada manualmente' : 'Generada automáticamente');
  const initialText = draft?.text ?? generatedText;
  const textarea = h('textarea', {
    class: 'daily-text',
    rows: rowsForText(initialText),
    'aria-label': 'Texto de la daily',
    value: initialText,
    dataset: { focusKey: `daily-text-${dateKey}` },
    onInput: (event) => {
      const text = event.target.value;
      event.target.rows = rowsForText(text);
      draftStatus.textContent = 'Guardando…';
      clearTimeout(draftSaveTimer);
      draftSaveTimer = setTimeout(async () => {
        const saved = await runAction('daily:saveDailyDraft', () => saveDailyDraft(dateKey, text).then(() => true));
        draftStatus.textContent = saved ? 'Editada manualmente · guardada' : 'No se pudo guardar';
      }, AUTOSAVE_DEBOUNCE_MS);
    },
  });

  const previous = daily.previous;
  const previousInfo = !previous.dateKey
    ? 'No hay registros anteriores.'
    : previous.isFallback
      ? `«Ayer» usa el ${formatDateLong(previous.dateKey)}: el último día laboral (${previous.expectedDateKey ? formatDateLong(previous.expectedDateKey) : '—'}) no tiene registros.`
      : `«Ayer» = ${formatDateLong(previous.dateKey)}.`;

  return h('div', { class: 'view' },
    h('header', { class: 'view-header' },
      h('h1', {}, 'Daily'),
      h('label', { class: 'field field--inline' }, h('span', {}, 'Fecha de la daily'),
        h('input', {
          type: 'date',
          value: dateKey,
          dataset: { focusKey: 'daily-date-input' },
          onChange: (event) => {
            if (!isDateKey(event.target.value)) return;
            uiDrafts.set(DAILY_DATE_KEY, event.target.value);
            window.dispatchEvent(new Event(RERENDER_EVENT));
          },
        })),
    ),
    h('div', { class: 'columns columns--wide-left' },
      h('section', { class: 'card' },
        h('div', { class: 'card-header' }, h('h2', {}, 'Texto para la reunión'), draftStatus),
        h('p', { class: 'hint' }, previousInfo),
        draft && draft.text !== generatedText ? h('p', { class: 'banner' }, 'Editaste este texto. Si después cambiaste registros o el plan, «Volver al texto generado» los incluye (perdés tus ediciones).') : null,
        textarea,
        h('div', { class: 'form-actions' },
          copyButton('Copiar daily', () => textarea.value, { successMessage: 'Daily copiada' }),
          // Solo hay algo que regenerar si el texto se editó a mano.
          draft ? h('button', { type: 'button', class: 'button', onClick: () => runAction('daily:clearDailyDraft', () => clearDailyDraft(dateKey), 'Daily regenerada con los registros actuales') }, 'Volver al texto generado') : null,
        ),
      ),
      h('div', { class: 'stack' },
        h('section', { class: 'card' },
          h('h2', {}, '¿Qué voy a hacer hoy?'),
          h('p', { class: 'hint' }, daily.plan.isSuggestion
            ? 'No marcaste tareas: se sugieren las que están en progreso. Marcar no cambia su estado.'
            : 'Marcar o desmarcar no cambia el estado de la tarea.'),
          openTasks.length
            ? h('ul', { class: 'check-list' }, openTasks.map((task) => h('li', {},
              h('label', {},
                h('input', { type: 'checkbox', checked: plannedTaskIds.has(task.id), dataset: { focusKey: `daily-plan-${task.id}` }, onChange: () => runAction('daily:togglePlannedTask', () => togglePlannedTask(dateKey, task.id)) }),
                h('span', {}, task.title),
              ),
              statusBadge(task.status),
              projectChip(snapshot.projects.find((project) => project.id === task.projectId)),
            )))
            : emptyState('No hay tareas abiertas.'),
        ),
        h('section', { class: 'card' },
          h('h2', {}, `Bloqueos (${daily.blockers.length})`),
          daily.blockers.length
            ? h('ul', { class: 'record-list' }, daily.blockers.map((blocker) => h('li', { class: `record-item ${blocker.isProlonged ? 'record-item--alert' : ''}` },
              h('a', { href: `#/tareas/${blocker.task.id}` }, blocker.task.title),
              h('p', { class: 'record-item__note' }, blocker.reason || 'Sin motivo registrado'),
              h('p', { class: blocker.isProlonged ? 'text-danger' : 'hint' },
                `Bloqueada ${describeBlockedDuration(blocker.workdaysBlocked)}${blocker.isProlonged ? ' · conviene escalarlo' : ''}`),
            )))
            : emptyState('Sin bloqueos.'),
        ),
      ),
    ),
  );
}
