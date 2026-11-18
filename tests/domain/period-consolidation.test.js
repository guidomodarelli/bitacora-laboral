import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthlyReport,
  buildPeriodReport,
  buildWeeklyReport,
  computeSourceFingerprint,
} from '../../src/domain/period-consolidation.js';
import { createTestActivity, createTestResult, createTestSnapshot, createTestTask } from '../helpers/snapshot-factory.js';

const weekOfNovember9 = { start: '2026-11-09', end: '2026-11-15' };

/** Escenario del lunes a jueves: una tarea con avances en varios días. */
function buildAuthScenario() {
  const authTask = createTestTask({
    id: 'task-auth',
    title: 'Autenticación',
    status: 'in_progress',
    createdOn: '2026-11-09',
    changes: [{ status: 'completed', date: '2026-11-12' }],
  });
  const ongoingTask = createTestTask({ id: 'task-reports', title: 'Reportes', status: 'in_progress', createdOn: '2026-11-02' });
  const activities = [
    createTestActivity({ date: '2026-11-09', taskId: authTask.id, text: 'Investigué alternativas' }),
    createTestActivity({ date: '2026-11-10', taskId: authTask.id, text: 'Implementé endpoints' }),
    createTestActivity({ date: '2026-11-11', taskId: authTask.id, text: 'Abrí PR' }),
    createTestActivity({ date: '2026-11-12', taskId: authTask.id, text: 'Respondí code review' }),
    createTestActivity({ date: '2026-11-10', taskId: ongoingTask.id, text: 'Armé consultas' }),
    createTestActivity({ date: '2026-11-10', text: 'Reunión de planning', kind: 'meeting' }),
  ];
  const results = [createTestResult({ date: '2026-11-12', taskId: authTask.id, description: 'Login con JWT en producción' })];
  return createTestSnapshot({ tasks: [authTask, ongoingTask], activities, results });
}

describe('period consolidation', () => {
  it('groups all advances of a task into a single entry', () => {
    const report = buildPeriodReport(weekOfNovember9, buildAuthScenario());
    const authEntry = report.taskEntries.find((entry) => entry.task.id === 'task-auth');
    assert.equal(report.taskEntries.filter((entry) => entry.task.id === 'task-auth').length, 1);
    assert.equal(authEntry.activities.length, 4);
    assert.equal(authEntry.results.length, 1);
  });

  it('distinguishes completed tasks from tasks that only progressed', () => {
    const report = buildPeriodReport(weekOfNovember9, buildAuthScenario());
    const categories = Object.fromEntries(report.taskEntries.map((entry) => [entry.task.id, entry.category]));
    assert.deepEqual(categories, { 'task-auth': 'completed', 'task-reports': 'progressed' });
    assert.equal(report.looseGroups.length, 1);
    assert.deepEqual(report.categoryCounts, { completed: 1, progressed: 1, blocked: 0, discarded: 0 });
  });

  it('reports a task still blocked at the end of the period even without activity in it', () => {
    const blockedTask = createTestTask({
      id: 'task-redis',
      title: 'Migrar sesiones a Redis',
      status: 'in_progress',
      createdOn: '2026-11-02',
      changes: [{ status: 'blocked', date: '2026-11-05', note: 'Esperando acceso al cluster' }],
    });
    const snapshot = buildAuthScenario();
    const report = buildPeriodReport(weekOfNovember9, { ...snapshot, tasks: [...snapshot.tasks, blockedTask] });
    const blockedEntry = report.taskEntries.find((entry) => entry.task.id === 'task-redis');
    assert.equal(blockedEntry.category, 'blocked');
    assert.equal(blockedEntry.blockerReasonAtEnd, 'Esperando acceso al cluster');
    assert.equal(blockedEntry.activities.length, 0);
    assert.equal(report.categoryCounts.blocked, 1);
  });

  it('leaves out a task that was blocked earlier but unblocked before the period ended', () => {
    const unblockedTask = createTestTask({
      id: 'task-unblocked',
      title: 'Configurar CI',
      status: 'in_progress',
      createdOn: '2026-11-02',
      changes: [{ status: 'blocked', date: '2026-11-03' }, { status: 'in_progress', date: '2026-11-06' }],
    });
    const snapshot = buildAuthScenario();
    const report = buildPeriodReport(weekOfNovember9, { ...snapshot, tasks: [...snapshot.tasks, unblockedTask] });
    assert.equal(report.taskEntries.some((entry) => entry.task.id === 'task-unblocked'), false);
  });

  it('classifies by the status at the end of the period, not the current status', () => {
    const report = buildPeriodReport({ start: '2026-11-09', end: '2026-11-11' }, buildAuthScenario());
    assert.equal(report.taskEntries.find((entry) => entry.task.id === 'task-auth').category, 'progressed');
  });

  it('marks a saved weekly summary as stale when its records change', () => {
    const snapshot = buildAuthScenario();
    const summary = { id: 'week:2026-W46', kind: 'week', periodId: '2026-W46', content: 'Resumen', savedAt: '2026-11-15T20:00:00.000Z', sourceFingerprint: computeSourceFingerprint(weekOfNovember9, snapshot) };
    assert.equal(buildWeeklyReport('2026-W46', { ...snapshot, summaries: [summary] }).isSummaryStale, false);
    const editedSnapshot = { ...snapshot, summaries: [summary], activities: snapshot.activities.slice(1) };
    assert.equal(buildWeeklyReport('2026-W46', editedSnapshot).isSummaryStale, true);
  });

  describe('monthly', () => {
    it('uses saved summaries for full weeks and clipped records for weeks crossing months', () => {
      const october = createTestActivity({ date: '2026-10-30', text: 'Trabajo de octubre' });
      const november = createTestActivity({ date: '2026-11-30', text: 'Lunes 30 de noviembre' });
      const december = createTestActivity({ date: '2026-12-01', text: 'Trabajo de diciembre' });
      const base = buildAuthScenario();
      const snapshot = {
        ...base,
        activities: [...base.activities, october, november, december],
        summaries: [
          { id: 'week:2026-W46', kind: 'week', periodId: '2026-W46', content: 'Semana 46 redactada', savedAt: '2026-11-15T20:00:00.000Z' },
          { id: 'week:2026-W49', kind: 'week', periodId: '2026-W49', content: 'Incluye diciembre', savedAt: '2026-12-06T20:00:00.000Z' },
        ],
      };
      const monthly = buildMonthlyReport('2026-11', snapshot);
      const sources = monthly.weeks.map((week) => [week.weekId, week.source, week.fallbackReason]);
      assert.deepEqual(sources, [
        ['2026-W44', 'records', 'crosses_month'],
        ['2026-W45', 'records', 'missing_summary'],
        ['2026-W46', 'summary', null],
        ['2026-W47', 'records', 'missing_summary'],
        ['2026-W48', 'records', 'missing_summary'],
        ['2026-W49', 'records', 'crosses_month'],
      ]);
      const lastWeekTexts = monthly.weeks.at(-1).report.looseGroups.flatMap((group) => group.activities.map((activity) => activity.text));
      assert.deepEqual(lastWeekTexts, ['Lunes 30 de noviembre']);
      assert.equal(monthly.weeks[0].report.isEmpty, true);
    });

    it('computes verified facts with references shared across weeks', () => {
      const monthly = buildMonthlyReport('2026-11', buildAuthScenario());
      assert.deepEqual(monthly.facts.completedTasks.map((item) => [item.reference, item.task.id, item.completedOn]), [['T1', 'task-auth', '2026-11-12']]);
      assert.deepEqual(monthly.facts.openTasksAtEnd.map((item) => item.task.id), ['task-reports']);
      const weekReport = monthly.weeks.find((week) => week.weekId === '2026-W46').report;
      assert.equal(weekReport.taskEntries.find((entry) => entry.task.id === 'task-auth').reference, 'T1');
    });
  });
});
