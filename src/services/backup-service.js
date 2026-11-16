/**
 * Exportación a archivo, importación y backup automático a una carpeta elegida
 * por el usuario (File System Access API, disponible en Chrome y Edge).
 */
import { getRecord, writeRecords } from '../db/database.js';
import { BACKUP_FILE_PREFIX, BACKUP_FOLDER_HANDLE_ID, BACKUP_MIME_TYPE, STORE } from '../constants/storage.js';
import { createBackupDocument, parseBackupDocument } from '../domain/backup-format.js';
import { todayKey } from '../domain/dates.js';
import { getExportableData, getSnapshot, importData, updateSettings } from './data-store.js';

const JSON_INDENT_SPACES = 2;
const PERMISSION_GRANTED = 'granted';
const READ_WRITE_PERMISSION = { mode: 'readwrite' };

function serializeBackup() {
  return JSON.stringify(createBackupDocument(getExportableData(), new Date().toISOString()), null, JSON_INDENT_SPACES);
}

const backupFileName = () => `${BACKUP_FILE_PREFIX}-${todayKey()}.json`;

async function markBackupDone(extraSettings = {}) {
  await updateSettings({ lastBackupAt: new Date().toISOString(), ...extraSettings });
}

/** Descarga el backup como archivo JSON. */
export async function downloadBackupFile() {
  const blob = new Blob([serializeBackup()], { type: BACKUP_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = backupFileName();
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  await markBackupDone();
}

/**
 * @param {File} file
 * @param {'merge'|'replace'} mode
 */
export async function importBackupFile(file, mode) {
  const data = parseBackupDocument(await file.text());
  await importData(data, mode);
}

// ── Backup a carpeta ───────────────────────────────────────────

export function isFolderBackupSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/** @returns {Promise<FileSystemDirectoryHandle|null>} */
async function getFolderHandle() {
  const record = await getRecord(STORE.FILE_HANDLES, BACKUP_FOLDER_HANDLE_ID);
  return record?.handle ?? null;
}

/** Pide al usuario la carpeta de backups y hace el primer backup. */
export async function chooseBackupFolder() {
  const handle = await window.showDirectoryPicker({ id: BACKUP_FILE_PREFIX, ...READ_WRITE_PERMISSION });
  await writeRecords([{ storeName: STORE.FILE_HANDLES, type: 'put', record: { id: BACKUP_FOLDER_HANDLE_ID, handle } }]);
  await writeBackupToFolder(handle);
  return handle.name;
}

/** @returns {Promise<{folderName: string|null, permission: string|null}>} */
export async function getFolderBackupStatus() {
  if (!isFolderBackupSupported()) return { folderName: null, permission: null };
  const handle = await getFolderHandle();
  if (!handle) return { folderName: null, permission: null };
  return { folderName: handle.name, permission: await handle.queryPermission(READ_WRITE_PERMISSION) };
}

/** @param {FileSystemDirectoryHandle} handle */
async function writeBackupToFolder(handle) {
  const fileHandle = await handle.getFileHandle(backupFileName(), { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(serializeBackup());
  } finally {
    await writable.close();
  }
  await markBackupDone({ lastFolderBackupOn: todayKey() });
}

/**
 * Backup manual a la carpeta configurada; pide permiso si hace falta (requiere un clic del usuario).
 * @returns {Promise<boolean>} `false` si no hay carpeta o no se concedió permiso.
 */
export async function backupToFolderNow() {
  const handle = await getFolderHandle();
  if (!handle) return false;
  if (await handle.requestPermission(READ_WRITE_PERMISSION) !== PERMISSION_GRANTED) return false;
  await writeBackupToFolder(handle);
  return true;
}

/**
 * Backup automático una vez por día, solo si el navegador ya conserva el permiso.
 * @returns {Promise<boolean>} Si se escribió un backup.
 */
export async function runDailyFolderBackupIfDue() {
  if (!isFolderBackupSupported() || getSnapshot().settings.lastFolderBackupOn === todayKey()) return false;
  const handle = await getFolderHandle();
  if (!handle || await handle.queryPermission(READ_WRITE_PERMISSION) !== PERMISSION_GRANTED) return false;
  await writeBackupToFolder(handle);
  return true;
}
