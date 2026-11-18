/**
 * Fuente de verdad de la aplicación en memoria, respaldada por IndexedDB.
 * Cada operación escribe primero en IndexedDB y recién después actualiza la
 * memoria y notifica a la interfaz; si la escritura falla, nada cambia.
 */
import { readAllStores, replaceStores, writeRecords } from '../db/database.js';
import { buildSummaryId } from '../constants/periods.js';
import { ACTIVITY_KIND, RESULT_TYPE } from '../constants/records.js';
import { DEFAULT_SETTINGS } from '../constants/settings.js';
import { EXPORTABLE_STORES, IMPORT_MODE, SETTINGS_RECORD_ID, STORE, STORE_KEY_PATHS } from '../constants/storage.js';
import { TASK_STATUS } from '../constants/task-status.js';
import { mergeBackupData } from '../domain/backup-format.js';
import { todayKey } from '../domain/dates.js';
import { applyStatusChange, createInitialStatusHistory, revertStatusChange } from '../domain/task-history.js';
import { normalizeSearchText } from '../domain/text-search.js';

/**
 * @typedef {import('../domain/record-grouping.js').Snapshot} Snapshot
 * @typedef {{silent?: boolean}} WriteOptions `silent` evita re-renderizar (autoguardado de textos).
 * @typedef {(snapshot: Snapshot) => void} SnapshotListener
 */

/** Error con mensaje apto para mostrar al usuario. */
export class ValidationError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** @returns {Snapshot} */
function createEmptySnapshot() {
  return {
    projects: [], tasks: [], activities: [], results: [], dayPlans: [], dailyDrafts: [], summaries: [], templates: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

/** @type {Snapshot} */
let snapshot = createEmptySnapshot();
/** @type {Set<SnapshotListener>} */
const listeners = new Set();

const nowIso = () => new Date().toISOString();
const createId = () => crypto.randomUUID();

/** @param {Record<string, object[]>} stored */
function snapshotFromStores(stored) {
  const { id: _settingsId, ...storedSettings } = stored.settings?.find((record) => record.id === SETTINGS_RECORD_ID) ?? {};
  return {
    projects: stored.projects ?? [],
    tasks: stored.tasks ?? [],
    activities: stored.activities ?? [],
    results: stored.results ?? [],
    dayPlans: stored.dayPlans ?? [],
    dailyDrafts: stored.dailyDrafts ?? [],
    summaries: stored.summaries ?? [],
    templates: stored.templates ?? [],
    settings: { ...DEFAULT_SETTINGS, ...storedSettings },
  };
}

function notify() {
  for (const listener of listeners) listener(snapshot);
}

/**
 * @param {object[]} collection
 * @param {object} record
 * @param {string} keyPath
 */
function upsertInCollection(collection, record, keyPath) {
  const index = collection.findIndex((item) => item[keyPath] === record[keyPath]);
  if (index === -1) return [...collection, record];
  const next = [...collection];
  next[index] = record;
  return next;
}

/**
 * Persiste operaciones y luego aplica los mismos cambios a la memoria.
 * @param {Array<{storeName: string, type: 'put', record: object}|{storeName: string, type: 'delete', key: string}>} operations
 * @param {WriteOptions} [options]
 */
async function commit(operations, { silent = false } = {}) {
  await writeRecords(operations);
  let next = snapshot;
  for (const operation of operations) {
    if (operation.storeName === STORE.SETTINGS) {
      const { id: _settingsId, ...settings } = /** @type {any} */ (operation).record;
      next = { ...next, settings: { ...DEFAULT_SETTINGS, ...settings } };
      continue;
    }
    const keyPath = STORE_KEY_PATHS[operation.storeName];
    const collection = next[operation.storeName];
    next = {
      ...next,
      [operation.storeName]: operation.type === 'put'
        ? upsertInCollection(collection, operation.record, keyPath)
        : collection.filter((item) => item[keyPath] !== operation.key),
    };
  }
  snapshot = next;
  if (!silent) notify();
}

const put = (storeName, record) => ({ storeName, type: /** @type {'put'} */ ('put'), record });
const remove = (storeName, key) => ({ storeName, type: /** @type {'delete'} */ ('delete'), key });

/** @param {string} text @param {string} fieldLabel */
function requireText(text, fieldLabel) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) throw new ValidationError(`Completá ${fieldLabel}.`);
  return trimmed;
}

/** @param {string} taskId */
function requireTask(taskId) {
  const task = snapshot.tasks.find((candidate) => candidate.id === taskId);
  if (!task) throw new ValidationError('La tarea ya no existe. Recargá la vista.');
  return task;
}

// ── Ciclo de vida ──────────────────────────────────────────────

export async function initializeDataStore() {
  snapshot = snapshotFromStores(await readAllStores([...EXPORTABLE_STORES]));
  notify();
}

/** @returns {Snapshot} */
export function getSnapshot() {
  return snapshot;
}

/** @param {SnapshotListener} listener */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ── Proyectos ──────────────────────────────────────────────────

/**
 * Devuelve el proyecto con ese nombre o lo crea. Nombre vacío → `null`.
 * @param {string} name
 */
export async function ensureProject(name) {
  const trimmedName = String(name ?? '').trim();
  if (!trimmedName) return null;
  const normalizedName = normalizeSearchText(trimmedName);
  const existing = snapshot.projects.find((project) => normalizeSearchText(project.name) === normalizedName);
  if (existing) return existing;
  const timestamp = nowIso();
  const project = { id: createId(), name: trimmedName, archived: false, createdAt: timestamp, updatedAt: timestamp };
  await commit([put(STORE.PROJECTS, project)]);
  return project;
}

/** @param {string} projectId @param {{name?: string, archived?: boolean}} patch */
export async function updateProject(projectId, patch) {
  const project = snapshot.projects.find((candidate) => candidate.id === projectId);
  if (!project) throw new ValidationError('El proyecto ya no existe.');
  const name = patch.name === undefined ? project.name : requireText(patch.name, 'el nombre del proyecto');
  await commit([put(STORE.PROJECTS, { ...project, ...patch, name, updatedAt: nowIso() })]);
}

// ── Tareas ─────────────────────────────────────────────────────

/**
 * @param {{title: string, description?: string, projectId?: string|null, status?: import('../constants/task-status.js').TaskStatus, links?: object[], dateKey?: string}} input
 */
export async function createTask({ title, description = '', projectId = null, status = TASK_STATUS.PENDING, links = [], dateKey = todayKey() }) {
  const timestamp = nowIso();
  const task = {
    id: createId(),
    title: requireText(title, 'el título de la tarea'),
    description: description.trim(),
    projectId,
    status,
    links,
    createdOn: dateKey,
    completedOn: status === TASK_STATUS.COMPLETED ? dateKey : null,
    blocker: null,
    statusHistory: createInitialStatusHistory(status, dateKey, timestamp),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await commit([put(STORE.TASKS, task)]);
  return task;
}

/**
 * Edita datos descriptivos. El estado solo cambia con `changeTaskStatus`.
 * @param {string} taskId
 * @param {{title?: string, description?: string, projectId?: string|null, links?: object[]}} patch
 */
export async function updateTask(taskId, patch) {
  const task = requireTask(taskId);
  const title = patch.title === undefined ? task.title : requireText(patch.title, 'el título de la tarea');
  const { status: _ignoredStatus, statusHistory: _ignoredHistory, ...descriptivePatch } = /** @type {any} */ (patch);
  await commit([put(STORE.TASKS, { ...task, ...descriptivePatch, title, updatedAt: nowIso() })]);
}

/**
 * @param {string} taskId
 * @param {import('../constants/task-status.js').TaskStatus} status
 * @param {{dateKey?: string, note?: string}} [options]
 * @returns {Promise<string|null>} Timestamp del cambio registrado, para poder deshacerlo.
 */
export async function changeTaskStatus(taskId, status, { dateKey = todayKey(), note = '' } = {}) {
  const task = requireTask(taskId);
  const atIso = nowIso();
  const updated = applyStatusChange(task, { status, dateKey, atIso, note });
  if (updated === task) return null;
  await commit([put(STORE.TASKS, updated)]);
  // Solo un cambio de estado real agrega una entrada al historial que se pueda deshacer.
  return updated.statusHistory.length > task.statusHistory.length ? atIso : null;
}

/**
 * Deshace un cambio de estado recién registrado.
 * @param {string} taskId
 * @param {string} changeAtIso Valor devuelto por `changeTaskStatus`.
 */
export async function undoTaskStatusChange(taskId, changeAtIso) {
  const task = requireTask(taskId);
  const reverted = revertStatusChange(task, changeAtIso, nowIso());
  if (reverted !== task) await commit([put(STORE.TASKS, reverted)]);
}

/**
 * Borra la tarea. Sus actividades y resultados se conservan como registros sueltos del mismo proyecto.
 * @param {string} taskId
 */
export async function deleteTask(taskId) {
  const task = requireTask(taskId);
  const timestamp = nowIso();
  const unlink = (record) => ({ ...record, taskId: null, projectId: task.projectId, updatedAt: timestamp });
  await commit([
    remove(STORE.TASKS, taskId),
    ...snapshot.activities.filter((activity) => activity.taskId === taskId).map((activity) => put(STORE.ACTIVITIES, unlink(activity))),
    ...snapshot.results.filter((result) => result.taskId === taskId).map((result) => put(STORE.RESULTS, unlink(result))),
    ...snapshot.dayPlans
      .filter((dayPlan) => dayPlan.taskIds.includes(taskId))
      .map((dayPlan) => put(STORE.DAY_PLANS, { ...dayPlan, taskIds: dayPlan.taskIds.filter((plannedId) => plannedId !== taskId), updatedAt: timestamp })),
  ]);
}

// ── Actividades ────────────────────────────────────────────────

/**
 * @param {{date: string, text: string, taskId?: string|null, projectId?: string|null, kind?: import('../constants/records.js').ActivityKind, links?: object[]}} input
 */
export async function addActivity({ date, text, taskId = null, projectId = null, kind = ACTIVITY_KIND.WORK, links = [] }) {
  if (taskId) requireTask(taskId);
  const timestamp = nowIso();
  const activity = {
    id: createId(),
    date,
    taskId,
    projectId: taskId ? null : projectId,
    kind,
    text: requireText(text, 'qué hiciste'),
    links,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await commit([put(STORE.ACTIVITIES, activity)]);
  return activity;
}

/** @param {string} activityId @param {Partial<import('../domain/record-grouping.js').Activity>} patch */
export async function updateActivity(activityId, patch) {
  const activity = snapshot.activities.find((candidate) => candidate.id === activityId);
  if (!activity) throw new ValidationError('La actividad ya no existe.');
  const text = patch.text === undefined ? activity.text : requireText(patch.text, 'el texto de la actividad');
  const next = { ...activity, ...patch, text, updatedAt: nowIso() };
  if (next.taskId) next.projectId = null;
  await commit([put(STORE.ACTIVITIES, next)]);
}

/**
 * Copia una actividad recurrente a otra fecha.
 * @param {string} activityId
 * @param {string} dateKey
 */
export async function duplicateActivity(activityId, dateKey) {
  const activity = snapshot.activities.find((candidate) => candidate.id === activityId);
  if (!activity) throw new ValidationError('La actividad ya no existe.');
  const taskStillExists = activity.taskId && snapshot.tasks.some((task) => task.id === activity.taskId);
  return addActivity({ ...activity, date: dateKey, taskId: taskStillExists ? activity.taskId : null });
}

// ── Resultados ─────────────────────────────────────────────────

/**
 * @param {{date: string, description: string, taskId?: string|null, projectId?: string|null, type?: import('../constants/records.js').ResultType, links?: object[]}} input
 */
export async function addResult({ date, description, taskId = null, projectId = null, type = RESULT_TYPE.OTHER, links = [] }) {
  if (taskId) requireTask(taskId);
  const timestamp = nowIso();
  const result = {
    id: createId(),
    date,
    taskId,
    projectId: taskId ? null : projectId,
    activityId: null,
    type,
    description: requireText(description, 'el resultado obtenido'),
    links,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await commit([put(STORE.RESULTS, result)]);
  return result;
}

/** @param {string} resultId @param {Partial<import('../domain/record-grouping.js').WorkResult>} patch */
export async function updateResult(resultId, patch) {
  const result = snapshot.results.find((candidate) => candidate.id === resultId);
  if (!result) throw new ValidationError('El resultado ya no existe.');
  const description = patch.description === undefined ? result.description : requireText(patch.description, 'el resultado obtenido');
  await commit([put(STORE.RESULTS, { ...result, ...patch, description, updatedAt: nowIso() })]);
}

// ── Borrado genérico con deshacer ──────────────────────────────

/**
 * @param {'activities'|'results'} storeName
 * @param {string} recordId
 * @returns {Promise<object>} Registro borrado, para poder restaurarlo.
 */
export async function deleteRecord(storeName, recordId) {
  const record = snapshot[storeName].find((candidate) => candidate.id === recordId);
  if (!record) throw new ValidationError('El registro ya no existe.');
  await commit([remove(storeName, recordId)]);
  return record;
}

/**
 * @param {'activities'|'results'} storeName
 * @param {object} record
 */
export async function restoreRecord(storeName, record) {
  await commit([put(storeName, { ...record, updatedAt: nowIso() })]);
}

// ── Plan del día y daily ───────────────────────────────────────

/**
 * Marca o desmarca una tarea como planificada para el día. No toca su estado.
 * @param {string} dateKey
 * @param {string} taskId
 */
export async function togglePlannedTask(dateKey, taskId) {
  const dayPlan = snapshot.dayPlans.find((candidate) => candidate.date === dateKey) ?? { date: dateKey, taskIds: [] };
  const taskIds = dayPlan.taskIds.includes(taskId)
    ? dayPlan.taskIds.filter((plannedId) => plannedId !== taskId)
    : [...dayPlan.taskIds, taskId];
  await commit([put(STORE.DAY_PLANS, { date: dateKey, taskIds, updatedAt: nowIso() })]);
}

/** @param {string} dateKey @param {string} text @param {WriteOptions} [options] */
export async function saveDailyDraft(dateKey, text, options = { silent: true }) {
  await commit([put(STORE.DAILY_DRAFTS, { date: dateKey, text, updatedAt: nowIso() })], options);
}

/** @param {string} dateKey */
export async function clearDailyDraft(dateKey) {
  await commit([remove(STORE.DAILY_DRAFTS, dateKey)]);
}

// ── Resúmenes y plantillas ─────────────────────────────────────

/**
 * @param {{kind: import('../constants/periods.js').SummaryKind, periodId: string, content: string, sourceFingerprint: string}} input
 */
export async function saveSummary({ kind, periodId, content, sourceFingerprint }) {
  const timestamp = nowIso();
  const id = buildSummaryId(kind, periodId);
  const existing = snapshot.summaries.find((summary) => summary.id === id);
  await commit([put(STORE.SUMMARIES, {
    id, kind, periodId,
    content: requireText(content, 'el resumen generado por la IA'),
    sourceFingerprint,
    savedAt: timestamp,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  })]);
}

/** @param {import('../constants/prompt-templates.js').TemplateKind} kind @param {string} body */
export async function saveTemplate(kind, body) {
  await commit([put(STORE.TEMPLATES, { kind, body: requireText(body, 'la plantilla'), updatedAt: nowIso() })]);
}

/** @param {import('../constants/prompt-templates.js').TemplateKind} kind */
export async function resetTemplate(kind) {
  await commit([remove(STORE.TEMPLATES, kind)]);
}

// ── Ajustes ────────────────────────────────────────────────────

/** @param {Partial<import('../constants/settings.js').AppSettings>} patch @param {WriteOptions} [options] */
export async function updateSettings(patch, options) {
  await commit([put(STORE.SETTINGS, { ...snapshot.settings, ...patch, id: SETTINGS_RECORD_ID, updatedAt: nowIso() })], options);
}

// ── Backup ─────────────────────────────────────────────────────

/** @returns {Record<string, object[]>} Datos exportables, con los ajustes como registro. */
export function getExportableData() {
  const { settings, ...collections } = snapshot;
  return { ...collections, settings: [{ ...settings, id: SETTINGS_RECORD_ID }] };
}

/**
 * @param {Record<string, object[]>} incomingData Ya validado con `parseBackupDocument`.
 * @param {import('../constants/storage.js').IMPORT_MODE[keyof import('../constants/storage.js').IMPORT_MODE]} mode
 */
export async function importData(incomingData, mode) {
  const data = mode === IMPORT_MODE.MERGE ? mergeBackupData(getExportableData(), incomingData) : incomingData;
  const recordsByStore = Object.fromEntries(EXPORTABLE_STORES.map((storeName) => [storeName, data[storeName] ?? []]));
  await replaceStores(recordsByStore);
  snapshot = snapshotFromStores(recordsByStore);
  notify();
}
