import nextEnvPkg from '@next/env';
const loadEnvConfig = (nextEnvPkg as any)?.loadEnvConfig || (nextEnvPkg as any)?.default?.loadEnvConfig || (nextEnvPkg as any);
if (typeof loadEnvConfig === 'function') {
  loadEnvConfig(process.cwd());
}

if (!process.env.QCET_ALLOW_DB_TESTS) {
  process.env.QCET_ALLOW_DB_TESTS = '1';
}
if (!process.env.NODE_ENV) {
  (process.env as any).NODE_ENV = 'test';
}
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('/qcet_eoffice')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/\/qcet_eoffice(\?.*)?$/, '/qcet_test$1');
}

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  UserRole,
  MeetingStatus,
  MeetingParticipantRole,
  UnitType,
  TaskActorRole,
} from '@prisma/client';
import { signSessionToken, SESSION_COOKIE_NAME } from '@/lib/jwt-session';
import { MeetingService } from '@/server/services/meeting-service';
import { GET as listMeetingsRoute, POST as createMeetingRoute } from '@/app/api/meetings/route';
import { GET as getMeetingRoute } from '@/app/api/meetings/[id]/route';
import { POST as draftMinutesRoute } from '@/app/api/meetings/[id]/actions/draft-minutes/route';
import { POST as confirmMinutesRoute } from '@/app/api/meetings/[id]/actions/confirm-minutes/route';
import { POST as holdMeetingRoute } from '@/app/api/meetings/[id]/actions/hold/route';
import { POST as createResolutionRoute } from '@/app/api/meetings/[id]/resolutions/route';

describe('Sprint 2: Task 5 (F05: Meeting Authorization & Lifecycle Security)', () => {
  const runId = String(Date.now());

  let testUnit: any;
  let chairUser: any;
  let secretaryUser: any;
  let participantUser: any;
  let outsiderUser: any;

  let chairToken: string;
  let secretaryToken: string;
  let participantToken: string;
  let outsiderToken: string;

  let testMeeting: any;

  const authHeaders = (token: string) => ({
    cookie: `${SESSION_COOKIE_NAME}=${token}`,
    'content-type': 'application/json',
  });

  before(async () => {
    testUnit = await prisma.organizationalUnit.create({
      data: {
        code: `OU_SEC_MT_${runId}`,
        name: 'Phòng An ninh Thông tin',
        type: UnitType.DEPARTMENT,
      },
    });

    chairUser = await prisma.user.create({
      data: {
        email: `chair_${runId}@qnc.edu.vn`,
        name: 'Chủ tọa cuộc họp',
        role: UserRole.CHUYEN_VIEN,
        isActive: true,
      },
    });

    secretaryUser = await prisma.user.create({
      data: {
        email: `sec_${runId}@qnc.edu.vn`,
        name: 'Thư ký cuộc họp',
        role: UserRole.CHUYEN_VIEN,
        isActive: true,
      },
    });

    participantUser = await prisma.user.create({
      data: {
        email: `part_${runId}@qnc.edu.vn`,
        name: 'Thành viên tham dự',
        role: UserRole.CHUYEN_VIEN,
        isActive: true,
      },
    });

    outsiderUser = await prisma.user.create({
      data: {
        email: `outsider_${runId}@qnc.edu.vn`,
        name: 'Người ngoài cuộc họp',
        role: UserRole.CHUYEN_VIEN,
        isActive: true,
      },
    });

    chairToken = signSessionToken({
      id: chairUser.id,
      email: chairUser.email,
      name: chairUser.name,
      role: chairUser.role,
    });

    secretaryToken = signSessionToken({
      id: secretaryUser.id,
      email: secretaryUser.email,
      name: secretaryUser.name,
      role: secretaryUser.role,
    });

    participantToken = signSessionToken({
      id: participantUser.id,
      email: participantUser.email,
      name: participantUser.name,
      role: participantUser.role,
    });

    outsiderToken = signSessionToken({
      id: outsiderUser.id,
      email: outsiderUser.email,
      name: outsiderUser.name,
      role: outsiderUser.role,
    });

    // Create test meeting with Chair, Secretary, Participant
    testMeeting = await MeetingService.createMeeting(
      {
        code: `MT_SEC_${runId}`,
        title: 'Họp thẩm định an toàn thông tin Q3/2026',
        unitId: testUnit.id,
        startTime: '2026-09-15T09:00:00.000Z',
        initialParticipants: [
          { userId: chairUser.id, role: MeetingParticipantRole.CHAIR },
          { userId: secretaryUser.id, role: MeetingParticipantRole.SECRETARY },
          { userId: participantUser.id, role: MeetingParticipantRole.ATTENDEE },
        ],
      },
      chairUser.id
    );
  });

  after(async () => {
    // Cleanup tasks and actors created from resolutions
    await prisma.taskActor.deleteMany({
      where: {
        task: {
          createdById: { in: [chairUser?.id, secretaryUser?.id] },
        },
      },
    });

    await prisma.task.deleteMany({
      where: {
        createdById: { in: [chairUser?.id, secretaryUser?.id] },
      },
    });

    await prisma.meetingResolution.deleteMany({
      where: {
        meeting: {
          code: { contains: runId },
        },
      },
    });

    await prisma.meetingParticipant.deleteMany({
      where: {
        meeting: {
          code: { contains: runId },
        },
      },
    });

    await prisma.meeting.deleteMany({
      where: {
        code: { contains: runId },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: { in: [chairUser?.id, secretaryUser?.id, participantUser?.id, outsiderUser?.id] },
      },
    });

    if (testUnit) {
      await prisma.organizationalUnit.delete({
        where: { id: testUnit.id },
      });
    }
  });

  test('1. Outsider listing predicate: listMeetings hides meetings where user has no relationship', async () => {
    // Service-level check
    const serviceList = await MeetingService.listMeetings({ page: 1, limit: 20 }, outsiderUser.id);
    const outsiderMeetingIds = serviceList.items.map((m) => m.id);
    assert.strictEqual(outsiderMeetingIds.includes(testMeeting.id), false, 'Outsider should not see testMeeting in service list');

    // Route-level check
    const req = new NextRequest('http://localhost:3000/api/meetings', {
      headers: authHeaders(outsiderToken),
    });
    const res = await listMeetingsRoute(req);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const apiMeetingIds = (body.items || []).map((m: any) => m.id);
    assert.strictEqual(apiMeetingIds.includes(testMeeting.id), false, 'Outsider should not see testMeeting via API');
  });

  test('2. Outsider GET detail returns 403 or 404', async () => {
    // Service-level check
    await assert.rejects(
      async () => {
        await MeetingService.getMeeting(testMeeting.id, outsiderUser.id);
      },
      (err: any) => {
        assert.ok(err.name === 'AuthorizationError' || err.statusCode === 403 || err.statusCode === 404);
        return true;
      }
    );

    // Route-level check
    const req = new NextRequest(`http://localhost:3000/api/meetings/${testMeeting.id}`, {
      headers: authHeaders(outsiderToken),
    });
    const res = await getMeetingRoute(req, { params: Promise.resolve({ id: testMeeting.id }) });
    assert.ok(res.status === 403 || res.status === 404);
  });

  test('3. Participant can read meeting detail (ALLOW)', async () => {
    // Service-level
    const meeting = await MeetingService.getMeeting(testMeeting.id, participantUser.id);
    assert.strictEqual(meeting.id, testMeeting.id);

    // Route-level
    const req = new NextRequest(`http://localhost:3000/api/meetings/${testMeeting.id}`, {
      headers: authHeaders(participantToken),
    });
    const res = await getMeetingRoute(req, { params: Promise.resolve({ id: testMeeting.id }) });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.id, testMeeting.id);
  });

  test('4. Participant attempting to confirm minutes -> DENY (403)', async () => {
    // Service-level
    await assert.rejects(
      async () => {
        await MeetingService.confirmMinutes(testMeeting.id, {}, participantUser.id);
      },
      (err: any) => {
        assert.strictEqual(err.name, 'AuthorizationError');
        return true;
      }
    );

    // Route-level
    const req = new NextRequest(`http://localhost:3000/api/meetings/${testMeeting.id}/actions/confirm-minutes`, {
      method: 'POST',
      headers: authHeaders(participantToken),
      body: JSON.stringify({ notes: 'Participant trying to confirm' }),
    });
    const res = await confirmMinutesRoute(req, { params: Promise.resolve({ id: testMeeting.id }) });
    assert.strictEqual(res.status, 403);
  });

  test('5. Outsider attempting to confirm minutes -> DENY (403)', async () => {
    const req = new NextRequest(`http://localhost:3000/api/meetings/${testMeeting.id}/actions/confirm-minutes`, {
      method: 'POST',
      headers: authHeaders(outsiderToken),
      body: JSON.stringify({ notes: 'Outsider trying to confirm' }),
    });
    const res = await confirmMinutesRoute(req, { params: Promise.resolve({ id: testMeeting.id }) });
    assert.strictEqual(res.status, 403);
  });

  test('6. Secretary can draft minutes after meeting is held (ALLOW)', async () => {
    // First transition to HELD by chair
    const holdReq = new NextRequest(`http://localhost:3000/api/meetings/${testMeeting.id}/actions/hold`, {
      method: 'POST',
      headers: authHeaders(chairToken),
    });
    const holdRes = await holdMeetingRoute(holdReq, { params: Promise.resolve({ id: testMeeting.id }) });
    assert.strictEqual(holdRes.status, 200);

    // Secretary drafts minutes
    const draftReq = new NextRequest(`http://localhost:3000/api/meetings/${testMeeting.id}/actions/draft-minutes`, {
      method: 'POST',
      headers: authHeaders(secretaryToken),
      body: JSON.stringify({ minutes: 'Dự thảo biên bản cuộc họp thẩm định ATTT...' }),
    });
    const draftRes = await draftMinutesRoute(draftReq, { params: Promise.resolve({ id: testMeeting.id }) });
    assert.strictEqual(draftRes.status, 200);
    const body = await draftRes.json();
    assert.strictEqual(body.status, MeetingStatus.MINUTES_DRAFT);
  });

  test('7. Secretary cannot confirm minutes without chair role -> DENY (403)', async () => {
    const confirmReq = new NextRequest(`http://localhost:3000/api/meetings/${testMeeting.id}/actions/confirm-minutes`, {
      method: 'POST',
      headers: authHeaders(secretaryToken),
      body: JSON.stringify({ notes: 'Secretary trying to self-confirm' }),
    });
    const confirmRes = await confirmMinutesRoute(confirmReq, { params: Promise.resolve({ id: testMeeting.id }) });
    assert.strictEqual(confirmRes.status, 403);
  });

  test('8. Resolution creation before allowed state -> DENY', async () => {
    // Create an un-held meeting (INVITED)
    const invitedMeeting = await MeetingService.createMeeting(
      {
        code: `MT_INV_${runId}`,
        title: 'Họp chưa diễn ra',
        unitId: testUnit.id,
        startTime: '2026-09-20T08:00:00.000Z',
        initialParticipants: [{ userId: chairUser.id, role: MeetingParticipantRole.CHAIR }],
      },
      chairUser.id
    );

    // Attempting resolution on INVITED meeting should be rejected
    const req = new NextRequest(`http://localhost:3000/api/meetings/${invitedMeeting.id}/resolutions`, {
      method: 'POST',
      headers: authHeaders(chairToken),
      body: JSON.stringify({
        code: `RES_EARLY_${runId}`,
        title: 'Nghị quyết quá sớm',
        content: 'Nội dung...',
      }),
    });
    const res = await createResolutionRoute(req, { params: Promise.resolve({ id: invitedMeeting.id }) });
    assert.strictEqual(res.status, 400); // Invalid state -> 400 Bad Request / ValidationError
  });

  test('9. Chair can confirm minutes (ALLOW)', async () => {
    const confirmReq = new NextRequest(`http://localhost:3000/api/meetings/${testMeeting.id}/actions/confirm-minutes`, {
      method: 'POST',
      headers: authHeaders(chairToken),
      body: JSON.stringify({ notes: 'Chủ tọa phê duyệt biên bản' }),
    });
    const confirmRes = await confirmMinutesRoute(confirmReq, { params: Promise.resolve({ id: testMeeting.id }) });
    assert.strictEqual(confirmRes.status, 200);
    const body = await confirmRes.json();
    assert.strictEqual(body.status, MeetingStatus.MINUTES_CONFIRMED);
  });

  test('10. Unauthorized user (participant/outsider) creating resolution -> DENY (403)', async () => {
    // Participant
    const partReq = new NextRequest(`http://localhost:3000/api/meetings/${testMeeting.id}/resolutions`, {
      method: 'POST',
      headers: authHeaders(participantToken),
      body: JSON.stringify({
        code: `RES_UNAUTH_${runId}`,
        title: 'Quyết nghị không phép',
        content: 'Nội dung...',
      }),
    });
    const partRes = await createResolutionRoute(partReq, { params: Promise.resolve({ id: testMeeting.id }) });
    assert.strictEqual(partRes.status, 403);

    // Outsider
    const outReq = new NextRequest(`http://localhost:3000/api/meetings/${testMeeting.id}/resolutions`, {
      method: 'POST',
      headers: authHeaders(outsiderToken),
      body: JSON.stringify({
        code: `RES_OUT_${runId}`,
        title: 'Quyết nghị người ngoài',
        content: 'Nội dung...',
      }),
    });
    const outRes = await createResolutionRoute(outReq, { params: Promise.resolve({ id: testMeeting.id }) });
    assert.strictEqual(outRes.status, 403);
  });

  test('11. Authorized Chair creates resolution -> Task created via canonical command with DRI actor and outbox', async () => {
    const resCode = `NQ_AUTH_${runId}`;
    const deadline = new Date('2026-10-15T17:00:00Z');

    const resReq = new NextRequest(`http://localhost:3000/api/meetings/${testMeeting.id}/resolutions`, {
      method: 'POST',
      headers: authHeaders(chairToken),
      body: JSON.stringify({
        code: resCode,
        title: 'Triển khai kiểm thử thâm nhập định kỳ Q4/2026',
        content: 'Giao chuyên viên tiến hành pentest hệ thống toàn diện theo tiêu chuẩn ISO 27001.',
        leadUnitId: testUnit.id,
        leadUserId: participantUser.id,
        deadline: deadline.toISOString(),
        createTask: true,
      }),
    });

    const resResult = await createResolutionRoute(resReq, { params: Promise.resolve({ id: testMeeting.id }) });
    assert.strictEqual(resResult.status, 201);
    const body = await resResult.json();
    assert.ok(body.id);
    assert.ok(body.resultingTaskId);

    // Verify task in database
    const createdTask = await prisma.task.findUnique({
      where: { id: body.resultingTaskId },
      include: {
        actors: true,
        actors: true,
      },
    });

    assert.ok(createdTask, 'Resulting Task must exist in database');
    assert.ok(createdTask.code.length > 0, 'Task must have a generated code');
    assert.strictEqual(createdTask.createdById, chairUser.id, 'Task creator must be chair');
    assert.strictEqual(createdTask.leadUnitId, testUnit.id, 'Task leadUnitId must match');

    // Invariant 5.5: TaskActor with DRI role
    const driActor = createdTask.actors.find((a) => a.userId === participantUser.id && a.role === TaskActorRole.DRI);
    assert.ok(driActor, 'Task must have a DRI TaskActor for leadUserId');

    // Verify outbox event exists
    const outboxEvent = await prisma.outboxEvent.findFirst({
      where: {
        aggregateType: 'Task',
        aggregateId: createdTask.id,
        eventType: 'TASK_CREATED_FROM_RESOLUTION',
      },
    });
    assert.ok(outboxEvent, 'Outbox event TASK_CREATED_FROM_RESOLUTION must be created');
    assert.strictEqual((outboxEvent.payload as any).createdById, chairUser.id);
  });
});
