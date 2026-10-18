/**
 * Đặc tả mức route cho GET /api/meetings/[id]/resolutions (danh sách kết luận cuộc họp).
 *
 * POST của route này đã được phủ ở tests/security/meeting-authorization.test.ts; file này chỉ khóa GET:
 * xác thực, 404 khi cuộc họp không tồn tại, quyền `meeting.read` trên cuộc họp cha (người ngoài,
 * trưởng đơn vị khác bị chặn; người tổ chức, chủ tọa, người dự, trưởng đơn vị chủ trì được xem),
 * và hình dạng phần tử trả về (mảng trần, mới nhất trước, chỉ của đúng cuộc họp).
 *
 * Lỗi của route này dùng envelope JSON thường (không phải RFC 9457).
 * Chạy trên qcet_test; mọi bản ghi mang runId riêng và được dọn theo id trong after().
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  AssignmentStatus,
  AssignmentType,
  JobCatalogGroup,
  MeetingParticipantRole,
  MeetingStatus,
  TaskActorRole,
  TaskStatus,
  UnitType,
  UserRole,
} from '@prisma/client';
import { prisma } from '@qcet/db/prisma';
import { signSessionToken } from '@/lib/jwt-session';
import { getAcademicMonthInfo } from '@qcet/shared/lib/academic-calendar';
import { GET as listResolutions } from '@/app/api/meetings/[id]/resolutions/route';

const runId = `mres_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type UserKey = 'organizer' | 'chair' | 'attendee' | 'outsider' | 'leaderOwn' | 'leaderOther';

const users = {} as Record<UserKey, { id: string; email: string; name: string; role: UserRole }>;
const tokens = {} as Record<UserKey, string>;
const unitIds: string[] = [];
const positionDefinitionIds: string[] = [];
const positionAssignmentIds: string[] = [];
const meetingIds: string[] = [];
const resolutionIds: string[] = [];
const taskIds: string[] = [];

let unitMeeting: { id: string; code: string; name: string };
let meetingMain: string;
let meetingOther: string;
let meetingEmpty: string;
let resultingTask: { id: string; title: string; status: TaskStatus; dueDate: Date };
let r1: { id: string; code: string | null; title: string; content: string; deadline: Date | null; createdAt: Date };
let r2: { id: string; code: string | null; title: string; createdAt: Date };
let r3: { id: string; title: string };

function get(meetingId: string, token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const req = new NextRequest(`http://localhost:3000/api/meetings/${meetingId}/resolutions`, {
    method: 'GET',
    headers,
  });
  return listResolutions(req, { params: Promise.resolve({ id: meetingId }) });
}

/** Lỗi: envelope JSON thường, không có dữ liệu kết luận nào của fixture. */
async function expectError(res: Response, status: number, code: string) {
  assert.equal(res.status, status);
  assert.match(res.headers.get('content-type') ?? '', /^application\/json/);
  assert.ok(res.headers.get('x-request-id'), 'phải có x-request-id');
  const text = await res.text();
  for (const leaked of [r1.id, r2.id, r3.id, r1.title, r2.title]) {
    assert.ok(!text.includes(leaked), `phản hồi lỗi không được chứa dữ liệu kết luận (${leaked})`);
  }
  const body = JSON.parse(text);
  assert.equal(Array.isArray(body), false);
  assert.equal(body.success, false);
  assert.equal(body.code, code);
  assert.equal(typeof body.message, 'string');
  assert.equal(body.error, body.message);
  assert.equal(typeof body.requestId, 'string');
  return body;
}

async function expectList(res: Response) {
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /^application\/json/);
  const body = await res.json();
  assert.ok(Array.isArray(body), 'GET trả mảng trần, không bọc envelope');
  return body as Array<Record<string, any>>;
}

async function createUser(key: UserKey) {
  const user = await prisma.user.create({
    data: {
      email: `${runId}_${key}@cdktcnqn.edu.vn`.toLowerCase(),
      name: `${runId} ${key}`,
      role: UserRole.CHUYEN_VIEN,
      isActive: true,
    },
    select: { id: true, email: true, name: true, role: true },
  });
  users[key] = user;
  tokens[key] = signSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role });
}

describe('GET /api/meetings/[id]/resolutions (route)', () => {
  before(async () => {
    console.log(`[meeting-resolutions-list-route] runId=${runId}`);
    const now = Date.now();

    for (const key of ['organizer', 'chair', 'attendee', 'outsider', 'leaderOwn', 'leaderOther'] as UserKey[]) {
      await createUser(key);
    }

    unitMeeting = await prisma.organizationalUnit.create({
      data: { code: `${runId}_M`, name: `Đơn vị chủ trì họp ${runId}`, type: UnitType.DEPARTMENT },
      select: { id: true, code: true, name: true },
    });
    const unitOther = await prisma.organizationalUnit.create({
      data: { code: `${runId}_V`, name: `Đơn vị khác ${runId}`, type: UnitType.DEPARTMENT },
      select: { id: true },
    });
    unitIds.push(unitMeeting.id, unitOther.id);

    // Mã bắt đầu bằng TRUONG_ → vị trí trưởng đơn vị trong authorize().
    const leaderDef = await prisma.positionDefinition.create({
      data: { code: `TRUONG_PHONG_${runId}`.slice(0, 50), title: 'Trưởng phòng (test)', group: JobCatalogGroup.LDPU, isLeadership: true },
      select: { id: true },
    });
    positionDefinitionIds.push(leaderDef.id);
    for (const [key, unitId] of [['leaderOwn', unitMeeting.id], ['leaderOther', unitOther.id]] as const) {
      const assignment = await prisma.positionAssignment.create({
        data: {
          userId: users[key].id,
          unitId,
          positionDefinitionId: leaderDef.id,
          type: AssignmentType.PRIMARY,
          status: AssignmentStatus.ACTIVE,
          effectiveFrom: new Date(now - 30 * DAY),
        },
        select: { id: true },
      });
      positionAssignmentIds.push(assignment.id);
    }

    const dueDate = new Date(now + 7 * DAY);
    const period = getAcademicMonthInfo(dueDate);
    resultingTask = await prisma.task.create({
      data: {
        code: `${runId}_T`.slice(0, 50),
        title: `Nhiệm vụ từ kết luận ${runId}`,
        academicMonth: period.monthNumber,
        academicYear: period.academicYear,
        startDate: new Date(now - 1 * DAY),
        dueDate,
        createdById: users.organizer.id,
        status: TaskStatus.IN_PROGRESS,
        actors: { create: [{ userId: users.attendee.id, role: TaskActorRole.DRI, isPrimaryDRI: true }] },
      },
      select: { id: true, title: true, status: true, dueDate: true },
    });
    taskIds.push(resultingTask.id);

    const createMeeting = async (suffix: string, participants: Array<{ userId: string; role: MeetingParticipantRole }>) => {
      const meeting = await prisma.meeting.create({
        data: {
          code: `${runId}_${suffix}`,
          title: `Cuộc họp ${suffix} ${runId}`,
          unitId: unitMeeting.id,
          organizerId: users.organizer.id,
          status: MeetingStatus.HELD,
          startTime: new Date(now - 1 * DAY),
          participants: { create: participants },
        },
        select: { id: true },
      });
      meetingIds.push(meeting.id);
      return meeting.id;
    };

    meetingMain = await createMeeting('MAIN', [
      { userId: users.chair.id, role: MeetingParticipantRole.CHAIR },
      { userId: users.attendee.id, role: MeetingParticipantRole.ATTENDEE },
    ]);
    meetingOther = await createMeeting('OTHER', []);
    meetingEmpty = await createMeeting('EMPTY', []);

    r1 = await prisma.meetingResolution.create({
      data: {
        meetingId: meetingMain,
        code: `${runId}_R1`,
        title: `Kết luận thứ nhất ${runId}`,
        content: 'Giao đơn vị chủ trì triển khai kế hoạch.',
        leadUnitId: unitMeeting.id,
        leadUserId: users.attendee.id,
        deadline: new Date(now + 5 * DAY),
        resultingTaskId: resultingTask.id,
        createdAt: new Date(now - 2 * HOUR),
      },
      select: { id: true, code: true, title: true, content: true, deadline: true, createdAt: true },
    });
    r2 = await prisma.meetingResolution.create({
      data: {
        meetingId: meetingMain,
        code: `${runId}_R2`,
        title: `Kết luận thứ hai ${runId}`,
        content: 'Ghi nhận ý kiến, không giao việc.',
        createdAt: new Date(now - 1 * HOUR),
      },
      select: { id: true, code: true, title: true, createdAt: true },
    });
    r3 = await prisma.meetingResolution.create({
      data: {
        meetingId: meetingOther,
        code: `${runId}_R3`,
        title: `Kết luận của cuộc họp khác ${runId}`,
        content: 'Không thuộc cuộc họp chính.',
      },
      select: { id: true, title: true },
    });
    resolutionIds.push(r1.id, r2.id, r3.id);
  });

  after(async () => {
    const userIds = Object.values(users).map((u) => u.id);
    const entityIds = [...meetingIds, ...resolutionIds, ...taskIds];
    if (entityIds.length > 0) {
      await prisma.auditEvent.deleteMany({ where: { entityId: { in: entityIds } } });
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: entityIds } } });
    }
    if (userIds.length > 0) {
      await prisma.auditEvent.deleteMany({ where: { actorId: { in: userIds } } });
      await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    }
    await prisma.meetingResolution.deleteMany({ where: { id: { in: resolutionIds } } });
    await prisma.meetingParticipant.deleteMany({ where: { meetingId: { in: meetingIds } } });
    await prisma.meeting.deleteMany({ where: { id: { in: meetingIds } } });
    await prisma.taskActor.deleteMany({ where: { taskId: { in: taskIds } } });
    await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
    await prisma.positionAssignment.deleteMany({ where: { id: { in: positionAssignmentIds } } });
    await prisma.positionDefinition.deleteMany({ where: { id: { in: positionDefinitionIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.organizationalUnit.deleteMany({ where: { id: { in: unitIds } } });
  });

  describe('xác thực và tồn tại', () => {
    test('không có token: 401 AUTH_REQUIRED', async () => {
      await expectError(await get(meetingMain, null), 401, 'AUTH_REQUIRED');
    });

    test('token không hợp lệ: 401 SESSION_INVALID', async () => {
      await expectError(await get(meetingMain, 'khong-phai-token-hop-le'), 401, 'SESSION_INVALID');
    });

    test('cuộc họp không tồn tại: 404 NOT_FOUND', async () => {
      const body = await expectError(await get(`${runId}-khong-ton-tai`, tokens.organizer), 404, 'NOT_FOUND');
      assert.equal(body.message, 'Cuộc họp không tồn tại');
    });
  });

  describe('quyền đọc cuộc họp cha (meeting.read)', () => {
    test('người ngoài (không tham dự, không chức vụ): 403 INSUFFICIENT_RELATIONSHIP', async () => {
      await expectError(await get(meetingMain, tokens.outsider), 403, 'INSUFFICIENT_RELATIONSHIP');
    });

    test('trưởng đơn vị khác không tham dự: 403 DEPARTMENT_BOUNDARY_VIOLATION', async () => {
      await expectError(await get(meetingMain, tokens.leaderOther), 403, 'DEPARTMENT_BOUNDARY_VIOLATION');
    });

    test('người tổ chức thấy kết luận của đúng cuộc họp, mới nhất trước, đúng hình dạng', async () => {
      const list = await expectList(await get(meetingMain, tokens.organizer));
      assert.deepEqual(
        list.map((r) => r.id),
        [r2.id, r1.id],
        'chỉ kết luận của cuộc họp này, sắp theo createdAt giảm dần'
      );

      const [second, first] = list;
      assert.deepEqual(
        Object.keys(first).sort(),
        [
          'code',
          'content',
          'createdAt',
          'deadline',
          'id',
          'leadUnit',
          'leadUnitId',
          'leadUser',
          'leadUserId',
          'meetingId',
          'resultingTask',
          'resultingTaskId',
          'title',
          'updatedAt',
        ]
      );
      assert.equal(first.meetingId, meetingMain);
      assert.equal(first.code, r1.code);
      assert.equal(first.title, r1.title);
      assert.equal(first.content, r1.content);
      assert.equal(first.deadline, r1.deadline?.toISOString());
      assert.equal(first.createdAt, r1.createdAt.toISOString());
      assert.equal(first.leadUnitId, unitMeeting.id);
      assert.equal(first.leadUnit.id, unitMeeting.id);
      assert.equal(first.leadUnit.code, unitMeeting.code);
      assert.equal(first.leadUnit.name, unitMeeting.name);
      assert.equal(first.leadUserId, users.attendee.id);
      // Người chủ trì chỉ lộ id/name/email.
      assert.deepEqual(first.leadUser, {
        id: users.attendee.id,
        name: users.attendee.name,
        email: users.attendee.email,
      });
      assert.equal(first.resultingTaskId, resultingTask.id);
      // Nhiệm vụ phát sinh chỉ lộ id/title/status/dueDate.
      assert.deepEqual(first.resultingTask, {
        id: resultingTask.id,
        title: resultingTask.title,
        status: resultingTask.status,
        dueDate: resultingTask.dueDate.toISOString(),
      });

      assert.equal(second.title, r2.title);
      assert.equal(second.code, r2.code);
      assert.equal(second.leadUnitId, null);
      assert.equal(second.leadUnit, null);
      assert.equal(second.leadUserId, null);
      assert.equal(second.leadUser, null);
      assert.equal(second.resultingTaskId, null);
      assert.equal(second.resultingTask, null);
      assert.equal(second.deadline, null);
    });

    for (const key of ['chair', 'attendee'] as const) {
      test(`người dự họp (${key}) thấy cùng danh sách`, async () => {
        const list = await expectList(await get(meetingMain, tokens[key]));
        assert.deepEqual(list.map((r) => r.id), [r2.id, r1.id]);
      });
    }

    test('trưởng đơn vị chủ trì cuộc họp (không tham dự) thấy cùng danh sách', async () => {
      const list = await expectList(await get(meetingMain, tokens.leaderOwn));
      assert.deepEqual(list.map((r) => r.id), [r2.id, r1.id]);
    });

    test('cuộc họp chưa có kết luận: 200 với mảng rỗng', async () => {
      const list = await expectList(await get(meetingEmpty, tokens.organizer));
      assert.deepEqual(list, []);
    });
  });
});
