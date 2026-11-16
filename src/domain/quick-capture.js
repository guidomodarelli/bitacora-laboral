/**
 * Interpreta la barra de captura rápida:
 * - `!texto` registra una decisión.
 * - `+texto` registra un resultado.
 * - `@tarea` asocia el registro a una tarea por su título.
 * - Las URLs pegadas se convierten en enlaces.
 */
import { DECISION_PREFIX, RESULT_PREFIX, TASK_REFERENCE_PATTERN, TASK_REFERENCE_SEPARATOR_PATTERN } from '../constants/quick-capture.js';
import { ACTIVITY_KIND, URL_PATTERN } from '../constants/records.js';
import { isOpenTaskStatus } from '../constants/task-status.js';
import { createLink, extractUrls } from './links.js';
import { normalizeSearchText } from './text-search.js';

/**
 * @typedef {object} QuickCaptureInput
 * @property {string} text Texto limpio, sin prefijos, referencias ni URLs.
 * @property {import('../constants/records.js').ActivityKind|null} kindOverride `decision` si se usó `!`.
 * @property {boolean} isResult Se usó `+`.
 * @property {string|null} taskQuery Texto de la referencia `@`.
 * @property {import('./links.js').Link[]} links
 */

/**
 * @param {string} rawText
 * @returns {QuickCaptureInput}
 */
export function parseQuickCapture(rawText) {
  let text = rawText.trim();
  let kindOverride = null;
  let isResult = false;
  if (text.startsWith(DECISION_PREFIX)) {
    kindOverride = ACTIVITY_KIND.DECISION;
    text = text.slice(DECISION_PREFIX.length);
  } else if (text.startsWith(RESULT_PREFIX)) {
    isResult = true;
    text = text.slice(RESULT_PREFIX.length);
  }

  const referenceMatch = TASK_REFERENCE_PATTERN.exec(text);
  const taskQuery = referenceMatch ? referenceMatch[1] : null;
  if (referenceMatch) text = text.replace(referenceMatch[0], ' ');

  const urls = extractUrls(text);
  const textWithoutUrls = text.replace(URL_PATTERN, ' ').replace(/\s+/g, ' ').trim();

  return {
    text: textWithoutUrls || urls[0] || '',
    kindOverride,
    isResult,
    taskQuery,
    links: urls.map((url) => createLink(url)),
  };
}

/**
 * Busca la tarea que mejor coincide con `@consulta`. Prioriza tareas abiertas y
 * títulos que empiezan con la consulta.
 * @param {string} taskQuery
 * @param {import('./task-history.js').Task[]} tasks
 * @returns {import('./task-history.js').Task|null}
 */
export function resolveTaskReference(taskQuery, tasks) {
  const normalizedQuery = normalizeSearchText(taskQuery.replace(TASK_REFERENCE_SEPARATOR_PATTERN, ' '));
  if (!normalizedQuery) return null;
  let bestTask = null;
  let bestScore = 0;
  for (const task of tasks) {
    const normalizedTitle = normalizeSearchText(task.title);
    let score = 0;
    if (normalizedTitle === normalizedQuery) score = 4;
    else if (normalizedTitle.startsWith(normalizedQuery)) score = 3;
    else if (normalizedTitle.split(/\s+/).some((word) => word.startsWith(normalizedQuery))) score = 2;
    else if (normalizedTitle.includes(normalizedQuery)) score = 1;
    if (score === 0) continue;
    if (isOpenTaskStatus(task.status)) score += 0.5;
    if (score > bestScore) {
      bestScore = score;
      bestTask = task;
    }
  }
  return bestTask;
}
