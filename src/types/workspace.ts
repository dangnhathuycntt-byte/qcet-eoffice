import type { SchoolTask, StaffTask } from "./dashboard";
import type { UserRole } from "./auth";

export type WorkspaceRole = UserRole;
export type WorkspaceScope = "school" | "unit" | "my";

export type TaskPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type ApprovalDecision = "approved" | "revision_requested" | "rejected";

export interface DeliverableSubmissionPayload {
  taskId: string;
  deliverableName: string;
  url?: string;
  fileType?: string;
  note?: string;
}

export interface ApprovalActionPayload {
  taskId: string;
  decision: ApprovalDecision;
  expectedVersion?: number;
  comment?: string;
  reviewedByRole: UserRole;
  reviewedByName: string;
}

export interface StaffUrgencySummary {
  todayCount: number;
  thisWeekCount: number;
  waitingApprovalCount: number;
  revisionRequestedCount: number;
  completedCount: number;
}

export interface DepartmentHealthSummary {
  departmentCode: string;
  departmentName: string;
  totalTasks: number;
  completedTasks: number;
  delayedTasks: number;
  completionRate: number;
  healthStatus: "GREEN" | "YELLOW" | "RED";
}

export type WorkspaceZone = "portal" | "dashboard" | "tasks" | "calendar" | "org" | "documents";

export function parseZoneParam(param: string | null | undefined): WorkspaceZone {
  if (!param) return "dashboard"; // Fallback chuẩn xác về Bàn làm việc Cockpit
  const normalized = param.trim().toLowerCase();
  if (normalized === "portal" || normalized === "hub") return "portal";
  if (normalized === "dashboard" || normalized === "kpi") return "dashboard";
  if (
    normalized === "tasks" ||
    normalized === "work" ||
    normalized === "task" ||
    normalized === "cong-viec"
  ) {
    return "tasks";
  }
  if (normalized === "calendar" || normalized === "lich") return "calendar";
  if (
    normalized === "documents" ||
    normalized === "van-ban" ||
    normalized === "cong-van" ||
    normalized === "docs"
  ) {
    return "documents";
  }
  if (
    normalized === "org" ||
    normalized === "directory" ||
    normalized === "to-chuc" ||
    normalized === "danh-ba"
  ) {
    return "org";
  }
  return "dashboard";
}

export interface SchoolBottleneckItem {
  id: string;
  title: string;
  departmentCode: string;
  departmentName: string;
  assigneeName: string;
  dueDate: string;
  daysRemaining?: number | null;
  daysOverdue?: number;
  isOverdue?: boolean;
  isBlocked: boolean;
  blockedReason?: string;
  priority?: "KHAN_CAP" | "CAO" | "TRUNG_BINH" | "THAP" | string;
  status?: string;
  progressPercent?: number;
  taskType?: "SCHOOL_TASK" | "STAFF_TASK";
  parentSchoolTaskId?: string;
  originalTask: SchoolTask | StaffTask;
}

export type OwnershipRoleFilter = 'ALL' | 'LEADING' | 'PARTICIPATING';

export interface AssigneeWorkloadItem {
  assigneeName: string;
  assigneeId?: string;
  count: number;
  completedCount: number;
}
