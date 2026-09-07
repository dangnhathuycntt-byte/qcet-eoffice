"use client";

import * as React from "react";
import Link from "next/link";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  Search,
  Filter,
  Calendar,
  ArrowRight,
  ExternalLink,
  FileText,
  CheckCircle,
  Inbox,
  AlertCircle,
  Eye,
  Layers,
  Sparkles,
  X,
  User,
  Building2,
  Plus,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import type {
  StaffUrgencySummary,
  DeliverableSubmissionPayload,
} from "@/types/workspace";
import { matchesUser } from "@/lib/role-task-filter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SubmitDeliverableModal } from "./submit-deliverable-modal";

// ============================================================================
// 1. Types & Interfaces
// ============================================================================

export interface StaffTaskWithContext extends StaffTask {
  parentSchoolTaskId: string;
  parentTaskTitle?: string;
  parentTaskCategory?: string;
  parentCategoryLabel?: string;
}

export type LecturerFilterTab =
  | "ALL"
  | "TODAY"
  | "THIS_WEEK"
  | "IN_PROGRESS"
  | "NEEDS_REVIEW"
  | "REVISION"
  | "COMPLETED";

export interface LecturerFocusWorkspaceProps {
  user: AuthUser;
  tasks?: SchoolTask[];
  staffTasks?: StaffTask[];
  onSelectTask?: (task: StaffTask | SchoolTask) => void;
  onSubmitDeliverable?: (
    payload: DeliverableSubmissionPayload
  ) => Promise<void> | void;
  onStatusChange?: (
    taskId: string,
    newStatus: TaskStatus,
    note?: string
  ) => void;
  referenceDate?: string;
  tasksUrl?: string;
  className?: string;
}

// ============================================================================
// 2. Pure Helper Functions (Exported for Testing)
// ============================================================================

/**
 * Calculates date difference in UTC days between due date and reference date.
 */
export function getDaysRemaining(
  dueDateStr?: string,
  referenceDate?: string
): number | null {
  if (!dueDateStr) return null;
  const ref = referenceDate
    ? new Date(referenceDate + "T00:00:00Z")
    : new Date();
  const refDate = new Date(
    Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate())
  );

  const dueParts = dueDateStr.slice(0, 10).split("-");
  if (dueParts.length !== 3) return null;
  const due = new Date(
    Date.UTC(
      Number(dueParts[0]),
      Number(dueParts[1]) - 1,
      Number(dueParts[2])
    )
  );

  const diffTime = due.getTime() - refDate.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Generates badge label and variant styling for task countdowns.
 */
export function getDeadlineBadgeInfo(
  dueDateStr?: string,
  referenceDate?: string
): {
  label: string;
  variant: "urgent" | "warning" | "neutral" | "completed";
  daysLeft: number | null;
} {
  if (!dueDateStr) {
    return { label: "Không có hạn", variant: "neutral", daysLeft: null };
  }

  const days = getDaysRemaining(dueDateStr, referenceDate);
  if (days === null) {
    return { label: "Không có hạn", variant: "neutral", daysLeft: null };
  }

  if (days < 0) {
    return {
      label: `Quá hạn ${Math.abs(days)} ngày`,
      variant: "urgent",
      daysLeft: days,
    };
  }
  if (days === 0) {
    return {
      label: "Hạn chót: Hôm nay",
      variant: "urgent",
      daysLeft: 0,
    };
  }
  if (days === 1) {
    return {
      label: "Hạn chót: Ngày mai",
      variant: "warning",
      daysLeft: 1,
    };
  }
  if (days <= 7) {
    return {
      label: `Hạn chót: Còn ${days} ngày`,
      variant: "warning",
      daysLeft: days,
    };
  }

  return {
    label: `Còn ${days} ngày`,
    variant: "neutral",
    daysLeft: days,
  };
}

/**
 * Computes StaffUrgencySummary metrics for the executive strip.
 */
export function computeStaffUrgencySummary(
  tasks: StaffTask[],
  referenceDate?: string
): StaffUrgencySummary {
  const refDate = referenceDate || new Date().toISOString().slice(0, 10);
  const refDateObj = new Date(refDate + "T00:00:00Z");
  const sevenDaysLaterObj = new Date(refDateObj);
  sevenDaysLaterObj.setUTCDate(sevenDaysLaterObj.getUTCDate() + 7);
  const sevenDaysLaterStr = sevenDaysLaterObj.toISOString().slice(0, 10);

  let todayCount = 0;
  let thisWeekCount = 0;
  let waitingApprovalCount = 0;
  let revisionRequestedCount = 0;
  let completedCount = 0;

  for (const task of tasks) {
    if (task.status === "COMPLETED") {
      completedCount++;
      continue;
    }

    if (task.rejectionReason && task.rejectionReason.trim().length > 0) {
      revisionRequestedCount++;
    }

    if (task.status === "NEEDS_REVIEW") {
      waitingApprovalCount++;
      continue;
    }

    const taskDueDate = task.dueDate ? task.dueDate.slice(0, 10) : "";

    // Due today, overdue, or blocked
    if (!taskDueDate || taskDueDate <= refDate || task.status === "BLOCKED") {
      todayCount++;
    } else if (taskDueDate <= sevenDaysLaterStr) {
      thisWeekCount++;
    }
  }

  return {
    todayCount,
    thisWeekCount,
    waitingApprovalCount,
    revisionRequestedCount,
    completedCount,
  };
}

/**
 * Extracts all subtasks assigned to staff user from school tasks array.
 */
export function extractStaffTasksFromSchoolTasks(
  tasks: SchoolTask[],
  user: AuthUser
): StaffTaskWithContext[] {
  if (!tasks || tasks.length === 0 || !user) return [];

  const results: StaffTaskWithContext[] = [];

  for (const schoolTask of tasks) {
    if (!schoolTask.subTasks || schoolTask.subTasks.length === 0) continue;

    for (const sub of schoolTask.subTasks) {
      const isAssigned =
        (sub.assigneeId && sub.assigneeId === user.id) ||
        matchesUser(sub.assigneeName, user);

      if (isAssigned) {
        results.push({
          ...sub,
          parentSchoolTaskId: schoolTask.id,
          parentTaskTitle: schoolTask.title,
          parentTaskCategory: schoolTask.category,
          parentCategoryLabel: schoolTask.categoryLabel,
        });
      }
    }
  }

  return results;
}

/**
 * Filters staff tasks based on filter tab and search term.
 */
export function filterStaffTasks(
  tasks: StaffTaskWithContext[],
  filter: LecturerFilterTab,
  searchTerm: string = "",
  referenceDate?: string
): StaffTaskWithContext[] {
  const refDate = referenceDate || new Date().toISOString().slice(0, 10);
  const refDateObj = new Date(refDate + "T00:00:00Z");
  const sevenDaysLaterObj = new Date(refDateObj);
  sevenDaysLaterObj.setUTCDate(sevenDaysLaterObj.getUTCDate() + 7);
  const sevenDaysLaterStr = sevenDaysLaterObj.toISOString().slice(0, 10);

  const cleanSearch = searchTerm.trim().toLowerCase();

  return tasks.filter((task) => {
    // Search keyword matching
    if (cleanSearch) {
      const matchTitle = (task.title || "").toLowerCase().includes(cleanSearch);
      const matchId = (task.id || "").toLowerCase().includes(cleanSearch);
      const matchParentId = (task.parentSchoolTaskId || "")
        .toLowerCase()
        .includes(cleanSearch);
      const matchParentTitle = (task.parentTaskTitle || "")
        .toLowerCase()
        .includes(cleanSearch);
      if (!matchTitle && !matchId && !matchParentId && !matchParentTitle) {
        return false;
      }
    }

    const taskDueDate = task.dueDate ? task.dueDate.slice(0, 10) : "";

    switch (filter) {
      case "TODAY":
        return (
          task.status !== "COMPLETED" &&
          task.status !== "NEEDS_REVIEW" &&
          (!taskDueDate || taskDueDate <= refDate || task.status === "BLOCKED")
        );
      case "THIS_WEEK":
        return (
          task.status !== "COMPLETED" &&
          task.status !== "NEEDS_REVIEW" &&
          taskDueDate > refDate &&
          taskDueDate <= sevenDaysLaterStr
        );
      case "IN_PROGRESS":
        return task.status === "IN_PROGRESS" || task.status === "NEW";
      case "NEEDS_REVIEW":
        return task.status === "NEEDS_REVIEW";
      case "REVISION":
        return (
          task.status !== "COMPLETED" &&
          Boolean(task.rejectionReason && task.rejectionReason.trim().length > 0)
        );
      case "COMPLETED":
        return task.status === "COMPLETED";
      case "ALL":
      default:
        return true;
    }
  });
}

/**
 * Sorts tasks so urgent/pending tasks appear first and completed tasks appear last.
 */
export function sortStaffTasks(
  tasks: StaffTaskWithContext[]
): StaffTaskWithContext[] {
  return [...tasks].sort((a, b) => {
    // Completed tasks sorted to bottom
    if (a.status === "COMPLETED" && b.status !== "COMPLETED") return 1;
    if (a.status !== "COMPLETED" && b.status === "COMPLETED") return -1;

    // Revision requested prioritized
    const aRev = Boolean(a.rejectionReason?.trim());
    const bRev = Boolean(b.rejectionReason?.trim());
    if (aRev && !bRev) return -1;
    if (!aRev && bRev) return 1;

    // Blocked prioritized next
    if (a.status === "BLOCKED" && b.status !== "BLOCKED") return -1;
    if (a.status !== "BLOCKED" && b.status === "BLOCKED") return 1;

    // Earliest dueDate first
    const aDue = a.dueDate ? a.dueDate.slice(0, 10) : "9999-99-99";
    const bDue = b.dueDate ? b.dueDate.slice(0, 10) : "9999-99-99";
    return aDue.localeCompare(bDue);
  });
}

// ============================================================================
// 3. Status Mapping & Badges Helper
// ============================================================================

export function renderStatusBadge(status: TaskStatus) {
  switch (status) {
    case "IN_PROGRESS":
      return (
        <Badge
          variant="outline"
          className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 text-xs font-medium"
        >
          Đang thực hiện
        </Badge>
      );
    case "NEEDS_REVIEW":
      return (
        <Badge
          variant="outline"
          className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30 text-xs font-medium"
        >
          Chờ thẩm định
        </Badge>
      );
    case "BLOCKED":
      return (
        <Badge
          variant="outline"
          className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 text-xs font-medium"
        >
          Bị nghẽn
        </Badge>
      );
    case "COMPLETED":
      return (
        <Badge
          variant="outline"
          className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs font-medium"
        >
          Đã hoàn thành
        </Badge>
      );
    case "NEW":
    default:
      return (
        <Badge
          variant="outline"
          className="bg-muted text-muted-foreground border-border text-xs font-medium"
        >
          Mới tiếp nhận
        </Badge>
      );
  }
}

// ============================================================================
// 4. Main Component: LecturerFocusWorkspace
// ============================================================================

export function LecturerFocusWorkspace({
  user,
  tasks = [],
  staffTasks,
  onSelectTask,
  onSubmitDeliverable,
  onStatusChange,
  referenceDate,
  tasksUrl = "/tasks",
  className,
}: LecturerFocusWorkspaceProps) {
  // 1. Resolve normalized staff tasks with parent context
  const resolvedTasks: StaffTaskWithContext[] = React.useMemo(() => {
    if (staffTasks && staffTasks.length > 0) {
      return staffTasks.map((st) => ({
        ...st,
        parentSchoolTaskId: st.parentSchoolTaskId || "task-root",
      }));
    }
    if (tasks && tasks.length > 0) {
      return extractStaffTasksFromSchoolTasks(tasks, user);
    }
    return [];
  }, [staffTasks, tasks, user]);

  // 2. Metrics summary
  const summary: StaffUrgencySummary = React.useMemo(() => {
    return computeStaffUrgencySummary(resolvedTasks, referenceDate);
  }, [resolvedTasks, referenceDate]);

  // 3. Filter & search state
  const [activeFilter, setActiveFilter] =
    React.useState<LecturerFilterTab>("ALL");
  const [searchTerm, setSearchTerm] = React.useState<string>("");

  // 4. Deliverable submission modal state
  const [selectedTaskForSubmission, setSelectedTaskForSubmission] =
    React.useState<StaffTask | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] =
    React.useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  const handleOpenSubmitModal = (task: StaffTask) => {
    setSelectedTaskForSubmission(task);
    setIsSubmitModalOpen(true);
  };

  const handleCloseSubmitModal = () => {
    setIsSubmitModalOpen(false);
    setSelectedTaskForSubmission(null);
  };

  const handleModalSubmit = async (payload: DeliverableSubmissionPayload) => {
    setIsSubmitting(true);
    try {
      if (onSubmitDeliverable) {
        await onSubmitDeliverable(payload);
      }
      if (onStatusChange && payload.taskId) {
        onStatusChange(payload.taskId, "NEEDS_REVIEW", payload.note);
      }
      handleCloseSubmitModal();
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Filter & sort tasks
  const filteredTasks = React.useMemo(() => {
    const filtered = filterStaffTasks(
      resolvedTasks,
      activeFilter,
      searchTerm,
      referenceDate
    );
    return sortStaffTasks(filtered);
  }, [resolvedTasks, activeFilter, searchTerm, referenceDate]);

  // 6. Pill click handler
  const handlePillClick = (filter: LecturerFilterTab) => {
    setActiveFilter(filter);
  };

  // 7. Stat strip toggle handler
  const handleStatCardClick = (filter: LecturerFilterTab) => {
    setActiveFilter((prev) => (prev === filter ? "ALL" : filter));
  };

  return (
    <div className={cn("space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6", className)}>
      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Personal Welcome Header */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/70 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary font-medium text-xs tracking-wide uppercase">
            <Sparkles className="size-3.5" strokeWidth={1.5} />
            <span>Bàn làm việc Giảng viên &amp; Chuyên viên</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Xin chào, {user.name}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-0.5">
            <span className="flex items-center gap-1">
              <Building2 className="size-3.5" strokeWidth={1.5} />
              <span>{user.department || user.departmentCode || "Bộ môn"}</span>
            </span>
            <span className="text-border">•</span>
            <span className="flex items-center gap-1">
              <User className="size-3.5" strokeWidth={1.5} />
              <span>{user.roleLabel || "Chuyên viên"}</span>
            </span>
          </div>
        </div>

        {/* Actions: Quick Create Task & Global Task Warehouse Link */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("qcet:open-create-task", {
                  detail: { leadAssigneeName: user.name },
                })
              );
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs cursor-pointer active:scale-95"
            title="Tự tạo công việc cá nhân mới"
          >
            <Plus className="size-3.5" strokeWidth={2} />
            <span>Tạo việc mới</span>
          </Button>

          <Link
            href={tasksUrl}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-border/80 bg-background/60 hover:bg-muted text-foreground transition-all shadow-xs"
          >
            <Eye className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
            <span>Kho nhiệm vụ toàn trường</span>
            <ArrowRight className="size-3 text-muted-foreground" strokeWidth={1.5} />
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Executive Stat Strip (5 Metrics Cards) */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Today */}
        <button
          type="button"
          onClick={() => handleStatCardClick("TODAY")}
          className={cn(
            "group relative text-left rounded-2xl border p-4 transition-all duration-200 cursor-pointer",
            activeFilter === "TODAY"
              ? "border-rose-500 bg-rose-500/10 ring-2 ring-rose-500/30 shadow-xs"
              : "border-border/70 bg-card hover:bg-muted/40 hover:border-border"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Hôm nay cần làm
            </span>
            <div
              className={cn(
                "p-1.5 rounded-lg",
                summary.todayCount > 0
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Clock className="size-4" strokeWidth={1.5} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {summary.todayCount}
            </span>
            <span className="text-xs text-muted-foreground">việc</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
            Quá hạn hoặc đến hạn
          </p>
        </button>

        {/* Card 2: This Week */}
        <button
          type="button"
          onClick={() => handleStatCardClick("THIS_WEEK")}
          className={cn(
            "group relative text-left rounded-2xl border p-4 transition-all duration-200 cursor-pointer",
            activeFilter === "THIS_WEEK"
              ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30 shadow-xs"
              : "border-border/70 bg-card hover:bg-muted/40 hover:border-border"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Trong tuần này
            </span>
            <div
              className={cn(
                "p-1.5 rounded-lg",
                summary.thisWeekCount > 0
                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Calendar className="size-4" strokeWidth={1.5} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {summary.thisWeekCount}
            </span>
            <span className="text-xs text-muted-foreground">việc</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
            Hạn chót trong 7 ngày tới
          </p>
        </button>

        {/* Card 3: Awaiting Approval */}
        <button
          type="button"
          onClick={() => handleStatCardClick("NEEDS_REVIEW")}
          className={cn(
            "group relative text-left rounded-2xl border p-4 transition-all duration-200 cursor-pointer",
            activeFilter === "NEEDS_REVIEW"
              ? "border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/30 shadow-xs"
              : "border-border/70 bg-card hover:bg-muted/40 hover:border-border"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Chờ lãnh đạo duyệt
            </span>
            <div
              className={cn(
                "p-1.5 rounded-lg",
                summary.waitingApprovalCount > 0
                  ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Layers className="size-4" strokeWidth={1.5} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {summary.waitingApprovalCount}
            </span>
            <span className="text-xs text-muted-foreground">hồ sơ</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
            Đang trong luồng thẩm định
          </p>
        </button>

        {/* Card 4: Revision Requested */}
        <button
          type="button"
          onClick={() => handleStatCardClick("REVISION")}
          className={cn(
            "group relative text-left rounded-2xl border p-4 transition-all duration-200 cursor-pointer",
            activeFilter === "REVISION"
              ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30 shadow-xs"
              : "border-border/70 bg-card hover:bg-muted/40 hover:border-border"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Cần chỉnh sửa
            </span>
            <div
              className={cn(
                "p-1.5 rounded-lg",
                summary.revisionRequestedCount > 0
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <AlertTriangle className="size-4" strokeWidth={1.5} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {summary.revisionRequestedCount}
            </span>
            <span className="text-xs text-muted-foreground">việc</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
            Cần bổ sung minh chứng
          </p>
        </button>

        {/* Card 5: Completed */}
        <button
          type="button"
          onClick={() => handleStatCardClick("COMPLETED")}
          className={cn(
            "group relative text-left rounded-2xl border p-4 transition-all duration-200 cursor-pointer col-span-2 sm:col-span-1",
            activeFilter === "COMPLETED"
              ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30 shadow-xs"
              : "border-border/70 bg-card hover:bg-muted/40 hover:border-border"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Đã hoàn thành
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" strokeWidth={1.5} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {summary.completedCount}
            </span>
            <span className="text-xs text-muted-foreground">việc</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
            Đã nghiệm thu đạt chuẩn
          </p>
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: Search & Quick Pill Filters */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
              strokeWidth={1.5}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên nhiệm vụ, mã công việc..."
              className="w-full rounded-xl border border-border/70 bg-background pl-9 pr-8 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded-md"
              >
                <X className="size-3.5" strokeWidth={1.5} />
              </button>
            )}
          </div>

          {/* Active Filter Indicator / Counter */}
          <div className="flex items-center justify-end text-xs text-muted-foreground gap-1.5">
            <Filter className="size-3.5" strokeWidth={1.5} />
            <span>
              Hiển thị <strong>{filteredTasks.length}</strong> /{" "}
              {resolvedTasks.length} nhiệm vụ
            </span>
          </div>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => handlePillClick("ALL")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer",
              activeFilter === "ALL"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            Tất cả ({resolvedTasks.length})
          </button>

          <button
            type="button"
            onClick={() => handlePillClick("TODAY")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
              activeFilter === "TODAY"
                ? "bg-rose-600 text-white font-semibold shadow-xs"
                : "bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20"
            )}
          >
            <span>Khẩn cấp / Quá hạn</span>
            <span className="text-xs font-bold">({summary.todayCount})</span>
          </button>

          <button
            type="button"
            onClick={() => handlePillClick("THIS_WEEK")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
              activeFilter === "THIS_WEEK"
                ? "bg-blue-600 text-white font-semibold shadow-xs"
                : "bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20"
            )}
          >
            <span>Trong tuần này</span>
            <span className="text-xs font-bold">({summary.thisWeekCount})</span>
          </button>

          <button
            type="button"
            onClick={() => handlePillClick("IN_PROGRESS")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer",
              activeFilter === "IN_PROGRESS"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            Đang làm
          </button>

          <button
            type="button"
            onClick={() => handlePillClick("NEEDS_REVIEW")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
              activeFilter === "NEEDS_REVIEW"
                ? "bg-purple-600 text-white font-semibold shadow-xs"
                : "bg-purple-500/10 text-purple-700 dark:text-purple-400 hover:bg-purple-500/20"
            )}
          >
            <span>Chờ duyệt</span>
            <span className="text-xs font-bold">
              ({summary.waitingApprovalCount})
            </span>
          </button>

          <button
            type="button"
            onClick={() => handlePillClick("REVISION")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
              activeFilter === "REVISION"
                ? "bg-amber-600 text-white font-semibold shadow-xs"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
            )}
          >
            <span>Cần bổ sung</span>
            <span className="text-xs font-bold">
              ({summary.revisionRequestedCount})
            </span>
          </button>

          <button
            type="button"
            onClick={() => handlePillClick("COMPLETED")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
              activeFilter === "COMPLETED"
                ? "bg-emerald-600 text-white font-semibold shadow-xs"
                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
            )}
          >
            <span>Đã xong</span>
            <span className="text-xs font-bold">
              ({summary.completedCount})
            </span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 4: Task List Cards */}
      {/* ------------------------------------------------------------------ */}
      {filteredTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center bg-card/40">
          <div className="mx-auto size-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground mb-3">
            <Inbox className="size-6" strokeWidth={1.5} />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            Không tìm thấy nhiệm vụ nào
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            Không có công việc nào thỏa mãn tiêu chí tìm kiếm hoặc bộ lọc hiện
            tại.
          </p>
          {(activeFilter !== "ALL" || searchTerm) && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveFilter("ALL");
                  setSearchTerm("");
                }}
                className="text-xs rounded-xl"
              >
                Xóa bộ lọc &amp; xem tất cả
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredTasks.map((task) => {
            const countdownInfo = getDeadlineBadgeInfo(
              task.dueDate,
              referenceDate
            );
            const hasRevision = Boolean(
              task.rejectionReason && task.rejectionReason.trim().length > 0
            );
            const hasBlocked = Boolean(
              task.status === "BLOCKED" ||
                (task.blockedReason && task.blockedReason.trim().length > 0)
            );

            return (
              <div
                key={task.id}
                className={cn(
                  "group relative rounded-2xl border p-4 sm:p-5 transition-all duration-200 bg-card hover:shadow-xs",
                  hasRevision
                    ? "border-amber-500/40 bg-amber-500/[0.02]"
                    : hasBlocked
                    ? "border-rose-500/40 bg-rose-500/[0.02]"
                    : task.status === "COMPLETED"
                    ? "border-border/60 opacity-80"
                    : "border-border/80 hover:border-border"
                )}
              >
                <div className="space-y-3">
                  {/* Top Row: Parent Context, Deadline Countdown & Status */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {task.parentTaskTitle && (
                        <span className="text-xs font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md line-clamp-1 max-w-xs sm:max-w-md">
                          {task.parentTaskTitle}
                        </span>
                      )}
                      {task.parentCategoryLabel && (
                        <span className="text-xs uppercase tracking-wider font-semibold text-primary/80 bg-primary/10 px-2 py-0.5 rounded-md">
                          {task.parentCategoryLabel}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Deadline Countdown Badge */}
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold",
                          countdownInfo.variant === "urgent"
                            ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/20"
                            : countdownInfo.variant === "warning"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                            : "bg-muted text-muted-foreground border border-border/70"
                        )}
                      >
                        <Clock className="size-3" strokeWidth={1.5} />
                        <span>{countdownInfo.label}</span>
                      </span>

                      {/* Status Badge */}
                      {renderStatusBadge(task.status)}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-1">
                    <h3 className="text-sm sm:text-base font-semibold text-foreground tracking-tight group-hover:text-primary transition-colors">
                      {task.title}
                    </h3>
                    {task.deliverableDescription && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {task.deliverableDescription}
                      </p>
                    )}
                  </div>

                  {/* Prominent Alert: Revision Requested */}
                  {hasRevision && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                      <div className="flex items-start gap-2">
                        <AlertTriangle
                          className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5"
                          strokeWidth={1.5}
                        />
                        <div className="space-y-0.5">
                          <p className="font-semibold text-amber-800 dark:text-amber-300">
                            Yêu cầu chỉnh sửa từ Trưởng đơn vị:
                          </p>
                          <p className="text-amber-900/90 dark:text-amber-200/90">
                            {task.rejectionReason}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Prominent Alert: Blocked Task */}
                  {hasBlocked && task.blockedReason && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-900 dark:text-rose-200">
                      <div className="flex items-start gap-2">
                        <AlertCircle
                          className="size-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5"
                          strokeWidth={1.5}
                        />
                        <div className="space-y-0.5">
                          <p className="font-semibold text-rose-800 dark:text-rose-300">
                            Lý do tắc nghẽn công việc:
                          </p>
                          <p className="text-rose-900/90 dark:text-rose-200/90">
                            {task.blockedReason}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Attached Deliverables List (if any) */}
                  {task.deliverables && task.deliverables.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <FileText className="size-3 text-muted-foreground" strokeWidth={1.5} />
                        <span>Minh chứng đã đính kèm:</span>
                      </span>
                      {task.deliverables.map((del) => (
                        <div
                          key={del.id || del.name}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/80 text-xs text-foreground border border-border/60"
                        >
                          <span className="max-w-[200px] truncate">{del.name}</span>
                          {del.url && (
                            <a
                              href={del.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline ml-0.5"
                            >
                              <ExternalLink className="size-2.5 inline" strokeWidth={1.5} />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bottom Action Strip */}
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span>Mã:</span>
                      <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs text-foreground">
                        {task.id}
                      </code>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Secondary action: Xem chi tiết */}
                      {onSelectTask && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelectTask(task)}
                          className="text-xs h-8 rounded-xl gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <Eye className="size-3.5" strokeWidth={1.5} />
                          <span>Chi tiết</span>
                        </Button>
                      )}

                      {/* Primary One-Click Action: Nộp minh chứng */}
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleOpenSubmitModal(task)}
                        className="text-xs font-semibold h-8 rounded-xl gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer"
                      >
                        <UploadCloud className="size-3.5" strokeWidth={1.5} />
                        <span>
                          {task.status === "COMPLETED"
                            ? "Cập nhật minh chứng"
                            : "Nộp minh chứng"}
                        </span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Section 5: Modal Nộp Minh Chứng Integration */}
      {/* ------------------------------------------------------------------ */}
      <SubmitDeliverableModal
        isOpen={isSubmitModalOpen}
        onClose={handleCloseSubmitModal}
        task={selectedTaskForSubmission}
        onSubmit={handleModalSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

export const StaffWorkspace = LecturerFocusWorkspace;
export default LecturerFocusWorkspace;
