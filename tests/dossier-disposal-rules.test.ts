/** V-07: quy tắc thuần về hết hạn bảo quản và nhắc nộp lưu. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPermanent,
  isRetentionExpired,
  isSubmitReminderDue,
  retentionEnd,
  submitDeadline,
  validateExtendYears,
} from '../src/domain/dossiers/disposal-rules';

const d = (iso: string) => new Date(iso);

describe('V-07 quy tắc hết hạn bảo quản', () => {
  test('bảo quản vĩnh viễn không bao giờ hết hạn', () => {
    const input = { archivedAt: d('1990-01-01'), ruleYears: null, extraYears: 0 };
    assert.equal(retentionEnd(input), null);
    assert.equal(isRetentionExpired(input, d('2099-01-01')), false);
    assert.equal(isPermanent(null), true);
  });

  test('hết hạn đúng sau số năm của bảng cộng số năm gia hạn', () => {
    const base = { archivedAt: d('2020-06-30T00:00:00Z'), ruleYears: 5, extraYears: 0 };
    assert.equal(retentionEnd(base)?.toISOString(), '2025-06-30T00:00:00.000Z');
    assert.equal(isRetentionExpired(base, d('2025-06-29T00:00:00Z')), false);
    assert.equal(isRetentionExpired(base, d('2025-06-30T00:00:00Z')), true);
    // Gia hạn thêm 3 năm thì dời mốc hết hạn.
    assert.equal(isRetentionExpired({ ...base, extraYears: 3 }, d('2026-01-01T00:00:00Z')), false);
    assert.equal(retentionEnd({ ...base, extraYears: 3 })?.toISOString(), '2028-06-30T00:00:00.000Z');
  });

  test('chưa được lưu trữ thì chưa tính hạn bảo quản', () => {
    assert.equal(retentionEnd({ archivedAt: null, ruleYears: 5, extraYears: 0 }), null);
  });

  test('gia hạn: số nguyên từ 1, tổng không quá 70 năm, vĩnh viễn thì không gia hạn', () => {
    assert.equal(validateExtendYears(5, 0, 5), null);
    assert.equal(validateExtendYears(5, 0, 0) !== null, true);
    assert.equal(validateExtendYears(5, 0, 1.5) !== null, true);
    assert.equal(validateExtendYears(60, 5, 5), null, 'đúng 70 năm');
    assert.match(validateExtendYears(60, 5, 6) ?? '', /không quá 70 năm/);
    assert.match(validateExtendYears(null, 0, 5) ?? '', /vĩnh viễn/);
  });

  test('hạn nộp lưu 1 năm sau khi đóng, nhắc từ 30 ngày trước', () => {
    const closed = d('2026-03-10T00:00:00Z');
    assert.equal(submitDeadline(closed)?.toISOString(), '2027-03-10T00:00:00.000Z');
    assert.equal(isSubmitReminderDue(closed, d('2027-02-07T00:00:00Z')), false, 'còn 31 ngày');
    assert.equal(isSubmitReminderDue(closed, d('2027-02-08T00:00:00Z')), true, 'còn đúng 30 ngày');
    assert.equal(isSubmitReminderDue(closed, d('2027-02-10T00:00:00Z')), true, 'còn 28 ngày');
    assert.equal(isSubmitReminderDue(closed, d('2027-09-01T00:00:00Z')), true, 'đã qua hạn');
    assert.equal(isSubmitReminderDue(null, d('2030-01-01')), false);
  });
});
