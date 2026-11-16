import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickCapture, resolveTaskReference } from '../../src/domain/quick-capture.js';
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
});
