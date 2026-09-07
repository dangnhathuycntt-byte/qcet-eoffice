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
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  Users,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import type {
  StaffUrgencySummary,
  DeliverableSubmissionPayload,
  OwnershipRoleFilter,
  GroupedParentTaskView,
} from "@/types/workspace";
import { matchesUser } from "@/lib/role-task-filter";
import {
  groupSchoolTasksForWorkspace,
  filterGroupedTasks,
  calculateAssigneeWorkloads,
} from "@/lib/task-ownership";
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
  onRefresh?: () => void;
  isRefreshing?: boolean;
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

export function renderStatusBadge(
  status: TaskStatus | "PENDING_EXECUTIVE_APPROVAL"
) {
  switch (status) {
    case "PENDING_EXECUTIVE_APPROVAL":
      return (
        <Badge
          variant="outline"
          className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs font-medium"
        >
          Chờ BGH duyệt
        </Badge>
      );
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

export function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "...", total];
  }
  if (current >= total - 3) {
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, "...", current - 1, current, current + 1, "...", total];
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
  onRefresh,
  isRefreshing,
}: LecturerFocusWorkspaceProps) {
  // Clean role label (strip redundant parenthesized name)
  const cleanRoleLabel = React.useMemo(() => {
    const raw = user.roleLabel || "Chuyên viên";
    return raw.replace(/\s*\(.*?\)\s*/g, "").trim() || "Chuyên viên";
  }, [user.roleLabel]);

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
  const [ownershipFilter, setOwnershipFilter] =
    React.useState<OwnershipRoleFilter>("ALL");

  // Pagination state (default: 10 items/page)
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const [pageSize, setPageSize] = React.useState<number>(10);

  // Auto-collapse state for parent tasks
  // If task ID is in collapsedGroupIds, use explicit user preference.
  // Otherwise, completed tasks (100% or COMPLETED) default to true (collapsed), active tasks to false (expanded).
  const [collapsedGroupIds, setCollapsedGroupIds] = React.useState<
    Record<string, boolean>
  >({});

  const isTaskCollapsed = React.useCallback(
    (groupId: string, isCompleted: boolean) => {
      if (groupId in collapsedGroupIds) {
        return collapsedGroupIds[groupId];
      }
      return isCompleted;
    },
    [collapsedGroupIds]
  );

  const toggleCollapse = (groupId: string, currentCollapsed: boolean) => {
    setCollapsedGroupIds((prev) => ({
      ...prev,
      [groupId]: !currentCollapsed,
    }));
  };

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

  // 5. Effective school tasks & 2-tier grouped parent tasks
  const effectiveSchoolTasks: SchoolTask[] = React.useMemo(() => {
    if (tasks && tasks.length > 0) {
      return tasks;
    }
    if (staffTasks && staffTasks.length > 0) {
      const map = new Map<string, StaffTask[]>();
      for (const st of staffTasks) {
        const pid = st.parentSchoolTaskId || `parent-${st.id}`;
        if (!map.has(pid)) {
          map.set(pid, []);
        }
        map.get(pid)!.push(st);
      }
      return Array.from(map.entries()).map(([pid, stList]) => {
        const first = stList[0];
        const completedCount = stList.filter((s) => s.status === "COMPLETED").length;
        return {
          id: pid,
          title: (first as any).parentTaskTitle || first.title,
          category: ((first as any).parentTaskCategory || "CHUYEN_MON") as any,
          categoryLabel: (first as any).parentCategoryLabel || "Chuyên môn",
          leadAssigneeName: first.assigneeName,
          coAssignees: Array.from(new Set(stList.map((s) => s.assigneeName))),
          assignedDate: first.updatedAt?.slice(0, 10) || "2026-09-01",
          dueDate: first.dueDate?.slice(0, 10) || "2026-09-30",
          status: (completedCount === stList.length ? "COMPLETED" : "IN_PROGRESS") as "IN_PROGRESS" | "PENDING_EXECUTIVE_APPROVAL" | "COMPLETED",
          subTasks: stList,
          totalSubTasks: stList.length,
          completedSubTasks: completedCount,
          progressPercent: stList.length > 0 ? Math.round((completedCount / stList.length) * 100) : 0,
          origin: "SCHOOL" as const,
        };
      });
    }
    return [];
  }, [tasks, staffTasks]);

  const groupedTasks: GroupedParentTaskView[] = React.useMemo(() => {
    return groupSchoolTasksForWorkspace(effectiveSchoolTasks, user);
  }, [effectiveSchoolTasks, user]);

  const countLeading = React.useMemo(() => {
    return groupedTasks.filter((g) => g.isLeading).length;
  }, [groupedTasks]);

  const countParticipating = React.useMemo(() => {
    return groupedTasks.filter((g) => g.isParticipating).length;
  }, [groupedTasks]);

  const filteredGroupedTasks: GroupedParentTaskView[] = React.useMemo(() => {
    let result = filterGroupedTasks(groupedTasks, {
      ownershipFilter,
      statusFilter:
        activeFilter === "TODAY" ||
        activeFilter === "THIS_WEEK" ||
        activeFilter === "REVISION"
          ? undefined
          : activeFilter,
      searchTerm,
    });

    if (activeFilter === "REVISION") {
      result = result.filter((g) => {
        const subList = g.isLeading ? g.allSubTasks : g.userSubTasks;
        return subList.some(
          (st) => Boolean(st.rejectionReason && st.rejectionReason.trim().length > 0)
        );
      });
    } else if (activeFilter === "TODAY") {
      const refDate = referenceDate || new Date().toISOString().slice(0, 10);
      result = result.filter((g) => {
        const pDue = g.parentTask.dueDate ? g.parentTask.dueDate.slice(0, 10) : "";
        if (
          g.parentTask.status !== "COMPLETED" &&
          (!pDue || pDue <= refDate)
        ) {
          return true;
        }
        const subList = g.isLeading ? g.allSubTasks : g.userSubTasks;
        return subList.some((st) => {
          const sDue = st.dueDate ? st.dueDate.slice(0, 10) : "";
          return (
            st.status !== "COMPLETED" &&
            (!sDue || sDue <= refDate || st.status === "BLOCKED")
          );
        });
      });
    } else if (activeFilter === "THIS_WEEK") {
      const refDate = referenceDate || new Date().toISOString().slice(0, 10);
      const refDateObj = new Date(refDate + "T00:00:00Z");
      const sevenDaysLaterObj = new Date(refDateObj);
      sevenDaysLaterObj.setUTCDate(sevenDaysLaterObj.getUTCDate() + 7);
      const sevenDaysLaterStr = sevenDaysLaterObj.toISOString().slice(0, 10);
      result = result.filter((g) => {
        const pDue = g.parentTask.dueDate ? g.parentTask.dueDate.slice(0, 10) : "";
        if (
          g.parentTask.status !== "COMPLETED" &&
          pDue > refDate &&
          pDue <= sevenDaysLaterStr
        ) {
          return true;
        }
        const subList = g.isLeading ? g.allSubTasks : g.userSubTasks;
        return subList.some((st) => {
          const sDue = st.dueDate ? st.dueDate.slice(0, 10) : "";
          return (
            st.status !== "COMPLETED" &&
            sDue > refDate &&
            sDue <= sevenDaysLaterStr
          );
        });
      });
    }

    return result;
  }, [groupedTasks, ownershipFilter, activeFilter, searchTerm, referenceDate]);

  // Reset pagination to page 1 whenever any filter or search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [ownershipFilter, activeFilter, searchTerm, pageSize]);

  const totalTasks = filteredGroupedTasks.length;
  const totalPages = Math.max(1, Math.ceil(totalTasks / pageSize));

  // Sliced tasks for current page
  const paginatedGroupedTasks = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredGroupedTasks.slice(start, start + pageSize);
  }, [filteredGroupedTasks, currentPage, pageSize]);

  // Bulk expand / collapse calculation for currently visible tasks
  const allVisibleCollapsed = React.useMemo(() => {
    if (paginatedGroupedTasks.length === 0) return false;
    return paginatedGroupedTasks.every((g) => {
      const isCompleted =
        g.parentTask.status === "COMPLETED" ||
        g.parentTask.progressPercent === 100;
      return isTaskCollapsed(g.parentTask.id, isCompleted);
    });
  }, [paginatedGroupedTasks, isTaskCollapsed]);

  const handleToggleAllVisible = () => {
    const nextState = !allVisibleCollapsed;
    setCollapsedGroupIds((prev) => {
      const updated = { ...prev };
      paginatedGroupedTasks.forEach((g) => {
        updated[g.parentTask.id] = nextState;
      });
      return updated;
    });
  };

  // 6. Filter & sort legacy tasks (for pure function compatibility)
  const filteredTasks = React.useMemo(() => {
    const filtered = filterStaffTasks(
      resolvedTasks,
      activeFilter,
      searchTerm,
      referenceDate
    );
    return sortStaffTasks(filtered);
  }, [resolvedTasks, activeFilter, searchTerm, referenceDate]);

  // 7. Pill click handler
  const handlePillClick = (filter: LecturerFilterTab) => {
    setActiveFilter(filter);
  };

  // 8. Stat strip toggle handler
  const handleStatCardClick = (filter: LecturerFilterTab) => {
    setActiveFilter((prev) => (prev === filter ? "ALL" : filter));
  };

  return (
    <div className={cn("space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6", className)}>
      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Personal Welcome Header */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-heading">
            Công việc của tôi
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20 font-mono">
              {cleanRoleLabel}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="font-medium text-foreground">{user.name}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>{user.department || user.departmentCode || "Bộ môn"}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="font-mono tabular-nums">Năm học 2026 – 2027</span>
          </div>
        </div>

        {/* Actions: Quick Create Task & Global Task Warehouse Link */}
        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap shrink-0">
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
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs cursor-pointer active:scale-95"
            title="Tự tạo công việc cá nhân mới"
          >
            <Plus className="size-3.5" strokeWidth={2} />
            <span>Tạo việc mới</span>
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="text-xs h-8 gap-1.5 whitespace-nowrap rounded-xl border-border/80 hover:bg-muted/80"
          >
            <Link href={tasksUrl} className="inline-flex items-center gap-1.5">
              <Layers className="size-3.5" strokeWidth={1.5} />
              <span>Kho nhiệm vụ</span>
              <ArrowRight className="size-3 ml-0.5 shrink-0" strokeWidth={1.5} />
            </Link>
          </Button>

          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="text-xs h-8 gap-1.5 rounded-xl border-border/80 hover:bg-muted/80"
              title="Làm mới dữ liệu cá nhân"
            >
              <RefreshCw
                size={13}
                strokeWidth={1.5}
                className={cn("shrink-0", isRefreshing ? "animate-spin text-primary" : "")}
              />
              <span className="hidden sm:inline">Làm mới</span>
            </Button>
          )}
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

          {/* Bulk Expand/Collapse & Active Filter Counter */}
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleToggleAllVisible}
              disabled={paginatedGroupedTasks.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/70 bg-card hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title={
                allVisibleCollapsed
                  ? "Mở rộng tất cả nhiệm vụ trên trang này"
                  : "Thu gọn tất cả nhiệm vụ trên trang này"
              }
            >
              {allVisibleCollapsed ? (
                <>
                  <ChevronDown className="size-3.5" strokeWidth={1.5} />
                  <span>Mở rộng tất cả</span>
                </>
              ) : (
                <>
                  <ChevronUp className="size-3.5" strokeWidth={1.5} />
                  <span>Thu gọn tất cả</span>
                </>
              )}
            </button>

            <div className="flex items-center text-xs text-muted-foreground gap-1.5 shrink-0 pl-1 border-l border-border/60">
              <Filter className="size-3.5" strokeWidth={1.5} />
              <span>
                Hiển thị <strong>{filteredGroupedTasks.length}</strong> /{" "}
                {groupedTasks.length} nhiệm vụ
              </span>
            </div>
          </div>
        </div>

        {/* Ownership Role Segmented Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border/70 w-fit">
            <button
              type="button"
              onClick={() => setOwnershipFilter("ALL")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                ownershipFilter === "ALL"
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Tất cả ({groupedTasks.length})
            </button>
            <button
              type="button"
              onClick={() => setOwnershipFilter("LEADING")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
                ownershipFilter === "LEADING"
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <User className="size-3.5" strokeWidth={1.5} />
              <span>Tôi chủ trì (DRI)</span>
              <span className="text-xs font-bold">({countLeading})</span>
            </button>
            <button
              type="button"
              onClick={() => setOwnershipFilter("PARTICIPATING")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
                ownershipFilter === "PARTICIPATING"
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="size-3.5" strokeWidth={1.5} />
              <span>Tôi tham gia (Phối hợp)</span>
              <span className="text-xs font-bold">({countParticipating})</span>
            </button>
          </div>
        </div>

        {/* Status Filter Pills (Without redundant 'Tất cả' button) */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 shrink-0 pr-1">
            <Filter className="size-3" strokeWidth={1.5} />
            <span>Lọc trạng thái:</span>
          </span>

          <button
            type="button"
            onClick={() => handlePillClick(activeFilter === "TODAY" ? "ALL" : "TODAY")}
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
            onClick={() => handlePillClick(activeFilter === "THIS_WEEK" ? "ALL" : "THIS_WEEK")}
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
            onClick={() => handlePillClick(activeFilter === "IN_PROGRESS" ? "ALL" : "IN_PROGRESS")}
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
            onClick={() => handlePillClick(activeFilter === "NEEDS_REVIEW" ? "ALL" : "NEEDS_REVIEW")}
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
            onClick={() => handlePillClick(activeFilter === "REVISION" ? "ALL" : "REVISION")}
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
            onClick={() => handlePillClick(activeFilter === "COMPLETED" ? "ALL" : "COMPLETED")}
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

          {activeFilter !== "ALL" && (
            <button
              type="button"
              onClick={() => setActiveFilter("ALL")}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted border border-border/60 cursor-pointer transition-colors ml-1"
              title="Xóa lọc trạng thái"
            >
              <X className="size-3" strokeWidth={1.5} />
              <span>Xóa lọc</span>
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 4: 2-Tier Task List Cards */}
      {/* ------------------------------------------------------------------ */}
      {filteredGroupedTasks.length === 0 ? (
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
          {(ownershipFilter !== "ALL" || activeFilter !== "ALL" || searchTerm) && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOwnershipFilter("ALL");
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
        <div className="space-y-4">
          {paginatedGroupedTasks.map((group) => {
            const parentCountdown = getDeadlineBadgeInfo(
              group.parentTask.dueDate,
              referenceDate
            );
            const isCompleted =
              group.parentTask.status === "COMPLETED" ||
              group.parentTask.progressPercent === 100;
            const isCollapsed = isTaskCollapsed(group.parentTask.id, isCompleted);
            const subTasksToRender = group.isLeading
              ? group.allSubTasks
              : group.userSubTasks;

            return (
              <div
                key={group.parentTask.id}
                className="group relative rounded-2xl border border-border/80 bg-card p-4 sm:p-5 transition-all duration-200 hover:border-border shadow-xs space-y-4"
              >
                {/* Tier 1 Header */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Category Badge */}
                      {group.parentTask.categoryLabel && (
                        <span className="text-xs uppercase tracking-wider font-semibold text-primary/80 bg-primary/10 px-2.5 py-0.5 rounded-md">
                          {group.parentTask.categoryLabel}
                        </span>
                      )}

                      {/* Origin Badge */}
                      {group.parentTask.origin === "SELF_INITIATED" ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500/30 text-amber-700 bg-amber-500/10 dark:text-amber-400 dark:bg-amber-500/15 text-xs font-medium"
                        >
                          Tự khởi xướng
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-blue-500/30 text-blue-700 bg-blue-500/10 dark:text-blue-400 dark:bg-blue-500/15 text-xs font-medium"
                        >
                          BGH giao
                        </Badge>
                      )}

                      {/* DRI / Role Indicator */}
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium",
                          group.isLeading
                            ? "bg-primary/15 text-primary border border-primary/25 font-semibold"
                            : "bg-muted text-muted-foreground border border-border/60"
                        )}
                      >
                        <User className="size-3" strokeWidth={1.5} />
                        <span>
                          {group.isLeading
                            ? `Tôi chủ trì (DRI: ${group.parentTask.leadAssigneeName})`
                            : `Chủ trì: ${group.parentTask.leadAssigneeName}`}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Due Date Countdown Badge */}
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold",
                          parentCountdown.variant === "urgent"
                            ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/20"
                            : parentCountdown.variant === "warning"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                            : "bg-muted text-muted-foreground border border-border/70"
                        )}
                      >
                        <Clock className="size-3" strokeWidth={1.5} />
                        <span>{parentCountdown.label}</span>
                      </span>

                      {/* Parent Status Badge */}
                      {renderStatusBadge(group.parentTask.status)}

                      {/* Collapse / Expand Toggle Button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleCollapse(group.parentTask.id, isCollapsed)}
                        className="text-xs h-7 px-2 gap-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                        title={
                          isCollapsed
                            ? "Mở rộng danh sách đầu việc"
                            : "Thu gọn danh sách đầu việc"
                        }
                      >
                        <span className="hidden sm:inline">
                          {isCollapsed ? "Mở rộng" : "Thu gọn"}
                        </span>
                        {isCollapsed ? (
                          <ChevronRight className="size-3.5" strokeWidth={1.5} />
                        ) : (
                          <ChevronDown className="size-3.5" strokeWidth={1.5} />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Parent Title & Progress */}
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 cursor-pointer select-none"
                    onClick={() => toggleCollapse(group.parentTask.id, isCollapsed)}
                    title={isCollapsed ? "Bấm để mở rộng chi tiết" : "Bấm để thu gọn"}
                  >
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight hover:text-primary transition-colors">
                        {group.parentTask.title}
                      </h3>
                      {group.parentTask.assignedDate && (
                        <p className="text-xs text-muted-foreground">
                          Bắt đầu: {group.parentTask.assignedDate} · Hạn:{" "}
                          {group.parentTask.dueDate}
                        </p>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="flex items-center gap-2 sm:w-48 shrink-0">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, group.parentTask.progressPercent || 0)
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-foreground tabular-nums">
                        {group.parentTask.progressPercent || 0}%
                      </span>
                    </div>
                  </div>

                  {/* DRI Workload Breakdown Chips (Only when expanded) */}
                  {!isCollapsed &&
                    group.isLeading &&
                    group.workloads &&
                    group.workloads.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/50">
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <Users
                            className="size-3 text-muted-foreground"
                            strokeWidth={1.5}
                          />
                          <span>Phân bổ nhân sự:</span>
                        </span>
                        {group.workloads.map((w) => (
                          <span
                            key={w.assigneeName}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-muted text-xs font-medium text-foreground border border-border/60"
                          >
                            <span>{w.assigneeName}:</span>
                            <span className="font-semibold text-primary">
                              {w.count} việc
                            </span>
                            {w.completedCount > 0 && (
                              <span className="text-muted-foreground text-xs">
                                ({w.completedCount} xong)
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                </div>

                {/* Tier 2: Subtasks Section with Tree Connector */}
                {!isCollapsed && (
                  <div className="pt-3 border-t border-border/60 space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                      <span className="font-semibold uppercase tracking-wider text-xs text-foreground flex items-center gap-1.5">
                        <Layers className="size-3.5" strokeWidth={1.5} />
                        <span>
                          {group.isLeading
                            ? `Tất cả công việc chi tiết (${group.allSubTasks.length})`
                            : `Công việc phân công cho tôi (${group.userSubTasks.length})`}
                        </span>
                      </span>
                    </div>

                    {group.isAwaitingAssignment ? (
                      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs text-blue-900 dark:text-blue-200">
                        <div className="flex items-start gap-2.5">
                          <AlertCircle
                            className="size-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5"
                            strokeWidth={1.5}
                          />
                          <div className="space-y-0.5">
                            <p className="font-semibold text-blue-800 dark:text-blue-300">
                              Chờ phân công nhiệm vụ cụ thể
                            </p>
                            <p className="text-blue-900/90 dark:text-blue-200/90">
                              Bạn đang trong danh sách phối hợp. Đang chờ người
                              chủ trì phân công công việc chi tiết.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : subTasksToRender.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
                        Chưa có công việc chi tiết nào được phân công.
                      </div>
                    ) : (
                      <div className="border-l-2 border-primary/20 dark:border-primary/30 pl-3 sm:pl-4 ml-1 sm:ml-2 space-y-2.5">
                        {subTasksToRender.map((subTask) => {
                          const countdownInfo = getDeadlineBadgeInfo(
                            subTask.dueDate,
                            referenceDate
                          );
                          const hasRevision = Boolean(
                            subTask.rejectionReason &&
                              subTask.rejectionReason.trim().length > 0
                          );
                          const hasBlocked = Boolean(
                            subTask.status === "BLOCKED" ||
                              (subTask.blockedReason &&
                                subTask.blockedReason.trim().length > 0)
                          );

                          return (
                            <div
                              key={subTask.id}
                              className={cn(
                                "rounded-xl border p-3.5 transition-all duration-200 bg-background/80 hover:bg-background space-y-2.5",
                                hasRevision
                                  ? "border-amber-500/40 bg-amber-500/[0.02]"
                                  : hasBlocked
                                  ? "border-rose-500/40 bg-rose-500/[0.02]"
                                  : subTask.status === "COMPLETED"
                                  ? "border-border/60 opacity-85"
                                  : "border-border/80 hover:border-border"
                              )}
                            >
                              {/* Top Row: Title, Assignee, Countdown & Status */}
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-sm font-semibold text-foreground tracking-tight">
                                    {subTask.title}
                                  </h4>
                                  {subTask.assigneeName && (
                                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                                      <User className="size-3" strokeWidth={1.5} />
                                      <span>{subTask.assigneeName}</span>
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
                                  {renderStatusBadge(subTask.status)}
                                </div>
                              </div>

                              {/* Deliverable description */}
                              {subTask.deliverableDescription && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {subTask.deliverableDescription}
                                </p>
                              )}

                              {/* Revision requested alert */}
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
                                        {subTask.rejectionReason}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Blocked alert */}
                              {hasBlocked && subTask.blockedReason && (
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
                                        {subTask.blockedReason}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Attached Deliverables List */}
                              {subTask.deliverables &&
                                subTask.deliverables.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                      <FileText
                                        className="size-3 text-muted-foreground"
                                        strokeWidth={1.5}
                                      />
                                      <span>Minh chứng đã đính kèm:</span>
                                    </span>
                                    {subTask.deliverables.map((del) => (
                                      <div
                                        key={del.id || del.name}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/80 text-xs text-foreground border border-border/60"
                                      >
                                        <span className="max-w-[200px] truncate">
                                          {del.name}
                                        </span>
                                        {del.url && (
                                          <a
                                            href={del.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-primary hover:underline ml-0.5"
                                          >
                                            <ExternalLink
                                              className="size-2.5 inline"
                                              strokeWidth={1.5}
                                            />
                                          </a>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                              {/* Bottom Action Strip */}
                              <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/40">
                                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                  <span>Mã:</span>
                                  <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs text-foreground">
                                    {subTask.id}
                                  </code>
                                </div>

                                <div className="flex items-center gap-2">
                                  {onSelectTask && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onSelectTask(subTask)}
                                      className="text-xs h-7 rounded-xl gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                                    >
                                      <Eye
                                        className="size-3.5"
                                        strokeWidth={1.5}
                                      />
                                      <span>Chi tiết</span>
                                    </Button>
                                  )}

                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={subTask.status === "COMPLETED" ? "outline" : "default"}
                                    onClick={() => handleOpenSubmitModal(subTask)}
                                    className={cn(
                                      "text-xs h-7 rounded-xl gap-1.5 cursor-pointer transition-all",
                                      subTask.status === "COMPLETED"
                                        ? "border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted font-medium"
                                        : "font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
                                    )}
                                  >
                                    <UploadCloud
                                      className="size-3.5"
                                      strokeWidth={1.5}
                                    />
                                    <span>
                                      {subTask.status === "COMPLETED"
                                        ? "Cập nhật minh chứng"
                                        : "Nộp minh chứng"}
                                    </span>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Section 4.5: Pagination Toolbar */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-border/70 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Hiển thị</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="rounded-lg border border-border/70 bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-ring cursor-pointer"
                >
                  <option value={5}>5 việc / trang</option>
                  <option value={10}>10 việc / trang</option>
                  <option value={20}>20 việc / trang</option>
                  <option value={50}>50 việc / trang</option>
                </select>
                <span>
                  (từ {(currentPage - 1) * pageSize + 1} đến{" "}
                  {Math.min(currentPage * pageSize, totalTasks)} trong tổng số{" "}
                  <strong>{totalTasks}</strong> nhiệm vụ)
                </span>
              </div>

              <div className="flex items-center gap-1.5 self-center sm:self-auto">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 rounded-lg border border-border/70 bg-card hover:bg-muted text-xs font-medium text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Trước
                </button>

                {getPageNumbers(currentPage, totalPages).map((p, idx) =>
                  p === "..." ? (
                    <span key={`ellipsis-${idx}`} className="px-1.5 py-1 text-muted-foreground">
                      ...
                    </span>
                  ) : (
                    <button
                      key={`page-${p}`}
                      type="button"
                      onClick={() => setCurrentPage(Number(p))}
                      className={cn(
                        "size-7 rounded-lg text-xs font-medium transition-all cursor-pointer",
                        currentPage === p
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "border border-border/70 bg-card hover:bg-muted text-foreground"
                      )}
                    >
                      {p}
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 rounded-lg border border-border/70 bg-card hover:bg-muted text-xs font-medium text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
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
