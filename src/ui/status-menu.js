/**
 * Control único para cambiar el estado de una tarea, igual en Hoy y en el detalle.
 *
 * Elegir una opción no cambia nada: el cambio se aplica con «Aplicar», así recorrer
 * las opciones con el teclado nunca altera el historial. El motivo del bloqueo se
 * escribe en el mismo panel (sin diálogos del navegador) y cada cambio se puede deshacer.
 */
import { RERENDER_EVENT } from '../constants/routes.js';
import { TASK_STATUS, TASK_STATUS_LABELS, TASK_STATUS_ORDER } from '../constants/task-status.js';
import { todayKey } from '../domain/dates.js';
import { changeTaskStatus, undoTaskStatusChange } from '../services/data-store.js';
import { runAction } from './components.js';
import { h } from './dom.js';
import { icon } from './icons.js';
import { showToast } from './toast.js';
import { uiDrafts } from './ui-state.js';

const DRAFT_PREFIX = 'status-menu';
const MENU_ATTRIBUTE = 'data-status-menu';

/** Menú abierto en este momento: sobrevive a los re-renders de la vista. */
let openMenuKey = null;

const rerender = () => window.dispatchEvent(new Event(RERENDER_EVENT));

/** @param {string} menuKey @param {string} field */
const draftKey = (menuKey, field) => `${DRAFT_PREFIX}-${menuKey}-${field}`;

/** @param {string} menuKey */
function clearDrafts(menuKey) {
  ['status', 'note', 'date'].forEach((field) => uiDrafts.delete(draftKey(menuKey, field)));
}

/**
 * @param {string} menuKey
 * @param {{restoreFocus?: boolean}} [options]
 */
function closeMenu(menuKey, { restoreFocus = false } = {}) {
  if (openMenuKey !== menuKey) return;
  openMenuKey = null;
  clearDrafts(menuKey);
  rerender();
  if (restoreFocus) requestAnimationFrame(() => document.querySelector(`[data-focus-key="${CSS.escape(`${menuKey}-trigger`)}"]`)?.focus());
}

// Un clic fuera del panel lo cierra, como cualquier menú desplegable.
document.addEventListener('pointerdown', (event) => {
  if (!openMenuKey) return;
  const target = /** @type {Element} */ (event.target);
  if (!target.closest?.(`[${MENU_ATTRIBUTE}="${CSS.escape(openMenuKey)}"]`)) closeMenu(openMenuKey);
});

/**
 * Cambia el estado y ofrece deshacerlo desde el aviso.
 * @param {import('../domain/task-history.js').Task} task
 * @param {import('../constants/task-status.js').TaskStatus} status
 * @param {{dateKey?: string, note?: string}} options
 */
async function changeStatusWithUndo(task, status, options) {
  const changeAt = await runAction('statusMenu:changeTaskStatus', () => changeTaskStatus(task.id, status, options));
  if (changeAt === undefined) return;
  if (changeAt === null) {
    showToast('Motivo del bloqueo actualizado', { tone: 'success' });
    return;
  }
  showToast(`${task.title}: ${TASK_STATUS_LABELS[status].toLowerCase()}`, {
    tone: 'success',
    actionLabel: 'Deshacer',
    onAction: () => runAction('statusMenu:undoTaskStatusChange', () => undoTaskStatusChange(task.id, changeAt), 'Cambio de estado deshecho'),
  });
}

/**
 * @param {import('../domain/task-history.js').Task} task
 * @param {{menuKey: string, allowDate?: boolean}} options
 *   `menuKey` identifica el control en la vista; `allowDate` permite registrar el cambio con otra fecha.
 */
export function statusMenu(task, { menuKey, allowDate = false }) {
  const isOpen = openMenuKey === menuKey;
  const panelId = `${menuKey}-panel`;
  const today = todayKey();

  const trigger = h('button', {
    type: 'button',
    class: `status-trigger status-trigger--${task.status}`,
    'aria-haspopup': 'true',
    'aria-expanded': String(isOpen),
    'aria-controls': isOpen ? panelId : null,
    'aria-label': `Estado: ${TASK_STATUS_LABELS[task.status]}. Cambiar estado de ${task.title}`,
    dataset: { focusKey: `${menuKey}-trigger` },
    onClick: () => {
      if (isOpen) {
        closeMenu(menuKey);
        return;
      }
      if (openMenuKey) clearDrafts(openMenuKey);
      openMenuKey = menuKey;
      rerender();
      requestAnimationFrame(() => document.querySelector(`#${CSS.escape(panelId)} input:checked`)?.focus());
    },
  }, h('span', {}, TASK_STATUS_LABELS[task.status]), icon('chevronDown'));

  if (!isOpen) return h('div', { class: 'status-menu', [MENU_ATTRIBUTE]: menuKey }, trigger);

  const selectedStatus = uiDrafts.get(draftKey(menuKey, 'status'), task.status);
  const isBlocking = selectedStatus === TASK_STATUS.BLOCKED;
  // El motivo y la fecha se leen siempre de los borradores: se escriben sin re-render.
  const currentNote = () => uiDrafts.get(draftKey(menuKey, 'note'), isBlocking ? task.blocker?.reason ?? '' : '');
  const currentDateKey = () => uiDrafts.get(draftKey(menuKey, 'date'), today);
  const changesSomething = () => selectedStatus !== task.status || (isBlocking && currentNote().trim() !== (task.blocker?.reason ?? ''));

  const applyButton = h('button', { type: 'submit', class: 'button button--primary button--small', disabled: !changesSomething() }, 'Aplicar');

  const onSubmit = (event) => {
    event.preventDefault();
    if (!changesSomething()) return;
    const note = isBlocking ? currentNote() : '';
    const dateKey = currentDateKey();
    openMenuKey = null;
    clearDrafts(menuKey);
    changeStatusWithUndo(task, selectedStatus, { dateKey, note });
  };

  const panel = h('form', {
    id: panelId,
    class: 'status-panel',
    'aria-label': `Cambiar estado de ${task.title}`,
    onSubmit,
  },
    h('fieldset', {},
      h('legend', {}, 'Nuevo estado'),
      h('div', { class: 'status-options' }, TASK_STATUS_ORDER.map((status) => h('label', { class: `status-option status-option--${status}` },
        h('input', {
          type: 'radio',
          name: `${menuKey}-status`,
          value: status,
          checked: status === selectedStatus,
          dataset: { focusKey: `${menuKey}-option-${status}` },
          onChange: () => { uiDrafts.set(draftKey(menuKey, 'status'), status); rerender(); },
        }),
        h('span', {}, TASK_STATUS_LABELS[status]),
        status === task.status ? h('span', { class: 'status-option__current' }, 'actual') : null,
      ))),
    ),
    isBlocking
      ? h('label', { class: 'field' }, h('span', {}, '¿Qué la bloquea?'),
        h('input', {
          type: 'text',
          value: currentNote(),
          placeholder: 'Dependencia, problema o a quién esperás',
          autocomplete: 'off',
          dataset: { focusKey: `${menuKey}-note` },
          onInput: (event) => {
            uiDrafts.set(draftKey(menuKey, 'note'), event.target.value);
            applyButton.disabled = !changesSomething();
          },
        }))
      : null,
    allowDate
      ? h('label', { class: 'field' }, h('span', {}, 'Fecha del cambio'),
        h('input', {
          type: 'date',
          value: currentDateKey(),
          max: today,
          dataset: { focusKey: `${menuKey}-date` },
          onChange: (event) => uiDrafts.set(draftKey(menuKey, 'date'), event.target.value || today),
        }))
      : null,
    h('div', { class: 'form-actions' },
      applyButton,
      h('button', { type: 'button', class: 'button button--ghost button--small', onClick: () => closeMenu(menuKey, { restoreFocus: true }) }, 'Cancelar'),
    ),
  );

  return h('div', {
    class: 'status-menu status-menu--open',
    [MENU_ATTRIBUTE]: menuKey,
    onKeydown: (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeMenu(menuKey, { restoreFocus: true });
    },
  }, trigger, panel);
}
