/**
 * Migraciones de esquema de IndexedDB. Cada entrada lleva la base a `version`.
 */
import { STORE, STORE_INDEXES, STORE_KEY_PATHS } from '../constants/storage.js';

/**
 * @type {ReadonlyArray<{version: number, migrate: (database: IDBDatabase, transaction: IDBTransaction) => void}>}
 */
export const MIGRATIONS = Object.freeze([
  {
    version: 1,
    migrate(database) {
      for (const storeName of Object.values(STORE)) {
        const store = database.createObjectStore(storeName, { keyPath: STORE_KEY_PATHS[storeName] });
        for (const [indexName, keyPath] of STORE_INDEXES[storeName] ?? []) store.createIndex(indexName, keyPath);
      }
    },
  },
]);

/**
 * @param {IDBDatabase} database
 * @param {IDBTransaction} transaction
 * @param {number} oldVersion
 */
export function runMigrations(database, transaction, oldVersion) {
  for (const migration of MIGRATIONS) {
    if (migration.version > oldVersion) migration.migrate(database, transaction);
  }
}
