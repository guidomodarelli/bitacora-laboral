/**
 * Búsqueda por palabras clave sobre tareas, actividades y resultados,
 * incluyendo URLs y etiquetas de enlaces.
 */
import { isDateInRange } from './dates.js';
import { indexById } from './record-grouping.js';
import { includesNormalized, normalizeSearchText } from './text-search.js';

/**
 * @typedef {'task'|'activity'|'result'} SearchHitType
 * @typedef {object} SearchHit
 * @property {SearchHitType} type
 * @property {string} date
 * @property {object} record
 * @property {import('./task-history.js').Task|null} task
 * @property {import('./record-grouping.js').Project|null} project
 */

/** @param {import('./links.js').Link[]} [links] */
function linksText(links = []) {
  return links.map((link) => `${link.url} ${link.label}`).join(' ');
}

/**
 * @param {string} query
 * @param {import('./record-grouping.js').Snapshot} snapshot
 * @param {{range?: import('./dates.js').DateRange|null}} [filters]
 * @returns {SearchHit[]} Ordenados de más reciente a más antiguo.
 */
export function searchRecords(query, snapshot, { range = null } = {}) {
  const normalizedQuery = normalizeSearchText(query);
  const tasksById = indexById(snapshot.tasks);
  const projectsById = indexById(snapshot.projects);
  const projectOf = (projectId) => (projectId ? projectsById.get(projectId) ?? null : null);
  const inRange = (dateKey) => !range || isDateInRange(dateKey, range);
  const matches = (text) => !normalizedQuery || includesNormalized(text, normalizedQuery);
  /** @type {SearchHit[]} */
  const hits = [];

  for (const task of snapshot.tasks) {
    if (!inRange(task.createdOn)) continue;
    const project = projectOf(task.projectId);
    if (matches(`${task.title} ${task.description} ${project?.name ?? ''} ${linksText(task.links)} ${task.blocker?.reason ?? ''}`)) {
      hits.push({ type: 'task', date: task.createdOn, record: task, task, project });
    }
  }
  for (const activity of snapshot.activities) {
    if (!inRange(activity.date)) continue;
    const task = activity.taskId ? tasksById.get(activity.taskId) ?? null : null;
    const project = projectOf(task?.projectId ?? activity.projectId);
    if (matches(`${activity.text} ${linksText(activity.links)} ${task?.title ?? ''} ${project?.name ?? ''}`)) {
      hits.push({ type: 'activity', date: activity.date, record: activity, task, project });
    }
  }
  for (const result of snapshot.results) {
    if (!inRange(result.date)) continue;
    const task = result.taskId ? tasksById.get(result.taskId) ?? null : null;
    const project = projectOf(task?.projectId ?? result.projectId);
    if (matches(`${result.description} ${linksText(result.links)} ${task?.title ?? ''} ${project?.name ?? ''}`)) {
      hits.push({ type: 'result', date: result.date, record: result, task, project });
    }
  }
  return hits.sort((left, right) => right.date.localeCompare(left.date));
}
