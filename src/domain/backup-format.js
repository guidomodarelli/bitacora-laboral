/**
 * Formato de backup JSON: creación, validación y fusión.
 */
import { BACKUP_APP_ID, BACKUP_SCHEMA_VERSION, EXPORTABLE_STORES, STORE_KEY_PATHS } from '../constants/storage.js';

/**
 * @typedef {Record<import('../constants/storage.js').StoreName, object[]>} StoresData
 * @typedef {{app: string, schemaVersion: number, exportedAt: string, data: StoresData}} BackupDocument
 */

export class BackupFormatError extends Error {
  /** @param {string} message @param {{cause?: unknown}} [options] */
  constructor(message, options) {
    super(message, options);
    this.name = 'BackupFormatError';
  }
}

/**
 * @param {Partial<StoresData>} storesData
 * @param {string} exportedAtIso
 * @returns {BackupDocument}
 */
export function createBackupDocument(storesData, exportedAtIso) {
  const data = /** @type {StoresData} */ ({});
  for (const storeName of EXPORTABLE_STORES) data[storeName] = storesData[storeName] ?? [];
  return { app: BACKUP_APP_ID, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: exportedAtIso, data };
}

/**
 * Valida un backup ya parseado o en texto. Lanza `BackupFormatError` con un
 * mensaje apto para mostrar al usuario.
 * @param {string|unknown} input
 * @returns {StoresData}
 */
export function parseBackupDocument(input) {
  let document = input;
  if (typeof input === 'string') {
    try {
      document = JSON.parse(input);
    } catch (parseError) {
      throw new BackupFormatError('El archivo no es un JSON válido.', { cause: parseError });
    }
  }
  if (!document || typeof document !== 'object') throw new BackupFormatError('El archivo no contiene un backup.');
  const backup = /** @type {Partial<BackupDocument>} */ (document);
  if (backup.app !== BACKUP_APP_ID) throw new BackupFormatError('El archivo no es un backup de esta bitácora.');
  if (!Number.isInteger(backup.schemaVersion) || backup.schemaVersion < 1) throw new BackupFormatError('El backup no indica una versión de esquema válida.');
  if (backup.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new BackupFormatError(`El backup es de una versión más nueva (esquema ${backup.schemaVersion}). Actualizá la aplicación antes de importarlo.`);
  }
  if (!backup.data || typeof backup.data !== 'object') throw new BackupFormatError('El backup no tiene la sección "data".');

  const data = /** @type {StoresData} */ ({});
  for (const storeName of EXPORTABLE_STORES) {
    const records = backup.data[storeName] ?? [];
    if (!Array.isArray(records)) throw new BackupFormatError(`La sección "${storeName}" del backup no es una lista.`);
    const keyPath = STORE_KEY_PATHS[storeName];
    const invalidIndex = records.findIndex((record) => !record || typeof record !== 'object' || typeof record[keyPath] !== 'string' || !record[keyPath]);
    if (invalidIndex !== -1) throw new BackupFormatError(`El registro ${invalidIndex + 1} de "${storeName}" no tiene "${keyPath}".`);
    data[storeName] = records;
  }
  return data;
}

/**
 * Fusiona por clave: si el registro existe en ambos lados gana el `updatedAt` más reciente.
 * @param {object[]} currentRecords
 * @param {object[]} incomingRecords
 * @param {string} keyPath
 * @returns {object[]}
 */
export function mergeStoreRecords(currentRecords, incomingRecords, keyPath) {
  const merged = new Map(currentRecords.map((record) => [record[keyPath], record]));
  for (const incoming of incomingRecords) {
    const current = merged.get(incoming[keyPath]);
    if (!current || (incoming.updatedAt ?? '') > (current.updatedAt ?? '')) merged.set(incoming[keyPath], incoming);
  }
  return [...merged.values()];
}

/**
 * @param {StoresData} currentData
 * @param {StoresData} incomingData
 * @returns {StoresData}
 */
export function mergeBackupData(currentData, incomingData) {
  const merged = /** @type {StoresData} */ ({});
  for (const storeName of EXPORTABLE_STORES) {
    merged[storeName] = mergeStoreRecords(currentData[storeName] ?? [], incomingData[storeName] ?? [], STORE_KEY_PATHS[storeName]);
  }
  return merged;
}
