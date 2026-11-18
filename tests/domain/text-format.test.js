import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { describeBlockedDuration, formatCount } from '../../src/domain/text-format.js';

describe('text format', () => {
  it('formats counts with singular and plural', () => {
    assert.equal(formatCount(1, 'avance', 'avances'), '1 avance');
    assert.equal(formatCount(0, 'avance', 'avances'), '0 avances');
    assert.equal(formatCount(3, 'registro', 'registros'), '3 registros');
  });

  it('describes how long a task has been blocked in workdays', () => {
    assert.equal(describeBlockedDuration(0), 'desde hoy');
    assert.equal(describeBlockedDuration(1), 'hace 1 día hábil');
    assert.equal(describeBlockedDuration(4), 'hace 4 días hábiles');
  });
});
