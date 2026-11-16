/**
 * Ajustes: días laborales, feriados, plantillas, proyectos y datos (backup / import).
 */
import { DEFAULT_TEMPLATES, TEMPLATE_KIND } from '../../constants/prompt-templates.js';
import { WEEKDAY_LABELS } from '../../constants/settings.js';
import { IMPORT_MODE } from '../../constants/storage.js';
import { BackupFormatError } from '../../domain/backup-format.js';
import { formatDateLong, formatTimestamp } from '../../domain/date-format.js';
import { isDateKey } from '../../domain/dates.js';
import {
  backupToFolderNow,
  chooseBackupFolder,
  downloadBackupFile,
  getFolderBackupStatus,
  importBackupFile,
  isFolderBackupSupported,
} from '../../services/backup-service.js';
import { isStoragePersisted, requestStoragePersistence } from '../../services/browser-services.js';
import { ValidationError, resetTemplate, saveTemplate, updateProject, updateSettings } from '../../services/data-store.js';
import { emptyState, runAction } from '../components.js';
import { h } from '../dom.js';
import { showToast } from '../toast.js';
import { uiDrafts } from '../ui-state.js';

/** Orden de los días en pantalla: lunes primero. */
const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const TEMPLATE_TITLES = { weekly: 'Prompt semanal', monthly: 'Prompt mensual' };

/** @param {import('../../domain/record-grouping.js').Snapshot} snapshot */
function workCalendarSection(snapshot) {
  const { workdays, holidays, blockerAlertWorkdays } = snapshot.settings;
  const toggleWorkday = (weekday) => {
    const nextWorkdays = workdays.includes(weekday) ? workdays.filter((day) => day !== weekday) : [...workdays, weekday].sort();
    runAction('settings:updateWorkdays', () => updateSettings({ workdays: nextWorkdays }));
  };
  const holidayInput = h('input', { type: 'date', 'aria-label': 'Nuevo feriado', dataset: { focusKey: 'settings-holiday' } });
  const addHoliday = () => {
    if (!isDateKey(holidayInput.value)) return showToast('Elegí una fecha.', { tone: 'error' });
    if (holidays.includes(holidayInput.value)) return showToast('Ese feriado ya está cargado.', { tone: 'error' });
    return runAction('settings:addHoliday', () => updateSettings({ holidays: [...holidays, holidayInput.value].sort() }), 'Feriado agregado');
  };

  return h('section', { class: 'card' },
    h('h2', {}, 'Calendario laboral'),
    h('fieldset', { class: 'weekday-picker' },
      h('legend', {}, 'Días laborales'),
      WEEKDAY_DISPLAY_ORDER.map((weekday) => h('label', { class: 'checkbox-pill' },
        h('input', { type: 'checkbox', checked: workdays.includes(weekday), onChange: () => toggleWorkday(weekday) }),
        h('span', {}, WEEKDAY_LABELS[weekday]),
      )),
    ),
    h('div', { class: 'field' }, h('span', {}, 'Feriados y días no laborables'),
      h('div', { class: 'inline-form' }, holidayInput, h('button', { type: 'button', class: 'button', onClick: addHoliday }, 'Agregar')),
      holidays.length
        ? h('ul', { class: 'tag-list' }, holidays.map((holiday) => h('li', {},
          formatDateLong(holiday),
          h('button', { type: 'button', class: 'icon-button', 'aria-label': `Quitar feriado ${holiday}`, onClick: () => runAction('settings:removeHoliday', () => updateSettings({ holidays: holidays.filter((day) => day !== holiday) })) }, '×'),
        )))
        : h('p', { class: 'hint' }, 'Sin feriados cargados.'),
    ),
    h('label', { class: 'field field--inline' }, h('span', {}, 'Marcar bloqueos prolongados a partir de'),
      h('input', {
        type: 'number', min: 1, max: 60, value: String(blockerAlertWorkdays), class: 'input--narrow',
        onChange: (event) => {
          const value = Number(event.target.value);
          if (Number.isInteger(value) && value > 0) runAction('settings:updateBlockerAlert', () => updateSettings({ blockerAlertWorkdays: value }));
        },
      }),
      h('span', {}, 'días hábiles')),
  );
}

/** @param {import('../../domain/record-grouping.js').Snapshot} snapshot */
function templatesSection(snapshot) {
  return h('section', { class: 'card' },
    h('h2', {}, 'Plantillas de prompts'),
    h('p', { class: 'hint' }, 'Placeholders disponibles: ', h('code', {}, '{{periodo}}'), ' y ', h('code', {}, '{{datos}}'), '.'),
    Object.values(TEMPLATE_KIND).map((kind) => {
      const saved = snapshot.templates.find((template) => template.kind === kind);
      const draftKey = `template-${kind}`;
      const textarea = h('textarea', {
        rows: 12,
        'aria-label': TEMPLATE_TITLES[kind],
        value: uiDrafts.get(draftKey, saved?.body ?? DEFAULT_TEMPLATES[kind]),
        dataset: { focusKey: draftKey },
        onInput: (event) => uiDrafts.set(draftKey, event.target.value),
      });
      return h('details', { class: 'inline-details' },
        h('summary', {}, TEMPLATE_TITLES[kind], saved ? h('span', { class: 'badge' }, 'Personalizada') : null),
        textarea,
        h('div', { class: 'form-actions' },
          h('button', { type: 'button', class: 'button button--primary', onClick: async () => { if (await runAction('settings:saveTemplate', () => saveTemplate(kind, textarea.value).then(() => true), 'Plantilla guardada')) uiDrafts.delete(draftKey); } }, 'Guardar plantilla'),
          h('button', { type: 'button', class: 'button', disabled: !saved, onClick: () => { uiDrafts.delete(draftKey); runAction('settings:resetTemplate', () => resetTemplate(kind), 'Plantilla restaurada'); } }, 'Restaurar la original'),
        ),
      );
    }),
  );
}

/** @param {import('../../domain/record-grouping.js').Snapshot} snapshot */
function projectsSection(snapshot) {
  return h('section', { class: 'card' },
    h('h2', {}, 'Proyectos'),
    snapshot.projects.length
      ? h('ul', { class: 'record-list' }, snapshot.projects.map((project) => h('li', { class: 'record-item record-item--row' },
        h('input', { class: 'inline-edit', value: project.name, 'aria-label': 'Nombre del proyecto', dataset: { focusKey: `project-${project.id}` }, onChange: (event) => runAction('settings:renameProject', () => updateProject(project.id, { name: event.target.value })) }),
        h('label', { class: 'checkbox-inline' },
          h('input', { type: 'checkbox', checked: project.archived, onChange: (event) => runAction('settings:archiveProject', () => updateProject(project.id, { archived: event.target.checked })) }),
          'Archivado'),
      )))
      : emptyState('Los proyectos se crean al escribirlos en una tarea.'),
  );
}

/** @param {import('../../domain/record-grouping.js').Snapshot} snapshot */
function dataSection(snapshot) {
  const persistenceStatus = h('span', { role: 'status' }, 'Consultando…');
  const folderStatus = h('span', { role: 'status' }, isFolderBackupSupported() ? 'Consultando…' : 'Tu navegador no permite elegir una carpeta (usá Chrome o Edge). Usá «Exportar JSON».');
  const folderActions = h('div', { class: 'form-actions' });

  const refreshStatuses = async () => {
    const persisted = await isStoragePersisted();
    persistenceStatus.textContent = persisted === null ? 'El navegador no informa el estado.' : persisted ? 'Sí: el navegador no borrará los datos por falta de espacio.' : 'No: el navegador podría borrarlos si se queda sin espacio.';
    if (!isFolderBackupSupported()) return;
    const status = await getFolderBackupStatus();
    const actionButtons = [
      h('button', { type: 'button', class: 'button', onClick: () => runAction('settings:chooseBackupFolder', chooseBackupFolder, 'Carpeta configurada y backup guardado').then(refreshStatuses) }, status.folderName ? 'Cambiar carpeta' : 'Elegir carpeta de backup'),
    ];
    if (status.folderName) {
      actionButtons.push(h('button', { type: 'button', class: 'button button--primary', onClick: () => runAction('settings:backupToFolder', async () => {
        if (!(await backupToFolderNow())) throw new ValidationError('El navegador no concedió permiso para escribir en la carpeta.');
      }, 'Backup guardado en la carpeta').then(refreshStatuses) }, 'Hacer backup ahora'));
    }
    folderActions.replaceChildren(...actionButtons);
    folderStatus.textContent = status.folderName
      ? `Carpeta «${status.folderName}». ${status.permission === 'granted' ? 'Se guarda un backup automático por día al abrir la app.' : 'El navegador pide confirmar el permiso: usá «Hacer backup ahora».'}`
      : 'Sin carpeta configurada. Si elegís una dentro de OneDrive o Dropbox, tenés copia fuera de la computadora sin que la app se conecte a nada.';
  };
  queueMicrotask(() => refreshStatuses().catch((statusError) => console.error('settings:refreshStatuses failed', statusError)));

  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', 'aria-label': 'Archivo de backup' });
  const importForm = h('form', {
    class: 'stack',
    onSubmit: async (event) => {
      event.preventDefault();
      const file = fileInput.files?.[0];
      if (!file) return showToast('Elegí un archivo de backup.', { tone: 'error' });
      const mode = String(new FormData(event.currentTarget).get('mode'));
      if (mode === IMPORT_MODE.REPLACE && !window.confirm('Reemplazar borra todos los datos actuales y deja solo los del archivo. ¿Continuar?')) return undefined;
      try {
        await importBackupFile(file, /** @type {any} */ (mode));
        showToast('Datos importados', { tone: 'success' });
      } catch (importError) {
        if (importError instanceof BackupFormatError) showToast(importError.message, { tone: 'error' });
        else {
          console.error(`settings:importBackupFile failed (file=${file.name.slice(0, 60)}, mode=${mode})`, importError);
          showToast('No se pudo importar el archivo. Revisá la consola para más detalle.', { tone: 'error' });
        }
      }
      return undefined;
    },
  },
  fileInput,
  h('fieldset', { class: 'radio-group' },
    h('legend', {}, 'Cómo importar'),
    h('label', {}, h('input', { type: 'radio', name: 'mode', value: IMPORT_MODE.MERGE, checked: true }), 'Fusionar: conserva lo actual y agrega o actualiza lo del archivo (gana lo editado más recientemente)'),
    h('label', {}, h('input', { type: 'radio', name: 'mode', value: IMPORT_MODE.REPLACE }), 'Reemplazar: deja solo lo que hay en el archivo'),
  ),
  h('div', { class: 'form-actions' }, h('button', { type: 'submit', class: 'button' }, 'Importar')));

  return h('section', { class: 'card' },
    h('h2', {}, 'Datos y backups'),
    h('p', { class: 'hint' }, 'Todo se guarda solo en este navegador (IndexedDB). La app no envía datos a ningún servicio. Si borrás los datos de navegación, se pierden: mantené backups.'),
    h('dl', { class: 'definition-list' },
      h('dt', {}, 'Último backup'), h('dd', {}, snapshot.settings.lastBackupAt ? formatTimestamp(snapshot.settings.lastBackupAt) : 'Nunca'),
      h('dt', {}, 'Almacenamiento persistente'), h('dd', {}, persistenceStatus,
        ' ', h('button', { type: 'button', class: 'button button--small', onClick: () => runAction('settings:requestPersistence', requestStoragePersistence).then(refreshStatuses) }, 'Solicitar')),
      h('dt', {}, 'Registros'), h('dd', {}, `${snapshot.tasks.length} tareas · ${snapshot.activities.length} actividades · ${snapshot.results.length} resultados · ${snapshot.summaries.length} resúmenes`),
    ),
    h('h3', {}, 'Exportar'),
    h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'button button--primary', onClick: () => runAction('settings:downloadBackup', downloadBackupFile, 'Backup descargado') }, 'Exportar JSON')),
    h('h3', {}, 'Backup automático a carpeta'),
    h('p', { class: 'hint' }, folderStatus),
    folderActions,
    h('h3', {}, 'Importar'),
    importForm,
  );
}

/** @param {{snapshot: import('../../domain/record-grouping.js').Snapshot}} context */
export function renderSettingsView({ snapshot }) {
  return h('div', { class: 'view' },
    h('header', { class: 'view-header' }, h('h1', {}, 'Ajustes')),
    h('div', { class: 'columns' },
      h('div', { class: 'stack' }, dataSection(snapshot), workCalendarSection(snapshot)),
      h('div', { class: 'stack' }, templatesSection(snapshot), projectsSection(snapshot)),
    ),
  );
}
