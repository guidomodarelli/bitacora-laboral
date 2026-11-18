import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyStatusChange, revertStatusChange, statusAt, statusChangesInRange, wasCompletedInRange } from '../../src/domain/task-history.js';
import { createTestTask } from '../helpers/snapshot-factory.js';

describe('task history', () => {
  const authTask = createTestTask({
    title: 'Autenticación',
    status: 'in_progress',
    createdOn: '2026-11-09',
    changes: [
      { status: 'blocked', date: '2026-11-10', note: 'Esperando credenciales' },
      { status: 'in_progress', date: '2026-11-11' },
      { status: 'completed', date: '2026-11-16' },
    ],
  });

  it('reconstructs the status at any past date', () => {
    assert.equal(statusAt(authTask, '2026-11-08'), null);
    assert.equal(statusAt(authTask, '2026-11-10'), 'blocked');
    assert.equal(statusAt(authTask, '2026-11-13'), 'in_progress');
    assert.equal(statusAt(authTask, '2026-11-16'), 'completed');
  });

  it('does not count a later completion as completed in an earlier week', () => {
    assert.equal(wasCompletedInRange(authTask, { start: '2026-11-09', end: '2026-11-15' }), false);
    assert.equal(wasCompletedInRange(authTask, { start: '2026-11-16', end: '2026-11-22' }), true);
  });

  it('keeps the status unchanged until the user changes it', () => {
    const task = createTestTask({ title: 'Larga', status: 'in_progress', createdOn: '2026-11-02' });
    assert.equal(statusAt(task, '2026-12-31'), 'in_progress');
  });

  it('records blocker reason and completion date from the change', () => {
    assert.equal(authTask.completedOn, '2026-11-16');
    assert.equal(authTask.blocker, null);
    const blocked = applyStatusChange(authTask, { status: 'blocked', dateKey: '2026-11-17', atIso: '2026-11-17T10:00:00.000Z', note: 'Rollback pendiente' });
    assert.deepEqual(blocked.blocker, { reason: 'Rollback pendiente', since: '2026-11-17' });
    assert.equal(blocked.completedOn, null);
  });

  it('applies retroactive changes in date order', () => {
    const task = createTestTask({ title: 'Retro', status: 'in_progress', createdOn: '2026-11-02', changes: [{ status: 'completed', date: '2026-11-10' }] });
    const reopenedEarlier = applyStatusChange(task, { status: 'blocked', dateKey: '2026-11-05', atIso: '2026-11-12T10:00:00.000Z', note: 'x' });
    assert.equal(reopenedEarlier.status, 'completed');
    assert.equal(statusAt(reopenedEarlier, '2026-11-06'), 'blocked');
  });

  it('lists changes in a range without the creation entry', () => {
    const changes = statusChangesInRange(authTask, { start: '2026-11-09', end: '2026-11-15' });
    assert.deepEqual(changes.map((change) => change.to), ['blocked', 'in_progress']);
  });

  it('undoes a status change and restores the previous status, blocker and completion', () => {
    const blocked = applyStatusChange(authTask, { status: 'blocked', dateKey: '2026-11-17', atIso: '2026-11-17T10:00:00.000Z', note: 'Rollback pendiente' });
    const reverted = revertStatusChange(blocked, '2026-11-17T10:00:00.000Z', '2026-11-17T10:00:05.000Z');
    assert.equal(reverted.status, 'completed');
    assert.equal(reverted.completedOn, '2026-11-16');
    assert.equal(reverted.blocker, null);
    assert.equal(reverted.statusHistory.length, authTask.statusHistory.length);
  });

  it('never undoes the creation entry and ignores unknown changes', () => {
    const creationAt = authTask.statusHistory[0].at;
    assert.equal(revertStatusChange(authTask, creationAt, '2026-11-17T10:00:00.000Z'), authTask);
    assert.equal(revertStatusChange(authTask, 'missing', '2026-11-17T10:00:00.000Z'), authTask);
  });
});
