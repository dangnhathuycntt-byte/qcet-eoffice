import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isReversedRange,
  normalizeIctDateRange,
  normalizeIctFrom,
  normalizeIctTo,
} from '../src/lib/ict-date-boundaries';

describe('ICT date-only boundaries', () => {
  it('normalizes a date-only from value to the exact ICT start instant', () => {
    const value = normalizeIctFrom('2026-01-15');
    assert.ok(value instanceof Date);
    assert.equal(value.toISOString(), '2026-01-14T17:00:00.000Z');
  });

  it('normalizes a date-only to value to the exact ICT end instant', () => {
    const value = normalizeIctTo('2026-01-15');
    assert.ok(value instanceof Date);
    assert.equal(value.toISOString(), '2026-01-15T16:59:59.999Z');
  });

  it('preserves timestamp inputs without converting their representation', () => {
    const from = '2026-01-15T10:30:00Z';
    const to = '2026-01-15T17:30:00+07:00';
    assert.equal(normalizeIctFrom(from), from);
    assert.equal(normalizeIctTo(to), to);
  });

  it('validates ordering after normalizing date-only bounds', () => {
    const reversed = normalizeIctDateRange('2026-01-16', '2026-01-15');
    assert.equal(reversed.error, 'Ngày bắt đầu không được sau ngày kết thúc');
    assert.equal(
      isReversedRange(normalizeIctFrom('2026-01-16'), normalizeIctTo('2026-01-15')),
      true,
    );
  });

  it('accepts equal date-only bounds as one complete ICT day', () => {
    const range = normalizeIctDateRange('2026-01-15', '2026-01-15');
    assert.equal(range.error, undefined);
    assert.equal((range.gte as Date).toISOString(), '2026-01-14T17:00:00.000Z');
    assert.equal((range.lte as Date).toISOString(), '2026-01-15T16:59:59.999Z');
  });
});
