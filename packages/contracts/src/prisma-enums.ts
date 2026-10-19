/**
 * Enum của Prisma dùng trong hợp đồng và domain, chép thành hằng số thuần để @qcet/contracts và @qcet/shared
 * (cả trình duyệt) không phải nạp @prisma/client. Giữ đúng tên, giá trị và thứ tự khóa của schema
 * (thông báo lỗi của z.nativeEnum liệt kê theo thứ tự này); test prisma-enums-parity so khớp với @prisma/client.
 * Sinh từ @prisma/client; thêm enum mới thì sinh lại theo cùng cách, không sửa tay giá trị.
 */

export const AssignmentType = {
  PRIMARY: "PRIMARY",
  CONCURRENT: "CONCURRENT",
  ACTING: "ACTING",
} as const;
export type AssignmentType = (typeof AssignmentType)[keyof typeof AssignmentType];

export const UnitType = {
  SCHOOL: "SCHOOL",
  FACULTY: "FACULTY",
  DEPARTMENT: "DEPARTMENT",
  CENTER: "CENTER",
  SECTION: "SECTION",
  OTHER: "OTHER",
} as const;
export type UnitType = (typeof UnitType)[keyof typeof UnitType];

export const JobCatalogGroup = {
  LDPU: "LDPU",
  VCMN: "VCMN",
  VCDC: "VCDC",
  HTPV: "HTPV",
} as const;
export type JobCatalogGroup = (typeof JobCatalogGroup)[keyof typeof JobCatalogGroup];

export const DelegationStatus = {
  ACTIVE: "ACTIVE",
  REVOKED: "REVOKED",
  EXPIRED: "EXPIRED",
  PENDING: "PENDING",
} as const;
export type DelegationStatus = (typeof DelegationStatus)[keyof typeof DelegationStatus];

export const DataClassification = {
  PUBLIC: "PUBLIC",
  INTERNAL: "INTERNAL",
  RESTRICTED: "RESTRICTED",
  PERSONAL_DATA: "PERSONAL_DATA",
} as const;
export type DataClassification = (typeof DataClassification)[keyof typeof DataClassification];

export const IncomingDocumentStatus = {
  RECEIVED: "RECEIVED",
  REGISTERED: "REGISTERED",
  PRESENTED: "PRESENTED",
  DIRECTED: "DIRECTED",
  ASSIGNED_TO_LEAD_UNIT: "ASSIGNED_TO_LEAD_UNIT",
  UNIT_ASSIGNED_PERSON: "UNIT_ASSIGNED_PERSON",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  FILED: "FILED",
  ARCHIVED: "ARCHIVED",
} as const;
export type IncomingDocumentStatus = (typeof IncomingDocumentStatus)[keyof typeof IncomingDocumentStatus];

export const MeetingStatus = {
  DRAFT_AGENDA: "DRAFT_AGENDA",
  INVITED: "INVITED",
  HELD: "HELD",
  MINUTES_DRAFT: "MINUTES_DRAFT",
  MINUTES_CONFIRMED: "MINUTES_CONFIRMED",
  CANCELLED: "CANCELLED",
} as const;
export type MeetingStatus = (typeof MeetingStatus)[keyof typeof MeetingStatus];

export const MeetingParticipantRole = {
  CHAIR: "CHAIR",
  SECRETARY: "SECRETARY",
  ATTENDEE: "ATTENDEE",
  INVITED_GUEST: "INVITED_GUEST",
} as const;
export type MeetingParticipantRole = (typeof MeetingParticipantRole)[keyof typeof MeetingParticipantRole];

export const AttendanceStatus = {
  INVITED: "INVITED",
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED",
  ATTENDED: "ATTENDED",
  ABSENT: "ABSENT",
} as const;
export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

export const OrganizationalBodyType = {
  COUNCIL: "COUNCIL",
  COMMITTEE: "COMMITTEE",
  STEERING_COMMITTEE: "STEERING_COMMITTEE",
  WORKING_GROUP: "WORKING_GROUP",
} as const;
export type OrganizationalBodyType = (typeof OrganizationalBodyType)[keyof typeof OrganizationalBodyType];

export const BodyMemberRole = {
  CHAIR: "CHAIR",
  VICE_CHAIR: "VICE_CHAIR",
  SECRETARY: "SECRETARY",
  MEMBER: "MEMBER",
} as const;
export type BodyMemberRole = (typeof BodyMemberRole)[keyof typeof BodyMemberRole];

export const BodyStatus = {
  ACTIVE: "ACTIVE",
  CONCLUDED: "CONCLUDED",
  SUSPENDED: "SUSPENDED",
  DISSOLVED: "DISSOLVED",
} as const;
export type BodyStatus = (typeof BodyStatus)[keyof typeof BodyStatus];

export const TaskStatus = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  WAITING_APPROVAL: "WAITING_APPROVAL",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const ApprovalStepStage = {
  UNIT_HEAD: "UNIT_HEAD",
  LEADER: "LEADER",
} as const;
export type ApprovalStepStage = (typeof ApprovalStepStage)[keyof typeof ApprovalStepStage];

export const ApprovalWorkflowStatus = {
  DRAFT: "DRAFT",
  WAITING_UNIT_HEAD: "WAITING_UNIT_HEAD",
  WAITING_LEADER: "WAITING_LEADER",
  APPROVED: "APPROVED",
  NEEDS_REVISION: "NEEDS_REVISION",
  REJECTED: "REJECTED",
} as const;
export type ApprovalWorkflowStatus = (typeof ApprovalWorkflowStatus)[keyof typeof ApprovalWorkflowStatus];

export const DocumentApprovalStepStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REVISION_REQUIRED: "REVISION_REQUIRED",
  REJECTED: "REJECTED",
  SKIPPED: "SKIPPED",
} as const;
export type DocumentApprovalStepStatus = (typeof DocumentApprovalStepStatus)[keyof typeof DocumentApprovalStepStatus];

export const DocumentStatus = {
  CHO_PHAN_CONG: "CHO_PHAN_CONG",
  DANG_XU_LY: "DANG_XU_LY",
  CHO_PHE_DUYET: "CHO_PHE_DUYET",
  DA_HOAN_THANH: "DA_HOAN_THANH",
  LUU_THEO_DOI: "LUU_THEO_DOI",
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];
