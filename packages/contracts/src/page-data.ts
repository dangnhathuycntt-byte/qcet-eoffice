/**
 * Dữ liệu trang web đọc từ API khi render ở server (D5): phiên `/api/auth/me`, cấu hình `/api/runtime-config`
 * và `GET /api/page-data/*` của năm trang có dữ liệu ban đầu. Ngày giờ là chuỗi ISO.
 *
 * Nhiệm vụ đã map (SchoolTask/StaffTask) dùng kiểu sẵn có trong `./types/dashboard`; schema chỉ kiểm có `id`
 * và giữ nguyên mọi trường như khi trang còn đọc service trực tiếp.
 */
import { z } from "zod";
import type { AgentModelCatalog } from "@qcet/shared/domain/agent/agent-models";
import { IsoDateStringSchema } from "./common";
import type { SchoolTask, StaffTask } from "./types/dashboard";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const hasStringId = (value: unknown) => isRecord(value) && typeof value.id === "string";

const SchoolTaskSchema = z.custom<SchoolTask>(hasStringId, "Nhiệm vụ không hợp lệ");
const StaffTaskSchema = z.custom<StaffTask>(hasStringId, "Nhiệm vụ không hợp lệ");
const NullableIsoDate = IsoDateStringSchema.nullable();

/* ---------------------------------------------------------------- phiên */

/** `GET /api/auth/me`: người dùng đang đăng nhập (tài khoản còn hoạt động) hoặc `authenticated: false`. */
export const AuthMeResponseSchema = z.object({
  authenticated: z.boolean(),
  user: z
    .looseObject({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      role: z.string(),
      departmentId: z.string().nullable().optional(),
    })
    .nullable(),
});
export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;
export type AuthMeUser = NonNullable<AuthMeResponse["user"]>;

/* ---------------------------------------------------------- cấu hình runtime */

export interface PublicRuntimeFeatures {
  googleAuth: boolean;
  webPush: boolean;
  academicCalendarSync: boolean;
  offlineSupport: boolean;
  pushNotifications: boolean;
  externalGoogleLogin: boolean;
  offlineMutations: boolean;
  largeExcelExport: boolean;
  taskWorkspaceV2: boolean;
  mobileAgenda: boolean;
  newExecutiveDashboard: boolean;
  uxTasksV5: boolean;
  uxCalendarV5: boolean;
  uxNotificationsV5: boolean;
  uxDocumentsV5: boolean;
  uxOrgV5: boolean;
  digitalSignature: boolean;
  outgoingDocuments: boolean;
  internalDocuments: boolean;
  userProvisioning: boolean;
  taskAgent: boolean;
  assistant: boolean;
  [key: string]: boolean;
}

export interface PublicRuntimeConfig {
  environment: "development" | "production" | "test";
  features: PublicRuntimeFeatures;
  version: string;
  buildId: string;
  appUrl?: string;
  referenceDate?: string;
  /** Model chọn được ở ô soạn của Trợ lý và Agent tạo nhiệm vụ (khi bật một trong hai); mã model không phải bí mật. */
  agentModels?: AgentModelCatalog;
}

/** `GET /api/runtime-config`: cờ tính năng công khai, mọi giá trị trong `features` là boolean. */
export const PublicRuntimeConfigSchema = z.custom<PublicRuntimeConfig>(
  (value) =>
    isRecord(value) &&
    isRecord(value.features) &&
    Object.values(value.features).every((flag) => typeof flag === "boolean"),
  "Cấu hình runtime không hợp lệ",
);

/* ---------------------------------------------------------------- trang */

/** Người dùng hiện tại truyền vào giao diện chi tiết (vai trò dùng để hiện nút thao tác, server vẫn kiểm quyền). */
export const PageUserSchema = z.object({ id: z.string(), name: z.string(), role: z.string() });

/** `GET /api/page-data/tasks?view=`: nhiệm vụ gốc theo góc nhìn, kèm `availableActions`. */
export const TasksPageDataSchema = z.object({ tasks: z.array(SchoolTaskSchema) });
export type TasksPageData = z.infer<typeof TasksPageDataSchema>;

export const TaskAuditEventSchema = z.object({
  id: z.string(),
  action: z.string(),
  timestamp: IsoDateStringSchema,
  actorName: z.string().optional(),
  actorId: z.string().optional(),
  description: z.string().optional(),
});

/**
 * `GET /api/page-data/tasks/[id]?<query của trang>`: chuyển về nhiệm vụ gốc (đường dẫn tương đối)
 * hoặc dữ liệu để vẽ. Không có hoặc không được đọc: 404.
 */
export const TaskDetailPageDataSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("redirect"), redirectTo: z.string().regex(/^\/(?![/\\])/) }),
  z.object({
    outcome: z.literal("render"),
    task: z.union([SchoolTaskSchema, StaffTaskSchema]),
    auditEvents: z.array(TaskAuditEventSchema),
    canEdit: z.boolean(),
    peekTasks: z.array(StaffTaskSchema).optional(),
    currentUser: PageUserSchema.extend({ email: z.string(), department: z.string() }),
  }),
]);
export type TaskDetailPageData = z.infer<typeof TaskDetailPageDataSchema>;

/** Cuộc họp trong tháng học hiện tại cho trang Lịch; các trường khác giữ nguyên. */
export const CalendarMeetingSchema = z.looseObject({
  id: z.string(),
  title: z.string(),
  startTime: IsoDateStringSchema,
  endTime: NullableIsoDate.optional(),
});

/** `GET /api/page-data/calendar`: nhiệm vụ và cuộc họp ban đầu của trang Lịch. */
export const CalendarPageDataSchema = z.object({
  initialTasks: z.array(SchoolTaskSchema),
  initialMeetings: z.array(CalendarMeetingSchema),
});
export type CalendarPageData = z.infer<typeof CalendarPageDataSchema>;

const MeetingParticipantSchema = z.looseObject({
  id: z.string(),
  meetingId: z.string(),
  userId: z.string(),
  role: z.string(),
  attendanceStatus: z.string(),
  notes: z.string().nullable(),
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema,
  user: z.object({ name: z.string().nullable(), email: z.string() }),
});

const MeetingResolutionSchema = z.looseObject({
  id: z.string(),
  meetingId: z.string(),
  code: z.string().nullable(),
  title: z.string(),
  content: z.string(),
  leadUnitId: z.string().nullable(),
  leadUserId: z.string().nullable(),
  deadline: NullableIsoDate,
  resultingTaskId: z.string().nullable(),
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema,
  leadUnit: z.object({ name: z.string() }).nullable(),
  leadUser: z.object({ name: z.string().nullable() }).nullable(),
});

export const MeetingDetailSchema = z.looseObject({
  id: z.string(),
  title: z.string(),
  code: z.string().nullable(),
  bodyId: z.string().nullable(),
  unitId: z.string().nullable(),
  organizerId: z.string(),
  status: z.string(),
  startTime: IsoDateStringSchema,
  endTime: NullableIsoDate,
  location: z.string().nullable(),
  agenda: z.string().nullable(),
  minutes: z.string().nullable(),
  materialsUrl: z.string().nullable(),
  materialsFileObjectId: z.string().nullable(),
  minutesConfirmedAt: NullableIsoDate,
  minutesConfirmedById: z.string().nullable(),
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema,
  unit: z.object({ name: z.string(), code: z.string() }).nullable(),
  organizer: z.object({ name: z.string().nullable(), email: z.string() }).nullable(),
  participants: z.array(MeetingParticipantSchema),
  resolutions: z.array(MeetingResolutionSchema),
});

/** `GET /api/page-data/meetings/[id]`: chi tiết cuộc họp (đã kiểm meeting.read). Không có hoặc không được đọc: 404. */
export const MeetingDetailPageDataSchema = z.object({ meeting: MeetingDetailSchema, currentUser: PageUserSchema });
export type MeetingDetailPageData = z.infer<typeof MeetingDetailPageDataSchema>;

const PersonRefSchema = z.object({ id: z.string(), name: z.string(), email: z.string() });

export const DossierDetailSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  status: z.string(),
  classification: z.string(),
  storageLocation: z.string().nullable(),
  notes: z.string().nullable(),
  openedAt: IsoDateStringSchema,
  closedAt: NullableIsoDate,
  submittedArchiveAt: NullableIsoDate,
  archivedAt: NullableIsoDate,
  createdAt: IsoDateStringSchema,
  updatedAt: NullableIsoDate,
  owningUnit: z.object({ id: z.string(), name: z.string(), code: z.string() }),
  responsiblePerson: PersonRefSchema,
  archivedBy: PersonRefSchema.nullable(),
  retentionRule: z
    .object({ id: z.string(), code: z.string(), name: z.string(), durationYears: z.number().nullable() })
    .nullable(),
  items: z.array(
    z.object({
      id: z.string(),
      itemType: z.string(),
      itemId: z.string().nullable(),
      title: z.string(),
      documentNumber: z.string().nullable(),
      documentDate: NullableIsoDate,
      pageCount: z.number().nullable(),
      sequence: z.number().nullable(),
      notes: z.string().nullable(),
      addedAt: NullableIsoDate,
      addedBy: z.object({ id: z.string(), name: z.string() }).nullable(),
    }),
  ),
  itemCount: z.number(),
});

/** `GET /api/page-data/dossiers/[id]`: chi tiết hồ sơ (DossierService kiểm quyền đọc). Lỗi đọc: trang trả 404. */
export const DossierDetailPageDataSchema = z.object({ dossier: DossierDetailSchema, currentUser: PageUserSchema });
export type DossierDetailPageData = z.infer<typeof DossierDetailPageDataSchema>;
