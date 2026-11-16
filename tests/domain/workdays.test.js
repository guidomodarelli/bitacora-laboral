import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { countWorkdaysSince, isWorkday, previousWorkday } from '../../src/domain/workdays.js';

const weekdaySettings = { workdays: [1, 2, 3, 4, 5], holidays: [] };

describe('workdays', () => {
  it('uses Friday as the previous workday of a Monday', () => {
    assert.equal(previousWorkday('2026-11-16', weekdaySettings), '2026-11-13');
  });

  it('skips configured holidays', () => {
    assert.equal(previousWorkday('2026-11-16', { ...weekdaySettings, holidays: ['2026-11-13'] }), '2026-11-12');
    assert.equal(isWorkday('2026-11-13', { ...weekdaySettings, holidays: ['2026-11-13'] }), false);
  });

  it('returns null instead of looping forever without workdays', () => {
    assert.equal(previousWorkday('2026-11-16', { workdays: [], holidays: [] }), null);
  });

  it('counts only workdays after the start date', () => {
    assert.equal(countWorkdaysSince('2026-11-12', '2026-11-16', weekdaySettings), 2);
    assert.equal(countWorkdaysSince('2026-11-16', '2026-11-16', weekdaySettings), 0);
  });
});
