import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthlyPrompt, buildWeeklyPrompt, renderTemplate } from '../../src/domain/prompt-builder.js';
import { createTestActivity, createTestResult, createTestSnapshot, createTestTask } from '../helpers/snapshot-factory.js';

function buildSnapshot() {
  const project = { id: 'project-platform', name: 'Plataforma', archived: false };
  const authTask = createTestTask({ id: 'task-auth', title: 'Autenticación', projectId: project.id, status: 'in_progress', createdOn: '2026-11-09', changes: [{ status: 'completed', date: '2026-11-12' }] });
  const reportsTask = createTestTask({ id: 'task-reports', title: 'Reportes', projectId: project.id, status: 'in_progress', createdOn: '2026-11-02' });
  return createTestSnapshot({
    projects: [project],
    tasks: [authTask, reportsTask],
    activities: [
      createTestActivity({ date: '2026-11-09', taskId: authTask.id, text: 'Investigué alternativas' }),
      createTestActivity({ date: '2026-11-10', taskId: authTask.id, text: 'Usar JWT', kind: 'decision' }),
      createTestActivity({ date: '2026-11-11', taskId: authTask.id, text: 'Abrí PR', links: [{ url: 'https://github.com/acme/app/pull/42', kind: 'pr', label: '' }] }),
      createTestActivity({ date: '2026-11-10', taskId: reportsTask.id, text: 'Armé consultas' }),
    ],
    results: [createTestResult({ date: '2026-11-12', taskId: authTask.id, description: 'Login con JWT' })],
  });
}

describe('prompt builder', () => {
  it('replaces known placeholders and keeps unknown ones', () => {
    assert.equal(renderTemplate('{{ periodo }} / {{otro}}', { periodo: 'Semana 46' }), 'Semana 46 / {{otro}}');
  });

  it('builds a weekly prompt with each task once and explicit status labels', () => {
    const prompt = buildWeeklyPrompt('2026-W46', buildSnapshot());
    assert.match(prompt, /Período: Semana 46 · 9 de noviembre al 15 de noviembre/);
    assert.equal(prompt.match(/\] Autenticación —/g).length, 1);
    assert.match(prompt, /\[T\d\] Autenticación — COMPLETADA el jue 12\/11/);
    assert.match(prompt, /\[T\d\] Reportes — CON AVANCES/);
    assert.match(prompt, /\(decisión\): Usar JWT/);
    assert.match(prompt, /PR: https:\/\/github\.com\/acme\/app\/pull\/42/);
    assert.match(prompt, /\[Funcionalidad\] Login con JWT/);
  });

  it('uses the user template when one is saved', () => {
    const snapshot = { ...buildSnapshot(), templates: [{ kind: 'weekly', body: 'Mi plantilla: {{periodo}}', updatedAt: '' }] };
    assert.equal(buildWeeklyPrompt('2026-W46', snapshot), 'Mi plantilla: Semana 46 · 9 de noviembre al 15 de noviembre');
  });

  it('builds a monthly prompt with verified facts and the source of every week', () => {
    const snapshot = { ...buildSnapshot(), summaries: [{ id: 'week:2026-W46', kind: 'week', periodId: '2026-W46', content: 'Resumen IA de la semana 46', savedAt: '2026-11-15T20:00:00.000Z' }] };
    const prompt = buildMonthlyPrompt('2026-11', snapshot);
    assert.match(prompt, /## Hechos verificados del mes/);
    assert.match(prompt, /- \[T1\] Autenticación \(Plataforma\) — completada el jue 12\/11/);
    assert.match(prompt, /Fuente: resumen semanal guardado\.\n\nResumen IA de la semana 46/);
    assert.match(prompt, /Semana 44 · 26 de octubre al 1 de noviembre · solo 1 de noviembre\n/);
    assert.match(prompt, /Fuente: registros diarios \(la semana cruza dos meses/);
  });
});
