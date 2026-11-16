/**
 * Reglas de días laborales: fines de semana y feriados configurables.
 */
import { MAX_WORKDAY_LOOKBACK_DAYS } from '../constants/settings.js';
import { addDays, weekdayOf } from './dates.js';

/**
 * @typedef {Pick<import('../constants/settings.js').AppSettings, 'workdays'|'holidays'>} WorkdaySettings
 */

/**
 * @param {string} dateKey
 * @param {WorkdaySettings} settings
 * @returns {boolean}
 */
export function isWorkday(dateKey, settings) {
  return settings.workdays.includes(weekdayOf(dateKey)) && !settings.holidays.includes(dateKey);
}

/**
 * Día laboral inmediatamente anterior. Un lunes devuelve el viernes previo.
 * @param {string} dateKey
 * @param {WorkdaySettings} settings
 * @returns {string|null} `null` si no hay días laborales configurados.
 */
export function previousWorkday(dateKey, settings) {
  let cursor = dateKey;
  for (let step = 0; step < MAX_WORKDAY_LOOKBACK_DAYS; step += 1) {
    cursor = addDays(cursor, -1);
    if (isWorkday(cursor, settings)) return cursor;
  }
  return null;
}

/**
 * Cantidad de días laborales en el intervalo `(fromKey, toKey]`.
 * @param {string} fromKey
 * @param {string} toKey
 * @param {WorkdaySettings} settings
 * @returns {number}
 */
export function countWorkdaysSince(fromKey, toKey, settings) {
  let count = 0;
  for (let cursor = addDays(fromKey, 1); cursor <= toKey; cursor = addDays(cursor, 1)) {
    if (isWorkday(cursor, settings)) count += 1;
  }
  return count;
}
