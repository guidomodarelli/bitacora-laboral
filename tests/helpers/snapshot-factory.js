/**
 * Fábrica de datos de prueba con la misma forma que guarda la aplicación.
 */
import { DEFAULT_SETTINGS } from '../../src/constants/settings.js';
import { applyStatusChange, createInitialStatusHistory } from '../../src/domain/task-history.js';

let recordSequence = 0;
const nextId = (prefix) => `${prefix}-${(recordSequence += 1)}`;
const timestampFor = (dateKey, second = 0) => `${dateKey}T12:00:${String(second).padStart(2, '0')}.000Z`;

/**
 * @param {{id?: string, title: string, projectId?: string|null, status?: string, createdOn: string,
 *   changes?: Array<{status: string, date: string, note?: string}>, description?: string, links?: object[]}} options
 */
export function createTestTask({ id, title, projectId = null, status = 'pending', createdOn, changes = [], description = '', links = [] }) {
  const createdAt = timestampFor(createdOn);
  let task = {
    id: id ?? nextId('task'),
    title,
    description,
    projectId,
    status,
    links,
    createdOn,
    completedOn: null,
    blocker: null,
    statusHistory: createInitialStatusHistory(status, createdOn, createdAt),
    createdAt,
    updatedAt: createdAt,
  };
  changes.forEach((change, index) => {
    task = applyStatusChange(task, { status: change.status, dateKey: change.date, atIso: timestampFor(change.date, index + 1), note: change.note ?? '' });
  });
  return task;
}

/** @param {{date: string, text: string, taskId?: string|null, projectId?: string|null, kind?: string, links?: object[], updatedAt?: string}} options */
export function createTestActivity({ date, text, taskId = null, projectId = null, kind = 'work', links = [], updatedAt }) {
  const createdAt = timestampFor(date);
  return { id: nextId('activity'), date, taskId, projectId, kind, text, links, createdAt, updatedAt: updatedAt ?? createdAt };
}

/** @param {{date: string, description: string, taskId?: string|null, projectId?: string|null, type?: string, links?: object[]}} options */
export function createTestResult({ date, description, taskId = null, projectId = null, type = 'feature', links = [] }) {
  const createdAt = timestampFor(date);
  return { id: nextId('result'), date, taskId, projectId, activityId: null, type, description, links, createdAt, updatedAt: createdAt };
}

/** @param {Partial<import('../../src/domain/record-grouping.js').Snapshot>} [partial] */
export function createTestSnapshot(partial = {}) {
  return {
    projects: [],
    tasks: [],
    activities: [],
    results: [],
    dayPlans: [],
    dailyDrafts: [],
    summaries: [],
    templates: [],
    ...partial,
    settings: { ...DEFAULT_SETTINGS, ...(partial.settings ?? {}) },
  };
}
