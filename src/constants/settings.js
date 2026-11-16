/** Locale usado para formatear fechas en la interfaz y en los prompts. */
export const APP_LOCALE = 'es-AR';

/** Días de la semana con `Date#getDay()`: 0 = domingo … 6 = sábado. */
export const WEEKDAY_LABELS = Object.freeze(['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']);

/**
 * @typedef {object} AppSettings
 * @property {number[]} workdays Días laborales según `Date#getDay()`.
 * @property {string[]} holidays Feriados en formato `YYYY-MM-DD`.
 * @property {number} blockerAlertWorkdays Días hábiles a partir de los cuales un bloqueo se marca como prolongado.
 * @property {string|null} lastBackupAt Fecha ISO del último export o backup a carpeta.
 * @property {string|null} lastFolderBackupOn Fecha `YYYY-MM-DD` del último backup automático a carpeta.
 */

/** @type {Readonly<AppSettings>} */
export const DEFAULT_SETTINGS = Object.freeze({
  workdays: [1, 2, 3, 4, 5],
  holidays: [],
  blockerAlertWorkdays: 3,
  lastBackupAt: null,
  lastFolderBackupOn: null,
});

/** Tope de búsqueda hacia atrás al buscar un día laboral (evita loops sin días laborales configurados). */
export const MAX_WORKDAY_LOOKBACK_DAYS = 366;

/** Días sin backup a partir de los cuales se muestra el recordatorio. */
export const BACKUP_REMINDER_DAYS = 7;
