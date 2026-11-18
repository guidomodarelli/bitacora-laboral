import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findTaskReferenceAtCaret, parseQuickCapture, resolveCapture, resolveTaskReference, suggestTasksForReference } from '../../src/domain/quick-capture.js';
import { detectLinkKind, isSafeLinkUrl } from '../../src/domain/links.js';
import { createTestTask } from '../helpers/snapshot-factory.js';

describe('quick capture', () => {
  it('extracts task reference and links from plain text', () => {
    const parsed = parseQuickCapture('@autent implementé endpoints https://github.com/acme/app/pull/42');
    assert.deepEqual(parsed, {
      text: 'implementé endpoints',
      kindOverride: null,
      isResult: false,
      taskQuery: 'autent',
      links: [{ url: 'https://github.com/acme/app/pull/42', kind: 'pr', label: '' }],
    });
  });

  it('recognises decision and result prefixes', () => {
    assert.equal(parseQuickCapture('! usar JWT').kindOverride, 'decision');
    const result = parseQuickCapture('+ login en producción');
    assert.equal(result.isResult, true);
    assert.equal(result.text, 'login en producción');
  });

  it('keeps the URL as text when nothing else was written', () => {
    assert.equal(parseQuickCapture('https://acme.atlassian.net/browse/APP-1').text, 'https://acme.atlassian.net/browse/APP-1');
  });

  it('resolves references ignoring accents and preferring open tasks', () => {
    const closed = createTestTask({ title: 'Autenticación vieja', status: 'completed', createdOn: '2026-10-01' });
    const open = createTestTask({ title: 'Autenticación', status: 'in_progress', createdOn: '2026-11-09' });
    const other = createTestTask({ title: 'Login con JWT', status: 'pending', createdOn: '2026-11-09' });
    assert.equal(resolveTaskReference('autenticacion', [closed, open, other]), open);
    assert.equal(resolveTaskReference('login-jwt', [closed, open, other]), null);
    assert.equal(resolveTaskReference('jwt', [closed, open, other]), other);
    assert.equal(resolveTaskReference('inexistente', [open]), null);
  });

  it('classifies links and rejects unsafe protocols', () => {
    assert.equal(detectLinkKind('https://acme.atlassian.net/browse/APP-12'), 'ticket');
    assert.equal(detectLinkKind('https://gitlab.com/acme/app/-/merge_requests/7'), 'pr');
    assert.equal(detectLinkKind('https://docs.google.com/document/d/1'), 'doc');
    assert.equal(isSafeLinkUrl('javascript:alert(1)'), false);
  });

  it('suggests matching tasks best first, open tasks ahead of closed ones', () => {
    const tasks = [
      createTestTask({ id: 'task-closed', title: 'Autenticación vieja', status: 'completed', createdOn: '2026-11-01' }),
      createTestTask({ id: 'task-open', title: 'Autenticación con JWT', status: 'in_progress', createdOn: '2026-11-02' }),
      createTestTask({ id: 'task-other', title: 'Reporte de auth fallida', status: 'pending', createdOn: '2026-11-03' }),
      createTestTask({ id: 'task-unrelated', title: 'Deploy', status: 'pending', createdOn: '2026-11-03' }),
    ];
    assert.deepEqual(suggestTasksForReference('aut', tasks, 5).map((task) => task.id), ['task-open', 'task-closed', 'task-other']);
    assert.deepEqual(suggestTasksForReference('aut', tasks, 1).map((task) => task.id), ['task-open']);
    assert.deepEqual(suggestTasksForReference('', tasks, 5), []);
  });

  it('finds the @reference being typed right before the caret', () => {
    assert.deepEqual(findTaskReferenceAtCaret('Implementé @aut', 15), { query: 'aut', start: 11, end: 15 });
    assert.deepEqual(findTaskReferenceAtCaret('@', 1), { query: '', start: 0, end: 1 });
    assert.equal(findTaskReferenceAtCaret('@aut implementé', 15), null);
    assert.equal(findTaskReferenceAtCaret('mail@empresa', 12), null);
  });

  it('resolves what a capture will save, preferring @ over the selected task', () => {
    const tasks = [
      createTestTask({ id: 'task-auth', title: 'Autenticación', status: 'in_progress', createdOn: '2026-11-02' }),
      createTestTask({ id: 'task-docs', title: 'Documentar API', status: 'pending', createdOn: '2026-11-02' }),
    ];
    const fromReference = resolveCapture('@doc escribí el README', { tasks, selectedTaskId: 'task-auth' });
    assert.equal(fromReference.task.id, 'task-docs');
    assert.equal(fromReference.isTaskFromReference, true);
    assert.equal(fromReference.problem, null);

    const fromSelection = resolveCapture('+ login en producción', { tasks, selectedTaskId: 'task-auth' });
    assert.equal(fromSelection.task.id, 'task-auth');
    assert.equal(fromSelection.parsed.isResult, true);

    assert.equal(resolveCapture('@zzz algo', { tasks, selectedTaskId: null }).problem, 'unknown_task');
    assert.equal(resolveCapture('   ', { tasks, selectedTaskId: null }).problem, 'empty');
    assert.equal(resolveCapture('@doc', { tasks, selectedTaskId: null }).problem, 'empty');
  });
});
