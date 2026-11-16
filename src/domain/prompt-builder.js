/**
 * Convierte los reportes de período en texto estructurado y arma los prompts.
 */
import { RECORDS_FALLBACK_REASON_LABELS, TASK_PERIOD_CATEGORY, TASK_PERIOD_CATEGORY_LABELS } from '../constants/periods.js';
import { DEFAULT_TEMPLATES, TEMPLATE_PLACEHOLDER, TEMPLATE_PLACEHOLDER_PATTERN } from '../constants/prompt-templates.js';
import { ACTIVITY_KIND, ACTIVITY_KIND_LABELS, LINK_KIND_LABELS, RESULT_TYPE_LABELS } from '../constants/records.js';
import { TASK_STATUS_LABELS } from '../constants/task-status.js';
import { formatDateRange, formatDateShort, formatMonthLabel, formatWeekLabel } from './date-format.js';
import { buildMonthlyReport, buildWeeklyReport } from './period-consolidation.js';

const NO_PROJECT_LABEL = 'Sin proyecto';

/**
 * Reemplaza `{{placeholder}}`. Los placeholders desconocidos quedan como están.
 * @param {string} template
 * @param {Record<string, string>} variables
 */
export function renderTemplate(template, variables) {
  return template.replace(TEMPLATE_PLACEHOLDER_PATTERN, (placeholder, name) => (name in variables ? variables[name] : placeholder));
}

/**
 * @param {import('./record-grouping.js').Snapshot} snapshot
 * @param {import('../constants/prompt-templates.js').TemplateKind} kind
 */
export function resolveTemplate(snapshot, kind) {
  return snapshot.templates.find((template) => template.kind === kind)?.body ?? DEFAULT_TEMPLATES[kind];
}

/** @param {import('./links.js').Link[]} links */
function formatLinks(links = []) {
  if (links.length === 0) return '';
  return ` (${links.map((link) => `${LINK_KIND_LABELS[link.kind]}: ${link.url}`).join(', ')})`;
}

/** @param {import('./record-grouping.js').Activity} activity */
function formatActivityLine(activity) {
  const kindSuffix = activity.kind === ACTIVITY_KIND.WORK ? '' : ` (${ACTIVITY_KIND_LABELS[activity.kind].toLowerCase()})`;
  return `- ${formatDateShort(activity.date)}${kindSuffix}: ${activity.text}${formatLinks(activity.links)}`;
}

/** @param {import('./record-grouping.js').WorkResult} result */
function formatResultLine(result) {
  return `- ${formatDateShort(result.date)} [${RESULT_TYPE_LABELS[result.type]}] ${result.description}${formatLinks(result.links)}`;
}

/**
 * @param {import('./period-consolidation.js').TaskPeriodEntry} entry
 * @param {string} heading
 */
function formatTaskEntry(entry, heading) {
  const completion = entry.category === TASK_PERIOD_CATEGORY.COMPLETED && entry.completedOn ? ` el ${formatDateShort(entry.completedOn)}` : '';
  const lines = [`${heading} [${entry.reference}] ${entry.task.title} — ${TASK_PERIOD_CATEGORY_LABELS[entry.category]}${completion}`];
  const statusLabel = entry.statusAtEnd ? TASK_STATUS_LABELS[entry.statusAtEnd] : 'Sin estado';
  lines.push(`Estado al cierre: ${statusLabel}${entry.startedInPeriod ? ' · Creada en este período' : ''}`);
  if (entry.blockerReasonAtEnd) lines.push(`Motivo del bloqueo: ${entry.blockerReasonAtEnd}`);
  if (entry.task.description) lines.push(`Descripción: ${entry.task.description}`);
  if (entry.task.links?.length) lines.push(`Links de la tarea:${formatLinks(entry.task.links)}`);
  if (entry.activities.length) lines.push('Avances:', ...entry.activities.map(formatActivityLine));
  if (entry.statusChanges.length) {
    lines.push('Cambios de estado:', ...entry.statusChanges.map((change) => {
      const fromLabel = change.from ? TASK_STATUS_LABELS[change.from] : '—';
      const note = change.note ? ` (${change.note})` : '';
      return `- ${formatDateShort(change.date)}: ${fromLabel} → ${TASK_STATUS_LABELS[change.to]}${note}`;
    }));
  }
  if (entry.results.length) lines.push('Resultados:', ...entry.results.map(formatResultLine));
  if (!entry.activities.length && !entry.statusChanges.length && !entry.results.length) lines.push('Sin avances registrados en el período.');
  return lines.join('\n');
}

/**
 * @param {import('./period-consolidation.js').PeriodReport} report
 * @param {{headingDepth?: number}} [options] Nivel de encabezado de los proyectos.
 * @returns {string}
 */
export function formatPeriodReport(report, { headingDepth = 2 } = {}) {
  if (report.isEmpty) return 'No hay registros en este período.';
  const projectHeading = '#'.repeat(headingDepth);
  const taskHeading = '#'.repeat(headingDepth + 1);

  /** @type {Map<string, string[]>} */
  const blocksByProject = new Map();
  const pushBlock = (projectName, block) => {
    if (!blocksByProject.has(projectName)) blocksByProject.set(projectName, []);
    blocksByProject.get(projectName).push(block);
  };

  for (const entry of report.taskEntries) pushBlock(entry.project?.name ?? NO_PROJECT_LABEL, formatTaskEntry(entry, taskHeading));
  for (const group of report.looseGroups) {
    const lines = [`${taskHeading} Actividades sin tarea asociada`];
    lines.push(...group.activities.map(formatActivityLine));
    if (group.results.length) lines.push('Resultados:', ...group.results.map(formatResultLine));
    pushBlock(group.project?.name ?? NO_PROJECT_LABEL, lines.join('\n'));
  }

  const sections = [...blocksByProject.entries()].map(([projectName, blocks]) => [`${projectHeading} Proyecto: ${projectName}`, ...blocks].join('\n\n'));
  const counts = report.categoryCounts;
  sections.push([
    `${projectHeading} Conteo del período`,
    `- Completadas: ${counts.completed}`,
    `- Con avances (siguen abiertas): ${counts.progressed}`,
    `- Bloqueadas al cierre: ${counts.blocked}`,
    `- Descartadas: ${counts.discarded}`,
    `- Resultados registrados: ${report.resultCount}`,
  ].join('\n'));
  return sections.join('\n\n');
}

/**
 * @param {string} weekId
 * @param {import('./record-grouping.js').Snapshot} snapshot
 */
export function buildWeeklyPrompt(weekId, snapshot) {
  const { report } = buildWeeklyReport(weekId, snapshot);
  return renderTemplate(resolveTemplate(snapshot, 'weekly'), {
    [TEMPLATE_PLACEHOLDER.PERIOD]: formatWeekLabel(weekId),
    [TEMPLATE_PLACEHOLDER.DATA]: formatPeriodReport(report),
  });
}

/**
 * @param {ReturnType<typeof buildMonthlyReport>} monthly
 * @returns {string}
 */
export function formatMonthlyReport(monthly) {
  const { facts } = monthly;
  const projectSuffix = (project) => (project ? ` (${project.name})` : '');
  const factLines = ['## Hechos verificados del mes', '', 'Tareas completadas en el mes:'];
  if (facts.completedTasks.length === 0) factLines.push('- Ninguna.');
  for (const item of facts.completedTasks) factLines.push(`- [${item.reference}] ${item.task.title}${projectSuffix(item.project)} — completada el ${formatDateShort(item.completedOn)}`);
  factLines.push('', 'Resultados registrados en el mes:');
  if (facts.results.length === 0) factLines.push('- Ninguno.');
  for (const { result, task, reference } of facts.results) {
    const taskSuffix = task ? ` — tarea [${reference}] ${task.title}` : '';
    factLines.push(`${formatResultLine(result)}${taskSuffix}`);
  }
  factLines.push('', 'Tareas abiertas al cierre del mes:');
  if (facts.openTasksAtEnd.length === 0) factLines.push('- Ninguna.');
  for (const item of facts.openTasksAtEnd) factLines.push(`- [${item.reference}] ${item.task.title}${projectSuffix(item.project)} — ${TASK_STATUS_LABELS[item.statusAtEnd]}`);

  const weekSections = monthly.weeks.map((week) => {
    const header = `## ${formatWeekLabel(week.weekId)}${week.crossesMonth ? ` · solo ${formatDateRange(week.monthRange)}` : ''}`;
    if (week.source === 'summary') return [header, 'Fuente: resumen semanal guardado.', '', week.summary.content.trim()].join('\n');
    return [
      header,
      `Fuente: registros diarios (${RECORDS_FALLBACK_REASON_LABELS[week.fallbackReason]}).`,
      '',
      formatPeriodReport(week.report, { headingDepth: 3 }),
    ].join('\n');
  });

  return [factLines.join('\n'), ...weekSections].join('\n\n');
}

/**
 * @param {string} monthId
 * @param {import('./record-grouping.js').Snapshot} snapshot
 */
export function buildMonthlyPrompt(monthId, snapshot) {
  const monthly = buildMonthlyReport(monthId, snapshot);
  return renderTemplate(resolveTemplate(snapshot, 'monthly'), {
    [TEMPLATE_PLACEHOLDER.PERIOD]: `${formatMonthLabel(monthId)} (${formatDateRange(monthly.range)})`,
    [TEMPLATE_PLACEHOLDER.DATA]: formatMonthlyReport(monthly),
  });
}
