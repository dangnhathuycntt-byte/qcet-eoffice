/** T-06: quy tắc thời gian của nhắc hạn nhiệm vụ (hàm thuần, theo giờ Việt Nam). */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  dayDiff,
  escalationStage,
  ictDayKey,
  ictHour,
  isDueSoon,
  isOverdueNotifiable,
} from '../src/domain/tasks/reminder-rules';

const at = (iso: string) => new Date(iso);

describe('T-06 quy tắc thời gian', () => {
  test('ngày và giờ theo giờ Việt Nam, không theo UTC', () => {
    // 20:00 UTC ngày 9/10 đã là 03:00 ngày 10/10 giờ Việt Nam.
    assert.equal(ictDayKey(at('2026-10-09T20:00:00Z')), '2026-10-10');
    assert.equal(ictHour(at('2026-10-09T20:00:00Z')), 3);
    assert.equal(ictHour(at('2026-10-10T00:30:00+07:00')), 0);
  });

  test('dayDiff dương khi sau, kể cả qua ranh giới tháng', () => {
    assert.equal(dayDiff('2026-10-30', '2026-11-01'), 2);
    assert.equal(dayDiff('2026-11-01', '2026-10-30'), -2);
    assert.equal(dayDiff('2026-10-10', '2026-10-10'), 0);
  });

  test('nhắc trước hạn: đúng ngày liền trước, và chỉ từ 07:00', () => {
    const due = at('2026-10-20T00:00:00+07:00'); // hạn ngày 20/10
    assert.equal(isDueSoon(due, at('2026-10-19T08:00:00+07:00')), true);
    assert.equal(isDueSoon(due, at('2026-10-19T06:59:00+07:00')), false, 'trước 07:00 chưa gửi');
    assert.equal(isDueSoon(due, at('2026-10-18T09:00:00+07:00')), false, 'còn 2 ngày thì chưa');
    assert.equal(isDueSoon(due, at('2026-10-20T09:00:00+07:00')), false, 'đúng ngày hạn không còn là trước hạn');
  });

  test('báo trễ từ ngày sau hạn đến 30 ngày; trước đó và sau đó thì không', () => {
    const due = at('2026-10-20T00:00:00+07:00');
    assert.equal(isOverdueNotifiable(due, at('2026-10-20T10:00:00+07:00')), false, 'chưa qua ngày hạn');
    assert.equal(isOverdueNotifiable(due, at('2026-10-21T08:00:00+07:00')), true);
    assert.equal(isOverdueNotifiable(due, at('2026-10-21T05:00:00+07:00')), false, 'trước giờ gửi');
    assert.equal(isOverdueNotifiable(due, at('2026-11-19T08:00:00+07:00')), true, 'ngày thứ 30');
    assert.equal(isOverdueNotifiable(due, at('2026-11-20T08:00:00+07:00')), false, 'quá 30 ngày thì bỏ qua');
  });

  test('mốc leo thang 48 giờ và 96 giờ', () => {
    const since = at('2026-10-10T08:00:00+07:00');
    assert.equal(escalationStage(since, at('2026-10-12T07:59:00+07:00')), 'NONE');
    assert.equal(escalationStage(since, at('2026-10-12T08:00:00+07:00')), 'FIRST');
    assert.equal(escalationStage(since, at('2026-10-14T07:59:00+07:00')), 'FIRST');
    assert.equal(escalationStage(since, at('2026-10-14T08:00:00+07:00')), 'SECOND');
  });
});
