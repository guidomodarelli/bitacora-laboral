import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildDaily, renderDailyText, resolvePreviousRecordDate } from '../../src/domain/daily-builder.js';
import { createTestActivity, createTestSnapshot, createTestTask } from '../helpers/snapshot-factory.js';

const project = { id: 'project-auth', name: 'Plataforma', archived: false };

describe('daily builder', () => {
  const authTask = createTestTask({ id: 'task-auth', title: 'Autenticación', projectId: project.id, status: 'in_progress', createdOn: '2026-11-09' });
  const blockedTask = createTestTask({
    id: 'task-deploy',
    title: 'Deploy staging',
    status: 'in_progress',
    createdOn: '2026-11-09',
    changes: [{ status: 'blocked', date: '2026-11-10', note: 'Sin acceso al cluster' }],
  });
  const pendingTask = createTestTask({ id: 'task-docs', title: 'Documentar API', status: 'pending', createdOn: '2026-11-12' });

  it('on Monday shows Friday activities grouped by task', () => {
    const snapshot = createTestSnapshot({
      projects: [project],
      tasks: [authTask, blockedTask, pendingTask],
      activities: [
        createTestActivity({ date: '2026-11-13', taskId: authTask.id, text: 'Implementé endpoints' }),
        createTestActivity({ date: '2026-11-13', taskId: authTask.id, text: 'Primeros tests' }),
        createTestActivity({ date: '2026-11-12', taskId: authTask.id, text: 'Jueves: no debe aparecer' }),
      ],
    });
    const daily = buildDaily('2026-11-16', snapshot);
    assert.equal(daily.previous.dateKey, '2026-11-13');
    assert.equal(daily.previous.isFallback, false);
    assert.equal(daily.previous.groups.length, 1);
    assert.deepEqual(daily.previous.groups[0].activities.map((activity) => activity.text), ['Implementé endpoints', 'Primeros tests']);
  });

  it('falls back to the last day with records when the previous workday is empty', () => {
    const snapshot = createTestSnapshot({ tasks: [authTask], activities: [createTestActivity({ date: '2026-11-11', taskId: authTask.id, text: 'Miércoles' })] });
    assert.deepEqual(resolvePreviousRecordDate('2026-11-16', snapshot), { dateKey: '2026-11-11', expectedDateKey: '2026-11-13', isFallback: true });
  });

  it('suggests in-progress tasks when nothing is planned, without changing statuses', () => {
    const snapshot = createTestSnapshot({ tasks: [authTask, blockedTask, pendingTask] });
    const daily = buildDaily('2026-11-16', snapshot);
    assert.equal(daily.plan.isSuggestion, true);
    assert.deepEqual(daily.plan.items.map((item) => item.task.id), ['task-auth']);
    assert.equal(pendingTask.status, 'pending');
  });

  it('uses the explicit day plan when present', () => {
    const snapshot = createTestSnapshot({ tasks: [authTask, pendingTask], dayPlans: [{ date: '2026-11-16', taskIds: ['task-docs'], updatedAt: '' }] });
    const daily = buildDaily('2026-11-16', snapshot);
    assert.equal(daily.plan.isSuggestion, false);
    assert.deepEqual(daily.plan.items.map((item) => item.task.id), ['task-docs']);
  });

  it('flags blockers that exceed the workday threshold', () => {
    const snapshot = createTestSnapshot({ tasks: [blockedTask] });
    const [blocker] = buildDaily('2026-11-16', snapshot).blockers;
    assert.equal(blocker.reason, 'Sin acceso al cluster');
    assert.equal(blocker.workdaysBlocked, 4);
    assert.equal(blocker.isProlonged, true);
  });

  it('renders the three daily questions as plain text', () => {
    const snapshot = createTestSnapshot({
      projects: [project],
      tasks: [authTask, blockedTask],
      activities: [createTestActivity({ date: '2026-11-13', taskId: authTask.id, text: 'Implementé endpoints' })],
    });
    const text = renderDailyText(buildDaily('2026-11-16', snapshot));
    assert.match(text, /¿Qué hice ayer\? \(viernes, 13 de noviembre\)/);
    assert.match(text, /• \[Plataforma\] Autenticación\n {2}– Implementé endpoints/);
    assert.match(text, /• Deploy staging: Sin acceso al cluster \(bloqueada hace 4 días hábiles\)/);
  });

  it('labels only decisions and groups loose records as «Otros» of their project', () => {
    const snapshot = createTestSnapshot({
      projects: [project],
      tasks: [authTask],
      activities: [
        createTestActivity({ date: '2026-11-13', taskId: authTask.id, text: 'Investigué alternativas', kind: 'research' }),
        createTestActivity({ date: '2026-11-13', taskId: authTask.id, text: 'Usar RS256', kind: 'decision' }),
        createTestActivity({ date: '2026-11-13', projectId: project.id, text: 'Revisé PRs del equipo', kind: 'note' }),
      ],
    });
    const text = renderDailyText(buildDaily('2026-11-16', snapshot));
    assert.match(text, /– Investigué alternativas/);
    assert.doesNotMatch(text, /Investigación:/);
    assert.match(text, /– Decisión: Usar RS256/);
    assert.match(text, /• Otros de Plataforma\n {2}– Revisé PRs del equipo/);
  });
});
