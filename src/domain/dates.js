/**
 * Utilidades de fechas de negocio. Todas las fechas se manejan como claves
 * `YYYY-MM-DD` en hora local, para que una actividad cargada de noche no
 * cambie de día por la zona horaria.
 */
import {
  DATE_KEY_PATTERN,
  DAYS_PER_WEEK,
  ISO_FIRST_WEEK_REFERENCE_DAY,
  ISO_WEEK_ANCHOR_OFFSET_DAYS,
  MILLISECONDS_PER_DAY,
  MONTH_ID_PATTERN,
  WEEK_ID_PATTERN,
} from '../constants/periods.js';

/** Hora usada al construir `Date` locales: el mediodía evita saltos por cambio de horario. */
const SAFE_LOCAL_HOUR = 12;

/**
 * @typedef {object} DateRange
 * @property {string} start Fecha inicial inclusiva `YYYY-MM-DD`.
 * @property {string} end Fecha final inclusiva `YYYY-MM-DD`.
 */

/**
 * @param {Date} date
 * @returns {string}
 */
export function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isDateKey(value) {
  if (typeof value !== 'string' || !DATE_KEY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, SAFE_LOCAL_HOUR);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/**
 * @param {string} dateKey
 * @returns {Date}
 */
export function parseDateKey(dateKey) {
  if (!isDateKey(dateKey)) {
    throw new Error(`dates:parseDateKey received an invalid date key "${String(dateKey).slice(0, 20)}"`);
  }
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, SAFE_LOCAL_HOUR);
}

/**
 * @param {Date} [now]
 * @returns {string}
 */
export function todayKey(now = new Date()) {
  return toDateKey(now);
}

/**
 * @param {string} dateKey
 * @param {number} amount Días a sumar (negativo para restar).
 * @returns {string}
 */
export function addDays(dateKey, amount) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

/**
 * @param {string} dateKey
 * @returns {number} Día de la semana según `Date#getDay()`.
 */
export function weekdayOf(dateKey) {
  return parseDateKey(dateKey).getDay();
}

/**
 * Diferencia en días calendario entre dos fechas (`toKey - fromKey`).
 * @param {string} fromKey
 * @param {string} toKey
 * @returns {number}
 */
export function daysBetween(fromKey, toKey) {
  const toUtc = (dateKey) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(toKey) - toUtc(fromKey)) / MILLISECONDS_PER_DAY);
}

/**
 * @param {string} dateKey
 * @param {DateRange} range
 * @returns {boolean}
 */
export function isDateInRange(dateKey, range) {
  return dateKey >= range.start && dateKey <= range.end;
}

/**
 * @param {DateRange} range
 * @returns {string[]}
 */
export function listDateKeys(range) {
  const dateKeys = [];
  for (let cursor = range.start; cursor <= range.end; cursor = addDays(cursor, 1)) dateKeys.push(cursor);
  return dateKeys;
}

/**
 * @param {string} dateKey
 * @returns {string} Lunes de la semana ISO que contiene la fecha.
 */
export function startOfIsoWeek(dateKey) {
  const mondayOffset = (weekdayOf(dateKey) + 6) % DAYS_PER_WEEK;
  return addDays(dateKey, -mondayOffset);
}

/**
 * @param {string} dateKey
 * @returns {string} Identificador `YYYY-Www`.
 */
export function isoWeekIdOf(dateKey) {
  const thursday = addDays(startOfIsoWeek(dateKey), ISO_WEEK_ANCHOR_OFFSET_DAYS);
  const isoYear = thursday.slice(0, 4);
  const weekNumber = Math.floor(daysBetween(`${isoYear}-01-01`, thursday) / DAYS_PER_WEEK) + 1;
  return `${isoYear}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * @param {string} weekId `YYYY-Www`.
 * @returns {DateRange} De lunes a domingo.
 */
export function weekRangeFromId(weekId) {
  const match = WEEK_ID_PATTERN.exec(weekId);
  if (!match) throw new Error(`dates:weekRangeFromId received an invalid week id "${String(weekId).slice(0, 20)}"`);
  const [, isoYear, weekNumber] = match;
  const firstMonday = startOfIsoWeek(`${isoYear}-${ISO_FIRST_WEEK_REFERENCE_DAY}`);
  const start = addDays(firstMonday, (Number(weekNumber) - 1) * DAYS_PER_WEEK);
  return { start, end: addDays(start, DAYS_PER_WEEK - 1) };
}

/**
 * @param {string} weekId
 * @param {number} amount Semanas a desplazar.
 * @returns {string}
 */
export function shiftWeekId(weekId, amount) {
  return isoWeekIdOf(addDays(weekRangeFromId(weekId).start, amount * DAYS_PER_WEEK));
}

/**
 * @param {string} dateKey
 * @returns {string} `YYYY-MM`.
 */
export function monthIdOf(dateKey) {
  return dateKey.slice(0, 7);
}

/**
 * @param {string} monthId `YYYY-MM`.
 * @returns {DateRange}
 */
export function monthRangeFromId(monthId) {
  const match = MONTH_ID_PATTERN.exec(monthId);
  if (!match) throw new Error(`dates:monthRangeFromId received an invalid month id "${String(monthId).slice(0, 20)}"`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const lastDay = new Date(year, month, 0, SAFE_LOCAL_HOUR).getDate();
  return { start: `${monthId}-01`, end: `${monthId}-${String(lastDay).padStart(2, '0')}` };
}

/**
 * @param {string} monthId
 * @param {number} amount Meses a desplazar.
 * @returns {string}
 */
export function shiftMonthId(monthId, amount) {
  const [year, month] = monthId.split('-').map(Number);
  const shifted = new Date(year, month - 1 + amount, 1, SAFE_LOCAL_HOUR);
  return monthIdOf(toDateKey(shifted));
}

/**
 * @typedef {object} MonthWeekSegment
 * @property {string} weekId
 * @property {DateRange} weekRange Semana completa (lunes a domingo).
 * @property {DateRange} monthRange Parte de la semana que cae dentro del mes.
 * @property {boolean} crossesMonth La semana tiene días fuera del mes.
 */

/**
 * Semanas ISO que tienen al menos un día dentro del mes calendario.
 * @param {string} monthId
 * @returns {MonthWeekSegment[]}
 */
export function weeksTouchingMonth(monthId) {
  const month = monthRangeFromId(monthId);
  const segments = [];
  for (let monday = startOfIsoWeek(month.start); monday <= month.end; monday = addDays(monday, DAYS_PER_WEEK)) {
    const weekRange = { start: monday, end: addDays(monday, DAYS_PER_WEEK - 1) };
    segments.push({
      weekId: isoWeekIdOf(monday),
      weekRange,
      monthRange: {
        start: weekRange.start < month.start ? month.start : weekRange.start,
        end: weekRange.end > month.end ? month.end : weekRange.end,
      },
      crossesMonth: weekRange.start < month.start || weekRange.end > month.end,
    });
  }
  return segments;
}
