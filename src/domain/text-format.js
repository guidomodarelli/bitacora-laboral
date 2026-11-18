/**
 * Formato de cantidades en texto visible.
 */

/**
 * @param {number} count
 * @param {string} singular
 * @param {string} plural
 * @returns {string} Por ejemplo, «1 avance» o «3 avances».
 */
export function formatCount(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Cuánto lleva bloqueada una tarea, en días hábiles.
 * @param {number} workdays
 * @returns {string} «desde hoy» o «hace 3 días hábiles».
 */
export function describeBlockedDuration(workdays) {
  return workdays === 0 ? 'desde hoy' : `hace ${formatCount(workdays, 'día hábil', 'días hábiles')}`;
}
