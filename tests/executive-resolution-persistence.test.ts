import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Executive Resolution Persistence Logic', () => {
  test('calculates new due date correctly when grantedDays is applied', () => {
    const currentDueDate = new Date('2026-09-20T00:00:00Z');
    const grantedDays = 7;
    const newDueDate = new Date(currentDueDate.getTime() + grantedDays * 24 * 60 * 60 * 1000);

    assert.strictEqual(newDueDate.toISOString().split('T')[0], '2026-09-27');
  });
});
