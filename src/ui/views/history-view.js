/**
 * Historial: navegación por días con registros y búsqueda por texto, fecha o enlace.
 */
import { RERENDER_EVENT } from '../../constants/routes.js';
import { formatDateLong, formatDateShort } from '../../domain/date-format.js';
import { isDateKey } from '../../domain/dates.js';
import { collectRecordDates, collectRecordsInRange, indexById } from '../../domain/record-grouping.js';
import { searchRecords } from '../../domain/record-search.js';
import { formatCount } from '../../domain/text-format.js';
import { emptyState, projectChip, statusBadge } from '../components.js';
import { h } from '../dom.js';
import { activityItem, resultItem, statusChangeItem } from '../record-items.js';
import { uiDrafts } from '../ui-state.js';

const DAYS_PAGE_SIZE = 20;
const SEARCH_RESULTS_LIMIT = 200;
const OPEN_DAYS_BY_DEFAULT = 2;

const rerender = () => window.dispatchEvent(new Event(RERENDER_EVENT));

function currentRange() {
  const from = uiDrafts.get('history-from', '');
  const to = uiDrafts.get('history-to', '');
  if (!isDateKey(from) && !isDateKey(to)) return null;
  return { start: isDateKey(from) ? from : '0000-01-01', end: isDateKey(to) ? to : '9999-12-31' };
}

/**
 * @param {string} dateKey
 * @param {import('../../domain/record-grouping.js').Snapshot} snapshot
 * @param {boolean} isOpen
 */
function dayDetails(dateKey, snapshot, isOpen) {
  const records = collectRecordsInRange({ start: dateKey, end: dateKey }, snapshot);
  const tasksById = indexById(snapshot.tasks);
  const count = records.activities.length + records.results.length + records.statusChanges.length;
  return h('details', { class: 'card history-day', open: isOpen },
    h('summary', {}, h('span', { class: 'history-day__title' }, formatDateLong(dateKey)), h('span', { class: 'hint' }, formatCount(count, 'registro', 'registros'))),
    h('ul', { class: 'record-list' },
      records.statusChanges.map(({ taskId, change }) => statusChangeItem(change, tasksById.get(taskId))),
      records.results.map((result) => resultItem(result, snapshot)),
      records.activities.map((activity) => activityItem(activity, snapshot, { allowDuplicate: true })),
    ),
  );
}

/**
 * @param {import('../../domain/record-search.js').SearchHit} hit
 * @param {import('../../domain/record-grouping.js').Snapshot} snapshot
 */
function searchHitItem(hit, snapshot) {
  if (hit.type === 'activity') return activityItem(/** @type {any} */ (hit.record), snapshot, { showDate: true, allowDuplicate: true });
  if (hit.type === 'result') return resultItem(/** @type {any} */ (hit.record), snapshot, { showDate: true });
  return h('li', { class: 'record-item' },
    h('div', { class: 'record-item__meta' },
      h('span', { class: 'record-item__date' }, formatDateShort(hit.date)),
      h('span', { class: 'badge' }, 'Tarea'),
      statusBadge(hit.task.status),
      projectChip(hit.project),
    ),
    h('a', { href: `#/tareas/${hit.task.id}` }, hit.task.title),
  );
}

/** @param {{snapshot: import('../../domain/record-grouping.js').Snapshot}} context */
export function renderHistoryView({ snapshot }) {
  const query = uiDrafts.get('history-query', '');
  const range = currentRange();
  const isSearching = Boolean(query.trim()) || Boolean(range);
  const visibleDays = uiDrafts.get('history-visible-days', DAYS_PAGE_SIZE);

  const dateInput = (draftKey, label) => h('label', { class: 'field' }, h('span', {}, label),
    h('input', { type: 'date', value: uiDrafts.get(draftKey, ''), dataset: { focusKey: draftKey }, onChange: (event) => { uiDrafts.set(draftKey, event.target.value); rerender(); } }));

  let content;
  if (isSearching) {
    const hits = searchRecords(query, snapshot, { range });
    content = h('section', { class: 'card' },
      h('h2', {}, formatCount(hits.length, 'resultado', 'resultados')),
      hits.length ? h('ul', { class: 'record-list' }, hits.slice(0, SEARCH_RESULTS_LIMIT).map((hit) => searchHitItem(hit, snapshot))) : emptyState('Sin coincidencias.'),
      hits.length > SEARCH_RESULTS_LIMIT ? h('p', { class: 'hint' }, `Se muestran los ${SEARCH_RESULTS_LIMIT} más recientes. Acotá la búsqueda con fechas.`) : null,
    );
  } else {
    const dates = [...collectRecordDates(snapshot)].sort().reverse();
    content = dates.length
      ? h('div', { class: 'stack' },
        dates.slice(0, visibleDays).map((dateKey, index) => dayDetails(dateKey, snapshot, index < OPEN_DAYS_BY_DEFAULT)),
        dates.length > visibleDays
          ? h('button', { type: 'button', class: 'button', onClick: () => { uiDrafts.set('history-visible-days', visibleDays + DAYS_PAGE_SIZE); rerender(); } }, `Mostrar más días (${dates.length - visibleDays} restantes)`)
          : null)
      : emptyState('Todavía no hay registros.');
  }

  return h('div', { class: 'view' },
    h('header', { class: 'view-header' }, h('h1', {}, 'Historial')),
    h('section', { class: 'card' },
      h('div', { class: 'form-row' },
        h('label', { class: 'field field--grow' }, h('span', {}, 'Buscar'),
          h('input', {
            type: 'search',
            placeholder: 'Palabras, tarea, proyecto o parte de un enlace',
            value: query,
            dataset: { focusKey: 'history-query' },
            onInput: (event) => { uiDrafts.set('history-query', event.target.value); rerender(); },
          })),
        dateInput('history-from', 'Desde'),
        dateInput('history-to', 'Hasta'),
      ),
      isSearching ? h('button', { type: 'button', class: 'button button--ghost', onClick: () => { ['history-query', 'history-from', 'history-to'].forEach((key) => uiDrafts.delete(key)); rerender(); } }, 'Limpiar búsqueda') : null,
    ),
    content,
  );
}
