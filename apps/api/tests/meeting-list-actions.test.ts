/**
 * Thao tác trên danh sách cuộc họp (menu chuột phải, chọn nhiều, sắp xếp theo cột): mỗi hàng mang `availableActions` của
 * chính người xem để giao diện chỉ hiện thao tác được phép; `sort`/`order` sắp xếp ở máy chủ; hủy họp qua
 * `POST /api/meetings/{id}/actions/cancel` chỉ dành cho người tổ chức/chủ tọa và chỉ khi cuộc họp chưa kết thúc.
 * Chạy trên qcet_test và chỉ xóa bản ghi do test tạo.
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
import { POST as cancelRoute } from '@/app/api/meetings/[id]/actions/cancel/route';
import { MeetingService } from '@/server/services/meeting-service';
import { ListMeetingsQuerySchema } from '@qcet/contracts/meeting';

const runId = crypto.randomBytes(4).toString('hex');
const DAY = 86_400_000;
const users = { organizer: '', attendee: '', outsider: '' };
const tokens: Record<keyof typeof users, string> = { organizer: '', attendee: '', outsider: '' };
let unitId = '';
const meetingIds: Record<string, string> = {};

type Row = { id: string; title: string; availableActions: string[]; participants?: unknown; body?: { memberships?: unknown } | null };
const list = async (userId: string, query: Record<string, string> = {}) =>
  (await MeetingService.listMeetings(ListMeetingsQuerySchema.parse({ limit: '50', ...query }), userId)) as unknown as { items: Row[] };
// Chỉ lấy các cuộc họp của chính bài test này, theo mã trong tiêu đề
const keys = (result: { items: Array<{ id: string; title: string }> }) =>
  result.items
    .filter((m) => m.title.includes(runId))
    .map((m) => Object.entries(meetingIds).find(([, id]) => id === m.id)?.[0]);
const rowOf = (result: { items: Row[] }, key: string) => result.items.find((m) => m.id === meetingIds[key]);

const cancel = (who: keyof typeof users, key: string, body?: unknown) =>
  cancelRoute(
    new NextRequest(`http://localhost:3000/api/meetings/${meetingIds[key]}/actions/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens[who]}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: meetingIds[key] }) }
  );

describe('Thao tác trên danh sách cuộc họp', { concurrency: 1 }, () => {
  before(async () => {
    for (const key of ['organizer', 'attendee', 'outsider'] as const) {
      const email = `mla_${runId}_${key}@cdktcnqn.edu.vn`;
      const name = `Người ${key} ${runId}`;
      users[key] = (await prisma.user.create({ data: { email, name, role: 'CHUYEN_VIEN', isActive: true }, select: { id: true } })).id;
      tokens[key] = signSessionToken({ id: users[key], email, name, role: 'CHUYEN_VIEN' });
    }
    unitId = (await prisma.organizationalUnit.create({ data: { code: `OU_MLA_${runId}`, name: `Đơn vị họp ${runId}`, type: UnitType.DEPARTMENT } })).id;
    const now = Date.now();
    // Tiêu đề bắt đầu bằng chữ cái khác nhau để kiểm sắp theo tên; giờ họp lệch nhau để kiểm sắp theo giờ.
    const seed: Array<[string, string, MeetingStatus, number]> = [
      ['invited', 'Bàn kế hoạch', MeetingStatus.INVITED, 2],
      ['draft', 'An toàn lao động', MeetingStatus.DRAFT_AGENDA, 1],
      ['cancelMe', 'Cải tiến quy trình', MeetingStatus.INVITED, 3],
      ['confirmed', 'Duyệt kết quả', MeetingStatus.MINUTES_CONFIRMED, -1],
    ];
    for (const [key, title, status, days] of seed) {
      meetingIds[key] = (
        await prisma.meeting.create({
          data: { code: `MT_MLA_${runId}_${key}`, title: `${title} ${runId}`, unitId, organizerId: users.organizer, status, startTime: new Date(now + days * DAY) },
        })
      ).id;
    }
    for (const key of ['invited', 'cancelMe']) {
      await prisma.meetingParticipant.create({ data: { meetingId: meetingIds[key], userId: users.attendee, role: 'ATTENDEE' } });
    }
  });

  after(async () => {
    await prisma.meetingParticipant.deleteMany({ where: { meetingId: { in: Object.values(meetingIds) } } });
    await prisma.meeting.deleteMany({ where: { id: { in: Object.values(meetingIds) } } });
    await prisma.auditEvent.deleteMany({ where: { actorId: { in: Object.values(users) } } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
    await prisma.organizationalUnit.deleteMany({ where: { id: unitId } });
    await prisma.$disconnect();
  });

  it('mỗi hàng có thao tác được phép của chính người xem: người tổ chức sửa được, người dự họp chỉ xem', async () => {
    const asOrganizer = rowOf(await list(users.organizer), 'invited');
    assert.ok(asOrganizer, 'người tổ chức thấy cuộc họp');
    assert.ok(asOrganizer.availableActions.includes('meeting.read'));
    assert.ok(asOrganizer.availableActions.includes('meeting.update'));

    const asAttendee = rowOf(await list(users.attendee), 'invited');
    assert.ok(asAttendee, 'người dự họp thấy cuộc họp');
    assert.ok(asAttendee.availableActions.includes('meeting.read'));
    assert.equal(asAttendee.availableActions.includes('meeting.update'), false);
  });

  it('hàng không lộ danh sách người dự và thành viên hội đồng dùng để tính quyền', async () => {
    const row = rowOf(await list(users.organizer), 'invited');
    assert.ok(row);
    assert.equal('participants' in row, false);
    assert.equal(row.body?.memberships, undefined);
  });

  it('sort/order: theo tên tăng dần mặc định, đảo được; theo giờ họp tăng dần', async () => {
    assert.deepEqual(keys(await list(users.organizer, { sort: 'title' })), ['draft', 'invited', 'cancelMe', 'confirmed']);
    assert.deepEqual(keys(await list(users.organizer, { sort: 'title', order: 'desc' })), ['confirmed', 'cancelMe', 'invited', 'draft']);
    assert.deepEqual(keys(await list(users.organizer, { sort: 'startTime', order: 'asc' })), ['confirmed', 'draft', 'invited', 'cancelMe']);
    // Không có sort: giữ thứ tự cũ (giờ họp mới nhất trước).
    assert.deepEqual(keys(await list(users.organizer)), ['cancelMe', 'invited', 'draft', 'confirmed']);
  });

  it('route: sort lạ bị từ chối 400, sort hợp lệ trả hàng kèm availableActions', async () => {
    const auth = { Authorization: `Bearer ${tokens.organizer}` };
    const bad = await listRoute(new NextRequest('http://localhost:3000/api/meetings?sort=organizer', { headers: auth }));
    assert.equal(bad.status, 400);
    const ok = await listRoute(new NextRequest('http://localhost:3000/api/meetings?sort=title&order=asc&limit=50', { headers: auth }));
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { items: Row[] };
    assert.deepEqual(keys(body), ['draft', 'invited', 'cancelMe', 'confirmed']);
    assert.ok(rowOf(body, 'draft')?.availableActions.includes('meeting.update'));
  });

  it('hủy họp: người dự họp và người không liên quan bị từ chối 403, cuộc họp giữ nguyên', async () => {
    for (const who of ['attendee', 'outsider'] as const) {
      const res = await cancel(who, 'cancelMe');
      assert.equal(res.status, 403, who);
    }
    const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingIds.cancelMe } });
    assert.equal(meeting.status, MeetingStatus.INVITED);
  });

  it('hủy họp: body có trường lạ bị từ chối 400', async () => {
    const res = await cancel('organizer', 'cancelMe', { reason: 'Đổi lịch', status: 'HELD' });
    assert.equal(res.status, 400);
  });

  it('hủy họp: người tổ chức hủy được (body rỗng hoặc có lý do), ghi nhật ký; hủy lần nữa bị từ chối', async () => {
    const res = await cancel('organizer', 'cancelMe', { reason: 'Đổi lịch' });
    assert.equal(res.status, 200);
    const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingIds.cancelMe } });
    assert.equal(meeting.status, MeetingStatus.CANCELLED);
    const audit = await prisma.auditEvent.findFirst({ where: { entityType: 'Meeting', entityId: meetingIds.cancelMe, actorId: users.organizer } });
    assert.ok(audit, 'có nhật ký hủy họp');

    const again = await cancel('organizer', 'cancelMe');
    assert.equal(again.status, 400);

    const draft = await cancel('organizer', 'draft');
    assert.equal(draft.status, 200);
  });

  it('hủy họp: cuộc họp đã duyệt biên bản không hủy được', async () => {
    const res = await cancel('organizer', 'confirmed');
    assert.equal(res.status, 400);
    const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingIds.confirmed } });
    assert.equal(meeting.status, MeetingStatus.MINUTES_CONFIRMED);
  });
});
