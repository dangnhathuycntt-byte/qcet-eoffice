import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import { prisma } from '@/lib/prisma';
import {
  recordAuthorizationDecision,
  extractAuditFromDecision,
  type AuthorizationAuditRecord,
} from '@/server/authorization/authorization-audit';
import {
  type AuthorizationContext,
  AuthorizationContextModel,
} from '@/server/authorization/authorization-context';
import { logger, type StructuredLogEntry } from '@/server/observability/logger';
import { MeetingService } from '@/server/services/meeting-service';
import {
  UnitType,
  UserRole,
  MeetingParticipantRole,
  AttendanceStatus,
  AssignmentType,
  AssignmentStatus,
} from '@prisma/client';

describe('Sprint 2: Task 11 (Audit Authorization Decisions)', () => {
  const runId = Date.now().toString().slice(-6);

  let testUnit: any;
  let chairUser: any;
  let participantUser: any;
  let testMeeting: any;

  before(async () => {
    testUnit = await prisma.organizationalUnit.create({
      data: {
        code: `OU_AUD_${runId}`,
        name: 'Phòng Thanh tra & Kiểm toán',
        type: UnitType.DEPARTMENT,
      },
    });

    chairUser = await prisma.user.create({
      data: {
        email: `chair_aud_${runId}@qnc.edu.vn`,
        name: 'Chủ tọa kiểm toán',
        role: UserRole.CHUYEN_VIEN,
        isActive: true,
      },
    });

    participantUser = await prisma.user.create({
      data: {
        email: `part_aud_${runId}@qnc.edu.vn`,
        name: 'Thành viên tham dự kiểm toán',
        role: UserRole.CHUYEN_VIEN,
        isActive: true,
      },
    });

    testMeeting = await MeetingService.createMeeting(
      {
        code: `MT_AUD_${runId}`,
        title: 'Họp thẩm tra nhật ký kiểm toán',
        unitId: testUnit.id,
        startTime: '2026-09-15T09:00:00.000Z',
        initialParticipants: [
          { userId: chairUser.id, role: MeetingParticipantRole.CHAIR },
          { userId: participantUser.id, role: MeetingParticipantRole.ATTENDEE },
        ],
      },
      chairUser.id
    );
  });

  after(async () => {
    logger.setWriter(undefined);

    await prisma.taskActor.deleteMany({
      where: {
        task: {
          createdById: { in: [chairUser?.id, participantUser?.id] },
        },
      },
    });

    await prisma.task.deleteMany({
      where: {
        createdById: { in: [chairUser?.id, participantUser?.id] },
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
        id: { in: [chairUser?.id, participantUser?.id] },
      },
    });

    if (testUnit?.id) {
      await prisma.organizationalUnit.delete({
        where: { id: testUnit.id },
      });
    }
  });

  test('1. recordAuthorizationDecision creates immutable AuditEvent with all required fields (result: ALLOW)', async () => {
    const resourceId = `res-allow-${runId}`;
    const requestId = `req-allow-${runId}`;
    const record: AuthorizationAuditRecord = {
      actorUserId: chairUser.id,
      actingPositionAssignmentId: `pos-assignment-${runId}`,
      delegationGrantId: `del-grant-${runId}`,
      action: 'task.approve_special',
      resourceType: 'SpecialResource',
      resourceId,
      requestId,
      result: 'ALLOW',
      reason: 'Authority granted by Rector portfolio',
    };

    // Execute through Prisma interactive transaction
    await prisma.$transaction(async (tx) => {
      await recordAuthorizationDecision(tx, record);
    });

    // Verify stored AuditEvent in the database
    const auditEvent = await prisma.auditEvent.findFirst({
      where: {
        entityType: 'SpecialResource',
        entityId: resourceId,
        action: 'task.approve_special',
      },
    });

    assert.ok(auditEvent, 'AuditEvent must be created in the database');
    assert.strictEqual(auditEvent.actorId, chairUser.id);
    assert.strictEqual(auditEvent.action, 'task.approve_special');
    assert.strictEqual(auditEvent.entityType, 'SpecialResource');
    assert.strictEqual(auditEvent.entityId, resourceId);
    assert.strictEqual(auditEvent.requestId, requestId);

    const meta = auditEvent.metadata as Record<string, any>;
    assert.ok(meta, 'Audit metadata must exist');
    assert.strictEqual(meta.result, 'ALLOW');
    assert.strictEqual(meta.actingPositionAssignmentId, `pos-assignment-${runId}`);
    assert.strictEqual(meta.delegationGrantId, `del-grant-${runId}`);
    assert.strictEqual(meta.reason, 'Authority granted by Rector portfolio');
  });

  test('2. recordAuthorizationDecision logs structured security event for DENY without database spam', async () => {
    const capturedLogs: StructuredLogEntry[] = [];
    logger.setWriter((entry) => capturedLogs.push(entry));

    const resourceId = `res-deny-${runId}`;
    const requestId = `req-deny-${runId}`;
    const record: AuthorizationAuditRecord = {
      actorUserId: participantUser.id,
      actingPositionAssignmentId: null,
      delegationGrantId: null,
      action: 'document.sign_decree',
      resourceType: 'OfficialDocument',
      resourceId,
      requestId,
      result: 'DENY',
      reason: 'User lacks executive signing authority',
      rejectionCode: 'INSUFFICIENT_CAPABILITY',
    };

    try {
      // Record denial decision
      await recordAuthorizationDecision(prisma, record);

      // Verify no DB event was created to prevent denial spam
      const eventInDb = await prisma.auditEvent.findFirst({
        where: {
          entityType: 'OfficialDocument',
          entityId: resourceId,
        },
      });
      assert.strictEqual(eventInDb, null, 'DENY events must not spam database by default');

      // Verify structured logger captured the security denial event
      const denyLog = capturedLogs.find((l) => l.event === 'security.authorization.denied');
      assert.ok(denyLog, 'Logger must record security.authorization.denied event');
      assert.strictEqual(denyLog.level, 'warn');
      assert.strictEqual(denyLog.requestId, requestId);
      assert.strictEqual(denyLog.metadata?.actorUserId, participantUser.id);
      assert.strictEqual(denyLog.metadata?.action, 'document.sign_decree');
      assert.strictEqual(denyLog.metadata?.resourceType, 'OfficialDocument');
      assert.strictEqual(denyLog.metadata?.resourceId, resourceId);
      assert.strictEqual(denyLog.metadata?.result, 'DENY');
      assert.strictEqual(denyLog.metadata?.reason, 'User lacks executive signing authority');
      assert.strictEqual(denyLog.metadata?.rejectionCode, 'INSUFFICIENT_CAPABILITY');
    } finally {
      logger.setWriter(undefined);
    }
  });

  test('3. recordAuthorizationDecision writes to DB when recordDenyInDb is explicitly enabled', async () => {
    const resourceId = `res-deny-db-${runId}`;
    const requestId = `req-deny-db-${runId}`;
    const record: AuthorizationAuditRecord = {
      actorUserId: participantUser.id,
      actingPositionAssignmentId: null,
      delegationGrantId: null,
      action: 'document.sign_decree',
      resourceType: 'OfficialDocument',
      resourceId,
      requestId,
      result: 'DENY',
      reason: 'Forced DB audit for security investigation',
      rejectionCode: 'INSUFFICIENT_CAPABILITY',
    };

    await recordAuthorizationDecision(prisma, record, { recordDenyInDb: true });

    const eventInDb = await prisma.auditEvent.findFirst({
      where: {
        entityType: 'OfficialDocument',
        entityId: resourceId,
      },
    });

    assert.ok(eventInDb, 'AuditEvent must be written when recordDenyInDb is true');
    assert.strictEqual(eventInDb.actorId, participantUser.id);
    assert.strictEqual(eventInDb.action, 'document.sign_decree');
    const meta = eventInDb.metadata as Record<string, any>;
    assert.strictEqual(meta.result, 'DENY');
    assert.strictEqual(meta.rejectionCode, 'INSUFFICIENT_CAPABILITY');
  });

  test('4. extractAuditFromDecision properly transforms decision and context', () => {
    const context = new AuthorizationContextModel({
      userId: 'user-ext-1',
      user: {
        id: 'user-ext-1',
        email: 'test@qnc.edu.vn',
        name: 'Test Extractor',
        isActive: true,
      },
      positions: [
        {
          id: 'pos-ext-1',
          userId: 'user-ext-1',
          positionDefinitionId: 'def-1',
          positionCode: 'TRUONG_PHONG',
          positionTitle: 'Trưởng phòng',
          positionLevel: 1,
          isLeadership: true,
          unitId: 'unit-1',
          unitCode: 'P_HCQT',
          unitName: 'Phòng HCQT',
          unitType: UnitType.DEPARTMENT,
          unitStatus: 'ACTIVE',
          type: AssignmentType.PRIMARY,
          isActing: false,
          effectiveFrom: new Date(),
          effectiveTo: null,
          status: AssignmentStatus.ACTIVE,
          sourceDecisionNumber: '100/QD',
        },
      ],
      responsibilityAreas: [],
      portfolios: [],
      delegations: [],
      bodyMemberships: [],
      primaryUnitIds: ['unit-1'],
      systemRoles: [],
    });

    const allowDecision = {
      allowed: true,
      granted: true,
      reason: 'Approved via delegation grant',
      statusCode: 'GRANTED' as const,
      actingPositionId: 'pos-ext-1',
      delegationUsed: 'del-grant-999',
      auditRecord: {
        actorId: 'user-ext-1',
        action: 'meeting.confirm_minutes',
        resourceType: 'Meeting',
        resourceId: 'm-1',
        timestamp: new Date(),
        decision: 'ALLOW' as const,
      },
    };

    const record = extractAuditFromDecision(
      allowDecision,
      context,
      'meeting.confirm_minutes',
      'Meeting',
      'm-1',
      'req-extract-1'
    );

    assert.strictEqual(record.actorUserId, 'user-ext-1');
    assert.strictEqual(record.actingPositionAssignmentId, 'pos-ext-1');
    assert.strictEqual(record.delegationGrantId, 'del-grant-999');
    assert.strictEqual(record.action, 'meeting.confirm_minutes');
    assert.strictEqual(record.resourceType, 'Meeting');
    assert.strictEqual(record.resourceId, 'm-1');
    assert.strictEqual(record.requestId, 'req-extract-1');
    assert.strictEqual(record.result, 'ALLOW');
    assert.strictEqual(record.reason, 'Approved via delegation grant');
    assert.strictEqual(record.rejectionCode, null);
  });

  test('5. confirmMinutes writes authorization audit metadata upon successful mutation', async () => {
    // Transition meeting: INVITED -> HELD -> MINUTES_DRAFT
    await MeetingService.holdMeeting(testMeeting.id, chairUser.id);

    await MeetingService.draftMinutes(
      testMeeting.id,
      {
        minutes: 'Biên bản cuộc họp kiểm toán an toàn',
      },
      chairUser.id
    );

    const reqId = `req-conf-min-${runId}`;
    const confirmed = await MeetingService.confirmMinutes(
      testMeeting.id,
      { notes: 'Chủ tọa phê duyệt chính thức' },
      chairUser.id,
      reqId
    );

    assert.strictEqual(confirmed.status, 'MINUTES_CONFIRMED');

    // Verify Authorization Audit Event was recorded in DB
    const authAudit = await prisma.auditEvent.findFirst({
      where: {
        entityType: 'Meeting',
        entityId: testMeeting.id,
        action: 'meeting.confirm_minutes',
      },
      orderBy: { createdAt: 'desc' },
    });

    assert.ok(authAudit, 'Authorization audit event for meeting.confirm_minutes must exist in DB');
    assert.strictEqual(authAudit.actorId, chairUser.id);
    assert.strictEqual(authAudit.action, 'meeting.confirm_minutes');
    assert.strictEqual(authAudit.entityType, 'Meeting');
    assert.strictEqual(authAudit.entityId, testMeeting.id);
    assert.strictEqual(authAudit.requestId, reqId);

    const meta = authAudit.metadata as Record<string, any>;
    assert.ok(meta, 'Audit metadata must be present');
    assert.strictEqual(meta.result, 'ALLOW');
    assert.ok('actingPositionAssignmentId' in meta);
    assert.ok('delegationGrantId' in meta);
  });

  test('6. createResolution writes authorization audit metadata upon successful mutation', async () => {
    const reqId = `req-create-res-${runId}`;
    const resolution = await MeetingService.createResolution(
      testMeeting.id,
      {
        code: `RES_AUD_${runId}`,
        title: 'Nghị quyết nâng cao năng lực kiểm toán',
        content: 'Nội dung thực thi...',
        createTask: false,
      },
      chairUser.id,
      reqId
    );

    assert.ok(resolution?.id, 'Resolution must be created');

    // Verify Authorization Audit Event was recorded for MeetingResolution
    const authAudit = await prisma.auditEvent.findFirst({
      where: {
        entityType: 'MeetingResolution',
        entityId: resolution.id,
        action: 'meeting.create_resolution',
      },
      orderBy: { createdAt: 'desc' },
    });

    assert.ok(authAudit, 'Authorization audit event for meeting.create_resolution must exist in DB');
    assert.strictEqual(authAudit.actorId, chairUser.id);
    assert.strictEqual(authAudit.action, 'meeting.create_resolution');
    assert.strictEqual(authAudit.entityType, 'MeetingResolution');
    assert.strictEqual(authAudit.entityId, resolution.id);
    assert.strictEqual(authAudit.requestId, reqId);

    const meta = authAudit.metadata as Record<string, any>;
    assert.ok(meta, 'Audit metadata must be present');
    assert.strictEqual(meta.result, 'ALLOW');
    assert.ok('actingPositionAssignmentId' in meta);
    assert.ok('delegationGrantId' in meta);
  });
});
