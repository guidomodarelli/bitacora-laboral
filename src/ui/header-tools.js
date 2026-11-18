/**
 * Herramientas fijas del encabezado: estado del backup y ayuda de atajos y sintaxis.
 * El backup es un indicador discreto que solo pide atención cuando hay riesgo real.
 */
import { BACKUP_REMINDER_DAYS } from '../constants/settings.js';
import { NAVIGATION_ITEMS, QUICK_CAPTURE_SHORTCUT_KEY, ROUTE, buildRouteHash } from '../constants/routes.js';
import { daysBetween, todayKey } from '../domain/dates.js';
import { formatCount } from '../domain/text-format.js';
import { h } from './dom.js';
import { icon } from './icons.js';

/**
 * @param {import('../domain/record-grouping.js').Snapshot} snapshot
 * @returns {HTMLElement|null} `null` mientras no haya datos que respaldar.
 */
export function backupIndicator(snapshot) {
  const hasData = snapshot.tasks.length > 0 || snapshot.activities.length > 0 || snapshot.results.length > 0;
  if (!hasData) return null;
  const { lastBackupAt } = snapshot.settings;
  const daysSinceBackup = lastBackupAt ? daysBetween(lastBackupAt.slice(0, 10), todayKey()) : null;
  const isAtRisk = daysSinceBackup === null || daysSinceBackup >= BACKUP_REMINDER_DAYS;
  const label = daysSinceBackup === null
    ? 'Sin backup'
    : daysSinceBackup === 0 ? 'Backup: hoy' : `Backup: hace ${formatCount(daysSinceBackup, 'día', 'días')}`;
  const description = isAtRisk
    ? 'Tus datos viven solo en este navegador. Abrí Ajustes para exportarlos o configurar el backup automático.'
    : 'Último backup de tus datos. Se configura en Ajustes.';
  return h('a', {
    href: buildRouteHash(ROUTE.SETTINGS),
    class: `backup-indicator ${isAtRisk ? 'backup-indicator--at-risk' : ''}`,
    title: description,
    'aria-label': `${label}. ${description}`,
  }, icon('backup'), h('span', {}, label));
}

/** Panel de ayuda: atajos de teclado y sintaxis de la captura rápida. */
export function shortcutsHelp() {
  const row = (keys, description) => h('div', { class: 'help-row' }, h('dt', {}, keys), h('dd', {}, description));
  const menu = h('details', {
    class: 'help-menu',
    onKeydown: (event) => {
      if (event.key !== 'Escape' || !menu.open) return;
      menu.open = false;
      menu.querySelector('summary')?.focus();
    },
  },
    h('summary', { 'aria-label': 'Atajos y sintaxis', title: 'Atajos y sintaxis' }, icon('help')),
    h('div', { class: 'help-panel' },
      h('h2', {}, 'Captura rápida'),
      h('dl', {},
        row(h('kbd', {}, QUICK_CAPTURE_SHORTCUT_KEY), 'Enfoca la captura desde cualquier sección'),
        row(h('kbd', {}, '@tarea'), 'Asocia el registro a una tarea (sugiere mientras escribís)'),
        row(h('kbd', {}, '!'), 'Al principio: registra una decisión'),
        row(h('kbd', {}, '+'), 'Al principio: registra un resultado'),
        row('Una URL', 'Se guarda como enlace (PR, ticket o doc)'),
      ),
      h('h2', {}, 'Secciones'),
      h('dl', {}, NAVIGATION_ITEMS.map((item) => row(h('kbd', {}, `Alt+${item.shortcut}`), item.label))),
    ),
  );
  // Como cualquier panel emergente: un clic afuera lo cierra.
  document.addEventListener('pointerdown', (event) => {
    if (menu.open && !menu.contains(/** @type {Node} */ (event.target))) menu.open = false;
  });
  return menu;
}
