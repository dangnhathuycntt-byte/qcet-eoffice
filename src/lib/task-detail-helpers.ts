/**
 * src/lib/task-detail-helpers.ts
 *
 * Pure utility functions extracted from task-detail-side-sheet.tsx.
 * These helpers are side-effect free and independently unit-testable.
 *
 * Importers previously coupled to the 2400-line side-sheet component
 * should update their imports to this module.
 */

import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import { isSchoolTask } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import type { DelegationRule } from "@/types/delegation";
import {
  evaluateTaskCapabilityMatrix,
  type DelegationContract as TaskDelegationContract,
  type TaskActorContract,
  type TaskCapabilityMatrix,
  type TaskEntityContract,
  type TaskCapabilityEvaluationResult,
} from "@/domain/tasks/contract";
import {
  mapDbStatusToLifecycle,
  type TaskLifecycleStatus,
} from "@/domain/tasks/canonical-semantics";

// ── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Định dạng chuỗi ISO date sang DD/MM/YYYY theo chuẩn hành chính Việt Nam.
 * Trả về "Chưa đặt" khi thiếu giá trị.
 */
export function formatDetailDate(dateStr?: string): string {
  if (!dateStr) return "Chưa đặt";
  try {
    const clean = dateStr.split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

/**
 * Tính khoảng cách thời gian tương đối đến hạn nhiệm vụ với màu sắc theo ngữ cảnh.
 * Trả về null khi không có ngày hạn.
 */
export function getRelativeDueTime(
  dueDate?: string | Date
): { text: string; color: string } | null {
  if (!dueDate) return null;
  const target = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  if (isNaN(target.getTime())) return null;

  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      text: `Quá hạn ${Math.abs(diffDays)} ngày`,
      color: "border-red-500/30 bg-red-500/10 text-red-700",
    };
  }
  if (diffDays === 0) {
    return {
      text: "Hạn hôm nay",
      color: "border-amber-500/30 bg-amber-500/10 text-amber-700",
    };
  }
  if (diffDays === 1) {
    return {
      text: "Còn 1 ngày",
      color: "border-amber-500/30 bg-amber-500/10 text-amber-700",
    };
  }
  return {
    text: `Còn ${diffDays} ngày`,
    color: "border-border/60 bg-muted/40 text-muted-foreground",
  };
}

// ── Status / level display config ────────────────────────────────────────────

export const TASK_LEVEL_CONFIG = {
  TRUONG: {
    label: "Nhiệm vụ cấp Trường",
    variant: "secondary" as const,
    className:
      "border-blue-500/20 bg-blue-500/10 text-blue-700 font-semibold px-2.5 py-0.5",
  },
  DON_VI: {
    label: "Công việc Đơn vị",
    variant: "outline" as const,
    className:
      "border-border/60 bg-muted/40 text-muted-foreground font-semibold px-2.5 py-0.5",
  },
};

export const TASK_STATUS_CONFIG: Record<
  TaskStatus,
  {
    label: string;
    className: string;
    variant: "destructive" | "progress" | "warning" | "success" | "outline";
  }
> = {
  NEW: {
    label: "Mới",
    className: "border-border/60 bg-muted/40 text-muted-foreground",
    variant: "outline",
  },
  NOT_STARTED: {
    label: "Chưa bắt đầu",
    className: "border-border/60 bg-muted/40 text-muted-foreground",
    variant: "outline",
  },
  IN_PROGRESS: {
    label: "Đang thực hiện",
    className: "border-blue-500/20 bg-blue-500/10 text-blue-700",
    variant: "progress",
  },
  WAITING_APPROVAL: {
    label: "Chờ phê duyệt",
    className: "border-purple-500/20 bg-purple-500/10 text-purple-700",
    variant: "outline",
  },
  PENDING_EXECUTIVE_APPROVAL: {
    label: "Chờ BGH nghiệm thu",
    className: "border-purple-500/20 bg-purple-500/10 text-purple-700",
    variant: "outline",
  },
  NEEDS_REVIEW: {
    label: "Cần chỉnh sửa",
    className: "border-amber-500/20 bg-amber-500/10 text-amber-700",
    variant: "warning",
  },
  BLOCKED: {
    label: "Bị nghẽn / Phối hợp",
    className: "border-rose-500/20 bg-rose-500/10 text-rose-700",
    variant: "destructive",
  },
  COMPLETED: {
    label: "Hoàn thành",
    className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
    variant: "success",
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "border-border/60 bg-muted/40 text-muted-foreground",
    variant: "outline",
  },
};

export function getTaskLevelBadge(isSchool: boolean) {
  return isSchool ? TASK_LEVEL_CONFIG.TRUONG : TASK_LEVEL_CONFIG.DON_VI;
}

export function getDetailStatusConfig(status: TaskStatus | string) {
  if (status in TASK_STATUS_CONFIG) {
    return TASK_STATUS_CONFIG[status as TaskStatus];
  }
  return {
    label: status || "Chưa rõ",
    className: "border-border/60 bg-muted/40 text-muted-foreground",
    variant: "outline" as const,
  };
}

// ── Role / permission helpers ─────────────────────────────────────────────────

/**
 * Legacy role/name helpers (Decree 232 & DACUM).
 * Retained for backward-compatible callers.
 */
export function canUserSubmitDeliverable(
  task: StaffTask,
  actor?: AuthUser | null
): boolean {
  if (!actor) return false;
  const isAllowedStatus = task.status === "IN_PROGRESS" || task.status === "BLOCKED";
  const isAssignee = actor.name === task.assigneeName;
  return isAllowedStatus && isAssignee;
}

export function canUserReviewTask(
  task: StaffTask,
  actor?: AuthUser | null
): boolean {
  if (!actor) return false;
  if (task.status !== "NEEDS_REVIEW") return false;
  return actor.role === "MANAGER" || actor.role === "ADMIN";
}

/**
 * Statutory SchoolTask executive-closure gate (Điều lệ Trường Cao đẳng).
 */
export function canUserCloseSchoolTask(
  task: SchoolTask,
  actor?: AuthUser | null
): boolean {
  if (!actor) return false;
  if (task.status !== "PENDING_EXECUTIVE_APPROVAL") return false;
  return actor.role === "ADMIN";
}

// ── Capability matrix ─────────────────────────────────────────────────────────

export interface TaskAuditEvent {
  id: string;
  action: string;
  actorName?: string;
  timestamp: string;
  description?: string;
}

export interface TaskDetailCapabilities {
  matrix: TaskCapabilityMatrix;
  lifecycle: TaskLifecycleStatus;
  isTerminal: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
}

const EMPTY_DELEGATIONS: DelegationRule[] = [];

function toEngineStatus(lifecycle: TaskLifecycleStatus): string {
  switch (lifecycle) {
    case "NOT_STARTED":
      return "NEW";
    case "WAITING_APPROVAL":
      return "WAITING_APPROVAL";
    case "PENDING_EXECUTIVE_APPROVAL":
      return "PENDING_EXECUTIVE_APPROVAL";
    case "COMPLETED":
      return "COMPLETED";
    case "CANCELLED":
      return "CANCELLED";
    case "IN_PROGRESS":
    default:
      return "IN_PROGRESS";
  }
}

export function resolveTaskAssigneeId(
  task: SchoolTask | StaffTask | null | undefined,
  actor?: AuthUser | null
): string | null {
  if (!task) return null;
  if (isSchoolTask(task)) {
    if (task.leadAssigneeId) return task.leadAssigneeId;
    if (actor && task.leadAssigneeName && task.leadAssigneeName === actor.name) {
      return actor.id;
    }
    return null;
  }
  const staff = task as StaffTask;
  if (staff.assigneeId) return staff.assigneeId;
  if (actor && staff.assigneeName && staff.assigneeName === actor.name) {
    return actor.id;
  }
  return null;
}

function toTaskDelegationContract(rule: DelegationRule): TaskDelegationContract {
  const isApprovalScope =
    rule.scope === "DACUM_REVIEW_STEP1" ||
    rule.scope === "FULL_DEPARTMENT_APPROVAL";
  return {
    action: isApprovalScope ? "FULL_DEPARTMENT_APPROVAL" : rule.scope,
    granteeUserId: rule.granteeId,
    validFrom: rule.startDate,
    validUntil: rule.endDate,
    status: rule.status,
    revokedAt: rule.revokedAt,
  };
}

export function deriveTaskDetailCapabilities(
  task: SchoolTask | StaffTask | null | undefined,
  actor?: AuthUser | null,
  delegations: DelegationRule[] = EMPTY_DELEGATIONS
): TaskDetailCapabilities {
  const lifecycle = mapDbStatusToLifecycle(task?.status ?? "");
  const isTerminal = lifecycle === "COMPLETED" || lifecycle === "CANCELLED";

  const emptyMatrix = Object.fromEntries(
    ["CAN_VIEW", "CAN_EDIT", "CAN_SUBMIT", "CAN_APPROVE", "CAN_REJECT", "CAN_DELEGATE", "CAN_DELETE", "CAN_DOWNLOAD"].map(k => [k, false])
  ) as TaskCapabilityMatrix;

  if (!task || !actor) {
    return { matrix: emptyMatrix, lifecycle, isTerminal, canSubmit: false, canApprove: false, canReject: false };
  }

  const isSchool = isSchoolTask(task);
  const assigneeId = resolveTaskAssigneeId(task, actor);
  const departmentId = isSchool
    ? (task as SchoolTask).leadDepartmentCode ??
      (task as SchoolTask).departmentCode ?? null
    : (task as StaffTask).departmentCode ?? null;

  const actorContract: TaskActorContract = {
    id: actor.id,
    role: actor.role,
    departmentId: actor.departmentCode ?? null,
  };
  const entity: TaskEntityContract = {
    id: task.id,
    status: toEngineStatus(lifecycle),
    scope: isSchool ? "SCHOOL" : "DEPARTMENT",
    departmentId,
    primaryOwnerId: assigneeId,
    driId: assigneeId,
    assigneeIds: assigneeId ? [assigneeId] : [],
    assignees: assigneeId ? [{ userId: assigneeId }] : [],
    deliverables: isSchool ? [] :
      ((task as StaffTask).deliverables ?? []).map((d) => ({
        id: d.id, fileUrl: d.url ?? null,
      })),
  };

  const { matrix } = evaluateTaskCapabilityMatrix(
    actorContract, entity, delegations.map(toTaskDelegationContract)
  );
  return {
    matrix,
    lifecycle,
    isTerminal,
    canSubmit: matrix.CAN_SUBMIT,
    canApprove: matrix.CAN_APPROVE,
    canReject: matrix.CAN_REJECT,
  };
}

export function isTaskCompletedLifecycle(
  task: SchoolTask | StaffTask | null | undefined
): boolean {
  return mapDbStatusToLifecycle(task?.status ?? "") === "COMPLETED";
}

// ── Audit timeline ───────────────────────────────���────────────────────────────

export interface AuditTimelineEvent {
  id: string;
  label: string;
  timestamp: string;
  actor?: string;
  description?: string;
  type: "assigned" | "due" | "progress" | "status" | "updated";
}

export function getTaskAuditTimeline(
  task: SchoolTask | StaffTask
): AuditTimelineEvent[] {
  const events: AuditTimelineEvent[] = [];
  const isSchool = isSchoolTask(task);

  const assignedDate = isSchool
    ? task.assignedDate
    : (task.updatedAt || task.dueDate);
  events.push({
    id: "event-init",
    label: isSchool ? "Giao nhiệm vụ cấp Trường" : "Khởi tạo công việc đơn vị",
    timestamp: formatDetailDate(assignedDate),
    actor: isSchoolTask(task) ? "Ban Giám hiệu QCET" : (task.assigneeName || "Trưởng đơn vị"),
    description: isSchoolTask(task)
      ? `Giao cho cán bộ chủ trì: ${task.leadAssigneeName}`
      : `Phân công thực hiện: ${task.assigneeName}`,
    type: "assigned",
  });

  if (isSchoolTask(task) && task.totalSubTasks > 0) {
    events.push({
      id: "event-progress",
      label: "Tiến độ nhiệm vụ thành phần",
      timestamp: formatDetailDate(task.assignedDate),
      actor: `${task.completedSubTasks}/${task.totalSubTasks} nhiệm vụ thành phần`,
      description: `Đạt ${task.progressPercent}% tổng khối lượng công việc được giao`,
      type: "progress",
    });
  }

  const statusCfg = getDetailStatusConfig(task.status);
  events.push({
    id: "event-status",
    label: `Trạng thái: ${statusCfg.label}`,
    timestamp: formatDetailDate(isSchoolTask(task) ? task.dueDate : task.updatedAt),
    actor: isSchoolTask(task) ? task.leadAssigneeName : task.assigneeName,
    description:
      task.status === "COMPLETED"
        ? "Nhiệm vụ đã được nghiệm thu hoàn thành"
        : task.status === "NEEDS_REVIEW"
        ? "Đã nộp minh chứng / Yêu cầu rà soát và thẩm định nội dung"
        : task.status === "IN_PROGRESS"
        ? "Đang triển khai thực hiện theo kế hoạch"
        : task.status === "BLOCKED"
        ? "Đang bị nghẽn hoặc chờ phối hợp liên đơn vị"
        : "Tiếp nhận vào danh mục nhiệm vụ cần xử lý",
    type: "status",
  });

  if (task.dueDate) {
    events.push({
      id: "event-due",
      label: "Thời hạn hoàn thành",
      timestamp: formatDetailDate(task.dueDate),
      actor: isSchool ? task.leadAssigneeName : task.assigneeName,
      description: "Thời hạn báo cáo kết quả và kết thúc nhiệm vụ",
      type: "due",
    });
  }

  return events;
}
