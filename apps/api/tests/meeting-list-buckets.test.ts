/**
 * Danh sách cuộc họp theo nhóm (trang Cuộc họp, các mục con "Sắp diễn ra" / "Đã họp" ở sidebar), tính theo thời gian chứ không
 * theo trạng thái (người dùng yêu cầu 21/10/2026): `bucket=upcoming` là chưa qua giờ kết thúc (kể cả đang họp) xếp theo giờ họp
 * tăng dần, `bucket=done` là đã qua giờ kết thúc (không có thì theo giờ bắt đầu) xếp mới nhất trước, không có `bucket` thì có cả
 * cuộc họp đã hủy; nhóm không mở rộng phạm vi xem (người không liên quan vẫn không thấy gì) và đi cùng `status` thì cả hai cùng đúng.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

if (!process.env.QCET_ALLOW_DB_TESTS) {
  process.env.QCET_ALLOW_DB_TESTS = '1';
}
if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'test') {
  (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
}
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('_test')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/\/qcet_eoffice(\?.*)?$/, '/qcet_test$1');
}

import { NextRequest } from 'next/server';
import { MeetingStatus, UnitType } from '@prisma/client';
import { prisma } from '@qcet/db/prisma';
import { signSessionToken } from '@/lib/jwt-session';
import { GET as listRoute } from '@/app/api/meetings/route';
import { MeetingService } from '@/server/services/meeting-service';
import { ListMeetingsQuerySchema, meetingBucketOf } from '@qcet/contracts/meeting';

const runId = crypto.randomBytes(4).toString('hex');
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const users = { organizer: '', outsider: '' };
let unitId = '';
const meetingIds: Record<string, string> = {};

const list = (userId: string, query: Record<string, string> = {}) =>
  MeetingService.listMeetings(ListMeetingsQuerySchema.parse({ limit: '50', ...query }), userId);
// Chỉ lấy các cuộc họp của chính bài test này, theo mã trong tiêu đề
const mine = (result: { items: Array<{ id: string; title: string }> }) => result.items.filter((m) => m.title.includes(runId));
const keys = (result: { items: Array<{ id: string; title: string }> }) =>
  mine(result).map((m) => Object.entries(meetingIds).find(([, id]) => id === m.id)?.[0]);

describe('Danh sách cuộc họp theo nhóm thời gian', () => {
  before(async () => {
    for (const key of ['organizer', 'outsider'] as const) {
      users[key] = (
        await prisma.user.create({
          data: { email: `mtg_${runId}_${key}@cdktcnqn.edu.vn`, name: `Người ${key} ${runId}`, role: 'CHUYEN_VIEN', isActive: true },
          select: { id: true },
        })
      ).id;
    }
    unitId = (await prisma.organizationalUnit.create({ data: { code: `OU_MB_${runId}`, name: `Đơn vị họp ${runId}`, type: UnitType.DEPARTMENT } })).id;
    const now = Date.now();
    // [khóa, trạng thái, giờ bắt đầu, giờ kết thúc] tính từ lúc chạy test
    const seed: Array<[string, MeetingStatus, number, number?]> = [
      ['draft', MeetingStatus.DRAFT_AGENDA, 2 * DAY],
      ['invited', MeetingStatus.INVITED, DAY],
      // Đang họp: đã bắt đầu, chưa tới giờ kết thúc
      ['ongoing', MeetingStatus.INVITED, -HOUR, HOUR],
      // Đã kết thúc trong ngày dù trạng thái chưa chuyển
      ['endedToday', MeetingStatus.INVITED, -3 * HOUR, -HOUR],
      ['held', MeetingStatus.HELD, -DAY],
      ['minutesDraft', MeetingStatus.MINUTES_DRAFT, -2 * DAY],
      ['confirmed', MeetingStatus.MINUTES_CONFIRMED, -3 * DAY],
      // Quá giờ mà vẫn "Dự thảo chương trình" (ca người dùng báo)
      ['staleDraft', MeetingStatus.DRAFT_AGENDA, -4 * DAY],
      ['cancelled', MeetingStatus.CANCELLED, 3 * DAY],
    ];
    for (const [key, status, start, end] of seed) {
      meetingIds[key] = (
        await prisma.meeting.create({
          data: {
            code: `MT_MB_${runId}_${key}`,
            title: `Họp ${key} ${runId}`,
            unitId,
            organizerId: users.organizer,
            status,
            startTime: new Date(now + start),
            endTime: end === undefined ? null : new Date(now + end),
          },
        })
      ).id;
    }
  });

  after(async () => {
    await prisma.meeting.deleteMany({ where: { id: { in: Object.values(meetingIds) } } });
    await prisma.auditEvent.deleteMany({ where: { actorId: { in: Object.values(users) } } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
    await prisma.organizationalUnit.deleteMany({ where: { id: unitId } });
    await prisma.$disconnect();
  });

  it('meetingBucketOf: theo giờ kết thúc (không có thì giờ bắt đầu), không theo trạng thái; đã hủy không thuộc nhóm nào', () => {
    const now = new Date('2026-10-21T03:00:00.000Z');
    const at = (iso: string) => new Date(iso);
    assert.equal(meetingBucketOf({ status: 'DRAFT_AGENDA', startTime: at('2026-10-20T01:00:00.000Z') }, now), 'done');
    assert.equal(meetingBucketOf({ status: 'HELD', startTime: at('2026-10-22T01:00:00.000Z') }, now), 'upcoming');
    assert.equal(meetingBucketOf({ status: 'INVITED', startTime: at('2026-10-21T02:00:00.000Z'), endTime: at('2026-10-21T04:00:00.000Z') }, now), 'upcoming');
    assert.equal(meetingBucketOf({ status: 'INVITED', startTime: '2026-10-21T01:00:00.000Z', endTime: '2026-10-21T03:00:00.000Z' }, now), 'done');
    assert.equal(meetingBucketOf({ status: 'CANCELLED', startTime: at('2026-10-22T01:00:00.000Z') }, now), null);
  });

  it('upcoming: chưa qua giờ kết thúc (kể cả đang họp), gần nhất lên đầu', async () => {
    assert.deepEqual(keys(await list(users.organizer, { bucket: 'upcoming' })), ['ongoing', 'invited', 'draft']);
  });

  it('done: đã qua giờ kết thúc dù trạng thái chưa chuyển, mới nhất lên đầu', async () => {
    assert.deepEqual(keys(await list(users.organizer, { bucket: 'done' })), ['endedToday', 'held', 'minutesDraft', 'confirmed', 'staleDraft']);
  });

  it('không có nhóm: đủ các cuộc kể cả đã hủy, mới nhất lên đầu', async () => {
    assert.deepEqual(keys(await list(users.organizer)), [
      'cancelled', 'draft', 'invited', 'ongoing', 'endedToday', 'held', 'minutesDraft', 'confirmed', 'staleDraft',
    ]);
  });

  it('nhóm đi cùng status thì cả hai cùng đúng: done + INVITED chỉ cuộc đã mời mà đã qua giờ, upcoming + HELD rỗng', async () => {
    assert.deepEqual(keys(await list(users.organizer, { bucket: 'done', status: 'INVITED' })), ['endedToday']);
    assert.deepEqual(keys(await list(users.organizer, { bucket: 'done', status: 'DRAFT_AGENDA' })), ['staleDraft']);
    assert.deepEqual(keys(await list(users.organizer, { bucket: 'upcoming', status: 'HELD' })), []);
  });

  it('nhóm không mở rộng phạm vi xem: người không liên quan không thấy cuộc nào của bài test', async () => {
    for (const bucket of ['upcoming', 'done']) {
      assert.deepEqual(keys(await list(users.outsider, { bucket })), []);
    }
  });

  it('route: ?bucket= hợp lệ lọc đúng, giá trị lạ bị từ chối 400, chưa đăng nhập 401', async () => {
    const token = signSessionToken({ id: users.organizer, email: `mtg_${runId}_organizer@cdktcnqn.edu.vn`, name: `Người organizer ${runId}`, role: 'CHUYEN_VIEN' });
    const auth = { Authorization: `Bearer ${token}` };
    const ok = await listRoute(new NextRequest('http://localhost:3000/api/meetings?bucket=upcoming&limit=50', { headers: auth }));
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { items: Array<{ id: string; title: string }> };
    assert.deepEqual(keys(body), ['ongoing', 'invited', 'draft']);

    const bad = await listRoute(new NextRequest('http://localhost:3000/api/meetings?bucket=all', { headers: auth }));
    assert.equal(bad.status, 400);
    const anonymous = await listRoute(new NextRequest('http://localhost:3000/api/meetings?bucket=done'));
    assert.equal(anonymous.status, 401);
  });
});
