/**
 * Formateo legible de fechas de negocio para la interfaz y los prompts.
 */
import { APP_LOCALE } from '../constants/settings.js';
import { parseDateKey, weekRangeFromId, monthRangeFromId } from './dates.js';

const longDateFormatter = new Intl.DateTimeFormat(APP_LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
const shortWeekdayFormatter = new Intl.DateTimeFormat(APP_LOCALE, { weekday: 'short' });
const dayMonthFormatter = new Intl.DateTimeFormat(APP_LOCALE, { day: 'numeric', month: 'long' });
const monthFormatter = new Intl.DateTimeFormat(APP_LOCALE, { month: 'long', year: 'numeric' });
const timestampFormatter = new Intl.DateTimeFormat(APP_LOCALE, { dateStyle: 'medium', timeStyle: 'short' });

/** @param {string} dateKey @returns {string} p. ej. «lunes, 16 de noviembre» */
export function formatDateLong(dateKey) {
  return longDateFormatter.format(parseDateKey(dateKey));
}

/**
 * Se arma a mano porque el formato corto de Intl varía entre motores (Node usa «lun 16-11»).
 * @param {string} dateKey
 * @returns {string} p. ej. «lun 16/11»
 */
export function formatDateShort(dateKey) {
  const weekday = shortWeekdayFormatter.format(parseDateKey(dateKey)).replace('.', '');
  const [, month, day] = dateKey.split('-');
  return `${weekday} ${day}/${month}`;
}

/** @param {string} dateKey @returns {string} p. ej. «16 de noviembre» */
export function formatDayMonth(dateKey) {
  return dayMonthFormatter.format(parseDateKey(dateKey));
}

/** @param {{start: string, end: string}} range */
export function formatDateRange(range) {
  if (range.start === range.end) return formatDayMonth(range.start);
  return `${formatDayMonth(range.start)} al ${formatDayMonth(range.end)}`;
}

/** @param {string} weekId */
export function formatWeekLabel(weekId) {
  const range = weekRangeFromId(weekId);
  const weekNumber = Number(weekId.split('-W')[1]);
  return `Semana ${weekNumber} · ${formatDateRange(range)}`;
}

/** @param {string} monthId */
export function formatMonthLabel(monthId) {
  const label = monthFormatter.format(parseDateKey(monthRangeFromId(monthId).start));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** @param {string} isoTimestamp */
export function formatTimestamp(isoTimestamp) {
  return timestampFormatter.format(new Date(isoTimestamp));
}
