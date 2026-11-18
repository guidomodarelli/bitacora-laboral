/**
 * Piezas de interfaz reutilizadas por varias vistas.
 */
import { ACTIVITY_KIND_LABELS, LINK_KIND_LABELS, RESULT_TYPE_LABELS } from '../constants/records.js';
import { TASK_STATUS, TASK_STATUS_LABELS, TASK_STATUS_ORDER, isOpenTaskStatus } from '../constants/task-status.js';
import { formatTimestamp } from '../domain/date-format.js';
import { todayKey } from '../domain/dates.js';
import { createLink, describeLink, isSafeLinkUrl } from '../domain/links.js';
import { copyToClipboard } from '../services/browser-services.js';
import { ValidationError, createTask, ensureProject, saveSummary } from '../services/data-store.js';
import { h, optionElements } from './dom.js';
import { showToast } from './toast.js';
import { uiDrafts } from './ui-state.js';

/** El usuario canceló un diálogo del navegador (p. ej. el selector de carpeta). */
const USER_ABORT_ERROR_NAME = 'AbortError';

/**
 * Ejecuta una acción del usuario mostrando el resultado. Los errores de
 * validación se muestran tal cual; los técnicos se registran con contexto.
 * @param {string} actionName Nombre para el log, p. ej. `today:addActivity`.
 * @param {() => Promise<unknown>} action
 * @param {string} [successMessage]
 */
export async function runAction(actionName, action, successMessage) {
  try {
    const result = await action();
    if (successMessage) showToast(successMessage, { tone: 'success' });
    return result;
  } catch (actionError) {
    if (actionError instanceof DOMException && actionError.name === USER_ABORT_ERROR_NAME) return undefined;
    if (actionError instanceof ValidationError) {
      showToast(actionError.message, { tone: 'error' });
    } else {
      console.error(`${actionName} failed`, actionError);
      showToast('No se pudo completar la acción. Revisá la consola para más detalle.', { tone: 'error' });
    }
    return undefined;
  }
}

/** @param {import('../constants/task-status.js').TaskStatus} status */
export function statusBadge(status) {
  return h('span', { class: `badge badge--${status}` }, TASK_STATUS_LABELS[status]);
}

/** @param {import('../constants/records.js').ActivityKind} kind */
export function kindBadge(kind) {
  return h('span', { class: `badge badge--kind-${kind}` }, ACTIVITY_KIND_LABELS[kind]);
}

/** @param {import('../constants/records.js').ResultType} type */
export function resultBadge(type) {
  return h('span', { class: 'badge badge--result' }, `★ ${RESULT_TYPE_LABELS[type]}`);
}

/** @param {{name: string}|null|undefined} project */
export function projectChip(project) {
  return project ? h('span', { class: 'chip' }, project.name) : null;
}

/** @param {string} message */
export function emptyState(message) {
  return h('p', { class: 'empty-state' }, message);
}

/**
 * @param {import('../domain/links.js').Link[]} links
 * @param {{onRemove?: (index: number) => void}} [options]
 */
export function linkList(links = [], { onRemove } = {}) {
  if (links.length === 0) return null;
  return h('ul', { class: 'link-list' }, links.map((link, index) => h('li', {},
    h('span', { class: `link-kind link-kind--${link.kind}` }, LINK_KIND_LABELS[link.kind]),
    isSafeLinkUrl(link.url)
      ? h('a', { href: link.url, target: '_blank', rel: 'noopener noreferrer' }, describeLink(link))
      : h('span', {}, link.url),
    onRemove ? h('button', { type: 'button', class: 'icon-button', 'aria-label': `Quitar enlace ${describeLink(link)}`, onClick: () => onRemove(index) }, '×') : null,
  )));
}

/**
 * Editor de enlaces: lista + campo para agregar una URL.
 * @param {import('../domain/links.js').Link[]} links
 * @param {(links: import('../domain/links.js').Link[]) => void} onChange
 * @param {string} focusKey
 */
export function linkEditor(links, onChange, focusKey) {
  const input = h('input', { type: 'url', placeholder: 'https://… (ticket, PR, doc)', 'aria-label': 'Nuevo enlace', dataset: { focusKey } });
  const add = () => {
    const url = input.value.trim();
    if (!isSafeLinkUrl(url)) {
      showToast('Ingresá una URL que empiece con http:// o https://', { tone: 'error' });
      return;
    }
    onChange([...links, createLink(url)]);
  };
  return h('div', { class: 'link-editor' },
    linkList(links, { onRemove: (index) => onChange(links.filter((_link, linkIndex) => linkIndex !== index)) }),
    h('div', { class: 'inline-form' },
      input,
      h('button', { type: 'button', class: 'button', onClick: add }, 'Agregar enlace'),
    ),
  );
}

/**
 * Opciones de tareas para un select: abiertas primero, más la seleccionada aunque esté cerrada.
 * @param {import('../domain/task-history.js').Task[]} tasks
 * @param {string} selectedTaskId
 * @param {string} noneLabel
 */
export function taskSelectOptions(tasks, selectedTaskId, noneLabel) {
  const visibleTasks = tasks
    .filter((task) => isOpenTaskStatus(task.status) || task.id === selectedTaskId)
    .sort((left, right) => TASK_STATUS_ORDER.indexOf(left.status) - TASK_STATUS_ORDER.indexOf(right.status) || left.title.localeCompare(right.title));
  return optionElements([{ value: '', label: noneLabel }, ...visibleTasks.map((task) => ({ value: task.id, label: task.title }))], selectedTaskId);
}

/** @param {import('../constants/task-status.js').TaskStatus[]} statuses */
export function statusOptions(statuses, selectedStatus) {
  return optionElements(statuses.map((status) => ({ value: status, label: TASK_STATUS_LABELS[status] })), selectedStatus);
}

/**
 * @param {Array<{name: string, archived?: boolean}>} projects
 * @param {string} datalistId
 */
export function projectDatalist(projects, datalistId) {
  return h('datalist', { id: datalistId }, projects.filter((project) => !project.archived).map((project) => h('option', { value: project.name })));
}

/**
 * Formulario de nueva tarea. El proyecto se escribe libre: si no existe, se crea.
 * @param {import('../domain/record-grouping.js').Snapshot} snapshot
 * @param {string} formKey Prefijo para conservar lo escrito entre re-renders.
 * @param {{onCreated?: (task: object) => void}} [options]
 */
export function taskCreateForm(snapshot, formKey, { onCreated } = {}) {
  const draftKey = (field) => `${formKey}-${field}`;
  const draftInput = (field, props) => h('input', {
    ...props,
    name: field,
    value: uiDrafts.get(draftKey(field), ''),
    dataset: { focusKey: draftKey(field) },
    onInput: (event) => uiDrafts.set(draftKey(field), event.target.value),
  });
  const datalistId = `${formKey}-projects`;

  const onSubmit = async (event) => {
    event.preventDefault();
    const form = /** @type {HTMLFormElement} */ (event.currentTarget);
    const values = Object.fromEntries(new FormData(form));
    const clearedFields = ['title', 'description'];
    const pendingDrafts = clearedFields.map((field) => [field, uiDrafts.get(draftKey(field), '')]);
    clearedFields.forEach((field) => uiDrafts.delete(draftKey(field)));
    const task = await runAction('taskCreateForm:createTask', async () => {
      const project = await ensureProject(String(values.project ?? ''));
      return createTask({
        title: String(values.title ?? ''),
        description: String(values.description ?? ''),
        projectId: project?.id ?? null,
        status: /** @type {any} */ (values.status),
        dateKey: todayKey(),
      });
    }, 'Tarea creada');
    if (!task) {
      pendingDrafts.forEach(([field, value]) => uiDrafts.set(draftKey(field), value));
      return;
    }
    onCreated?.(task);
  };

  return h('form', { class: 'task-create-form', onSubmit },
    h('div', { class: 'form-row' },
      h('label', { class: 'field field--grow' }, h('span', {}, 'Título'), draftInput('title', { type: 'text', required: true, placeholder: 'Ej.: Autenticación con JWT', autocomplete: 'off' })),
      h('label', { class: 'field' }, h('span', {}, 'Proyecto'), draftInput('project', { type: 'text', list: datalistId, placeholder: 'Nuevo o existente', autocomplete: 'off' })),
      h('label', { class: 'field' }, h('span', {}, 'Estado inicial'), h('select', { name: 'status' }, statusOptions([TASK_STATUS.PENDING, TASK_STATUS.IN_PROGRESS], TASK_STATUS.IN_PROGRESS))),
    ),
    h('label', { class: 'field' }, h('span', {}, 'Descripción (opcional)'),
      h('textarea', { name: 'description', rows: 2, value: uiDrafts.get(draftKey('description'), ''), dataset: { focusKey: draftKey('description') }, onInput: (event) => uiDrafts.set(draftKey('description'), event.target.value) })),
    projectDatalist(snapshot.projects, datalistId),
    h('div', { class: 'form-actions' }, h('button', { type: 'submit', class: 'button button--primary' }, 'Crear tarea')),
  );
}

/**
 * Botón que copia al portapapeles el texto devuelto por `getText`.
 * @param {string} label
 * @param {() => string} getText
 * @param {{primary?: boolean, successMessage?: string}} [options]
 */
export function copyButton(label, getText, { primary = true, successMessage = 'Copiado al portapapeles' } = {}) {
  return h('button', {
    type: 'button',
    class: primary ? 'button button--primary' : 'button',
    onClick: () => runAction('copyButton:copy', () => copyToClipboard(getText()), successMessage),
  }, label);
}

/**
 * Pegar y guardar el resumen generado por la IA.
 * @param {{kind: 'week'|'month', periodId: string, summary: object|null, isStale: boolean, sourceFingerprint: string}} options
 */
export function summaryEditor({ kind, periodId, summary, isStale, sourceFingerprint }) {
  const draftKey = `summary-${kind}-${periodId}`;
  const textarea = h('textarea', {
    rows: 10,
    'aria-label': 'Resumen generado por la IA',
    placeholder: 'Pegá acá el resumen que te devolvió la IA y guardalo.',
    value: uiDrafts.get(draftKey, summary?.content ?? ''),
    dataset: { focusKey: draftKey },
    onInput: (event) => uiDrafts.set(draftKey, event.target.value),
  });
  const save = async () => {
    const saved = await runAction('summaryEditor:saveSummary', () => saveSummary({ kind, periodId, content: textarea.value, sourceFingerprint }).then(() => true), 'Resumen guardado');
    if (saved) uiDrafts.delete(draftKey);
  };
  return h('section', { class: 'card' },
    h('h2', {}, 'Resumen de la IA'),
    summary ? h('p', { class: 'hint' }, `Guardado: ${formatTimestamp(summary.savedAt)}`) : h('p', { class: 'hint' }, 'Copiá el prompt, pegalo en tu herramienta de IA y guardá acá lo que te devuelva.'),
    isStale ? h('p', { class: 'banner banner--warning', role: 'status' }, 'Hay registros de este período que cambiaron después de guardar el resumen. Conviene regenerarlo.') : null,
    textarea,
    h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'button button--primary', onClick: save }, summary ? 'Actualizar resumen' : 'Guardar resumen')),
  );
}
