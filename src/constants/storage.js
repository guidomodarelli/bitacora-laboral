/**
 * Contrato de almacenamiento en IndexedDB y del formato de backup.
 * @typedef {'projects'|'tasks'|'activities'|'results'|'dayPlans'|'dailyDrafts'|'summaries'|'templates'|'settings'|'fileHandles'} StoreName
 */

export const DATABASE_NAME = 'bitacora-laboral';
export const DATABASE_VERSION = 1;

export const STORE = Object.freeze({
  PROJECTS: 'projects',
  TASKS: 'tasks',
  ACTIVITIES: 'activities',
  RESULTS: 'results',
  DAY_PLANS: 'dayPlans',
  DAILY_DRAFTS: 'dailyDrafts',
  SUMMARIES: 'summaries',
  TEMPLATES: 'templates',
  SETTINGS: 'settings',
  FILE_HANDLES: 'fileHandles',
});

/** @type {Readonly<Record<StoreName, string>>} */
export const STORE_KEY_PATHS = Object.freeze({
  projects: 'id',
  tasks: 'id',
  activities: 'id',
  results: 'id',
  dayPlans: 'date',
  dailyDrafts: 'date',
  summaries: 'id',
  templates: 'kind',
  settings: 'id',
  fileHandles: 'id',
});

/** Índices secundarios por store: `[nombreIndice, keyPath]`. */
export const STORE_INDEXES = Object.freeze({
  tasks: [['status', 'status'], ['projectId', 'projectId']],
  activities: [['date', 'date'], ['taskId', 'taskId']],
  results: [['date', 'date'], ['taskId', 'taskId']],
  summaries: [['kind', 'kind']],
});

/** Stores que viajan en la exportación JSON (los handles de carpeta no son serializables). */
export const EXPORTABLE_STORES = Object.freeze(
  /** @type {StoreName[]} */ ([
    'projects', 'tasks', 'activities', 'results', 'dayPlans', 'dailyDrafts', 'summaries', 'templates', 'settings',
  ]),
);

export const SETTINGS_RECORD_ID = 'settings';
export const BACKUP_FOLDER_HANDLE_ID = 'backupFolder';

export const BACKUP_APP_ID = 'bitacora-laboral';
export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_FILE_PREFIX = 'bitacora-laboral';
export const BACKUP_MIME_TYPE = 'application/json';

export const IMPORT_MODE = Object.freeze({
  MERGE: 'merge',
  REPLACE: 'replace',
});

/** Clave de `localStorage` para preferencias de interfaz no críticas. */
export const UI_PREFERENCES_STORAGE_KEY = 'bitacora-laboral:ui';
