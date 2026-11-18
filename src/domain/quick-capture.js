/**
 * Interpreta la barra de captura rápida:
 * - `!texto` registra una decisión.
 * - `+texto` registra un resultado.
 * - `@tarea` asocia el registro a una tarea por su título.
 * - Las URLs pegadas se convierten en enlaces.
 */
import { DECISION_PREFIX, RESULT_PREFIX, TASK_REFERENCE_AT_CARET_PATTERN, TASK_REFERENCE_PATTERN, TASK_REFERENCE_SEPARATOR_PATTERN } from '../constants/quick-capture.js';
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
  return suggestTasksForReference(taskQuery, tasks, 1)[0] ?? null;
}

/**
 * Tareas que coinciden con `@consulta`, de la mejor a la peor, para autocompletar.
 * A igual puntaje se conserva el orden recibido.
 * @param {string} taskQuery
 * @param {import('./task-history.js').Task[]} tasks
 * @param {number} limit
 * @returns {import('./task-history.js').Task[]}
 */
export function suggestTasksForReference(taskQuery, tasks, limit) {
  const normalizedQuery = normalizeSearchText(taskQuery.replace(TASK_REFERENCE_SEPARATOR_PATTERN, ' '));
  if (!normalizedQuery) return [];
  return tasks
    .map((task) => ({ task, score: scoreTaskReference(normalizedQuery, task) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((candidate) => candidate.task);
}

/**
 * @param {string} normalizedQuery
 * @param {import('./task-history.js').Task} task
 */
function scoreTaskReference(normalizedQuery, task) {
  const normalizedTitle = normalizeSearchText(task.title);
  let score = 0;
  if (normalizedTitle === normalizedQuery) score = 4;
  else if (normalizedTitle.startsWith(normalizedQuery)) score = 3;
  else if (normalizedTitle.split(/\s+/).some((word) => word.startsWith(normalizedQuery))) score = 2;
  else if (normalizedTitle.includes(normalizedQuery)) score = 1;
  if (score > 0 && isOpenTaskStatus(task.status)) score += 0.5;
  return score;
}

/**
 * Referencia `@consulta` que se está escribiendo justo antes del cursor.
 * @param {string} text
 * @param {number} caretIndex
 * @returns {{query: string, start: number, end: number}|null} `start` apunta a la `@`.
 */
export function findTaskReferenceAtCaret(text, caretIndex) {
  const match = TASK_REFERENCE_AT_CARET_PATTERN.exec(text.slice(0, caretIndex));
  if (!match) return null;
  return { query: match[1], start: caretIndex - match[1].length - 1, end: caretIndex };
}

/** Motivos por los que una captura no se puede registrar todavía. */
export const CAPTURE_PROBLEM = Object.freeze({
  EMPTY: 'empty',
  UNKNOWN_TASK: 'unknown_task',
});

/**
 * @typedef {object} ResolvedCapture
 * @property {QuickCaptureInput} parsed
 * @property {import('./task-history.js').Task|null} task Tarea a la que va el registro.
 * @property {boolean} isTaskFromReference La tarea salió de `@`, no de la elegida en el formulario.
 * @property {'empty'|'unknown_task'|null} problem
 */

/**
 * Decide qué se va a registrar con el texto actual: lo usa la vista previa y el envío,
 * así lo que se muestra es exactamente lo que se guarda.
 * @param {string} rawText
 * @param {{tasks: import('./task-history.js').Task[], selectedTaskId: string|null}} context
 * @returns {ResolvedCapture}
 */
export function resolveCapture(rawText, { tasks, selectedTaskId }) {
  const parsed = parseQuickCapture(rawText);
  const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) ?? null : null;
  if (parsed.taskQuery) {
    const referencedTask = resolveTaskReference(parsed.taskQuery, tasks);
    if (!referencedTask) return { parsed, task: selectedTask, isTaskFromReference: false, problem: CAPTURE_PROBLEM.UNKNOWN_TASK };
    return { parsed, task: referencedTask, isTaskFromReference: true, problem: parsed.text ? null : CAPTURE_PROBLEM.EMPTY };
  }
  return { parsed, task: selectedTask, isTaskFromReference: false, problem: parsed.text ? null : CAPTURE_PROBLEM.EMPTY };
}
