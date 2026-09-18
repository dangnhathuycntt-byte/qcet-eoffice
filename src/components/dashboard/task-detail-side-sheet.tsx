"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  X,
  ArrowLeft,
  MoreHorizontal,
  Calendar,
  User,
  Users,
  CheckCircle2,
  Circle,
  Plus,
  Layers,
  Clock,
  Tag,
  Building2,
  Briefcase,
  AlertTriangle,
  Play,
  RotateCcw,
  History,
  TrendingUp,
  FileText,
  FileCheck,
  ExternalLink,
  Link,
  Link2,
  ShieldCheck,
  ListTodo,
  Share2,
  Copy,
} from "lucide-react";
import { DashboardModalContext } from "@/components/dashboard/dashboard-context";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { fadeVariants, sideSheetVariants } from "@/lib/motion/variants";
import {
  type SchoolTask,
  type StaffTask,
  type TaskCategory,
  type TaskStatus,
  type DeliverableItem,
  type AIReviewSummary,
  type EscalationMeta,
  isSchoolTask,
} from "@/types/dashboard";

export { isSchoolTask };
import type { AuthUser } from "@/types/auth";
import type { DelegationRule } from "@/types/delegation";
import { canUserApproveTask } from "@/lib/delegation-authority-engine";
import { useAuth } from "@/lib/auth-context";
import {
  transitionStaffTaskStatus,
  validateDeliverableSubmission,
  screenDeliverablesWithAI,
} from "@/lib/dacum-workflow-engine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCategoryBadgeConfig } from "./cascading-task-table";
import { getSystemReferenceDate, isTaskOverdue } from "@/lib/academic-calendar";
import {
  evaluateTaskCapabilityMatrix,
  type DelegationContract as TaskDelegationContract,
  type TaskActorContract,
  type TaskCapabilityMatrix,
  type TaskEntityContract,
} from "@/domain/tasks/contract";
import {
  mapDbStatusToLifecycle,
  type TaskLifecycleStatus,
} from "@/domain/tasks/canonical-semantics";

/**
 * Stable empty delegation list shared across renders. A fresh `[]` default would
 * change identity on every render and force the approval/capability memos to
 * recompute; the exported helpers still accept an optional list.
 */
const EMPTY_DELEGATIONS: DelegationRule[] = [];

/**
 * Consolidated canonical label for child-task creation (T17).
 */
const ADD_SUBTASK_LABEL = "Thêm việc con";

/**
 * Restores logical focus (C12 / T19 / D9) to the element that opened the sheet.
 * Best-effort: never throws on close and never targets a detached node.
 */
function restoreLogicalFocus(el: HTMLElement | null): void {
  if (typeof document === "undefined") return;
  if (el && typeof el.focus === "function" && document.contains(el)) {
    try {
      el.focus({ preventScroll: true });
    } catch {
      /* focus restoration is best-effort and must never throw on close */
    }
  }
}

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
    className:
      "border-slate-500/20 bg-slate-500/10 text-slate-700",
    variant: "outline",
  },
  NOT_STARTED: {
    label: "Chưa bắt đầu",
    className:
      "border-slate-500/20 bg-slate-500/10 text-slate-700",
    variant: "outline",
  },
  IN_PROGRESS: {
    label: "Đang thực hiện",
    className:
      "border-blue-500/20 bg-blue-500/10 text-blue-700",
    variant: "progress",
  },
  WAITING_APPROVAL: {
    label: "Chờ phê duyệt",
    className:
      "border-purple-500/20 bg-purple-500/10 text-purple-700",
    variant: "outline",
  },
  PENDING_EXECUTIVE_APPROVAL: {
    label: "Chờ BGH nghiệm thu",
    className:
      "border-purple-500/20 bg-purple-500/10 text-purple-700",
    variant: "outline",
  },
  NEEDS_REVIEW: {
    label: "Cần chỉnh sửa",
    className:
      "border-amber-500/20 bg-amber-500/10 text-amber-700",
    variant: "warning",
  },
  BLOCKED: {
    label: "Bị nghẽn / Phối hợp",
    className:
      "border-rose-500/20 bg-rose-500/10 text-rose-700",
    variant: "destructive",
  },
  COMPLETED: {
    label: "Hoàn thành",
    className:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
    variant: "success",
  },
  OVERDUE: {
    label: "Quá hạn",
    className:
      "border-red-500/20 bg-red-500/10 text-red-700",
    variant: "destructive",
  },
  CANCELLED: {
    label: "Đã hủy",
    className:
      "border-slate-400/20 bg-slate-400/10 text-slate-600",
    variant: "outline",
  },
};

export function getTaskLevelBadge(isSchool: boolean) {
  return isSchool ? TASK_LEVEL_CONFIG.TRUONG : TASK_LEVEL_CONFIG.DON_VI;
}

export function getDetailStatusConfig(status: TaskStatus | string) {
  if (status === "PENDING_EXECUTIVE_APPROVAL") {
    return {
      label: "Chờ BGH nghiệm thu",
      className:
        "border-purple-500/20 bg-purple-500/10 text-purple-700",
      variant: "outline" as const,
    };
  }
  if (status in TASK_STATUS_CONFIG) {
    return TASK_STATUS_CONFIG[status as TaskStatus];
  }
  return {
    label: status || "Chưa rõ",
    className: "border-border/60 bg-muted/40 text-muted-foreground",
    variant: "outline" as const,
  };
}

/**
 * Legacy role/name helpers for Task Detail Side Sheet (Decree 232 & DACUM).
 *
 * These are retained for backward-compatible callers. The detail surface itself
 * no longer uses {@link canUserSubmitDeliverable} for submit gating: it consumes
 * the canonical capability projection from {@link deriveTaskDetailCapabilities}
 * so the decision derives from lifecycle + actor identity + server policy rather
 * than a display-name/status match (C2).
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
 * Statutory SchoolTask executive-closure gate (Điều lệ Trường Cao đẳng): only
 * Ban Giám hiệu (ADMIN) may close a school-level task that is awaiting
 * executive acceptance. Kept separate from the capability matrix because the
 * canonical engine does not model PENDING_EXECUTIVE_APPROVAL as approvable.
 */
export function canUserCloseSchoolTask(
  task: SchoolTask,
  actor?: AuthUser | null
): boolean {
  if (!actor) return false;
  if (task.status !== "PENDING_EXECUTIVE_APPROVAL") return false;
  return actor.role === "ADMIN";
}

/**
 * Real, server-authoritative audit record surfaced on the detail surface.
 *
 * These are append-only WORM audit events supplied by the server
 * (see src/lib/db/audit.ts getTaskAuditTrail). They must NEVER be synthesized on
 * the client: if no records are available the "Lịch sử" section renders a
 * truthful empty state instead.
 */
export interface TaskAuditEvent {
  id: string;
  /** Canonical AuditAction value, e.g. TASK_CREATED / DELIVERABLE_SUBMITTED. */
  action: string;
  actorName?: string;
  timestamp: string;
  description?: string;
}

/**
 * Presentation labels for real audit actions. This maps server enum values to
 * Vietnamese copy; it never invents events (an unknown action renders verbatim).
 */
const AUDIT_ACTION_LABELS: Record<string, string> = {
  TASK_CREATED: "Khởi tạo nhiệm vụ",
  TASK_UPDATED: "Cập nhật nhiệm vụ",
  TASK_ASSIGNED: "Phân công nhiệm vụ",
  STATUS_CHANGED: "Thay đổi trạng thái",
  DEADLINE_CHANGED: "Thay đổi thời hạn",
  APPROVED: "Phê duyệt",
  REJECTED: "Từ chối",
  REVISION_REQUESTED: "Yêu cầu chỉnh sửa",
  DELIVERABLE_SUBMITTED: "Nộp minh chứng",
  DELIVERABLE_REVIEWED: "Thẩm định minh chứng",
};

/**
 * Capability projection for the detail surface (C2 / C11 / T20).
 *
 * Capability is derived from lifecycle state + actor identity + server policy
 * (the canonical capability matrix) and delegations — never from a display name
 * or a raw role branch in this component. The SAME result is intended to drive
 * row, detail, bulk, context-menu and command entry points (C11): the matrix
 * module is the single owner.
 *
 * Scope note: this projection covers the submit and unit-review (approve /
 * reject) decisions. The SchoolTask executive closure remains governed by the
 * statutory BGH authority gate (`canUserCloseSchoolTask`) because the canonical
 * capability engine does not model the PENDING_EXECUTIVE_APPROVAL lifecycle as
 * an approvable state; the detail surface must not infer that authority from
 * the unit-review capability.
 */
export interface TaskDetailCapabilities {
  matrix: TaskCapabilityMatrix;
  lifecycle: TaskLifecycleStatus;
  isTerminal: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
}

/**
 * Normalizes a canonical lifecycle status into the exact token the capability
 * engine understands. OVERDUE is an in-progress task past its deadline, so it
 * must not silently lose submit/edit capability.
 */
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
    case "OVERDUE":
    default:
      return "IN_PROGRESS";
  }
}

/** Resolves the task's DRI/assignee stable id, falling back to a name match. */
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
    // The contract treats FULL_DEPARTMENT_APPROVAL as the approval grant token.
    action: isApprovalScope ? "FULL_DEPARTMENT_APPROVAL" : rule.scope,
    granteeUserId: rule.granteeId,
    validFrom: rule.startDate,
    validUntil: rule.endDate,
    status: rule.status,
    revokedAt: rule.revokedAt,
  };
}

/**
 * Derives the detail surface capabilities from the canonical capability matrix.
 * Pure and side-effect free so it is directly unit-testable and reusable by any
 * entry point (C11).
 */
export function deriveTaskDetailCapabilities(
  task: SchoolTask | StaffTask | null | undefined,
  actor?: AuthUser | null,
  delegations: DelegationRule[] = EMPTY_DELEGATIONS
): TaskDetailCapabilities {
  const lifecycle = mapDbStatusToLifecycle(task?.status ?? "");
  const isTerminal = lifecycle === "COMPLETED" || lifecycle === "CANCELLED";

  const emptyMatrix: TaskCapabilityMatrix = {
    CAN_VIEW: false,
    CAN_EDIT: false,
    CAN_SUBMIT: false,
    CAN_APPROVE: false,
    CAN_REJECT: false,
    CAN_DELEGATE: false,
    CAN_DELETE: false,
    CAN_DOWNLOAD: false,
  };

  if (!task || !actor) {
    return {
      matrix: emptyMatrix,
      lifecycle,
      isTerminal,
      canSubmit: false,
      canApprove: false,
      canReject: false,
    };
  }

  const isSchool = isSchoolTask(task);
  const assigneeId = resolveTaskAssigneeId(task, actor);
  const departmentId = isSchool
    ? (task as SchoolTask).leadDepartmentCode ??
      (task as SchoolTask).departmentCode ??
      null
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
    deliverables: isSchool
      ? []
      : ((task as StaffTask).deliverables ?? []).map((d) => ({
          id: d.id,
          fileUrl: d.url ?? null,
        })),
  };

  const { matrix } = evaluateTaskCapabilityMatrix(
    actorContract,
    entity,
    delegations.map(toTaskDelegationContract)
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

/** True only for lifecycle COMPLETED — completion is never derived from progress. */
export function isTaskCompletedLifecycle(
  task: SchoolTask | StaffTask | null | undefined
): boolean {
  return mapDbStatusToLifecycle(task?.status ?? "") === "COMPLETED";
}

function getInitials(name: string): string {
  if (!name) return "QC";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return (first + last).toUpperCase();
}

function getRelativeTimeString(
  dueDateStr?: string,
  isCompleted?: boolean
): { text: string; color: string } | null {
  if (isCompleted) {
    return {
      text: "Đã hoàn thành",
      color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
    };
  }
  if (!dueDateStr) return null;
  try {
    const now = new Date(getSystemReferenceDate() + "T00:00:00");
    const due = new Date(dueDateStr.split("T")[0] + "T00:00:00");
    const diffDays = Math.ceil(
      (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays < 0) {
      return {
        text: `Quá hạn ${Math.abs(diffDays)} ngày`,
        color: "text-rose-600 bg-rose-500/10 border-rose-500/20 font-bold",
      };
    }
    if (diffDays === 0) {
      return {
        text: "Hạn hôm nay",
        color: "text-amber-600 bg-amber-500/10 border-amber-500/20 font-bold",
      };
    }
    if (diffDays <= 3) {
      return {
        text: `Còn ${diffDays} ngày`,
        color: "text-amber-600 bg-amber-500/10 border-amber-500/20 font-medium",
      };
    }
    return {
      text: `Còn ${diffDays} ngày`,
      color: "text-blue-600 bg-blue-500/10 border-blue-500/20 font-medium",
    };
  } catch {
    return null;
  }
}

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

  // 1. Initial assignment / creation
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

  // 2. Progress milestone (for SchoolTask with subtasks)
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

  // 3. Status checkpoint
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

  // 4. Due date milestone
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

export interface ActivityNote {
  id: string;
  author: string;
  content: string;
  timestamp: string;
}

export interface TaskDetailSideSheetProps {
  task: SchoolTask | StaffTask | null;
  isOpen?: boolean;
  onClose: () => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onAddSubTask?: (parentSchoolTaskId: string, prefillTitle?: string) => void;
  onSelectSubTask?: (subTask: StaffTask | string) => void;
  parentSchoolTaskTitle?: string;
  className?: string;
  currentUser?: AuthUser;
  onUpdateStaffTask?: (updatedTask: StaffTask) => void;
  onCloseSchoolTask?: (schoolTaskId: string) => void;
  delegations?: DelegationRule[];
  /**
   * Real server audit events (append-only). Rendered verbatim under "Lịch sử";
   * never synthesized client-side. Absent/empty renders a truthful empty state.
   */
  auditEvents?: TaskAuditEvent[];
}

export function TaskDetailSideSheet({
  task: rawTask,
  isOpen,
  onClose,
  onStatusChange,
  onAddSubTask,
  onSelectSubTask,
  parentSchoolTaskTitle,
  className,
  currentUser,
  onUpdateStaffTask,
  onCloseSchoolTask,
  delegations = EMPTY_DELEGATIONS,
  auditEvents = [],
}: TaskDetailSideSheetProps) {
  const auth = useAuth();
  const user = currentUser ?? auth.user;
  const visible = isOpen !== undefined ? isOpen : rawTask !== null;
  const [mounted, setMounted] = React.useState(false);
  const lastTaskRef = React.useRef<SchoolTask | StaffTask | null>(rawTask);
  if (rawTask) {
    lastTaskRef.current = rawTask;
  }
  const task = rawTask || (visible ? null : lastTaskRef.current);
  const displayTask = task;
  const showContent = Boolean(visible && task);

  const dashboardModal = React.useContext(DashboardModalContext);

  const effectiveOnAddSubTask = React.useCallback(
    (parentSchoolTaskId: string, prefillTitle?: string) => {
      if (onAddSubTask) {
        onAddSubTask(parentSchoolTaskId, prefillTitle);
      } else if (dashboardModal?.openCreateModal) {
        dashboardModal.openCreateModal("DON_VI", parentSchoolTaskId, undefined, prefillTitle);
      }
    },
    [onAddSubTask, dashboardModal]
  );

  // Deliverable submission state (for StaffTask)
  const [deliverableName, setDeliverableName] = React.useState("");
  const [deliverableUrl, setDeliverableUrl] = React.useState("");
  const [deliverableNotes, setDeliverableNotes] = React.useState("");
  const [deliverableError, setDeliverableError] = React.useState<string | null>(null);
  const [deliverableSuccess, setDeliverableSuccess] = React.useState<string | null>(null);
  const [isSubmittingDeliverable, setIsSubmittingDeliverable] = React.useState(false);

  // Manager rejection modal state
  const [isRejectionModalOpen, setIsRejectionModalOpen] = React.useState(false);
  const [rejectionReasonInput, setRejectionReasonInput] = React.useState("");
  const [rejectionError, setRejectionError] = React.useState<string | null>(null);

  // Mobile overflow menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // SchoolTask executive feedback
  const [executiveActionFeedback, setExecutiveActionFeedback] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Reset local state whenever active task changes
  React.useEffect(() => {
    setDeliverableName("");
    setDeliverableUrl("");
    setDeliverableNotes("");
    setDeliverableError(null);
    setDeliverableSuccess(null);
    setIsRejectionModalOpen(false);
    setRejectionReasonInput("");
    setRejectionError(null);
    setExecutiveActionFeedback(null);
    setIsMobileMenuOpen(false);
  }, [task?.id]);

  // Handle ESC key and scroll lock
  React.useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isRejectionModalOpen) {
          setIsRejectionModalOpen(false);
        } else {
          onClose();
        }
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [visible, onClose, isRejectionModalOpen]);

  // AI Screening for NEEDS_REVIEW tasks (must be above early return to respect Rules of Hooks)
  const aiReview = React.useMemo(() => {
    if (!displayTask || isSchoolTask(displayTask) || displayTask.status !== "NEEDS_REVIEW") return null;
    return screenDeliverablesWithAI(displayTask as StaffTask);
  }, [displayTask]);

  // Permission evaluations & Stanford Authority Delegation Engine (must be above early return to respect Rules of Hooks)
  const isSchoolForPermission = displayTask ? isSchoolTask(displayTask) : false;
  const taskDepartmentCode =
    (!isSchoolForPermission && displayTask && (displayTask as StaffTask).departmentCode) ||
    (isSchoolForPermission && displayTask && (displayTask as SchoolTask).leadDepartmentCode) ||
    user?.departmentCode ||
    "";

  const taskAssigneeId =
    !isSchoolForPermission
      ? (displayTask && (displayTask as StaffTask).assigneeId) ||
        (user && displayTask && (displayTask as StaffTask).assigneeName === user.name ? user.id : undefined)
      : (displayTask && (displayTask as SchoolTask).leadAssigneeId) ||
        (user && displayTask && (displayTask as SchoolTask).leadAssigneeName === user.name ? user.id : undefined);

  const approvalResult = React.useMemo(() => {
    if (!user || !displayTask) {
      return { allowed: false, reason: "Chưa xác thực người dùng hoặc thiếu thông tin nhiệm vụ." };
    }
    return canUserApproveTask({
      actor: {
        id: user.id,
        name: user.name,
        role: user.role,
        departmentCode: user.departmentCode,
      },
      task: {
        id: displayTask.id,
        departmentCode: taskDepartmentCode,
        assigneeId: taskAssigneeId,
      },
      activeDelegations: delegations,
    });
  }, [user, displayTask, taskDepartmentCode, taskAssigneeId, delegations]);

  const capabilities = React.useMemo(
    () => deriveTaskDetailCapabilities(displayTask, user, delegations),
    [displayTask, user, delegations]
  );

  // C12 / T19 / D9 — capture the launcher element when the sheet OPENS and
  // restore logical focus to it when the sheet CLOSES. The canonical workspace
  // (unified-adaptive-workspace) and the calendar page keep this sheet mounted
  // and toggle `isOpen`, so restoration is keyed on the visible transition
  // rather than on component unmount; the same effect cleanup also covers
  // callers that conditionally mount the sheet (dashboard-modals-host).
  // Switching tasks while open (taskId change with `visible` unchanged) leaves
  // the effect untouched, preserving the original launcher.
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    if (!visible) return;
    const active = document.activeElement;
    // Never capture this sheet's own subtree as the launcher.
    if (
      active instanceof HTMLElement &&
      !active.closest('[data-slot="task-detail-side-sheet"]')
    ) {
      returnFocusRef.current = active;
    }
    return () => {
      restoreLogicalFocus(returnFocusRef.current);
      returnFocusRef.current = null;
    };
  }, [visible]);

  if (!mounted && !showContent) {
    return null;
  }

  if (!task) {
    return null;
  }

  const isSchool = isSchoolTask(task);
  const schoolTask = isSchool ? (task as SchoolTask) : null;
  const isDone = isTaskCompletedLifecycle(task);
  const levelBadge = getTaskLevelBadge(isSchool);
  const statusConfig = getDetailStatusConfig(task.status);
  const assigneeName = isSchool ? task.leadAssigneeName : task.assigneeName;
  const relativeTime = getRelativeTimeString(task.dueDate, isDone);
  const isOverdue = isTaskOverdue(task.status, task.dueDate);
  const derivedMilestones = getTaskAuditTimeline(task);
  const requiresReview = !isSchool && Boolean((task as StaffTask).requiresReview);
  const taskCode =
    (task as any).code ||
    (task as any).taskCode ||
    (task.id.startsWith("NV-") ? task.id : `NV-${task.id.slice(0, 8).toUpperCase()}`);

  // C2: submit is capability-driven (canonical matrix = lifecycle + actor
  // identity + server policy), never from the display-name/status helper. The
  // lifecycle guard keeps the submit affordance on the maker's active state
  // (BLOCKED still maps to in-progress) and stops re-offering it once the task
  // already awaits review.
  const canSubmitDeliverable =
    !isSchool &&
    capabilities.canSubmit &&
    capabilities.lifecycle === "IN_PROGRESS";
  // T20 / C2: review actions are capability-driven (lifecycle + actor identity +
  // server policy + delegations), never role-only. COMPLETED is terminal so the
  // matrix yields no review CTA; SoD blocks the submitter/maker.
  const canReview = !isSchool && capabilities.canApprove;
  const canRejectReview = !isSchool && capabilities.canReject;
  const actorIsAssignee = Boolean(user && resolveTaskAssigneeId(displayTask, user) === user.id);
  const isSeparationOfDutiesBlocked =
    !isSchool &&
    !approvalResult.allowed &&
    Boolean(
      (user?.id && taskAssigneeId && user.id === taskAssigneeId) ||
      (user && (displayTask as StaffTask).assigneeName === user.name)
    );
  const actorHasApprovalAuthority =
    !isSchool && !isSeparationOfDutiesBlocked && approvalResult.allowed;
  const canCloseSchool =
    isSchool && canUserCloseSchoolTask(displayTask as SchoolTask, user);

  // Deliverable submission handler (Staff)
  const handleSubmitDeliverable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSchool) return;

    setDeliverableError(null);
    setDeliverableSuccess(null);

    const deliverables: DeliverableItem[] = [];
    if (deliverableUrl.trim()) {
      deliverables.push({
        id: `deliv-${Date.now()}`,
        name: deliverableName.trim() || "Minh chứng kết quả công việc",
        url: deliverableUrl.trim(),
        submittedAt: new Date().toISOString(),
      });
    }

    const currentStaffTask = task as StaffTask;
    const existing = currentStaffTask.deliverables || [];
    const combinedDeliverables = [...existing, ...deliverables];
    const notes = deliverableNotes.trim() || currentStaffTask.deliverableDescription;

    const validation = validateDeliverableSubmission(
      currentStaffTask,
      combinedDeliverables,
      notes
    );
    if (!validation.valid) {
      setDeliverableError(
        validation.error ||
          "Theo quy định phân công và Nghị định 232, bắt buộc phải có sản phẩm minh chứng hoặc mô tả kết quả."
      );
      return;
    }

    setIsSubmittingDeliverable(true);
    const result = transitionStaffTaskStatus(
      currentStaffTask,
      "NEEDS_REVIEW",
      user,
      {
        deliverables: combinedDeliverables,
        notes: notes || undefined,
      }
    );
    setIsSubmittingDeliverable(false);

    if (result.success && result.updatedTask) {
      onStatusChange?.(task.id, "NEEDS_REVIEW");
      onUpdateStaffTask?.(result.updatedTask);
      setDeliverableSuccess(
        "Nộp minh chứng thành công! Công việc đã được chuyển sang Chờ duyệt."
      );
      setDeliverableName("");
      setDeliverableUrl("");
      setDeliverableNotes("");
    } else {
      setDeliverableError(result.error || "Không thể chuyển trạng thái công việc.");
    }
  };

  // Manager Approval: Nghiệm thu Đạt (COMPLETED)
  const handleManagerApprove = () => {
    if (!user || isSchool) return;
    const result = transitionStaffTaskStatus(
      task as StaffTask,
      "COMPLETED",
      user
    );
    if (result.success && result.updatedTask) {
      onStatusChange?.(task.id, "COMPLETED");
      onUpdateStaffTask?.(result.updatedTask);
    }
  };

  // Manager Rejection: Trả lại Yêu cầu Sửa (IN_PROGRESS) kèm lý do
  const handleManagerReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSchool) return;
    if (!rejectionReasonInput.trim()) {
      setRejectionError("Lý do trả lại yêu cầu chỉnh sửa bắt buộc phải được ghi rõ.");
      return;
    }

    const result = transitionStaffTaskStatus(
      task as StaffTask,
      "IN_PROGRESS",
      user,
      { rejectionReason: rejectionReasonInput.trim() }
    );

    if (result.success && result.updatedTask) {
      onStatusChange?.(task.id, "IN_PROGRESS");
      onUpdateStaffTask?.(result.updatedTask);
      setIsRejectionModalOpen(false);
      setRejectionReasonInput("");
      setRejectionError(null);
    } else {
      setRejectionError(result.error || "Không thể trả lại công việc.");
    }
  };

  // Executive Closure: Hiệu trưởng nghiệm thu đóng nhiệm vụ cấp Trường
  const handleExecutiveClose = () => {
    if (!user || !isSchool) return;
    if (task.status !== "PENDING_EXECUTIVE_APPROVAL") return;
    onStatusChange?.(task.id, "COMPLETED");
    onCloseSchoolTask?.(task.id);
    setExecutiveActionFeedback(
      "Đã nghiệm thu và đóng Nhiệm vụ cấp Trường thành công."
    );
  };

  const sheetContent = (
    <AnimatePresence>
      {showContent && (
        <m.div
          key="task-detail-backdrop"
          data-slot="side-sheet-backdrop"
          variants={fadeVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs sm:backdrop-blur-sm !m-0"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {showContent && (
        <m.aside
          key="task-detail-side-sheet"
          data-slot="task-detail-side-sheet"
          variants={sideSheetVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className={cn(
            "fixed inset-0 md:inset-y-0 md:right-0 md:left-auto z-50 flex h-full flex-col border-l border-border/50 bg-card shadow-2xl !m-0",
            // Mobile (< 768px): Full-screen detail surface
            "w-full max-w-none rounded-none",
            // Tablet & Desktop (768-1439px): 520px side sheet overlay
            "md:w-[520px] md:max-w-[520px] md:rounded-l-2xl",
            // Large Desktop (>= 1440px): 560px side sheet overlay
            "2xl:w-[560px] 2xl:max-w-[560px]",
            className
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-detail-title"
        >
        {/* Sticky Header Bar: Task Code, Compact Status, Mobile Back & Close */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 px-4 sm:px-6 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] bg-card/90 backdrop-blur-xl gap-2">
          {/* Mobile Back Button (< 768px) */}
          <button
            type="button"
            onClick={onClose}
            className="md:hidden inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer active:scale-95 shrink-0"
            aria-label="Quay lại danh sách nhiệm vụ"
          >
            <ArrowLeft className="size-5" strokeWidth={1.5} />
          </button>

          {/* Task Code & Compact Status Indicator Pill */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted/60 border border-border/50 px-2 py-0.5 rounded-md tabular-nums shrink-0">
              {taskCode}
            </span>

            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shrink-0",
                isOverdue
                  ? "border-rose-500/20 bg-rose-500/10 text-rose-600"
                  : statusConfig.className
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full shrink-0",
                  isDone
                    ? "bg-emerald-500"
                    : isOverdue
                    ? "bg-rose-500"
                    : "bg-primary"
                )}
              />
              <span>
                {isOverdue ? "Quá hạn" : statusConfig.label}
              </span>
            </span>
          </div>

          {/* Close Button (lifecycle changes flow only through capability-driven actions) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer active:scale-95"
              aria-label="Đóng bảng chi tiết"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-6 thin-scrollbar">
          {/* Breadcrumb indicator leading back to parent task */}
          {!isSchool && ((task as StaffTask).parentSchoolTaskId || (task as StaffTask).parentTask) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-2.5 py-1.5 rounded-lg border border-border/60">
              <Link2 className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />
              <span>Nhiệm vụ cha:</span>
              <button
                type="button"
                onClick={() => {
                  const targetId =
                    (task as StaffTask).parentSchoolTaskId ||
                    (task as StaffTask).parentTask?.id;
                  if (targetId && onSelectSubTask) {
                    (onSelectSubTask as (v: any) => void)(targetId);
                  }
                }}
                className="font-semibold text-primary hover:underline cursor-pointer truncate max-w-[320px] text-left"
              >
                {(task as StaffTask).parentSchoolTaskTitle ||
                  (task as StaffTask).parentTask?.title ||
                  parentSchoolTaskTitle ||
                  (task as StaffTask).parentSchoolTaskId ||
                  "Xem nhiệm vụ cha"}
              </button>
            </div>
          )}

          {/* Header Block: Level Badge + Title */}
          <div data-slot="detail-title">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border text-xs font-semibold px-2 py-0.5 shadow-2xs",
                  levelBadge.className
                )}
              >
                {isSchool ? (
                  <Building2 className="size-3.5" strokeWidth={1.5} />
                ) : (
                  <Briefcase className="size-3.5" strokeWidth={1.5} />
                )}
                <span>{levelBadge.label}</span>
              </span>
              {!isSchool && (
                <span
                  className={cn(
                    "text-xs px-2.5 py-0.5 rounded-full border tabular-nums shrink-0 font-medium",
                    (task as StaffTask).requiresReview
                      ? "border-amber-500/20 bg-amber-500/10 text-amber-600"
                      : "border-blue-500/20 bg-blue-500/10 text-blue-600"
                  )}
                >
                  {(task as StaffTask).requiresReview ? "Trọng điểm (Yêu cầu nghiệm thu)" : "Thường quy (Tự nghiệm thu)"}
                </span>
              )}
            </div>

            <h2
              id="task-detail-title"
              className="text-lg sm:text-xl font-semibold tracking-tight text-foreground font-heading leading-snug"
            >
              {task.title}
            </h2>

            {/* Parent Task reference */}
            {!isSchool && parentSchoolTaskTitle && (
              <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 border border-border/40 rounded-xl px-3 py-2">
                <Layers className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />
                <span className="shrink-0">Nhiệm vụ cấp trên:</span>
                <span className="font-semibold text-foreground truncate">
                  {parentSchoolTaskTitle}
                </span>
              </div>
            )}

            {/* Status + deadline summary (T16 decision-first order) */}
            <div
              data-slot="detail-status-deadline"
              className="mt-3.5 flex flex-wrap items-center gap-2"
            >
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
                <span>Hạn nộp:</span>
                <span className="font-mono font-semibold text-foreground tabular-nums">
                  {formatDetailDate(task.dueDate)}
                </span>
              </span>
              {relativeTime && (
                <span
                  className={cn(
                    "text-xs px-2.5 py-0.5 rounded-full border tabular-nums font-mono",
                    relativeTime.color
                  )}
                >
                  {relativeTime.text}
                </span>
              )}
            </div>

            {/* Contextual notices (BLOCKED / rejection / escalation) live with the contextual action block below, after the submitted evidence. */}
          </div>

          {/* Owner / Unit metadata grid (T16: owner & unit before evidence) */}
          <div
            data-slot="detail-owner-unit"
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl border border-border/50 bg-card/60 shadow-xs text-xs"
          >
            {/* Cell 1: Lead / Assignee */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <User className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
                Chủ trì nhiệm vụ
              </span>
              <div className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary border border-primary/20">
                  {getInitials(assigneeName)}
                </span>
                <span className="font-semibold text-foreground truncate">
                  {assigneeName}
                </span>
              </div>
            </div>

            {/* Cell 2: Delegator */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Building2 className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
                Người giao nhiệm vụ
              </span>
              <span className="font-semibold text-foreground truncate">
                {isSchool ? "Ban Giám hiệu QCET" : "Trưởng đơn vị quản lý"}
              </span>
            </div>

            {/* Cell 3: Progress / Last Update */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                {isSchool ? (
                  <TrendingUp className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
                ) : (
                  <Clock className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
                )}
                {isSchool ? "Tiến độ thực hiện" : "Cập nhật lần cuối"}
              </span>
              {schoolTask ? (
                <span className="font-mono font-semibold text-foreground tabular-nums">
                  {schoolTask.completedSubTasks}/{schoolTask.totalSubTasks} nhiệm vụ ({schoolTask.progressPercent}%)
                </span>
              ) : (
                <span className="font-mono font-semibold text-foreground tabular-nums">
                  {formatDetailDate(task.updatedAt)}
                </span>
              )}
            </div>

            {/* Cell 5: Co-assignees (SchoolTask only - read-only derived from active subtasks) */}
            {schoolTask && schoolTask.coAssignees && schoolTask.coAssignees.length > 0 && (
              <div className="flex flex-col gap-1 col-span-1 sm:col-span-2 pt-2 border-t border-border/30">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Users className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
                  Đơn vị phối hợp
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {schoolTask.coAssignees.map((partner) => (
                    <span
                      key={partner}
                      className="inline-flex items-center rounded-md bg-secondary/80 px-2 py-0.5 text-xs font-medium text-foreground border border-border/40"
                    >
                      {partner}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Requirement / expected result (T16: owner & unit -> requirement -> evidence) */}
          <div data-slot="detail-requirement" className="space-y-2">
            <h3 className="font-sans text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <ListTodo className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
              Yêu cầu nhiệm vụ
            </h3>
            <div className="rounded-xl border border-border/50 bg-card/60 p-3 space-y-2 text-xs">
              {isSchool ? (
                <>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                    {(task as SchoolTask).description ||
                      "Chưa có mô tả yêu cầu cho nhiệm vụ cấp Trường này."}
                  </p>
                  {(task as SchoolTask).executiveCriteria && (
                    <div className="space-y-1 border-t border-border/30 pt-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Tiêu chí nghiệm thu cấp Trường:
                      </span>
                      <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                        {(task as SchoolTask).executiveCriteria}
                      </p>
                    </div>
                  )}
                </>
              ) : (task as StaffTask).deliverableDescription ? (
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                  {(task as StaffTask).deliverableDescription}
                </p>
              ) : (
                <p className="text-muted-foreground italic">
                  Chưa có mô tả yêu cầu / kết quả mong đợi cho công việc này.
                </p>
              )}
            </div>
          </div>

          {/* Submitted evidence (T16: requirement -> submitted evidence -> context action) */}
          {!isSchool && (
            <div data-slot="detail-evidence" className="space-y-3.5 pt-2" id="deliverable-section">
              <div className="flex items-center justify-between">
                <h3 className="font-sans text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <FileCheck className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
                  {(task as StaffTask).requiresReview
                    ? "Sản phẩm minh chứng (Bắt buộc nghiệm thu)"
                    : "Tài liệu đính kèm (Nhiệm vụ thường quy - Tùy chọn)"}
                </h3>
                {((task as StaffTask).deliverables?.length || 0) > 0 && (
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">
                    {(task as StaffTask).deliverables!.length} tài liệu
                  </span>
                )}
              </div>

              {/* List of existing deliverables */}
              {((task as StaffTask).deliverables?.length || 0) > 0 ? (
                <div className="divide-y divide-border/40 rounded-xl border border-border/50 bg-card overflow-hidden shadow-xs">
                  {(task as StaffTask).deliverables!.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 p-3 text-xs hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="size-4 shrink-0 text-primary" strokeWidth={1.5} />
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-foreground truncate block">
                            {item.name}
                          </span>
                          {item.submittedAt && (
                            <span className="font-mono text-xs text-muted-foreground tabular-nums">
                              Nộp ngày: {formatDetailDate(item.submittedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0"
                        >
                          <Link className="size-3" strokeWidth={1.5} />
                          <span>Xem tài liệu</span>
                          <ExternalLink className="size-3 opacity-70" strokeWidth={1.5} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-muted-foreground rounded-xl border border-dashed border-border/60 bg-muted/20">
                  Chưa có sản phẩm minh chứng nào được nộp
                </div>
              )}

              {/* Submission Form (shown when canUserSubmitDeliverable is true) */}
              {canSubmitDeliverable && (
                <form
                  id="deliverable-form"
                  tabIndex={-1}
                  onSubmit={handleSubmitDeliverable}
                  className="rounded-xl border border-border/60 bg-card p-4 space-y-3 shadow-xs"
                >
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <FileCheck className="size-3.5 text-primary" strokeWidth={1.5} />
                      {(task as StaffTask).requiresReview
                        ? "Nộp sản phẩm minh chứng nghiệm thu"
                        : "Đính kèm tài liệu kết quả (tùy chọn)"}
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {(task as StaffTask).requiresReview
                        ? "Cung cấp đường dẫn tệp tài liệu và mô tả kết quả công việc theo tiêu chuẩn Nghị định 232 để Trưởng phòng nghiệm thu."
                        : "Viên chức có thể đính kèm đường dẫn tài liệu lưu trữ hoặc dùng nút 'Hoàn thành nhiệm vụ' trên thanh tác vụ."}
                    </p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <label
                        htmlFor="deliverable-name"
                        className="block font-medium text-muted-foreground mb-1 text-xs"
                      >
                        Tên tài liệu / sản phẩm minh chứng
                      </label>
                      <input
                        id="deliverable-name"
                        type="text"
                        value={deliverableName}
                        onChange={(e) => setDeliverableName(e.target.value)}
                        placeholder="Ví dụ: Báo cáo kết quả triển khai, slide thuyết trình..."
                        className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="deliverable-url"
                        className="block font-medium text-muted-foreground mb-1 text-xs"
                      >
                        Đường dẫn tài liệu / tệp đính kèm (Drive, Cloud, File URL)
                      </label>
                      <input
                        id="deliverable-url"
                        type="url"
                        value={deliverableUrl}
                        onChange={(e) => setDeliverableUrl(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring font-mono text-xs"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="deliverable-notes"
                        className="block font-medium text-muted-foreground mb-1 text-xs"
                      >
                        Mô tả tóm tắt kết quả công việc
                      </label>
                      <textarea
                        id="deliverable-notes"
                        rows={2}
                        value={deliverableNotes}
                        onChange={(e) => setDeliverableNotes(e.target.value)}
                        placeholder="Tóm tắt nội dung đã hoàn thành, sản phẩm bàn giao..."
                        className="w-full rounded-lg border border-border/60 bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring resize-none"
                      />
                    </div>
                  </div>

                  {deliverableError && (
                    <p className="text-xs font-medium text-rose-600">
                      {deliverableError}
                    </p>
                  )}

                  {deliverableSuccess && (
                    <p className="text-xs font-medium text-emerald-600">
                      {deliverableSuccess}
                    </p>
                  )}

                  <div className="flex items-center justify-end pt-1">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={
                        (!deliverableUrl.trim() && !deliverableNotes.trim()) ||
                        isSubmittingDeliverable
                      }
                      className="h-8 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <FileCheck className="size-3.5" strokeWidth={1.5} />
                      <span>Nộp minh chứng & Trình duyệt</span>
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Contextual action block (T16: after evidence; T07/T20: capability-driven, no lifecycle bypass) */}
          <div
            id="task-detail-context-actions"
            data-slot="detail-context-action"
            className="space-y-3.5"
          >
            <h3 className="font-sans text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Play className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
              Thao tác xử lý
            </h3>

            {/* Warning Banner: BLOCKED Status */}
            {task.status === "BLOCKED" && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="size-4 shrink-0 text-rose-600 mt-0.5" strokeWidth={1.5} />
                  <div className="space-y-1">
                    <h4 className="font-semibold text-rose-700">
                      Cảnh báo cản trở: Nhiệm vụ đang bị ách tắc / Cần phối hợp
                    </h4>
                    <p className="text-rose-600/90 leading-relaxed">
                      {("blockedReason" in task && task.blockedReason) ||
                        "Công việc đang bị nghẽn tiến độ. Vui lòng kiểm tra vướng mắc hoặc tạo Phiếu phối hợp liên đơn vị để tháo gỡ."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Rejection Reason Notice (if returned to IN_PROGRESS) */}
            {"rejectionReason" in task && task.rejectionReason && task.status === "IN_PROGRESS" && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs">
                <div className="flex items-start gap-2.5">
                  <RotateCcw className="size-4 shrink-0 text-amber-600 mt-0.5" strokeWidth={1.5} />
                  <div className="space-y-1">
                    <h4 className="font-semibold text-amber-700">
                      Yêu cầu chỉnh sửa từ Trưởng đơn vị
                    </h4>
                    <p className="text-amber-600/90 leading-relaxed">
                      {task.rejectionReason}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Delegation notice if acting under delegated authority */}
            {approvalResult.isDelegated && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-xs text-purple-700 font-medium">
                <ShieldCheck className="size-4 shrink-0 text-purple-600" strokeWidth={1.5} />
                <span>
                  Phê duyệt theo thẩm quyền ủy quyền của {approvalResult.rule?.grantorName || "Trưởng đơn vị"}
                </span>
              </div>
            )}

            {/* AI screening card for reviewers of a submitted result */}
            {!isSchool && task.status === "NEEDS_REVIEW" && canReview && aiReview && (
              <div className="w-full rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-indigo-600 shrink-0" strokeWidth={1.5} />
                  <span className="text-xs font-semibold text-indigo-700">
                    Kết quả sàng lọc tự động
                  </span>
                  <span className={cn(
                    "ml-auto text-xs font-mono tabular-nums px-1.5 py-0.5 rounded-md border",
                    aiReview.complianceScore >= 80
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                      : aiReview.complianceScore >= 50
                      ? "border-amber-500/20 bg-amber-500/10 text-amber-700"
                      : "border-rose-500/20 bg-rose-500/10 text-rose-700"
                  )}>
                    Điểm tuân thủ: {aiReview.complianceScore}/100
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {aiReview.executiveSummary}
                </p>
                {aiReview.flags.length > 0 && (
                  <ul className="space-y-1">
                    {aiReview.flags.map((flag, idx) => (
                      <li key={idx} className={cn(
                        "text-xs flex items-start gap-1.5",
                        flag.type === "CRITICAL"
                          ? "text-rose-600"
                          : flag.type === "WARNING"
                          ? "text-amber-600"
                          : "text-blue-600"
                      )}>
                        <AlertTriangle className="size-3 shrink-0 mt-0.5" strokeWidth={1.5} />
                        <span>{flag.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {aiReview.suggestedAction === "QUICK_APPROVE" && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <CheckCircle2 className="size-3" strokeWidth={1.5} />
                    <span>Khuyến nghị: Duyệt nhanh</span>
                  </div>
                )}
                {aiReview.suggestedAction === "REQUEST_CHANGES" && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                    <RotateCcw className="size-3" strokeWidth={1.5} />
                    <span>Khuyến nghị: Yêu cầu bổ sung</span>
                  </div>
                )}
              </div>
            )}

            {/* Capability-driven primary actions */}
            <div className="flex flex-wrap items-center gap-2">
              {/* NEW: accept/start the assignment */}
              {task.status === "NEW" && onStatusChange && (actorIsAssignee || actorHasApprovalAuthority) && (
                <Button
                  type="button"
                  onClick={() => onStatusChange(task.id, "IN_PROGRESS")}
                  className="flex-1 h-8.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-xs gap-1.5 cursor-pointer active:scale-[0.98] transition-all duration-150"
                >
                  <Play className="size-3.5" strokeWidth={1.5} />
                  <span>Tiếp nhận công việc</span>
                </Button>
              )}

              {/* IN_PROGRESS */}
              {task.status === "IN_PROGRESS" && (
                <>
                  {canSubmitDeliverable ? (
                    requiresReview ? (
                      <Button
                        type="button"
                        onClick={() => {
                          const formElem = document.getElementById("deliverable-form");
                          formElem?.scrollIntoView({ behavior: "smooth" });
                          const nameInput = document.getElementById("deliverable-name");
                          nameInput?.focus();
                        }}
                        className="flex-1 h-8.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs gap-1.5 cursor-pointer active:scale-[0.98] transition-all duration-150"
                      >
                        <FileCheck className="size-3.5" strokeWidth={1.5} />
                        <span>Nộp minh chứng nghiệm thu</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => onStatusChange?.(task.id, "COMPLETED")}
                        className="flex-1 h-8.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs gap-1.5 cursor-pointer active:scale-[0.98] transition-all duration-150"
                      >
                        <CheckCircle2 className="size-3.5" strokeWidth={1.5} />
                        <span>Hoàn thành nhiệm vụ</span>
                      </Button>
                    )
                  ) : requiresReview ? (
                    <div className="w-full flex items-center gap-2 p-2 rounded-lg border border-amber-500/20 bg-amber-500/10 text-xs text-amber-700 font-medium">
                      <Clock className="size-3.5 shrink-0" strokeWidth={1.5} />
                      <span>Đang thực hiện. Nghiệm thu chỉ khả dụng sau khi người phụ trách nộp minh chứng.</span>
                    </div>
                  ) : actorHasApprovalAuthority && onStatusChange ? (
                    <Button
                      type="button"
                      onClick={() => onStatusChange(task.id, "COMPLETED")}
                      className="flex-1 h-8.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs gap-1.5 cursor-pointer active:scale-[0.98] transition-all duration-150"
                    >
                      <CheckCircle2 className="size-3.5" strokeWidth={1.5} />
                      <span>Nghiệm thu hoàn thành</span>
                    </Button>
                  ) : null}
                </>
              )}

              {/* NEEDS_REVIEW: reviewer sees permitted actions; submitter never sees approve; terminal shows none */}
              {task.status === "NEEDS_REVIEW" && (
                canReview ? (
                  <div className="flex items-center gap-2 w-full">
                    {aiReview?.suggestedAction === "QUICK_APPROVE" ? (
                      <Button
                        type="button"
                        onClick={handleManagerApprove}
                        className="flex-1 h-8.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs gap-1.5 cursor-pointer active:scale-[0.98] transition-all duration-150"
                      >
                        <CheckCircle2 className="size-3.5" strokeWidth={1.5} />
                        <span>Duyệt nhanh (Đạt chuẩn)</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={handleManagerApprove}
                        className="flex-1 h-8.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs gap-1.5 cursor-pointer active:scale-[0.98] transition-all duration-150"
                      >
                        <CheckCircle2 className="size-3.5" strokeWidth={1.5} />
                        <span>Nghiệm thu Đạt (Hoàn thành)</span>
                      </Button>
                    )}
                    {canRejectReview && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsRejectionModalOpen(true)}
                        className="h-8.5 px-3 text-xs font-medium border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 rounded-lg transition-all duration-150 active:scale-[0.98] cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <RotateCcw className="size-3.5" strokeWidth={1.5} />
                        <span>Trả lại Yêu cầu Sửa</span>
                      </Button>
                    )}
                  </div>
                ) : isSeparationOfDutiesBlocked ? (
                  <div className="space-y-2 w-full">
                    <div className="w-full flex items-start gap-2 p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-700 font-medium">
                      <AlertTriangle className="size-4 shrink-0 text-rose-600 mt-0.5" strokeWidth={1.5} />
                      <div className="space-y-0.5">
                        <p className="font-semibold">Phân lập thẩm quyền công vụ</p>
                        <p className="text-xs text-rose-600/90 leading-relaxed">
                          Theo chuẩn quản trị đại học (Separation of Duties), bạn không thể tự nghiệm thu công việc do chính mình phụ trách.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full">
                      <Button
                        type="button"
                        disabled
                        className="flex-1 h-8.5 text-xs font-semibold bg-muted text-muted-foreground rounded-lg cursor-not-allowed opacity-50 gap-1.5"
                      >
                        <CheckCircle2 className="size-3.5" strokeWidth={1.5} />
                        <span>Nghiệm thu Đạt (Vô hiệu hóa)</span>
                      </Button>
                      <Button
                        type="button"
                        disabled
                        variant="outline"
                        className="h-8.5 px-3 text-xs font-medium border-muted bg-muted/40 text-muted-foreground rounded-lg cursor-not-allowed opacity-50 inline-flex items-center gap-1.5"
                      >
                        <RotateCcw className="size-3.5" strokeWidth={1.5} />
                        <span>Trả lại Yêu cầu Sửa</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="w-full flex items-center gap-2 p-2 rounded-lg border border-amber-500/20 bg-amber-500/10 text-xs text-amber-700 font-medium">
                    <Clock className="size-3.5 shrink-0" strokeWidth={1.5} />
                    <span>Đã nộp minh chứng. Đang chờ Trưởng đơn vị kiểm tra và nghiệm thu.</span>
                  </div>
                )
              )}

              {/* COMPLETED: terminal lifecycle — no review CTA.
                  The former ADMIN/MANAGER "Mở lại" (reopen) action was removed
                  intentionally (SK-4): COMPLETED/CANCELLED are immutable per the
                  canonical Terminal State Protection invariant, and reopening
                  through a generic `onStatusChange` status jump is exactly the
                  lifecycle bypass T07 prohibits. A future reopen must route
                  through a canonical reopen command, never a raw status write. */}
              {task.status === "COMPLETED" && (
                <div className="flex items-center gap-2 w-full p-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-700 font-medium">
                  <CheckCircle2 className="size-3.5 shrink-0" strokeWidth={1.5} />
                  <span>Nhiệm vụ đã được nghiệm thu hoàn thành</span>
                </div>
              )}
            </div>

            {/* AI Executive Brief Card (StaffTask NEEDS_REVIEW for reviewer capability) */}
            {!isSchool && task.status === "NEEDS_REVIEW" && canReview && (task as StaffTask).aiReview && (() => {
              const aiReview = (task as StaffTask).aiReview!;
              const riskColorMap: Record<string, string> = {
                CLEAN: "bg-emerald-50 text-emerald-700 border-emerald-200",
                NEEDS_ATTENTION: "bg-amber-50 text-amber-700 border-amber-200",
                HIGH_RISK: "bg-rose-50 text-rose-700 border-rose-200",
              };
              const riskLabel: Record<string, string> = {
                CLEAN: "An toàn",
                NEEDS_ATTENTION: "Cần lưu ý",
                HIGH_RISK: "Rủi ro cao",
              };
              return (
                <div className="rounded-xl border border-border/50 bg-card p-4 text-xs space-y-3 shadow-xs" data-testid="ai-executive-brief">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="size-4 text-primary" strokeWidth={1.5} />
                      Trạng thái thẩm định hồ sơ (AI Executive Brief)
                    </h4>
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border",
                      riskColorMap[aiReview.status] || riskColorMap.CLEAN
                    )}>
                      {riskLabel[aiReview.status] || aiReview.status}
                    </span>
                  </div>

                  {/* Compliance Score */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Điểm tuân thủ quy chuẩn:
                    </span>
                    <span className={cn(
                      "font-mono font-bold tabular-nums",
                      aiReview.complianceScore >= 80 ? "text-emerald-700" :
                      aiReview.complianceScore >= 50 ? "text-amber-700" :
                      "text-rose-700"
                    )}>
                      {aiReview.complianceScore}/100
                    </span>
                  </div>

                  {/* Executive Summary */}
                  <p className="text-xs text-foreground leading-relaxed">
                    {aiReview.executiveSummary}
                  </p>

                  {/* Criteria Matched */}
                  {aiReview.dacumCriteriaMatched.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Tiêu chí chuyên môn đạt:
                      </span>
                      <ul className="list-disc list-inside text-xs text-foreground space-y-0.5 pl-1">
                        {aiReview.dacumCriteriaMatched.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Warning Flags */}
                  {aiReview.flags.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Cảnh báo:
                      </span>
                      <ul className="space-y-0.5 pl-1">
                        {aiReview.flags.map((f, i) => (
                          <li key={i} className={cn(
                            "text-xs",
                            f.type === "CRITICAL" ? "text-rose-600 font-medium" :
                            f.type === "WARNING" ? "text-amber-600" :
                            "text-muted-foreground"
                          )}>
                            [{f.type}] {f.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Quick Approve / Request Changes Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    {aiReview.suggestedAction === "QUICK_APPROVE" && (
                      <Button
                        type="button"
                        onClick={handleManagerApprove}
                        className="flex-1 h-8.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs gap-1.5 cursor-pointer active:scale-[0.98] transition-all duration-150"
                      >
                        <CheckCircle2 className="size-3.5" strokeWidth={1.5} />
                        <span>Duyệt nhanh theo đề xuất AI</span>
                      </Button>
                    )}
                    {canRejectReview && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (aiReview.suggestedFeedback) {
                            setRejectionReasonInput(aiReview.suggestedFeedback);
                          }
                          setIsRejectionModalOpen(true);
                        }}
                        className="h-8.5 px-3 text-xs font-medium border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 rounded-lg transition-all duration-150 active:scale-[0.98] cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <AlertTriangle className="size-3.5" strokeWidth={1.5} />
                        <span>Yêu cầu chỉnh sửa</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Escalation Notice Banner (48h SLA exceeded) */}
            {!isSchool && (task as StaffTask).escalation?.isEscalated && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 p-4 text-xs" data-testid="escalation-notice">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div className="space-y-1">
                    <h4 className="font-semibold">
                      Thông báo leo thang: Vượt quá SLA 48h
                    </h4>
                    <p className="leading-relaxed">
                      Công việc này đã vượt quá thời hạn xử lý 48 giờ và hiện đã được chuyển lên Ban Giám hiệu (BGH) để giám sát.
                      {(task as StaffTask).escalation?.escalationNote && (
                        <> {(task as StaffTask).escalation!.escalationNote}</>
                      )}
                    </p>
                    {(task as StaffTask).escalation?.escalatedAt && (
                      <span className="text-xs font-mono tabular-nums text-rose-600">
                        Leo thang lúc: {formatDetailDate((task as StaffTask).escalation!.escalatedAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SchoolTask Executive Approval (Hiệu trưởng nghiệm thu cấp 2) */}
            {schoolTask && task.status === "PENDING_EXECUTIVE_APPROVAL" && (
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 text-xs space-y-3">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 shrink-0 text-purple-600 mt-0.5" strokeWidth={1.5} />
                  <div className="space-y-1 flex-1">
                    <h4 className="font-semibold text-purple-700">
                      Nghiệm thu cấp 2: Chờ Ban Giám hiệu phê duyệt
                    </h4>
                    <p className="text-purple-600/90 leading-relaxed">
                      Tất cả nhiệm vụ thành phần trực thuộc ({schoolTask.completedSubTasks}/{schoolTask.totalSubTasks}) đã hoàn thành 100%. Nhiệm vụ cấp Trường sẵn sàng để Ban Giám hiệu nghiệm thu và đóng nhiệm vụ.
                    </p>
                  </div>
                </div>

                {canCloseSchool ? (
                  <Button
                    type="button"
                    onClick={handleExecutiveClose}
                    className="w-full h-8.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-xs gap-1.5 cursor-pointer active:scale-[0.98] transition-all"
                  >
                    <CheckCircle2 className="size-3.5" strokeWidth={1.5} />
                    <span>Đóng Nhiệm vụ cấp Trường</span>
                  </Button>
                ) : (
                  <p className="text-xs font-medium text-muted-foreground italic">
                    Chỉ Ban Giám hiệu mới có thẩm quyền nghiệm thu đóng Nhiệm vụ cấp Trường.
                  </p>
                )}

                {executiveActionFeedback && (
                  <p className="text-xs font-medium text-emerald-600">
                    {executiveActionFeedback}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Subtasks Section (SchoolTask only) */}
          {schoolTask && (
            <div data-slot="detail-child-tasks" className="space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-sans text-sm font-semibold text-foreground tracking-tight">
                      Nhiệm vụ con
                    </h3>
                    <Badge variant="outline" className="text-xs font-mono font-semibold">
                      {schoolTask.subTasks.length} việc
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mỗi việc con có đúng 1 người phụ trách, hạn nộp và trạng thái riêng biệt
                  </p>
                </div>
                {/* T17: the single consolidated child-task CTA. Child creation routes
                    through the canonical create path (effectiveOnAddSubTask). */}
                {effectiveOnAddSubTask && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => effectiveOnAddSubTask(task.id)}
                    className="h-7 text-xs gap-1 border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-semibold rounded-lg cursor-pointer"
                    title="Tạo việc con trực thuộc nhiệm vụ này"
                  >
                    <Plus className="size-3.5" strokeWidth={1.5} />
                    <span>{ADD_SUBTASK_LABEL}</span>
                  </Button>
                )}
              </div>

              {/* Subtask Clean List */}
              <div className="divide-y divide-border/40 rounded-xl border border-border/50 bg-card overflow-hidden shadow-xs">
                {schoolTask.subTasks.length === 0 ? (
                  <div className="py-6 flex flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                    <ListTodo className="size-5 text-muted-foreground/50" strokeWidth={1.5} />
                    <p>Chưa có nhiệm vụ con trực thuộc</p>
                    {effectiveOnAddSubTask && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => effectiveOnAddSubTask(task.id)}
                        className="mt-1 h-7 text-xs gap-1 border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-semibold rounded-lg cursor-pointer"
                        title="Tạo việc con trực thuộc nhiệm vụ này"
                      >
                        <Plus className="size-3.5" strokeWidth={1.5} />
                        <span>{ADD_SUBTASK_LABEL}</span>
                      </Button>
                    )}
                  </div>
                ) : (
                  schoolTask.subTasks.map((sub) => {
                    const subStatus = getDetailStatusConfig(sub.status);
                    const subDone = sub.status === "COMPLETED";

                    return (
                      <div
                        key={sub.id}
                        tabIndex={0}
                        onClick={() => {
                          if (onSelectSubTask) {
                            (onSelectSubTask as (v: any) => void)(sub);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (onSelectSubTask) {
                              (onSelectSubTask as (v: any) => void)(sub);
                            }
                          }
                        }}
                        className="group flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 transition-colors hover:bg-secondary/40 cursor-pointer"
                        role="button"
                        aria-label={`Chi tiết nhiệm vụ con: ${sub.title}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {subDone ? (
                            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" strokeWidth={1.5} />
                          ) : (
                            <Circle className="size-4 shrink-0 text-muted-foreground/50" strokeWidth={1.5} />
                          )}
                          <div className="flex items-center gap-2 min-w-0 truncate">
                            <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted/60 border border-border/50 px-1.5 py-0.5 rounded shrink-0">
                              {sub.code || `NV-${sub.id.slice(0, 8).toUpperCase()}`}
                            </span>
                            <span
                              className={cn(
                                "text-xs font-medium text-foreground truncate",
                                subDone && "line-through text-muted-foreground"
                              )}
                            >
                              {sub.title}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap pl-6 sm:pl-0">
                          {/* Single DRI: Đúng 1 người phụ trách */}
                          <div
                            className="flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200/80"
                            title={`Người phụ trách duy nhất: ${sub.assigneeName || "Chưa phân công"}`}
                          >
                            {sub.assigneeAvatar ? (
                              <img
                                src={sub.assigneeAvatar}
                                alt=""
                                aria-hidden="true"
                                className="size-4 rounded-full object-cover border border-border/60"
                              />
                            ) : (
                              <div
                                aria-hidden="true"
                                className="size-4 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs"
                              >
                                {sub.assigneeName ? sub.assigneeName.charAt(0).toUpperCase() : "?"}
                              </div>
                            )}
                            <span className="truncate max-w-[120px] font-medium text-slate-800">
                              {sub.assigneeName || "Chưa phân công"}
                            </span>
                          </div>

                          {/* Due Date: Hạn nộp */}
                          <div
                            className="flex items-center gap-1 text-xs text-muted-foreground font-mono tabular-nums bg-muted/40 px-2 py-0.5 rounded border border-border/40"
                            title="Hạn nộp"
                          >
                            <Calendar className="size-3 text-muted-foreground/70" />
                            <span>{sub.dueDate ? formatDetailDate(sub.dueDate) : "Không hạn"}</span>
                          </div>

                          {/* Progress Percentage */}
                          {typeof sub.progressPercent === "number" && (
                            <span className="text-xs font-mono font-medium text-primary bg-primary/5 px-1.5 py-0.5 rounded border border-primary/20 tabular-nums">
                              {sub.progressPercent}%
                            </span>
                          )}

                          {/* Status Badge: Trạng thái */}
                          <Badge
                            variant={subStatus.variant}
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-md font-semibold shrink-0",
                              subStatus.className
                            )}
                          >
                            {subStatus.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Truthful history + derived milestones (T18) */}
          <div className="space-y-6 pt-2">
            {/* Real, server-authoritative audit events only. Never synthesized. */}
            <section data-slot="detail-history" className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-sans text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <History className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
                  Lịch sử
                </h3>
                {auditEvents.length > 0 && (
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">
                    {auditEvents.length} bản ghi
                  </span>
                )}
              </div>

              {auditEvents.length > 0 ? (
                <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border/60">
                  {auditEvents.map((event) => (
                    <div key={event.id} className="relative flex flex-col gap-0.5">
                      <span className="absolute -left-5 top-1 flex size-4 items-center justify-center rounded-full border border-border/80 bg-card">
                        <span className="size-1.5 rounded-full bg-emerald-500/70" />
                      </span>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {event.description || AUDIT_ACTION_LABELS[event.action] || event.action}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">
                          {formatDetailDate(event.timestamp)}
                        </span>
                      </div>
                      {event.actorName && (
                        <span className="text-xs font-medium text-muted-foreground/80">
                          Chủ thể: {event.actorName}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-muted-foreground rounded-xl border border-dashed border-border/60 bg-muted/20">
                  Chưa có bản ghi kiểm toán từ máy chủ cho nhiệm vụ này.
                </div>
              )}
            </section>

            {/* Derived facts aggregated from the task record — informational only. */}
            <section data-slot="detail-derived-milestones" className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-sans text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
                  Mốc thông tin
                </h3>
                <span className="text-xs font-mono text-muted-foreground tabular-nums">
                  {derivedMilestones.length} mốc
                </span>
              </div>

              <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border/60">
                {derivedMilestones.map((item) => (
                  <div key={item.id} className="relative flex flex-col gap-0.5">
                    {/* Flat round node */}
                    <span className="absolute -left-5 top-1 flex size-4 items-center justify-center rounded-full border border-border/80 bg-card">
                      <span className="size-1.5 rounded-full bg-primary/70" />
                    </span>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {item.label}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        {item.timestamp}
                      </span>
                    </div>

                    {item.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {item.description}
                      </p>
                    )}

                    {item.actor && (
                      <span className="text-xs font-medium text-muted-foreground/80">
                        Chủ thể: {item.actor}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Mobile Contextual Sticky Bottom Action Bar (< 768px) */}
        <div className="md:hidden sticky bottom-0 z-20 border-t border-border/60 bg-card/95 backdrop-blur-xl px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg space-y-2">
          <div className="flex items-center gap-2">
            {/* Condition 1: Manager / BGH Review Mode */}
            {(canReview && task.status === "NEEDS_REVIEW") ||
            (isSchool && task.status === "PENDING_EXECUTIVE_APPROVAL" && canCloseSchool) ? (
              <div className="flex items-center gap-2 flex-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRejectionModalOpen(true)}
                  className="flex-1 min-h-[44px] h-11 text-xs font-semibold border-amber-500/30 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-xl cursor-pointer inline-flex items-center justify-center gap-1.5 touch-manipulation active:scale-[0.98]"
                >
                  <AlertTriangle className="size-4 text-amber-600" strokeWidth={1.5} />
                  <span>Yêu cầu sửa</span>
                </Button>
                <Button
                  type="button"
                  onClick={isSchool ? handleExecutiveClose : handleManagerApprove}
                  className="flex-1 min-h-[44px] h-11 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer inline-flex items-center justify-center gap-1.5 touch-manipulation active:scale-[0.98]"
                >
                  <CheckCircle2 className="size-4" strokeWidth={1.5} />
                  <span>Phê duyệt</span>
                </Button>
              </div>
            ) : canSubmitDeliverable ? (
              /* Condition 2: submitter reporting — scrolls to the evidence form */
              <Button
                type="button"
                onClick={() => {
                  const form = document.getElementById("deliverable-form");
                  if (form) {
                    form.scrollIntoView({ behavior: "smooth", block: "center" });
                    document.getElementById("deliverable-name")?.focus();
                  }
                }}
                className="flex-1 min-h-[44px] h-11 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-xs cursor-pointer inline-flex items-center justify-center gap-2 touch-manipulation active:scale-[0.98]"
              >
                <FileCheck className="size-4" strokeWidth={1.5} />
                <span>Nộp báo cáo</span>
              </Button>
            ) : task.status === "NEW" && onStatusChange && (actorIsAssignee || actorHasApprovalAuthority) ? (
              /* Condition 3: accept the new assignment (canonical lifecycle start) */
              <Button
                type="button"
                onClick={() => onStatusChange(task.id, "IN_PROGRESS")}
                className="flex-1 min-h-[44px] h-11 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-xs cursor-pointer inline-flex items-center justify-center gap-2 touch-manipulation active:scale-[0.98]"
              >
                <Play className="size-4" strokeWidth={1.5} />
                <span>Tiếp nhận công việc</span>
              </Button>
            ) : (
              /* Condition 4: no mobile primary action — deep-links into the context action block (no status bypass) */
              <Button
                type="button"
                onClick={() => {
                  document
                    .getElementById("task-detail-context-actions")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="flex-1 min-h-[44px] h-11 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-xs cursor-pointer inline-flex items-center justify-center gap-2 touch-manipulation active:scale-[0.98]"
              >
                <Play className="size-4" strokeWidth={1.5} />
                <span>Xem thao tác xử lý</span>
              </Button>
            )}

            {/* Secondary Action Menu / Overflow "..." */}
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="min-h-[44px] min-w-[44px] h-11 w-11 p-0 rounded-xl border-border/70 hover:bg-muted cursor-pointer inline-flex items-center justify-center shrink-0 touch-manipulation active:scale-95"
                aria-label="Thao tác khác"
              >
                <MoreHorizontal className="size-5 text-muted-foreground" strokeWidth={1.5} />
              </Button>

              {/* Overflow Dropdown */}
              {isMobileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setIsMobileMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 bottom-full mb-2 w-52 rounded-xl border border-border/70 bg-card p-1.5 shadow-xl z-40 space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-150 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        const code = isSchool ? (task as SchoolTask).taskCode : (task as StaffTask).code;
                        if (code && typeof navigator !== "undefined" && navigator.clipboard) {
                          navigator.clipboard.writeText(code);
                        }
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-foreground hover:bg-muted font-medium transition-colors text-left cursor-pointer min-h-[36px]"
                    >
                      <Copy className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                      <span>Sao chép mã NV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== "undefined" && navigator.clipboard) {
                          const url = new URL(window.location.href);
                          url.searchParams.set("taskId", task.id);
                          navigator.clipboard.writeText(url.toString());
                        }
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-foreground hover:bg-muted font-medium transition-colors text-left cursor-pointer min-h-[36px]"
                    >
                      <Share2 className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                      <span>Chia sẻ liên kết</span>
                    </button>
                    {onStatusChange && task.status !== "BLOCKED" && task.status !== "COMPLETED" && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          onStatusChange(task.id, "BLOCKED");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-rose-700 hover:bg-rose-50 font-medium transition-colors text-left cursor-pointer min-h-[36px]"
                      >
                        <AlertTriangle className="size-3.5 text-rose-600" strokeWidth={1.5} />
                        <span>Báo bị nghẽn (BLOCKED)</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        {/* In-Sheet Rejection Review Panel: Strictly inside the SideSheet, no nested modal dialogs */}
        <AnimatePresence>
          {isRejectionModalOpen && (
            <m.div
              key="in-sheet-rejection-panel"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 sm:p-6 !m-0"
              data-slot="in-sheet-rejection-panel"
            >
              <div className="w-full max-w-md rounded-xl border border-border/60 bg-card p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-border/50 pb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-4 text-amber-600" strokeWidth={1.5} />
                    <h3 id="rejection-dialog-title" className="text-sm font-semibold text-foreground">
                      Trả lại yêu cầu chỉnh sửa minh chứng
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRejectionModalOpen(false);
                      setRejectionError(null);
                    }}
                    className="size-7 rounded-md inline-flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
                    aria-label="Đóng hộp thoại"
                  >
                    <X className="size-4" strokeWidth={1.5} />
                  </button>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  Theo quy định phân công và Nghị định 232, Trưởng đơn vị bắt buộc phải ghi rõ lý do và nội dung cần khắc phục khi trả lại công việc.
                </p>

                <form onSubmit={handleManagerReject} className="space-y-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="rejection-reason"
                      className="text-xs font-semibold text-foreground"
                    >
                      Lý do yêu cầu sửa đổi (bắt buộc)
                    </label>
                    <textarea
                      id="rejection-reason"
                      rows={3}
                      value={rejectionReasonInput}
                      onChange={(e) => {
                        setRejectionReasonInput(e.target.value);
                        if (rejectionError) setRejectionError(null);
                      }}
                      placeholder="Ví dụ: Thiếu số liệu khảo sát phụ lục 2, cần bổ sung chữ ký số của trưởng bộ môn..."
                      className="w-full rounded-lg border border-border/60 bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring resize-none"
                      autoFocus
                    />
                  </div>

                  {rejectionError && (
                    <p className="text-xs font-medium text-rose-600">
                      {rejectionError}
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsRejectionModalOpen(false);
                        setRejectionError(null);
                      }}
                      className="h-8 text-xs cursor-pointer"
                    >
                      Hủy
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!rejectionReasonInput.trim()}
                      className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white cursor-pointer disabled:opacity-50"
                    >
                      Xác nhận trả lại
                    </Button>
                  </div>
                </form>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </m.aside>
      )}
    </AnimatePresence>
  );

  if (mounted && typeof document !== "undefined") {
    return createPortal(sheetContent, document.body);
  }

  return sheetContent;
}

export default TaskDetailSideSheet;
