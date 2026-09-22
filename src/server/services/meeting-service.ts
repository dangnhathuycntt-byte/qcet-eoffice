import {
  assertTransition,
  assertMeetingNotFinalized,
  isMeetingFinalized,
  canTransition,
} from "@/domain/meetings";
/**
 * QCET E-Office — Meeting & Institutional Resolutions Domain Service (Phase 8 / Task 5)
 * Implements workflow: DRAFT_AGENDA -> INVITED -> HELD -> MINUTES_DRAFT -> MINUTES_CONFIRMED
 * Handles Meeting Resolutions, automated Task derivation, and canonical authorization.
 */

import { prisma } from '@/lib/prisma';
import {
  MeetingStatus,
  MeetingParticipantRole,
  AttendanceStatus,
  Prisma,
} from '@prisma/client';
import {
  CreateMeetingInput,
  AddParticipantInput,
  UpdateAttendanceInput,
  DraftMinutesInput,
  ConfirmMinutesInput,
  CreateMeetingResolutionInput,
  ListMeetingsQuery,
} from '@/contracts/meeting';
import { logAuditEvent, AuditAction } from '@/lib/db/audit';
import { publishOutboxEvent } from '@/lib/db/outbox';
import { TaskCommandService } from '@/server/tasks/task-command-service';
import { loadAuthorizationContext } from '@/server/authorization/authorization-context-service';
import type { AuthorizationContext } from '@/server/authorization/authorization-context';
import {
  authorize,
  AuthorizationResource,
  isExecutivePosition,
  isUnitLeaderPosition,
  computeAvailableActions,
  recordAuthorizationDecision,
  extractAuditFromDecision,
} from '@/server/authorization';
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from '@/server/api/errors';

export function buildMeetingResource(meeting: {
  id: string;
  unitId?: string | null;
  bodyId?: string | null;
  status?: any;
  organizerId?: string;
  participants?: Array<{ userId: string; role: MeetingParticipantRole | string }>;
  body?: { memberships?: Array<{ userId?: string | null }> } | null;
}): AuthorizationResource {
  const participantIds = meeting.participants?.map((p) => p.userId) || [];
  const chairParticipant = meeting.participants?.find(
    (p) => p.role === MeetingParticipantRole.CHAIR || p.role === 'CHAIR'
  );
  const secretaryParticipant = meeting.participants?.find(
    (p) => p.role === MeetingParticipantRole.SECRETARY || p.role === 'SECRETARY'
  );
  const bodyMemberIds = (meeting.body?.memberships || [])
    .map((m) => m.userId)
    .filter((id): id is string => Boolean(id));

  return {
    type: 'meeting',
    id: meeting.id,
    unitId: meeting.unitId || undefined,
    bodyId: meeting.bodyId || undefined,
    status: meeting.status,
    organizerId: meeting.organizerId,
    chairId: chairParticipant?.userId,
    chairIds: chairParticipant?.userId ? [chairParticipant.userId] : [],
    secretaryId: secretaryParticipant?.userId,
    secretaryIds: secretaryParticipant?.userId ? [secretaryParticipant.userId] : [],
    participantIds,
    bodyMemberIds,
  };
}

export function buildMeetingReadWhere(
  context: AuthorizationContext
): Prisma.MeetingWhereInput {
  // Executive leadership (HIEU_TRUONG, PHO_HIEU_TRUONG, etc.) sees all school meetings
  const isExecutive = context.positions?.some((p) =>
    isExecutivePosition(p.positionCode)
  );
  if (isExecutive) {
    return {};
  }

  const orConditions: Prisma.MeetingWhereInput[] = [
    { organizerId: context.userId },
    { participants: { some: { userId: context.userId } } },
  ];

  if (context.bodyMemberships && context.bodyMemberships.length > 0) {
    const bodyIds = context.bodyMemberships
      .map((bm) => bm.bodyId)
      .filter((id): id is string => Boolean(id));
    if (bodyIds.length > 0) {
      orConditions.push({ bodyId: { in: bodyIds } });
    }
  }

  const unitLeaderUnitIds = (context.positions || [])
    .filter((p) => isUnitLeaderPosition(p.positionCode) && p.unitId)
    .map((p) => p.unitId as string);

  if (unitLeaderUnitIds.length > 0) {
    orConditions.push({ unitId: { in: unitLeaderUnitIds } });
  }

  const delegations = context.getActiveDelegationsForAction?.('meeting.read') || [];
  for (const d of delegations) {
    if (d.grantorPositionCode && isExecutivePosition(d.grantorPositionCode)) {
      return {};
    }
    for (const rule of d.scopeRules || []) {
      if (rule.entityType === 'unit' && rule.entityId) {
        orConditions.push({ unitId: rule.entityId });
      }
    }
  }

  return { OR: orConditions };
}

export class MeetingService {
  /**
   * 1. Khởi tạo cuộc họp (DRAFT_AGENDA)
   */
  static async createMeeting(
    input: CreateMeetingInput,
    contextOrOrganizerId: AuthorizationContext | string,
    requestId?: string
  ) {
    const authContext =
      typeof contextOrOrganizerId === 'string'
        ? await loadAuthorizationContext(contextOrOrganizerId)
        : contextOrOrganizerId;
    const organizerId = authContext.userId;

    const authResult = authorize(authContext, 'meeting.create', {
      type: 'meeting',
      id: '',
      organizerId,
      unitId: input.unitId,
      bodyId: input.bodyId,
    });
    if (!authResult.allowed) {
      throw new AuthorizationError(
        authResult.reason || 'Không có quyền tạo cuộc họp.',
        authResult.rejectionCode
      );
    }

    return prisma.$transaction(async (tx) => {
      const code = input.code || `MEET-${Date.now()}`;

      const meeting = await tx.meeting.create({
        data: {
          code,
          title: input.title,
          bodyId: input.bodyId,
          unitId: input.unitId,
          organizerId,
          status: input.initialParticipants && input.initialParticipants.length > 0
            ? MeetingStatus.INVITED
            : MeetingStatus.DRAFT_AGENDA,
          startTime: new Date(input.startTime),
          endTime: input.endTime ? new Date(input.endTime) : undefined,
          location: input.location,
          agenda: input.agenda,
          materialsUrl: input.materialsUrl,
        },
      });

      // Người tổ chức mặc định là SECRETARY trừ khi được chỉ định vai trò khác trong initialParticipants (ví dụ: CHAIR)
      const organizerRole =
        input.initialParticipants?.find((p) => p.userId === organizerId)?.role ||
        MeetingParticipantRole.SECRETARY;

      await tx.meetingParticipant.create({
        data: {
          meetingId: meeting.id,
          userId: organizerId,
          role: organizerRole,
          attendanceStatus: AttendanceStatus.ATTENDED,
        },
      });

      if (input.initialParticipants && input.initialParticipants.length > 0) {
        for (const p of input.initialParticipants) {
          if (p.userId !== organizerId) {
            await tx.meetingParticipant.create({
              data: {
                meetingId: meeting.id,
                userId: p.userId,
                role: p.role,
                notes: p.notes,
                attendanceStatus: AttendanceStatus.INVITED,
              },
            });
          }
        }
      }

      await logAuditEvent(tx, {
        actorId: organizerId,
        action: AuditAction.TASK_CREATED,
        entityType: 'Meeting',
        entityId: meeting.id,
        requestId,
        afterData: { code: meeting.code, title: meeting.title, status: meeting.status },
      });

      return meeting;
    });
  }

  /**
   * 2. Mời thành viên tham gia cuộc họp
   */
  static async addParticipant(
    meetingId: string,
    input: AddParticipantInput,
    contextOrUserId: AuthorizationContext | string,
    requestId?: string
  ) {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        body: { include: { memberships: true } },
        unit: true,
        participants: true,
      },
    });
    if (!meeting) {
      throw new NotFoundError('Cuộc họp không tồn tại');
    }

    const authContext =
      typeof contextOrUserId === 'string'
        ? await loadAuthorizationContext(contextOrUserId)
        : contextOrUserId;

    const authResult = authorize(authContext, 'meeting.manage_participants', buildMeetingResource(meeting));
    if (!authResult.allowed) {
      throw new AuthorizationError(
        authResult.reason || 'Không có quyền quản lý thành phần tham dự cuộc họp.',
        authResult.rejectionCode
      );
    }

    assertMeetingNotFinalized(meeting.status, "mời thành viên tham gia");

    return prisma.$transaction(async (tx) => {
      const participant = await tx.meetingParticipant.upsert({
        where: {
          meetingId_userId: {
            meetingId,
            userId: input.userId,
          },
        },
        create: {
          meetingId,
          userId: input.userId,
          role: input.role,
          notes: input.notes,
          attendanceStatus: AttendanceStatus.INVITED,
        },
        update: {
          role: input.role,
          notes: input.notes,
        },
      });

      if (meeting.status === MeetingStatus.DRAFT_AGENDA) {
        assertTransition(meeting.status, MeetingStatus.INVITED);
        await tx.meeting.update({
          where: { id: meetingId },
          data: { status: MeetingStatus.INVITED },
        });
      }

      await publishOutboxEvent(tx, {
        eventType: 'MEETING_INVITED',
        aggregateType: 'Meeting',
        aggregateId: meetingId,
        payload: {
          meetingId,
          userId: input.userId,
          role: input.role,
          meetingTitle: meeting.title,
        },
      });

      return participant;
    });
  }

  /**
   * 3. Cập nhật trạng thái tham dự
   */
  static async updateAttendance(meetingId: string, userId: string, input: UpdateAttendanceInput) {
    return prisma.meetingParticipant.update({
      where: {
        meetingId_userId: {
          meetingId,
          userId,
        },
      },
      data: {
        attendanceStatus: input.attendanceStatus,
        notes: input.notes,
      },
    });
  }

  /**
   * 4. Diễn ra cuộc họp (INVITED -> HELD)
   */
  static async holdMeeting(
    meetingId: string,
    contextOrUserId: AuthorizationContext | string,
    requestId?: string
  ) {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        body: { include: { memberships: true } },
        unit: true,
        participants: true,
      },
    });
    if (!meeting) {
      throw new NotFoundError('Cuộc họp không tồn tại');
    }

    const authContext =
      typeof contextOrUserId === 'string'
        ? await loadAuthorizationContext(contextOrUserId)
        : contextOrUserId;

    const authResult = authorize(authContext, 'meeting.update', buildMeetingResource(meeting));
    if (!authResult.allowed) {
      throw new AuthorizationError(
        authResult.reason || 'Không có quyền cập nhật trạng thái cuộc họp.',
        authResult.rejectionCode
      );
    }

    assertTransition(meeting.status, MeetingStatus.HELD);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.meeting.update({
        where: { id: meetingId },
        data: {
          status: MeetingStatus.HELD,
        },
      });

      await logAuditEvent(tx, {
        actorId: authContext.userId,
        action: AuditAction.TASK_STATUS_CHANGED,
        entityType: 'Meeting',
        entityId: meetingId,
        requestId,
        beforeData: { status: meeting.status },
        afterData: { status: MeetingStatus.HELD },
      });

      return updated;
    });
  }

  /**
   * 5. Soạn biên bản cuộc họp (HELD -> MINUTES_DRAFT)
   */
  static async draftMinutes(
    meetingId: string,
    input: DraftMinutesInput,
    contextOrUserId: AuthorizationContext | string,
    requestId?: string
  ) {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        body: { include: { memberships: true } },
        unit: true,
        participants: true,
      },
    });
    if (!meeting) {
      throw new NotFoundError('Cuộc họp không tồn tại');
    }

    const authContext =
      typeof contextOrUserId === 'string'
        ? await loadAuthorizationContext(contextOrUserId)
        : contextOrUserId;

    const authResult = authorize(authContext, 'meeting.draft_minutes', buildMeetingResource(meeting));
    if (!authResult.allowed) {
      if (authResult.rejectionCode === 'INVALID_WORKFLOW_STATE') {
        throw new ValidationError(
          authResult.reason || 'Trạng thái cuộc họp không hợp lệ để soạn biên bản.'
        );
      }
      throw new AuthorizationError(
        authResult.reason || 'Không có quyền lập dự thảo biên bản cuộc họp.',
        authResult.rejectionCode
      );
    }

    assertTransition(meeting.status, MeetingStatus.MINUTES_DRAFT);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.meeting.update({
        where: { id: meetingId },
        data: {
          minutes: input.minutes,
          status: MeetingStatus.MINUTES_DRAFT,
        },
      });

      await logAuditEvent(tx, {
        actorId: authContext.userId,
        action: AuditAction.TASK_STATUS_CHANGED,
        entityType: 'Meeting',
        entityId: meetingId,
        requestId,
        afterData: { status: MeetingStatus.MINUTES_DRAFT },
      });

      return updated;
    });
  }

  /**
   * 6. Phê duyệt/Xác nhận biên bản (MINUTES_DRAFT -> MINUTES_CONFIRMED)
   */
  static async confirmMinutes(
    meetingId: string,
    input: ConfirmMinutesInput,
    contextOrUserId: AuthorizationContext | string,
    requestId?: string
  ) {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        body: { include: { memberships: true } },
        unit: true,
        participants: true,
      },
    });
    if (!meeting) {
      throw new NotFoundError('Cuộc họp không tồn tại');
    }

    const authContext =
      typeof contextOrUserId === 'string'
        ? await loadAuthorizationContext(contextOrUserId)
        : contextOrUserId;

    // Fail-safe Maker-Checker SoD check under RFC-10: Secretary cannot confirm minutes
    const meetingResource = buildMeetingResource(meeting);
    if (
      meetingResource.secretaryId === authContext.userId ||
      meetingResource.secretaryIds?.includes(authContext.userId)
    ) {
      throw new AuthorizationError(
        'Vi phạm nguyên tắc phân lập trách nhiệm (SoD): Thư ký lập biên bản không được tự xác nhận biên bản cuộc họp.',
        'SOD_VIOLATION'
      );
    }

    const authResult = authorize(authContext, 'meeting.confirm_minutes', meetingResource);
    if (!authResult.allowed) {
      await recordAuthorizationDecision(
        extractAuditFromDecision(
          authResult,
          authContext,
          'meeting.confirm_minutes',
          'Meeting',
          meetingId,
          requestId
        )
      );
      if (authResult.rejectionCode === 'INVALID_WORKFLOW_STATE') {
        throw new ValidationError(
          authResult.reason || 'Trạng thái cuộc họp không hợp lệ để xác nhận biên bản.'
        );
      }
      throw new AuthorizationError(
        authResult.reason || 'Không có thẩm quyền xác nhận biên bản cuộc họp.',
        authResult.rejectionCode
      );
    }

    assertTransition(meeting.status, MeetingStatus.MINUTES_CONFIRMED);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.meeting.update({
        where: { id: meetingId },
        data: {
          status: MeetingStatus.MINUTES_CONFIRMED,
          minutesConfirmedAt: new Date(),
          minutesConfirmedById: authContext.userId,
        },
      });

      await recordAuthorizationDecision(
        tx,
        extractAuditFromDecision(
          authResult,
          authContext,
          'meeting.confirm_minutes',
          'Meeting',
          meetingId,
          requestId
        )
      );

      await logAuditEvent(tx, {
        actorId: authContext.userId,
        action: AuditAction.TASK_APPROVED,
        entityType: 'Meeting',
        entityId: meetingId,
        requestId,
        metadata: {
          confirmedBy: authContext.userId,
          notes: input.notes,
        },
      });

      await publishOutboxEvent(tx, {
        eventType: 'MEETING_MINUTES_CONFIRMED',
        aggregateType: 'Meeting',
        aggregateId: meetingId,
        payload: {
          meetingId,
          meetingTitle: meeting.title,
          confirmedById: authContext.userId,
          notes: input.notes,
        },
      });

      return updated;
    });
  }

  /**
   * 7. Ban hành Quyết nghị / Kết luận cuộc họp (và tự động sinh Task nếu yêu cầu)
   * Tuân thủ Invariant 5.5: Gọi TaskCommandService.createFromMeetingResolution
   */
  static async createResolution(
    meetingId: string,
    input: CreateMeetingResolutionInput,
    contextOrUserId: AuthorizationContext | string,
    requestId?: string
  ) {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        body: { include: { memberships: true } },
        unit: true,
        participants: true,
      },
    });
    if (!meeting) {
      throw new NotFoundError('Cuộc họp không tồn tại');
    }

    const authContext =
      typeof contextOrUserId === 'string'
        ? await loadAuthorizationContext(contextOrUserId)
        : contextOrUserId;

    const authResult = authorize(authContext, 'meeting.create_resolution', buildMeetingResource(meeting));
    if (!authResult.allowed) {
      await recordAuthorizationDecision(
        extractAuditFromDecision(
          authResult,
          authContext,
          'meeting.create_resolution',
          'MeetingResolution',
          meetingId,
          requestId
        )
      );
      if (authResult.rejectionCode === 'INVALID_WORKFLOW_STATE') {
        throw new ValidationError(
          authResult.reason || 'Trạng thái cuộc họp không hợp lệ để ban hành quyết nghị.'
        );
      }
      throw new AuthorizationError(
        authResult.reason || 'Không có quyền ban hành quyết nghị cuộc họp.',
        authResult.rejectionCode
      );
    }

    return prisma.$transaction(async (tx) => {
      let resultingTaskId: string | undefined = undefined;

      // Invariant 5.5: Tạo Task qua TaskCommandService canonical command
      if (input.createTask) {
        const task = await TaskCommandService.createFromMeetingResolution(tx, {
          meetingId,
          meetingCode: meeting.code,
          meetingTitle: meeting.title,
          bodyId: meeting.bodyId,
          unitId: meeting.unitId,
          title: input.title,
          content: input.content,
          taskTitle: input.taskTitle,
          leadUnitId: input.leadUnitId || meeting.unitId,
          leadUserId: input.leadUserId,
          deadline: input.deadline,
          actorId: authContext.userId,
          requestId,
        });

        resultingTaskId = task.id;
      }

      const resolution = await tx.meetingResolution.create({
        data: {
          meetingId,
          code: input.code || `RES-${Date.now()}`,
          title: input.title,
          content: input.content,
          leadUnitId: input.leadUnitId || meeting.unitId,
          leadUserId: input.leadUserId,
          deadline: input.deadline ? new Date(input.deadline) : undefined,
          resultingTaskId,
        },
        include: {
          leadUnit: true,
          leadUser: {
            select: { id: true, name: true, email: true },
          },
          resultingTask: true,
        },
      });

      await recordAuthorizationDecision(
        tx,
        extractAuditFromDecision(
          authResult,
          authContext,
          'meeting.create_resolution',
          'MeetingResolution',
          resolution.id,
          requestId
        )
      );

      await logAuditEvent(tx, {
        actorId: authContext.userId,
        action: AuditAction.TASK_CREATED,
        entityType: 'MeetingResolution',
        entityId: resolution.id,
        requestId,
        afterData: {
          code: resolution.code,
          title: resolution.title,
          meetingId,
          resultingTaskId,
        },
      });

      await publishOutboxEvent(tx, {
        eventType: 'MEETING_RESOLUTION_CREATED',
        aggregateType: 'MeetingResolution',
        aggregateId: resolution.id,
        payload: {
          resolutionId: resolution.id,
          meetingId,
          title: resolution.title,
          resultingTaskId,
          leadUnitId: resolution.leadUnitId,
          leadUserId: resolution.leadUserId,
        },
      });

      return resolution;
    });
  }

  /**
   * Hủy cuộc họp (-> CANCELLED)
   */
  static async cancelMeeting(
    meetingId: string,
    contextOrUserId: AuthorizationContext | string,
    reason?: string,
    requestId?: string
  ) {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        body: { include: { memberships: true } },
        unit: true,
        participants: true,
      },
    });
    if (!meeting) {
      throw new NotFoundError("Cuộc họp không tồn tại");
    }

    const authContext =
      typeof contextOrUserId === "string"
        ? await loadAuthorizationContext(contextOrUserId)
        : contextOrUserId;

    const authResult = authorize(authContext, "meeting.update", buildMeetingResource(meeting));
    if (!authResult.allowed) {
      throw new AuthorizationError(
        authResult.reason || "Không có quyền hủy cuộc họp.",
        authResult.rejectionCode
      );
    }

    assertTransition(meeting.status, MeetingStatus.CANCELLED);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.meeting.update({
        where: { id: meetingId },
        data: {
          status: MeetingStatus.CANCELLED,
        },
      });

      await logAuditEvent(tx, {
        actorId: authContext.userId,
        action: AuditAction.TASK_STATUS_CHANGED,
        entityType: "Meeting",
        entityId: meetingId,
        requestId,
        beforeData: { status: meeting.status },
        afterData: { status: MeetingStatus.CANCELLED, reason },
      });

      return updated;
    });
  }

  /**
   * 8. Lấy chi tiết cuộc họp
   */
  static async getMeeting(
    meetingId: string,
    contextOrUserId?: AuthorizationContext | string
  ) {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        body: {
          include: {
            memberships: true,
          },
        },
        unit: true,
        organizer: {
          select: { id: true, name: true, email: true, role: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
        resolutions: {
          include: {
            leadUnit: true,
            leadUser: {
              select: { id: true, name: true, email: true },
            },
            resultingTask: {
              select: { id: true, title: true, status: true, dueDate: true },
            },
          },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundError('Cuộc họp không tồn tại');
    }

    if (contextOrUserId) {
      const authContext =
        typeof contextOrUserId === 'string'
          ? await loadAuthorizationContext(contextOrUserId)
          : contextOrUserId;

      const meetingResource = buildMeetingResource(meeting);
      const authResult = authorize(authContext, 'meeting.read', meetingResource);
      if (!authResult.allowed) {
        throw new AuthorizationError(
          authResult.reason || 'Không có quyền truy cập cuộc họp.',
          authResult.rejectionCode || 'INSUFFICIENT_RELATIONSHIP'
        );
      }

      const availableActions = computeAvailableActions(authContext, meetingResource);
      return { ...meeting, availableActions };
    }

    return meeting;
  }

  /**
   * 9. Danh sách cuộc họp với bộ lọc và ủy quyền
   */
  static async listMeetings(
    query: ListMeetingsQuery,
    contextOrUserId?: AuthorizationContext | string
  ) {
    const { bodyId, unitId, status, search, from, to, limit = 20, page = 1 } = query;

    let authWhere: Prisma.MeetingWhereInput = {};

    if (contextOrUserId) {
      const authContext =
        typeof contextOrUserId === 'string'
          ? await loadAuthorizationContext(contextOrUserId)
          : contextOrUserId;
      authWhere = buildMeetingReadWhere(authContext);
    }

    const clientFilterWhere: Prisma.MeetingWhereInput = {};

    if (bodyId) clientFilterWhere.bodyId = bodyId;
    if (unitId) clientFilterWhere.unitId = unitId;
    if (status) clientFilterWhere.status = status;

    if (from || to) {
      const timeFilter: Prisma.DateTimeFilter = {};
      if (from) timeFilter.gte = new Date(from);
      if (to) timeFilter.lte = new Date(to);
      clientFilterWhere.startTime = timeFilter;
    }

    if (search) {
      clientFilterWhere.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const where: Prisma.MeetingWhereInput = {
      AND: [authWhere, clientFilterWhere],
    };

    const [items, total] = await Promise.all([
      prisma.meeting.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { startTime: 'desc' },
        include: {
          body: true,
          unit: true,
          organizer: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: {
              participants: true,
              resolutions: true,
            },
          },
        },
      }),
      prisma.meeting.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
