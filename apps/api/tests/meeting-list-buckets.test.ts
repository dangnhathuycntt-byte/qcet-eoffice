/**
 * Danh sách cuộc họp theo nhóm trạng thái (trang Cuộc họp, các mục con "Sắp diễn ra" / "Đã họp" ở sidebar):
 * `bucket=upcoming` là chưa họp xếp theo giờ họp tăng dần, `bucket=done` là đã họp xếp mới nhất trước, không có `bucket` thì
 * có cả cuộc họp đã hủy; nhóm không mở rộng phạm vi xem (người không liên quan vẫn không thấy gì) và đi cùng `status` thì cả hai cùng đúng.
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
import { ListMeetingsQuerySchema, MEETING_BUCKET_STATUSES } from '@qcet/contracts/meeting';

const runId = crypto.randomBytes(4).toString('hex');
const DAY = 86_400_000;
const users = { organizer: '', outsider: '' };
let unitId = '';
const meetingIds: Record<string, string> = {};

const list = (userId: string, query: Record<string, string> = {}) =>
  MeetingService.listMeetings(ListMeetingsQuerySchema.parse({ limit: '50', ...query }), userId);
// Chỉ lấy các cuộc họp của chính bài test này, theo mã trong tiêu đề
const mine = (result: { items: Array<{ id: string; title: string }> }) => result.items.filter((m) => m.title.includes(runId));
const keys = (result: { items: Array<{ id: string; title: string }> }) =>
  mine(result).map((m) => Object.entries(meetingIds).find(([, id]) => id === m.id)?.[0]);

describe('Danh sách cuộc họp theo nhóm trạng thái', () => {
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
    const seed: Array<[string, MeetingStatus, number]> = [
      ['draft', MeetingStatus.DRAFT_AGENDA, 2],
      ['invited', MeetingStatus.INVITED, 1],
      ['held', MeetingStatus.HELD, -1],
      ['minutesDraft', MeetingStatus.MINUTES_DRAFT, -2],
      ['confirmed', MeetingStatus.MINUTES_CONFIRMED, -3],
      ['cancelled', MeetingStatus.CANCELLED, 3],
    ];
    for (const [key, status, days] of seed) {
      meetingIds[key] = (
        await prisma.meeting.create({
          data: { code: `MT_MB_${runId}_${key}`, title: `Họp ${key} ${runId}`, unitId, organizerId: users.organizer, status, startTime: new Date(now + days * DAY) },
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

  it('bảng nhóm: upcoming là chưa họp, done là đã họp (kể cả biên bản), không nhóm nào chứa cuộc họp đã hủy', () => {
    assert.deepEqual([...MEETING_BUCKET_STATUSES.upcoming], ['DRAFT_AGENDA', 'INVITED']);
    assert.deepEqual([...MEETING_BUCKET_STATUSES.done], ['HELD', 'MINUTES_DRAFT', 'MINUTES_CONFIRMED']);
    assert.equal([...MEETING_BUCKET_STATUSES.upcoming, ...MEETING_BUCKET_STATUSES.done].includes('CANCELLED' as MeetingStatus), false);
  });

  it('upcoming: chỉ cuộc chưa họp, gần nhất lên đầu', async () => {
    assert.deepEqual(keys(await list(users.organizer, { bucket: 'upcoming' })), ['invited', 'draft']);
  });

  it('done: chỉ cuộc đã họp, mới nhất lên đầu', async () => {
    assert.deepEqual(keys(await list(users.organizer, { bucket: 'done' })), ['held', 'minutesDraft', 'confirmed']);
  });

  it('không có nhóm: đủ sáu cuộc kể cả đã hủy, mới nhất lên đầu', async () => {
    assert.deepEqual(keys(await list(users.organizer)), ['cancelled', 'draft', 'invited', 'held', 'minutesDraft', 'confirmed']);
  });

  it('nhóm đi cùng status thì cả hai cùng đúng: done + INVITED rỗng, done + HELD chỉ còn cuộc đã họp', async () => {
    assert.deepEqual(keys(await list(users.organizer, { bucket: 'done', status: 'INVITED' })), []);
    assert.deepEqual(keys(await list(users.organizer, { bucket: 'done', status: 'HELD' })), ['held']);
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
    assert.deepEqual(keys(body), ['invited', 'draft']);

    const bad = await listRoute(new NextRequest('http://localhost:3000/api/meetings?bucket=all', { headers: auth }));
    assert.equal(bad.status, 400);
    const anonymous = await listRoute(new NextRequest('http://localhost:3000/api/meetings?bucket=done'));
    assert.equal(anonymous.status, 401);
  });
});
