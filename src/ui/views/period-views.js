/**
 * Semanal y Mensual: vista previa de lo consolidado, copia del prompt y guardado del resumen de la IA.
 */
import { MONTHLY_WEEK_SOURCE, RECORDS_FALLBACK_REASON_LABELS, SUMMARY_KIND } from '../../constants/periods.js';
import { RERENDER_EVENT } from '../../constants/routes.js';
import { formatDateRange, formatMonthLabel, formatWeekLabel } from '../../domain/date-format.js';
import { isoWeekIdOf, monthIdOf, monthRangeFromId, shiftMonthId, shiftWeekId, todayKey } from '../../domain/dates.js';
import { buildMonthlyReport, buildWeeklyReport, computeSourceFingerprint, isSummaryStale } from '../../domain/period-consolidation.js';
import { buildMonthlyPrompt, buildWeeklyPrompt } from '../../domain/prompt-builder.js';
import { copyButton, summaryEditor } from '../components.js';
import { h } from '../dom.js';
import { uiDrafts } from '../ui-state.js';

const rerender = () => window.dispatchEvent(new Event(RERENDER_EVENT));

/**
 * @param {string} label
 * @param {() => void} onPrevious
 * @param {() => void} onNext
 * @param {() => void} onCurrent
 * @param {boolean} isCurrent
 */
function periodNavigator(label, onPrevious, onNext, onCurrent, isCurrent) {
  return h('div', { class: 'period-nav' },
    h('button', { type: 'button', class: 'button', 'aria-label': 'Período anterior', onClick: onPrevious }, '←'),
    h('strong', { class: 'period-nav__label', 'aria-live': 'polite' }, label),
    h('button', { type: 'button', class: 'button', 'aria-label': 'Período siguiente', onClick: onNext }, '→'),
    isCurrent ? null : h('button', { type: 'button', class: 'button button--ghost', onClick: onCurrent }, 'Ir al actual'),
  );
}

/** @param {Array<{label: string, value: number, tone?: string}>} items */
function statTiles(items) {
  return h('dl', { class: 'stats' }, items.map((item) => h('div', { class: `stat ${item.tone ? `stat--${item.tone}` : ''}` },
    h('dt', {}, item.label),
    h('dd', {}, String(item.value)),
  )));
}

/** @param {string} text */
function promptPreview(text) {
  return h('details', { class: 'prompt-preview' }, h('summary', {}, 'Ver el texto completo del prompt'), h('pre', { tabindex: '0' }, text));
}

/** @param {{snapshot: import('../../domain/record-grouping.js').Snapshot}} context */
export function renderWeeklyView({ snapshot }) {
  const currentWeekId = isoWeekIdOf(todayKey());
  const weekId = uiDrafts.get('weekly-week', currentWeekId);
  const setWeek = (nextWeekId) => { uiDrafts.set('weekly-week', nextWeekId); rerender(); };
  const weekly = buildWeeklyReport(weekId, snapshot);
  const counts = weekly.report.categoryCounts;

  return h('div', { class: 'view' },
    h('header', { class: 'view-header' },
      h('h1', {}, 'Semanal'),
      periodNavigator(formatWeekLabel(weekId), () => setWeek(shiftWeekId(weekId, -1)), () => setWeek(shiftWeekId(weekId, 1)), () => setWeek(currentWeekId), weekId === currentWeekId),
    ),
    h('section', { class: 'card' },
      statTiles([
        { label: 'Completadas', value: counts.completed, tone: 'success' },
        { label: 'Con avances', value: counts.progressed },
        { label: 'Bloqueadas al cierre', value: counts.blocked, tone: counts.blocked ? 'danger' : undefined },
        { label: 'Resultados', value: weekly.report.resultCount, tone: 'accent' },
      ]),
      h('p', { class: 'hint' }, 'La app agrupa los avances por tarea y marca cada una como COMPLETADA o CON AVANCES según su estado al cierre de la semana. La IA solo redacta.'),
      weekly.report.isEmpty ? h('p', { class: 'banner' }, 'No hay registros en esta semana.') : null,
      h('div', { class: 'form-actions' },
        copyButton('Copiar prompt semanal', () => buildWeeklyPrompt(weekId, snapshot), { successMessage: 'Prompt semanal copiado. Pegalo en tu herramienta de IA.' }),
      ),
      promptPreview(buildWeeklyPrompt(weekId, snapshot)),
    ),
    summaryEditor({
      kind: SUMMARY_KIND.WEEK,
      periodId: weekId,
      summary: weekly.summary,
      isStale: weekly.isSummaryStale,
      sourceFingerprint: computeSourceFingerprint(weekly.range, snapshot),
    }),
  );
}

/** @param {{snapshot: import('../../domain/record-grouping.js').Snapshot}} context */
export function renderMonthlyView({ snapshot }) {
  const currentMonthId = monthIdOf(todayKey());
  const monthId = uiDrafts.get('monthly-month', currentMonthId);
  const setMonth = (nextMonthId) => { uiDrafts.set('monthly-month', nextMonthId); rerender(); };
  const monthly = buildMonthlyReport(monthId, snapshot);
  const monthRange = monthRangeFromId(monthId);

  return h('div', { class: 'view' },
    h('header', { class: 'view-header' },
      h('h1', {}, 'Mensual'),
      periodNavigator(formatMonthLabel(monthId), () => setMonth(shiftMonthId(monthId, -1)), () => setMonth(shiftMonthId(monthId, 1)), () => setMonth(currentMonthId), monthId === currentMonthId),
    ),
    h('section', { class: 'card' },
      statTiles([
        { label: 'Completadas en el mes', value: monthly.facts.completedTasks.length, tone: 'success' },
        { label: 'Resultados', value: monthly.facts.results.length, tone: 'accent' },
        { label: 'Abiertas al cierre', value: monthly.facts.openTasksAtEnd.length },
        { label: 'Semanas con resumen', value: monthly.weeks.filter((week) => week.source === MONTHLY_WEEK_SOURCE.SUMMARY).length },
      ]),
      h('h2', {}, 'Fuentes por semana'),
      h('table', { class: 'sources-table' },
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Semana'), h('th', { scope: 'col' }, 'Días de este mes'), h('th', { scope: 'col' }, 'Fuente'))),
        h('tbody', {}, monthly.weeks.map((week) => h('tr', {},
          h('td', {}, formatWeekLabel(week.weekId).split(' · ')[0]),
          h('td', {}, formatDateRange(week.monthRange)),
          h('td', {}, week.source === MONTHLY_WEEK_SOURCE.SUMMARY
            ? h('span', { class: 'text-success' }, 'Resumen semanal guardado')
            : h('span', {}, `Registros diarios — ${RECORDS_FALLBACK_REASON_LABELS[week.fallbackReason]}`)),
        ))),
      ),
      h('p', { class: 'hint' }, 'Además, el prompt incluye «Hechos verificados» calculados de tus registros, para que la IA no cuente dos veces una tarea que aparece en varias semanas.'),
      h('div', { class: 'form-actions' },
        copyButton('Copiar prompt mensual', () => buildMonthlyPrompt(monthId, snapshot), { successMessage: 'Prompt mensual copiado. Pegalo en tu herramienta de IA.' }),
      ),
      promptPreview(buildMonthlyPrompt(monthId, snapshot)),
    ),
    summaryEditor({
      kind: SUMMARY_KIND.MONTH,
      periodId: monthId,
      summary: monthly.summary,
      isStale: monthly.summary ? isSummaryStale(monthly.summary, monthRange, snapshot) : false,
      sourceFingerprint: computeSourceFingerprint(monthRange, snapshot),
    }),
  );
}
