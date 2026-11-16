import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BackupFormatError, createBackupDocument, mergeBackupData, parseBackupDocument } from '../../src/domain/backup-format.js';
import { searchRecords } from '../../src/domain/record-search.js';
import { createTestActivity, createTestSnapshot, createTestTask } from '../helpers/snapshot-factory.js';

describe('backup format', () => {
  it('round-trips an exported document', () => {
    const task = createTestTask({ title: 'Tarea', createdOn: '2026-11-16' });
    const json = JSON.stringify(createBackupDocument({ tasks: [task] }, '2026-11-16T10:00:00.000Z'));
    const data = parseBackupDocument(json);
    assert.deepEqual(data.tasks, [task]);
    assert.deepEqual(data.activities, []);
  });

  it('rejects foreign, newer or malformed documents with readable errors', () => {
    assert.throws(() => parseBackupDocument('{no json'), BackupFormatError);
    assert.throws(() => parseBackupDocument({ app: 'otra', schemaVersion: 1, data: {} }), /no es un backup de esta bitácora/);
    assert.throws(() => parseBackupDocument({ app: 'bitacora-laboral', schemaVersion: 99, data: {} }), /versión más nueva/);
    assert.throws(() => parseBackupDocument({ app: 'bitacora-laboral', schemaVersion: 1, data: { tasks: [{ title: 'sin id' }] } }), /no tiene "id"/);
  });

  it('merges by id keeping the most recently updated record', () => {
    const current = { tasks: [{ id: 'a', title: 'Vieja', updatedAt: '2026-11-01' }, { id: 'b', title: 'Solo local', updatedAt: '2026-11-01' }] };
    const incoming = { tasks: [{ id: 'a', title: 'Nueva', updatedAt: '2026-11-10' }, { id: 'c', title: 'Solo backup', updatedAt: '2026-11-02' }] };
    const merged = mergeBackupData(current, incoming);
    assert.deepEqual(merged.tasks.map((task) => task.title).sort(), ['Nueva', 'Solo backup', 'Solo local']);
  });
});

describe('record search', () => {
  it('finds activities by text, task title or link, ignoring accents', () => {
    const task = createTestTask({ id: 'task-auth', title: 'Autenticación', createdOn: '2026-11-09' });
    const snapshot = createTestSnapshot({
      tasks: [task],
      activities: [
        createTestActivity({ date: '2026-11-10', taskId: task.id, text: 'Implementé endpoints' }),
        createTestActivity({ date: '2026-11-12', text: 'Revisé PR', links: [{ url: 'https://github.com/acme/app/pull/42', kind: 'pr', label: '' }] }),
      ],
    });
    assert.deepEqual(searchRecords('AUTENTICACION', snapshot).map((hit) => hit.type), ['activity', 'task']);
    assert.equal(searchRecords('pull/42', snapshot)[0].record.text, 'Revisé PR');
    assert.equal(searchRecords('endpoints', snapshot, { range: { start: '2026-11-11', end: '2026-11-30' } }).length, 0);
  });
});
