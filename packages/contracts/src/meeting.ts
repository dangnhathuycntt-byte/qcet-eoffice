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
} from './prisma-enums';

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
      userId: z.string().min(1, 'userId là bắt buộc'),
      role: z.nativeEnum(MeetingParticipantRole).default(MeetingParticipantRole.ATTENDEE),
      notes: z.string().optional(),
    })
  ).max(500, 'Tối đa 500 người được mời khi tạo cuộc họp').optional(),
}).superRefine((value, ctx) => {
  // Máy chủ không tin giao diện: giờ kết thúc không sau giờ bắt đầu, hay một người mời hai lần, là yêu cầu sai (400),
  // không để rơi xuống CSDL thành lỗi ràng buộc (500).
  if (value.endTime && new Date(value.endTime).getTime() <= new Date(value.startTime).getTime()) {
    ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'Giờ kết thúc phải sau giờ bắt đầu' });
  }
  const seen = new Set<string>();
  (value.initialParticipants ?? []).forEach((participant, index) => {
    if (seen.has(participant.userId)) {
      ctx.addIssue({ code: 'custom', path: ['initialParticipants', index, 'userId'], message: 'Một người chỉ được mời một lần' });
    }
    seen.add(participant.userId);
  });
});

export type CreateMeetingInput = z.infer<typeof CreateMeetingSchema>;

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

export const ListOrganizationalBodiesQuerySchema = z.object({
  type: z.nativeEnum(OrganizationalBodyType).optional(),
  status: z.nativeEnum(BodyStatus).optional(),
});

export type ListOrganizationalBodiesQuery = z.infer<typeof ListOrganizationalBodiesQuerySchema>;

export const AddBodyMembershipSchema = z.object({
  userId: z.string().optional(),
  positionAssignmentId: z.string().optional(),
  role: z.nativeEnum(BodyMemberRole).default(BodyMemberRole.MEMBER),
  appointedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});

/**
 * Nhóm của trang Cuộc họp (các mục con ở sidebar, như Chờ xử lý / Đã xử lý của Văn bản), tính theo thời gian chứ không theo
 * trạng thái (người dùng báo cuộc họp hôm qua còn "Dự thảo chương trình" vẫn nằm ở Sắp diễn ra, 21/10/2026): "upcoming" là
 * cuộc họp chưa kết thúc (kể cả đang họp; xếp theo giờ họp tăng dần), "done" là đã qua giờ kết thúc, không ghi giờ kết thúc
 * thì tính theo giờ bắt đầu. Cuộc họp đã hủy chỉ thấy ở "Tất cả". Máy chủ lọc ở `meetingBucketWhere` (meeting-service).
 */
export const MEETING_BUCKETS = ['upcoming', 'done'] as const;
export type MeetingBucket = (typeof MEETING_BUCKETS)[number];

/** Cột sắp xếp của trang Cuộc họp (đầu cột và tùy chọn hiển thị); không truyền thì theo nhóm (sắp diễn ra: gần nhất trước). */
export const MEETING_SORT_FIELDS = ['startTime', 'createdAt', 'title'] as const;
export type MeetingSortField = (typeof MEETING_SORT_FIELDS)[number];

export const ListMeetingsQuerySchema = z.object({
  bodyId: z.string().optional(),
  unitId: z.string().optional(),
  status: z.nativeEnum(MeetingStatus).optional(),
  bucket: z.enum(MEETING_BUCKETS).optional(),
  search: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sort: z.enum(MEETING_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

export type ListMeetingsQuery = z.infer<typeof ListMeetingsQuerySchema>;

/** Hủy cuộc họp (chưa họp): lý do tùy chọn, ghi vào nhật ký. */
export const CancelMeetingSchema = z.object({ reason: z.string().trim().max(500).optional() }).strict();
export type CancelMeetingInput = z.infer<typeof CancelMeetingSchema>;
