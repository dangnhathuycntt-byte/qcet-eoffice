"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  X,
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
  ShieldCheck,
} from "lucide-react";
import type {
  SchoolTask,
  StaffTask,
  TaskCategory,
  TaskStatus,
  DeliverableItem,
  AIReviewSummary,
  EscalationMeta,
} from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import { useAuth } from "@/lib/auth-context";
import {
  transitionStaffTaskStatus,
  validateDeliverableSubmission,
} from "@/lib/dacum-workflow-engine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCategoryBadgeConfig } from "./cascading-task-table";

export function isSchoolTask(
  task: SchoolTask | StaffTask | null | undefined
): task is SchoolTask {
  if (!task) return false;
  return "subTasks" in task && Array.isArray(task.subTasks);
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

export const TASK_LEVEL_CONFIG = {
  TRUONG: {
    label: "Nhiệm vụ cấp Trường",
    variant: "secondary" as const,
    className:
      "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold px-2.5 py-0.5",
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
      "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    variant: "outline",
  },
  IN_PROGRESS: {
    label: "Đang thực hiện",
    className:
      "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    variant: "progress",
  },
  NEEDS_REVIEW: {
    label: "Cần chỉnh sửa",
    className:
      "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    variant: "warning",
  },
  COMPLETED: {
    label: "Hoàn thành",
    className:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    variant: "success",
  },
  BLOCKED: {
    label: "Bị nghẽn / Phối hợp",
    className:
      "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    variant: "destructive",
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
        "border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300",
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
 * Role Permission Helpers for Task Detail Side Sheet (Decree 232 & DACUM)
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

export function canUserCloseSchoolTask(
  task: SchoolTask,
  actor?: AuthUser | null
): boolean {
  if (!actor) return false;
  if (task.status !== "PENDING_EXECUTIVE_APPROVAL") return false;
  return actor.role === "ADMIN";
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
      color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    };
  }
  if (!dueDateStr) return null;
  try {
    const now = new Date("2026-09-04T00:00:00");
    const due = new Date(dueDateStr.split("T")[0] + "T00:00:00");
    const diffDays = Math.ceil(
      (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays < 0) {
      return {
        text: `Quá hạn ${Math.abs(diffDays)} ngày`,
        color: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20 font-bold",
      };
    }
    if (diffDays === 0) {
      return {
        text: "Hạn hôm nay",
        color: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20 font-bold",
      };
    }
    if (diffDays <= 3) {
      return {
        text: `Còn ${diffDays} ngày`,
        color: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20 font-medium",
      };
    }
    return {
      text: `Còn ${diffDays} ngày`,
      color: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20 font-medium",
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
    actor: isSchool ? "Ban Giám hiệu QCET" : (task.assigneeName || "Trưởng đơn vị"),
    description: isSchool
      ? `Giao cho cán bộ chủ trì: ${task.leadAssigneeName}`
      : `Phân công thực hiện: ${task.assigneeName}`,
    type: "assigned",
  });

  // 2. Progress milestone (for SchoolTask with subtasks)
  if (isSchool && task.totalSubTasks > 0) {
    events.push({
      id: "event-progress",
      label: "Tiến độ công việc trực thuộc",
      timestamp: formatDetailDate(task.assignedDate),
      actor: `${task.completedSubTasks}/${task.totalSubTasks} việc con`,
      description: `Đạt ${task.progressPercent}% tổng khối lượng công việc được giao`,
      type: "progress",
    });
  }

  // 3. Status checkpoint
  const statusCfg = getDetailStatusConfig(task.status);
  events.push({
    id: "event-status",
    label: `Trạng thái: ${statusCfg.label}`,
    timestamp: formatDetailDate(isSchool ? task.dueDate : task.updatedAt),
    actor: isSchool ? task.leadAssigneeName : task.assigneeName,
    description:
      task.status === "COMPLETED"
        ? "Công việc đã được nghiệm thu hoàn thành"
        : task.status === "NEEDS_REVIEW"
        ? "Đã nộp minh chứng / Yêu cầu rà soát và hiệu chỉnh nội dung"
        : task.status === "IN_PROGRESS"
        ? "Đang triển khai thực hiện theo kế hoạch"
        : task.status === "BLOCKED"
        ? "Đang bị nghẽn hoặc chờ phối hợp liên đơn vị"
        : "Tiếp nhận vào danh sách công việc cần xử lý",
    type: "status",
  });

  // 4. Due date milestone
  if (task.dueDate) {
    events.push({
      id: "event-due",
      label: "Hạn chót hoàn thành",
      timestamp: formatDetailDate(task.dueDate),
      actor: isSchool ? task.leadAssigneeName : task.assigneeName,
      description: "Thời hạn báo cáo kết quả và kết thúc công việc",
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
  onAddSubTask?: (parentSchoolTaskId: string) => void;
  onSelectSubTask?: (subTask: StaffTask) => void;
  parentSchoolTaskTitle?: string;
  className?: string;
  currentUser?: AuthUser;
  onUpdateStaffTask?: (updatedTask: StaffTask) => void;
  onCloseSchoolTask?: (schoolTaskId: string) => void;
}

export function TaskDetailSideSheet({
  task,
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
}: TaskDetailSideSheetProps) {
  const auth = useAuth();
  const user = currentUser ?? auth.user;
  const visible = isOpen !== undefined ? isOpen : task !== null;
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState("");
  const [isAddingSubtask, setIsAddingSubtask] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

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

  if (!visible || !task) {
    return null;
  }

  const isSchool = isSchoolTask(task);
  const isDone = task.status === "COMPLETED";
  const levelBadge = getTaskLevelBadge(isSchool);
  const statusConfig = getDetailStatusConfig(task.status);
  const assigneeName = isSchool ? task.leadAssigneeName : task.assigneeName;
  const relativeTime = getRelativeTimeString(task.dueDate, isDone);
  const isOverdue =
    !isDone &&
    Boolean(task.dueDate) &&
    new Date(task.dueDate.split("T")[0] + "T00:00:00") <
      new Date("2026-09-04T00:00:00");
  const auditTimeline = getTaskAuditTimeline(task);

  // Permission evaluations
  const canSubmitDeliverable =
    !isSchool && canUserSubmitDeliverable(task as StaffTask, user);
  const canReview =
    !isSchool && canUserReviewTask(task as StaffTask, user);
  const canCloseSchool =
    isSchool && canUserCloseSchoolTask(task as SchoolTask, user);

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
          "Theo chuẩn DACUM và Nghị định 232, bắt buộc phải có sản phẩm minh chứng hoặc mô tả kết quả."
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

  const handleCreateSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !isSchool) return;
    if (onAddSubTask) {
      onAddSubTask(task.id);
    }
    setIsAddingSubtask(false);
    setNewSubtaskTitle("");
  };

  const sheetContent = (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in !m-0"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer Panel */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex h-full w-full sm:max-w-lg md:max-w-xl flex-col border-l border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl animate-in slide-in-from-right duration-300 !m-0",
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
      >
        {/* Sticky Header Bar: Status & Quick Actions */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 px-5 sm:px-6 py-3.5 bg-card/90 backdrop-blur-xl gap-3">
          {/* Status Indicator Pill */}
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shrink-0",
                isOverdue
                  ? "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
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

            {relativeTime && !isOverdue && (
              <span
                className={cn(
                  "text-[11px] px-2.5 py-0.5 rounded-full border tabular-nums shrink-0 hidden sm:inline font-mono",
                  relativeTime.color
                )}
              >
                {relativeTime.text}
              </span>
            )}

            {!isSchool && (
              <span
                className={cn(
                  "text-[11px] px-2.5 py-0.5 rounded-full border tabular-nums shrink-0 hidden sm:inline font-medium",
                  (task as StaffTask).requiresReview
                    ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                )}
              >
                {(task as StaffTask).requiresReview ? "Trọng điểm (DACUM)" : "Thường quy (Tự xong)"}
              </span>
            )}
          </div>

          {/* Quick Status Select & Close Button */}
          <div className="flex items-center gap-2 shrink-0">
            {onStatusChange && (
              <select
                id="status-select"
                value={task.status}
                onChange={(e) =>
                  onStatusChange(task.id, e.target.value as TaskStatus)
                }
                className="h-8 rounded-lg border border-border/60 bg-background px-2.5 text-xs font-medium text-foreground hover:border-border transition-all cursor-pointer outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                aria-label="Cập nhật trạng thái nhiệm vụ"
              >
                <option value="NEW">Mới</option>
                <option value="IN_PROGRESS">Đang thực hiện</option>
                <option value="NEEDS_REVIEW">Cần chỉnh sửa / Chờ duyệt</option>
                {/* Staff cannot directly select COMPLETED if task requires review */}
                {(user?.role !== "STAFF" || !(task as StaffTask).requiresReview) && (
                  <option value="COMPLETED">Hoàn thành</option>
                )}
                <option value="BLOCKED">Bị nghẽn / Phối hợp</option>
              </select>
            )}

            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer active:scale-95"
              aria-label="Đóng bảng chi tiết"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-6 thin-scrollbar">
          {/* Header Block: Code + Level Badge + Title */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-[11px] font-semibold text-muted-foreground bg-muted/60 border border-border/50 px-2 py-0.5 rounded-md tabular-nums">
                NV-{task.id.slice(0, 8).toUpperCase()}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border text-[11px] font-semibold px-2 py-0.5 shadow-2xs",
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
                <span className="shrink-0">Nhiệm vụ cha:</span>
                <span className="font-semibold text-foreground truncate">
                  {parentSchoolTaskTitle}
                </span>
              </div>
            )}

            {/* Quick 1-Click Action Bar based on RBAC & DACUM */}
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              {/* If task is NEW */}
              {task.status === "NEW" && onStatusChange && (
                <Button
                  type="button"
                  onClick={() => onStatusChange(task.id, "IN_PROGRESS")}
                  className="flex-1 h-8.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-xs gap-1.5 cursor-pointer active:scale-[0.98] transition-all duration-150"
                >
                  <Play className="size-3.5" strokeWidth={1.5} />
                  <span>Tiếp nhận công việc</span>
                </Button>
              )}

              {/* If task is IN_PROGRESS */}
              {task.status === "IN_PROGRESS" && (
                <>
                  {user?.role === "STAFF" ? (
                    canSubmitDeliverable ? (
                      (task as StaffTask).requiresReview ? (
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
                    ) : null
                  ) : onStatusChange ? (
                    <>
                      <Button
                        type="button"
                        onClick={() => onStatusChange(task.id, "COMPLETED")}
                        className="flex-1 h-8.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs gap-1.5 cursor-pointer active:scale-[0.98] transition-all duration-150"
                      >
                        <CheckCircle2 className="size-3.5" strokeWidth={1.5} />
                        <span>Nghiệm thu hoàn thành</span>
                      </Button>
                      <button
                        type="button"
                        onClick={() => setIsRejectionModalOpen(true)}
                        className="h-8.5 px-3 text-xs font-medium border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 rounded-lg transition-all duration-150 active:scale-[0.98] cursor-pointer inline-flex items-center gap-1.5"
                        title="Chuyển sang trạng thái cần chỉnh sửa"
                      >
                        <AlertTriangle className="size-3.5" strokeWidth={1.5} />
                        <span>Yêu cầu sửa</span>
                      </button>
                    </>
                  ) : null}
                </>
              )}

              {/* If task is NEEDS_REVIEW */}
              {task.status === "NEEDS_REVIEW" && (
                canReview ? (
                  <div className="flex items-center gap-2 w-full">
                    <Button
                      type="button"
                      onClick={handleManagerApprove}
                      className="flex-1 h-8.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs gap-1.5 cursor-pointer active:scale-[0.98] transition-all duration-150"
                    >
                      <CheckCircle2 className="size-3.5" strokeWidth={1.5} />
                      <span>Nghiệm thu Đạt (COMPLETED)</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsRejectionModalOpen(true)}
                      className="h-8.5 px-3 text-xs font-medium border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 rounded-lg transition-all duration-150 active:scale-[0.98] cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="size-3.5" strokeWidth={1.5} />
                      <span>Trả lại Yêu cầu Sửa</span>
                    </Button>
                  </div>
                ) : (
                  <div className="w-full flex items-center gap-2 p-2 rounded-lg border border-amber-500/20 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300 font-medium">
                    <Clock className="size-3.5 shrink-0" strokeWidth={1.5} />
                    <span>Đã nộp minh chứng. Đang chờ Trưởng đơn vị kiểm tra và nghiệm thu.</span>
                  </div>
                )
              )}

              {/* If task is COMPLETED */}
              {task.status === "COMPLETED" && (
                <div className="flex items-center justify-between w-full p-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 shrink-0" strokeWidth={1.5} />
                    <span>Nhiệm vụ đã được nghiệm thu hoàn thành</span>
                  </div>
                  {(user?.role === "ADMIN" || user?.role === "MANAGER") && onStatusChange && (
                    <button
                      type="button"
                      onClick={() => onStatusChange(task.id, "IN_PROGRESS")}
                      className="h-7 px-2.5 text-[11px] font-medium border border-border/60 bg-card text-foreground hover:bg-secondary rounded-md transition-all cursor-pointer inline-flex items-center gap-1"
                      title="Mở lại công việc để tiếp tục xử lý"
                    >
                      <RotateCcw className="size-3" strokeWidth={1.5} />
                      <span>Mở lại</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Warning Banner: BLOCKED Status */}
            {task.status === "BLOCKED" && (
              <div className="mt-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="size-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" strokeWidth={1.5} />
                  <div className="space-y-1">
                    <h4 className="font-semibold text-rose-700 dark:text-rose-300">
                      Cảnh báo cản trở: Nhiệm vụ đang bị ách tắc / Cần phối hợp
                    </h4>
                    <p className="text-rose-600/90 dark:text-rose-400/90 leading-relaxed">
                      {("blockedReason" in task && task.blockedReason) ||
                        "Công việc đang bị nghẽn tiến độ. Vui lòng kiểm tra vướng mắc hoặc tạo Phiếu phối hợp liên đơn vị để tháo gỡ."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Rejection Reason Notice (if returned to IN_PROGRESS) */}
            {"rejectionReason" in task && task.rejectionReason && task.status === "IN_PROGRESS" && (
              <div className="mt-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs">
                <div className="flex items-start gap-2.5">
                  <RotateCcw className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" strokeWidth={1.5} />
                  <div className="space-y-1">
                    <h4 className="font-semibold text-amber-700 dark:text-amber-300">
                      Yêu cầu chỉnh sửa từ Trưởng đơn vị
                    </h4>
                    <p className="text-amber-600/90 dark:text-amber-400/90 leading-relaxed">
                      {task.rejectionReason}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* AI Executive Brief Card (StaffTask NEEDS_REVIEW for MANAGER/ADMIN) */}
            {!isSchool && task.status === "NEEDS_REVIEW" && canReview && (task as StaffTask).aiReview && (() => {
              const aiReview = (task as StaffTask).aiReview!;
              const riskColorMap: Record<string, string> = {
                CLEAN: "bg-emerald-50 text-emerald-700 border-emerald-200",
                NEEDS_ATTENTION: "bg-amber-50 text-amber-700 border-amber-200",
                HIGH_RISK: "bg-rose-50 text-rose-700 border-rose-200",
              };
              const riskLabel: Record<string, string> = {
                CLEAN: "An toan",
                NEEDS_ATTENTION: "Can luu y",
                HIGH_RISK: "Rui ro cao",
              };
              return (
                <div className="mt-3.5 rounded-xl border border-border/50 bg-card p-4 text-xs space-y-3 shadow-xs" data-testid="ai-executive-brief">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="size-4 text-primary" strokeWidth={1.5} />
                      Tong hop AI Executive Brief
                    </h4>
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border",
                      riskColorMap[aiReview.status] || riskColorMap.CLEAN
                    )}>
                      {riskLabel[aiReview.status] || aiReview.status}
                    </span>
                  </div>

                  {/* Compliance Score */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Diem tuan thu (complianceScore):
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

                  {/* DACUM Criteria Matched */}
                  {aiReview.dacumCriteriaMatched.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        Tieu chi DACUM dat:
                      </span>
                      <ul className="list-disc list-inside text-[11px] text-foreground space-y-0.5 pl-1">
                        {aiReview.dacumCriteriaMatched.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Warning Flags */}
                  {aiReview.flags.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        Canh bao:
                      </span>
                      <ul className="space-y-0.5 pl-1">
                        {aiReview.flags.map((f, i) => (
                          <li key={i} className={cn(
                            "text-[11px]",
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
                        <span>Duyet nhanh theo de xuat AI</span>
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (aiReview.suggestedFeedback) {
                          setRejectionReasonInput(aiReview.suggestedFeedback);
                        }
                        setIsRejectionModalOpen(true);
                      }}
                      className="h-8.5 px-3 text-xs font-medium border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 rounded-lg transition-all duration-150 active:scale-[0.98] cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <AlertTriangle className="size-3.5" strokeWidth={1.5} />
                      <span>Yeu cau chinh sua</span>
                    </Button>
                  </div>
                </div>
              );
            })()}

            {/* Escalation Notice Banner (48h SLA exceeded) */}
            {!isSchool && (task as StaffTask).escalation?.isEscalated && (
              <div className="mt-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 p-4 text-xs" data-testid="escalation-notice">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div className="space-y-1">
                    <h4 className="font-semibold">
                      Thong bao leo thang: Vuot qua SLA 48h
                    </h4>
                    <p className="leading-relaxed">
                      Cong viec nay da vuot qua thoi han xu ly 48 gio va hien da duoc chuyen len Ban Giam hieu (BGH) de giam sat.
                      {(task as StaffTask).escalation?.escalationNote && (
                        <> {(task as StaffTask).escalation!.escalationNote}</>
                      )}
                    </p>
                    {(task as StaffTask).escalation?.escalatedAt && (
                      <span className="text-[10.5px] font-mono tabular-nums text-rose-600">
                        Leo thang luc: {formatDetailDate((task as StaffTask).escalation!.escalatedAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SchoolTask Executive Approval (Hiệu trưởng nghiệm thu cấp 2) */}
            {isSchool && task.status === "PENDING_EXECUTIVE_APPROVAL" && (
              <div className="mt-3.5 rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 text-xs space-y-3">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 shrink-0 text-purple-600 dark:text-purple-400 mt-0.5" strokeWidth={1.5} />
                  <div className="space-y-1 flex-1">
                    <h4 className="font-semibold text-purple-700 dark:text-purple-300">
                      Nghiệm thu cấp 2: Chờ Ban Giám hiệu phê duyệt
                    </h4>
                    <p className="text-purple-600/90 dark:text-purple-400/90 leading-relaxed">
                      Tất cả công việc đơn vị trực thuộc ({task.completedSubTasks}/{task.totalSubTasks}) đã hoàn thành 100%. Nhiệm vụ cấp Trường sẵn sàng để Ban Giám hiệu nghiệm thu và đóng nhiệm vụ.
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
                  <p className="text-[11px] font-medium text-muted-foreground italic">
                    Chỉ Ban Giám hiệu mới có thẩm quyền nghiệm thu đóng Nhiệm vụ cấp Trường.
                  </p>
                )}

                {executiveActionFeedback && (
                  <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    {executiveActionFeedback}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 2-Column Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl border border-border/50 bg-card/60 shadow-xs text-xs">
            {/* Cell 1: Lead / Assignee */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <User className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
                Cán bộ chủ trì
              </span>
              <div className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary border border-primary/20">
                  {getInitials(assigneeName)}
                </span>
                <span className="font-semibold text-foreground truncate">
                  {assigneeName}
                </span>
              </div>
            </div>

            {/* Cell 2: Delegator */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <Building2 className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
                Người giao việc
              </span>
              <span className="font-semibold text-foreground truncate">
                {isSchool ? "Ban Giám hiệu QCET" : "Trưởng đơn vị quản lý"}
              </span>
            </div>

            {/* Cell 3: Due Date */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <Calendar className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
                Hạn hoàn thành
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-foreground tabular-nums">
                  {formatDetailDate(task.dueDate)}
                </span>
                {relativeTime && (
                  <span
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full border font-sans font-medium",
                      relativeTime.color
                    )}
                  >
                    {relativeTime.text}
                  </span>
                )}
              </div>
            </div>

            {/* Cell 4: Progress / Last Update */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                {isSchool ? (
                  <TrendingUp className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
                ) : (
                  <Clock className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
                )}
                {isSchool ? "Tiến độ công việc" : "Cập nhật lần cuối"}
              </span>
              {isSchool ? (
                <span className="font-mono font-semibold text-foreground tabular-nums">
                  {task.completedSubTasks}/{task.totalSubTasks} việc ({task.progressPercent}%)
                </span>
              ) : (
                <span className="font-mono font-semibold text-foreground tabular-nums">
                  {formatDetailDate(task.updatedAt)}
                </span>
              )}
            </div>

            {/* Cell 5: Category (SchoolTask only) */}
            {isSchool && (
              <div className="flex flex-col gap-1 col-span-1 sm:col-span-2 pt-2 border-t border-border/30">
                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                  <Tag className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
                  Danh mục chuyên môn
                </span>
                <div>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                      getCategoryBadgeConfig(task.category).className
                    )}
                  >
                    {task.categoryLabel ||
                      getCategoryBadgeConfig(task.category).label}
                  </span>
                </div>
              </div>
            )}

            {/* Cell 6: Co-assignees (SchoolTask only) */}
            {isSchool && task.coAssignees && task.coAssignees.length > 0 && (
              <div className="flex flex-col gap-1 col-span-1 sm:col-span-2 pt-2 border-t border-border/30">
                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                  <Users className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
                  Đơn vị phối hợp
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {task.coAssignees.map((partner) => (
                    <span
                      key={partner}
                      className="inline-flex items-center rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-foreground border border-border/40"
                    >
                      {partner}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* DACUM Deliverable Section (StaffTask only) */}
          {!isSchool && (
            <div className="space-y-3.5 pt-2" id="deliverable-section">
              <div className="flex items-center justify-between">
                <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileCheck className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
                  {(task as StaffTask).requiresReview
                    ? "Sản phẩm minh chứng (Bắt buộc nghiệm thu - DACUM)"
                    : "Tài liệu đính kèm (Việc thường quy - Tùy chọn)"}
                </h3>
                {((task as StaffTask).deliverables?.length || 0) > 0 && (
                  <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
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
                            <span className="font-mono text-[10.5px] text-muted-foreground tabular-nums">
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
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline shrink-0"
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

              {/* Deliverable description / summary note if present */}
              {(task as StaffTask).deliverableDescription && (
                <div className="rounded-xl border border-border/40 bg-muted/30 p-3 space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    Báo cáo kết quả công việc:
                  </span>
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                    {(task as StaffTask).deliverableDescription}
                  </p>
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
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {(task as StaffTask).requiresReview
                        ? "Cung cấp đường dẫn tệp tài liệu và mô tả kết quả công việc theo tiêu chuẩn DACUM & Nghị định 232 để Trưởng phòng nghiệm thu."
                        : "Viên chức có thể đính kèm đường dẫn tài liệu lưu trữ hoặc dùng nút 'Hoàn thành nhiệm vụ' trên thanh tác vụ."}
                    </p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <label
                        htmlFor="deliverable-name"
                        className="block font-medium text-muted-foreground mb-1 text-[11px]"
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
                        className="block font-medium text-muted-foreground mb-1 text-[11px]"
                      >
                        Đường dẫn tài liệu / tệp đính kèm (Drive, Cloud, File URL)
                      </label>
                      <input
                        id="deliverable-url"
                        type="url"
                        value={deliverableUrl}
                        onChange={(e) => setDeliverableUrl(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring font-mono text-[11px]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="deliverable-notes"
                        className="block font-medium text-muted-foreground mb-1 text-[11px]"
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
                    <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                      {deliverableError}
                    </p>
                  )}

                  {deliverableSuccess && (
                    <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
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

          {/* Subtasks Section (SchoolTask only) */}
          {isSchool && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-sans text-sm font-semibold text-foreground tracking-tight">
                    Tiến độ công việc trực thuộc
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Theo dõi tỷ lệ hoàn thành các đầu việc thành phần
                  </p>
                </div>
                {onAddSubTask && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddingSubtask(!isAddingSubtask)}
                    className="h-7 text-xs gap-1 border-dashed border-border/80 hover:border-border hover:bg-secondary/60 rounded-lg cursor-pointer"
                  >
                    <Plus className="size-3.5" strokeWidth={1.5} />
                    <span>Giao việc con</span>
                  </Button>
                )}
              </div>

              {/* Add Subtask Inline Form */}
              {isAddingSubtask && (
                <form
                  onSubmit={handleCreateSubtask}
                  className="p-3 rounded-xl border border-border/60 bg-muted/30 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200"
                >
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Nhập tên việc con cần phân công..."
                    className="flex-1 text-xs bg-background border border-border/60 rounded-lg px-2.5 py-1.5 outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!newSubtaskTitle.trim()}
                    className="h-7 text-xs px-3 rounded-lg cursor-pointer"
                  >
                    Lưu
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddingSubtask(false)}
                    className="h-7 text-xs px-2 text-muted-foreground rounded-lg cursor-pointer"
                  >
                    Hủy
                  </Button>
                </form>
              )}

              {/* Subtask Clean List */}
              <div className="divide-y divide-border/40 rounded-xl border border-border/50 bg-card overflow-hidden shadow-xs">
                {task.subTasks.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Chưa có công việc đơn vị trực thuộc
                  </div>
                ) : (
                  task.subTasks.map((sub) => {
                    const subStatus = getDetailStatusConfig(sub.status);
                    const subDone = sub.status === "COMPLETED";

                    return (
                      <div
                        key={sub.id}
                        tabIndex={0}
                        onClick={() => onSelectSubTask?.(sub)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectSubTask?.(sub);
                          }
                        }}
                        className="group flex items-center justify-between gap-3 p-3 transition-colors hover:bg-secondary/40 cursor-pointer"
                        role="button"
                        aria-label={`Chi tiết việc con: ${sub.title}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {subDone ? (
                            <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
                          ) : (
                            <Circle className="size-4 shrink-0 text-muted-foreground/50" strokeWidth={1.5} />
                          )}
                          <span
                            className={cn(
                              "text-xs font-medium text-foreground truncate",
                              subDone && "line-through text-muted-foreground"
                            )}
                          >
                            {sub.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="text-[11px] text-muted-foreground hidden sm:inline">
                            {sub.assigneeName}
                          </span>
                          <Badge
                            variant={subStatus.variant}
                            className={cn(
                              "text-[10px] px-2 py-0.5 rounded-md font-medium",
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

          {/* Audit Timeline Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <History className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
                Nhật ký hoạt động & tiến độ
              </h3>
              <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                {auditTimeline.length} sự kiện
              </span>
            </div>

            <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border/60">
              {auditTimeline.map((item) => (
                <div key={item.id} className="relative flex flex-col gap-0.5">
                  {/* Flat round node */}
                  <span className="absolute -left-5 top-1 flex size-4 items-center justify-center rounded-full border border-border/80 bg-card">
                    <span className="size-1.5 rounded-full bg-primary/70" />
                  </span>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {item.label}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      {item.timestamp}
                    </span>
                  </div>

                  {item.description && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  )}

                  {item.actor && (
                    <span className="text-[10.5px] font-medium text-muted-foreground/80">
                      Chủ thể: {item.actor}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Rejection Modal Dialog for Manager Review */}
      {isRejectionModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rejection-dialog-title"
        >
          <div className="w-full max-w-md rounded-xl border border-border/60 bg-card p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" strokeWidth={1.5} />
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
              Theo quy định phân quyền DACUM và Nghị định 232, Trưởng đơn vị bắt buộc phải ghi rõ lý do và nội dung cần khắc phục khi trả lại công việc.
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
                <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
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
        </div>
      )}
    </>
  );

  if (mounted && typeof document !== "undefined") {
    return createPortal(sheetContent, document.body);
  }

  return sheetContent;
}

export default TaskDetailSideSheet;
