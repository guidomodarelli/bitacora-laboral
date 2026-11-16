/**
 * Acceso mínimo a IndexedDB con promesas. No contiene lógica de negocio.
 */
import { DATABASE_NAME, DATABASE_VERSION } from '../constants/storage.js';
import { runMigrations } from './migrations.js';

/** @type {Promise<IDBDatabase>|null} */
let databasePromise = null;

export class DatabaseError extends Error {
  /** @param {string} message @param {{cause?: unknown}} [options] */
  constructor(message, options) {
    super(message, options);
    this.name = 'DatabaseError';
  }
}

/**
 * @template RequestResult
 * @param {IDBRequest<RequestResult>} request
 * @returns {Promise<RequestResult>}
 */
function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** @param {IDBTransaction} transaction */
function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(undefined);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('transaction aborted'));
  });
}

/** @returns {Promise<IDBDatabase>} */
export function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new DatabaseError('IndexedDB:open failed: el navegador no soporta IndexedDB'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = (event) => runMigrations(request.result, /** @type {IDBTransaction} */ (request.transaction), event.oldVersion);
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(new DatabaseError(`IndexedDB:open failed (database=${DATABASE_NAME}, version=${DATABASE_VERSION})`, { cause: request.error }));
    request.onblocked = () => reject(new DatabaseError('IndexedDB:open blocked: cerrá otras pestañas de la bitácora y recargá'));
  });
  databasePromise.catch(() => { databasePromise = null; });
  return databasePromise;
}

/**
 * @param {string[]} storeNames
 * @returns {Promise<Record<string, object[]>>}
 */
export async function readAllStores(storeNames) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeNames, 'readonly');
    const entries = await Promise.all(storeNames.map(async (storeName) => [storeName, await requestToPromise(transaction.objectStore(storeName).getAll())]));
    return Object.fromEntries(entries);
  } catch (readError) {
    throw new DatabaseError(`IndexedDB:readAllStores failed (stores=${storeNames.join(',')})`, { cause: readError });
  }
}

/**
 * @param {string} storeName
 * @param {IDBValidKey} key
 */
export async function getRecord(storeName, key) {
  const database = await openDatabase();
  try {
    return await requestToPromise(database.transaction(storeName, 'readonly').objectStore(storeName).get(key));
  } catch (readError) {
    throw new DatabaseError(`IndexedDB:getRecord failed (store=${storeName}, key=${String(key)})`, { cause: readError });
  }
}

/**
 * Aplica varias escrituras en una sola transacción atómica.
 * @param {Array<{storeName: string, type: 'put', record: object}|{storeName: string, type: 'delete', key: IDBValidKey}>} operations
 */
export async function writeRecords(operations) {
  if (operations.length === 0) return;
  const database = await openDatabase();
  const storeNames = [...new Set(operations.map((operation) => operation.storeName))];
  try {
    const transaction = database.transaction(storeNames, 'readwrite');
    for (const operation of operations) {
      const store = transaction.objectStore(operation.storeName);
      if (operation.type === 'put') store.put(operation.record);
      else store.delete(operation.key);
    }
    await transactionDone(transaction);
  } catch (writeError) {
    const summary = operations.map((operation) => `${operation.type}:${operation.storeName}`).join(',');
    throw new DatabaseError(`IndexedDB:writeRecords failed (operations=${summary})`, { cause: writeError });
  }
}

/**
 * Reemplaza por completo el contenido de los stores indicados, en una transacción.
 * @param {Record<string, object[]>} recordsByStore
 */
export async function replaceStores(recordsByStore) {
  const database = await openDatabase();
  const storeNames = Object.keys(recordsByStore);
  try {
    const transaction = database.transaction(storeNames, 'readwrite');
    for (const storeName of storeNames) {
      const store = transaction.objectStore(storeName);
      store.clear();
      for (const record of recordsByStore[storeName]) store.put(record);
    }
    await transactionDone(transaction);
  } catch (writeError) {
    throw new DatabaseError(`IndexedDB:replaceStores failed (stores=${storeNames.join(',')})`, { cause: writeError });
  }
}
