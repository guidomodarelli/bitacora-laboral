import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  isDateKey,
  isoWeekIdOf,
  monthRangeFromId,
  shiftMonthId,
  shiftWeekId,
  toDateKey,
  weekRangeFromId,
  weeksTouchingMonth,
} from '../../src/domain/dates.js';

describe('dates', () => {
  it('formats local dates without shifting by timezone', () => {
    assert.equal(toDateKey(new Date(2026, 10, 16, 23, 59)), '2026-11-16');
  });

  it('rejects impossible dates', () => {
    assert.equal(isDateKey('2026-02-30'), false);
    assert.equal(isDateKey('2026-02-28'), true);
  });

  it('adds days across month and year boundaries', () => {
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  });

  it('computes ISO week ids, including week 53', () => {
    assert.equal(isoWeekIdOf('2026-11-16'), '2026-W47');
    assert.equal(isoWeekIdOf('2027-01-01'), '2026-W53');
    assert.deepEqual(weekRangeFromId('2026-W53'), { start: '2026-12-28', end: '2027-01-03' });
  });

  it('shifts weeks and months', () => {
    assert.equal(shiftWeekId('2026-W53', 1), '2027-W01');
    assert.equal(shiftMonthId('2026-12', 1), '2027-01');
    assert.equal(shiftMonthId('2026-01', -1), '2025-12');
  });

  it('returns calendar month ranges, including leap years', () => {
    assert.deepEqual(monthRangeFromId('2028-02'), { start: '2028-02-01', end: '2028-02-29' });
  });

  it('lists every week touching the month and marks those crossing it', () => {
    const segments = weeksTouchingMonth('2026-11');
    assert.equal(segments.length, 6);
    assert.deepEqual(segments[0], {
      weekId: '2026-W44',
      weekRange: { start: '2026-10-26', end: '2026-11-01' },
      monthRange: { start: '2026-11-01', end: '2026-11-01' },
      crossesMonth: true,
    });
    assert.equal(segments[1].crossesMonth, false);
    assert.deepEqual(segments.at(-1).monthRange, { start: '2026-11-30', end: '2026-11-30' });
    assert.equal(segments.at(-1).crossesMonth, true);
  });
});
