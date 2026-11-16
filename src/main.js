/**
 * Punto de entrada: carga los datos locales, monta la interfaz y activa el modo offline.
 */
import { runDailyFolderBackupIfDue } from './services/backup-service.js';
import { requestStoragePersistence } from './services/browser-services.js';
import { initializeDataStore } from './services/data-store.js';
import { startApp } from './ui/app.js';
import { h } from './ui/dom.js';
import { showToast } from './ui/toast.js';

const SERVICE_WORKER_PATH = './sw.js';
const SECURE_PROTOCOLS = new Set(['http:', 'https:']);

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !SECURE_PROTOCOLS.has(window.location.protocol)) return;
  try {
    await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
  } catch (registrationError) {
    console.warn('main:registerServiceWorker failed; la app funciona pero no offline', registrationError);
  }
}

async function main() {
  const root = /** @type {HTMLElement} */ (document.getElementById('app'));
  try {
    await initializeDataStore();
  } catch (initializationError) {
    console.error('main:initializeDataStore failed', initializationError);
    root.replaceChildren(h('div', { class: 'fatal-error', role: 'alert' },
      h('h1', {}, 'No se pudo abrir la base de datos local'),
      h('p', {}, 'Revisá que el navegador permita almacenamiento para este sitio (no uses ventana privada) y que no haya otra pestaña de la bitácora con una versión distinta abierta.'),
      h('p', { class: 'hint' }, String(initializationError?.message ?? initializationError)),
    ));
    return;
  }

  startApp(root);
  requestStoragePersistence().catch((persistenceError) => console.warn('main:requestStoragePersistence failed', persistenceError));
  runDailyFolderBackupIfDue()
    .then((didBackup) => { if (didBackup) showToast('Backup diario guardado en tu carpeta', { tone: 'success' }); })
    .catch((backupError) => {
      console.error('main:runDailyFolderBackupIfDue failed', backupError);
      showToast('No se pudo hacer el backup automático. Revisalo en Ajustes.', { tone: 'error' });
    });
  registerServiceWorker();
}

main();
