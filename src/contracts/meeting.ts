/**
 * QCET E-Office — Meeting, Institutional Bodies & Resolutions Contracts (Phase 8)
 * Conforms to Decree 30/2020, Decision 283/QCET, and QCET Work Regulations.
 */

import { z } from 'zod';
import {
  MeetingStatus,
  MeetingParticipantRole,
  AttendanceStatus,
  OrganizationalBodyType,
  BodyMemberRole,
  BodyStatus,
} from '@prisma/client';

export const CreateMeetingSchema = z.object({
  title: z.string().min(3, 'Tiêu đề cuộc họp tối thiểu 3 ký tự').max(500),
  code: z.string().max(100).optional(),
  bodyId: z.string().optional(),
  unitId: z.string().optional(),
  startTime: z.string().datetime({ message: 'Thời gian bắt đầu không hợp lệ (ISO format)' }),
  endTime: z.string().datetime({ message: 'Thời gian kết thúc không hợp lệ (ISO format)' }).optional(),
  location: z.string().max(255).optional(),
  agenda: z.string().optional(),
  materialsUrl: z.string().optional(),
  initialParticipants: z.array(
    z.object({
      userId: z.string(),
      role: z.nativeEnum(MeetingParticipantRole).default(MeetingParticipantRole.ATTENDEE),
      notes: z.string().optional(),
    })
  ).optional(),
});

export type CreateMeetingInput = z.infer<typeof CreateMeetingSchema>;

export const UpdateMeetingSchema = z.object({
  title: z.string().min(3).max(500).optional(),
  code: z.string().max(100).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  location: z.string().max(255).optional(),
  agenda: z.string().optional(),
  materialsUrl: z.string().optional(),
});

export type UpdateMeetingInput = z.infer<typeof UpdateMeetingSchema>;

export const AddParticipantSchema = z.object({
  userId: z.string().min(1, 'userId là bắt buộc'),
  role: z.nativeEnum(MeetingParticipantRole).default(MeetingParticipantRole.ATTENDEE),
  notes: z.string().optional(),
});

export type AddParticipantInput = z.infer<typeof AddParticipantSchema>;

export const UpdateAttendanceSchema = z.object({
  attendanceStatus: z.nativeEnum(AttendanceStatus),
  notes: z.string().optional(),
});

export type UpdateAttendanceInput = z.infer<typeof UpdateAttendanceSchema>;

export const DraftMinutesSchema = z.object({
  minutes: z.string().min(10, 'Nội dung biên bản cuộc họp tối thiểu 10 ký tự'),
});

export type DraftMinutesInput = z.infer<typeof DraftMinutesSchema>;

export const ConfirmMinutesSchema = z.object({
  notes: z.string().optional(),
});

export type ConfirmMinutesInput = z.infer<typeof ConfirmMinutesSchema>;

export const CreateMeetingResolutionSchema = z.object({
  code: z.string().max(100).optional(),
  title: z.string().min(3, 'Tiêu đề quyết nghị tối thiểu 3 ký tự').max(500),
  content: z.string().min(5, 'Nội dung quyết nghị/chỉ đạo tối thiểu 5 ký tự'),
  leadUnitId: z.string().optional(),
  leadUserId: z.string().optional(),
  deadline: z.string().datetime().optional(),
  createTask: z.boolean().default(false),
  taskTitle: z.string().optional(),
});

export type CreateMeetingResolutionInput = z.infer<typeof CreateMeetingResolutionSchema>;

export const CreateOrganizationalBodySchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(3).max(255),
  type: z.nativeEnum(OrganizationalBodyType),
  establishedBy: z.string().max(255).optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional(),
  status: z.nativeEnum(BodyStatus).default(BodyStatus.ACTIVE),
});

export type CreateOrganizationalBodyInput = z.infer<typeof CreateOrganizationalBodySchema>;

export const AddBodyMembershipSchema = z.object({
  userId: z.string().optional(),
  positionAssignmentId: z.string().optional(),
  role: z.nativeEnum(BodyMemberRole).default(BodyMemberRole.MEMBER),
  appointedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type AddBodyMembershipInput = z.infer<typeof AddBodyMembershipSchema>;

export const ListMeetingsQuerySchema = z.object({
  bodyId: z.string().optional(),
  unitId: z.string().optional(),
  status: z.nativeEnum(MeetingStatus).optional(),
  search: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

export type ListMeetingsQuery = z.infer<typeof ListMeetingsQuerySchema>;
