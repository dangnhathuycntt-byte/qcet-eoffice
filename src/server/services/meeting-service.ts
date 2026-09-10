/**
 * QCET E-Office — Meeting & Institutional Resolutions Domain Service (Phase 8)
 * Implements workflow: DRAFT_AGENDA -> INVITED -> HELD -> MINUTES_DRAFT -> MINUTES_CONFIRMED
 * Handles Meeting Resolutions and automated Task derivation.
 */

import { prisma } from '@/lib/prisma';
import {
  MeetingStatus,
  MeetingParticipantRole,
  AttendanceStatus,
  TaskStatus,
  TaskOriginLevel,
  TaskActorRole,
  TaskPriority,
  TaskScope,
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
import { logAuditEvent, AuditAction, AuditEntityType } from '@/lib/db/audit';
import { publishOutboxEvent } from '@/lib/db/outbox';
import { getCurrentAcademicPeriod } from '@/lib/academic-calendar';

export class MeetingService {
  /**
   * 1. Khởi tạo cuộc họp (DRAFT_AGENDA)
   */
  static async createMeeting(input: CreateMeetingInput, organizerId: string, requestId?: string) {
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

      // Thêm người tổ chức làm thư ký hoặc người tham dự mặc định nếu chưa có
      await tx.meetingParticipant.create({
        data: {
          meetingId: meeting.id,
          userId: organizerId,
          role: MeetingParticipantRole.SECRETARY,
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

      await logAuditEvent(tx as any, {
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
  static async addParticipant(meetingId: string, input: AddParticipantInput, actorId: string, requestId?: string) {
    return prisma.$transaction(async (tx) => {
      const meeting = await tx.meeting.findUnique({ where: { id: meetingId } });
      if (!meeting) {
        throw new Error('Cuộc họp không tồn tại');
      }

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

      // Nếu cuộc họp đang ở DRAFT_AGENDA, chuyển sang INVITED
      if (meeting.status === MeetingStatus.DRAFT_AGENDA) {
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
  static async holdMeeting(meetingId: string, actorId: string, requestId?: string) {
    return prisma.$transaction(async (tx) => {
      const meeting = await tx.meeting.findUnique({ where: { id: meetingId } });
      if (!meeting) {
        throw new Error('Cuộc họp không tồn tại');
      }

      if (meeting.status !== MeetingStatus.INVITED && meeting.status !== MeetingStatus.DRAFT_AGENDA) {
        throw new Error(`Không thể chuyển sang HELD từ trạng thái ${meeting.status}`);
      }

      const updated = await tx.meeting.update({
        where: { id: meetingId },
        data: {
          status: MeetingStatus.HELD,
        },
      });

      await logAuditEvent(tx as any, {
        actorId,
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
  static async draftMinutes(meetingId: string, input: DraftMinutesInput, actorId: string, requestId?: string) {
    return prisma.$transaction(async (tx) => {
      const meeting = await tx.meeting.findUnique({ where: { id: meetingId } });
      if (!meeting) {
        throw new Error('Cuộc họp không tồn tại');
      }

      if (meeting.status !== MeetingStatus.HELD && meeting.status !== MeetingStatus.MINUTES_DRAFT) {
        throw new Error(`Biên bản chỉ được soạn khi cuộc họp đã diễn ra (HELD). Trạng thái hiện tại: ${meeting.status}`);
      }

      const updated = await tx.meeting.update({
        where: { id: meetingId },
        data: {
          minutes: input.minutes,
          status: MeetingStatus.MINUTES_DRAFT,
        },
      });

      await logAuditEvent(tx as any, {
        actorId,
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
  static async confirmMinutes(meetingId: string, input: ConfirmMinutesInput, actorId: string, requestId?: string) {
    return prisma.$transaction(async (tx) => {
      const meeting = await tx.meeting.findUnique({ where: { id: meetingId } });
      if (!meeting) {
        throw new Error('Cuộc họp không tồn tại');
      }

      if (meeting.status !== MeetingStatus.MINUTES_DRAFT) {
        throw new Error(`Chỉ có thể xác nhận biên bản khi đang ở trạng thái MINUTES_DRAFT. Trạng thái hiện tại: ${meeting.status}`);
      }

      const updated = await tx.meeting.update({
        where: { id: meetingId },
        data: {
          status: MeetingStatus.MINUTES_CONFIRMED,
          minutesConfirmedAt: new Date(),
          minutesConfirmedById: actorId,
        },
      });

      await logAuditEvent(tx as any, {
        actorId,
        action: AuditAction.TASK_APPROVED,
        entityType: 'Meeting',
        entityId: meetingId,
        requestId,
        metadata: { confirmedBy: actorId },
      });

      await publishOutboxEvent(tx, {
        eventType: 'MEETING_MINUTES_CONFIRMED',
        aggregateType: 'Meeting',
        aggregateId: meetingId,
        payload: {
          meetingId,
          meetingTitle: meeting.title,
          confirmedById: actorId,
        },
      });

      return updated;
    });
  }

  /**
   * 7. Ban hành Quyết nghị / Kết luận cuộc họp (và tự động sinh Task nếu yêu cầu)
   */
  static async createResolution(meetingId: string, input: CreateMeetingResolutionInput, actorId: string, requestId?: string) {
    return prisma.$transaction(async (tx) => {
      const meeting = await tx.meeting.findUnique({
        where: { id: meetingId },
        include: { unit: true, body: true },
      });
      if (!meeting) {
        throw new Error('Cuộc họp không tồn tại');
      }

      let resultingTaskId: string | undefined = undefined;

      // Nếu có yêu cầu sinh Task từ quyết nghị
      if (input.createTask) {
        const taskTitle = input.taskTitle || `[Kết luận ${meeting.code || 'họp'}] ${input.title}`;
        const dueDate = input.deadline ? new Date(input.deadline) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const taskCode = `RES-TASK-${Date.now()}`;
        const { month: academicMonth, academicYear } = getCurrentAcademicPeriod();

        const task = await tx.task.create({
          data: {
            code: taskCode,
            title: taskTitle,
            description: input.content,
            status: TaskStatus.IN_PROGRESS,
            originLevel: meeting.bodyId ? TaskOriginLevel.SCHOOL : TaskOriginLevel.UNIT,
            priority: TaskPriority.HIGH,
            scope: TaskScope.SCHOOL,
            dueDate,
            academicMonth,
            academicYear,
            createdById: actorId,
            leadUnitId: input.leadUnitId || meeting.unitId,
          },
        });

        // Thiết lập DRI nếu có leadUserId
        if (input.leadUserId) {
          await tx.taskActor.create({
            data: {
              taskId: task.id,
              userId: input.leadUserId,
              unitId: input.leadUnitId,
              role: TaskActorRole.DRI,
              isPrimaryDRI: true,
              assignedById: actorId,
            },
          });
        }

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
      });

      await logAuditEvent(tx as any, {
        actorId,
        action: AuditAction.TASK_CREATED,
        entityType: 'MeetingResolution',
        entityId: resolution.id,
        requestId,
        afterData: {
          resolutionCode: resolution.code,
          meetingId,
          resultingTaskId,
        },
      });

      await publishOutboxEvent(tx, {
        eventType: 'MEETING_RESOLUTION_ENACTED',
        aggregateType: 'MeetingResolution',
        aggregateId: resolution.id,
        payload: {
          resolutionId: resolution.id,
          resolutionCode: resolution.code,
          meetingId,
          resultingTaskId,
        },
      });

      return resolution;
    });
  }

  /**
   * 8. Lấy chi tiết cuộc họp
   */
  static async getMeeting(meetingId: string) {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        body: true,
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
      throw new Error('Cuộc họp không tồn tại');
    }

    return meeting;
  }

  /**
   * 9. Danh sách cuộc họp với bộ lọc
   */
  static async listMeetings(query: ListMeetingsQuery, currentUserId?: string) {
    const { bodyId, unitId, status, search, from, to, limit = 20, page = 1 } = query;

    const where: any = {};

    if (bodyId) where.bodyId = bodyId;
    if (unitId) where.unitId = unitId;
    if (status) where.status = status;

    if (from || to) {
      where.startTime = {};
      if (from) where.startTime.gte = new Date(from);
      if (to) where.startTime.lte = new Date(to);
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

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
            select: { participants: true, resolutions: true },
          },
        },
      }),
      prisma.meeting.count({ where }),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
