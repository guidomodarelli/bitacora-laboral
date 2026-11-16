/**
 * @typedef {'hoy'|'daily'|'tareas'|'historial'|'semanal'|'mensual'|'ajustes'} RouteName
 */

export const ROUTE = Object.freeze({
  TODAY: 'hoy',
  DAILY: 'daily',
  TASKS: 'tareas',
  HISTORY: 'historial',
  WEEKLY: 'semanal',
  MONTHLY: 'mensual',
  SETTINGS: 'ajustes',
});

/** @type {ReadonlyArray<{route: RouteName, label: string, shortcut: string}>} */
export const NAVIGATION_ITEMS = Object.freeze([
  { route: 'hoy', label: 'Hoy', shortcut: '1' },
  { route: 'daily', label: 'Daily', shortcut: '2' },
  { route: 'tareas', label: 'Tareas', shortcut: '3' },
  { route: 'historial', label: 'Historial', shortcut: '4' },
  { route: 'semanal', label: 'Semanal', shortcut: '5' },
  { route: 'mensual', label: 'Mensual', shortcut: '6' },
  { route: 'ajustes', label: 'Ajustes', shortcut: '7' },
]);

export const DEFAULT_ROUTE = ROUTE.TODAY;
export const QUICK_CAPTURE_SHORTCUT_KEY = '/';

/** Evento para pedir un re-render cuando cambia estado de interfaz (no datos). */
export const RERENDER_EVENT = 'app:rerender';

/** @param {string} route @param {string} [param] */
export function buildRouteHash(route, param) {
  return param ? `#/${route}/${encodeURIComponent(param)}` : `#/${route}`;
}
