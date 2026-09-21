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
import { getStatusDisplay } from "@/domain/tasks/display-config";
import { SubmitDeliverableModal } from "./submit-deliverable-modal";
import { UnifiedAdaptiveWorkspace } from "@/components/workspace/unified-adaptive-workspace";
import { StaffAttentionHub } from "@/components/workspace";
export { StaffAttentionHub };

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
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const refDate = referenceDate
    ? new Date(referenceDate + "T00:00:00Z")
    : new Date(`${year}-${month}-${day}T00:00:00Z`);

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
  status: TaskStatus | "PENDING_EXECUTIVE_APPROVAL" | string
) {
  const config = getStatusDisplay(status);
  return (
    <Badge
      variant="outline"
      className={cn(config.badgeClassName || config.colorClass, "text-xs font-medium")}
    >
      {config.label}
    </Badge>
  );
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

/**
 * LecturerFocusWorkspace - Thin adapter delegating to StaffAttentionHub.
 * Preserves complete backward compatibility for props and interfaces.
 */
export function LecturerFocusWorkspace({
  user,
  tasks = [],
  onSelectTask,
  onSubmitDeliverable,
  onStatusChange,
  onRefresh,
  isRefreshing,
  className,
}: LecturerFocusWorkspaceProps) {
  return (
    <div className={className} data-slot="lecturer-focus-workspace">
      <StaffAttentionHub
        user={user}
        tasks={tasks}
        onSelectTask={onSelectTask}
        onSubmitDeliverable={onSubmitDeliverable}
        onStatusChange={onStatusChange}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
      />
    </div>
  );
}

export function LegacyLecturerFocusWorkspace({
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

  const inProgressCount = React.useMemo(() => {
    return resolvedTasks.filter((t) => t.status === "IN_PROGRESS").length;
  }, [resolvedTasks]);

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
    <div id="tour-tasks-landing" className={cn("space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6", className)}>
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
          </div>
        </div>

        {/* Actions: Refresh */}
        {onRefresh && (
          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="text-xs min-h-[44px] sm:h-8 gap-1.5 rounded-xl border-border/80 hover:bg-muted/80 cursor-pointer"
              title="Làm mới dữ liệu cá nhân"
            >
              <RefreshCw
                size={13}
                strokeWidth={1.5}
                className={cn("shrink-0", isRefreshing ? "animate-spin text-primary" : "")}
              />
              <span className="hidden sm:inline">Làm mới</span>
            </Button>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Unified Interactive Toolbar */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-3 bg-card/40 p-3 rounded-2xl border border-border/70">
        {/* Row 1: Ownership Tabs + Search + Bulk Toggle + Task Counter */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Segmented ownership tabs */}
          <div role="tablist" aria-label="Lọc theo vai trò tham gia nhiệm vụ" className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border/70 w-fit shrink-0">
            <button
              type="button"
              role="tab"
              id="tab-ownership-all"
              aria-controls="ownership-tabpanel"
              aria-selected={ownershipFilter === "ALL"}
              onClick={() => setOwnershipFilter("ALL")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1",
                ownershipFilter === "ALL"
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>Tất cả</span>
              {groupedTasks.length > 0 && (
                <span className="text-xs font-bold ml-1">({groupedTasks.length})</span>
              )}
            </button>
            <button
              type="button"
              role="tab"
              id="tab-ownership-leading"
              aria-controls="ownership-tabpanel"
              aria-selected={ownershipFilter === "LEADING"}
              onClick={() => setOwnershipFilter("LEADING")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1",
                ownershipFilter === "LEADING"
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <User className="size-3.5" strokeWidth={1.5} />
              <span>Tôi chủ trì (DRI)</span>
              {countLeading > 0 && (
                <span className="text-xs font-bold">({countLeading})</span>
              )}
            </button>
            <button
              type="button"
              role="tab"
              id="tab-ownership-participating"
              aria-controls="ownership-tabpanel"
              aria-selected={ownershipFilter === "PARTICIPATING"}
              onClick={() => setOwnershipFilter("PARTICIPATING")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1",
                ownershipFilter === "PARTICIPATING"
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="size-3.5" strokeWidth={1.5} />
              <span>Tôi tham gia (Phối hợp)</span>
              {countParticipating > 0 && (
                <span className="text-xs font-bold">({countParticipating})</span>
              )}
            </button>
          </div>

          {/* Search, bulk toggle & counter */}
          <div className="flex items-center justify-between lg:justify-end gap-2.5 flex-wrap">
            {/* Compact search input */}
            <div className="relative w-56 sm:w-64">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
                strokeWidth={1.5}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm việc, mã số..."
                aria-label="Tìm kiếm nhiệm vụ cá nhân theo tiêu đề hoặc mã số"
                className="w-full min-h-[44px] sm:h-8 rounded-xl border border-border/70 bg-background pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded-md"
                >
                  <X className="size-3.5" strokeWidth={1.5} />
                </button>
              )}
            </div>

            {/* Bulk Toggle Button */}
            <button
              type="button"
              onClick={handleToggleAllVisible}
              disabled={paginatedGroupedTasks.length === 0}
              className="inline-flex items-center gap-1.5 min-h-[44px] sm:h-8 px-2.5 rounded-xl border border-border/70 bg-card hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
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

            {/* Task counter */}
            <div className="flex items-center text-xs text-muted-foreground gap-1.5 shrink-0 pl-1 border-l border-border/60">
              <Filter className="size-3.5" strokeWidth={1.5} />
              <span>
                Hiển thị {filteredGroupedTasks.length} / {groupedTasks.length} nhiệm vụ
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Interactive Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pt-1 border-t border-border/50">
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
                : "bg-rose-500/10 text-rose-700 hover:bg-rose-500/20"
            )}
          >
            <span>Hôm nay cần làm</span>
            {summary.todayCount > 0 && (
              <span className="text-xs font-bold">({summary.todayCount})</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handlePillClick(activeFilter === "THIS_WEEK" ? "ALL" : "THIS_WEEK")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
              activeFilter === "THIS_WEEK"
                ? "bg-blue-600 text-white font-semibold shadow-xs"
                : "bg-blue-500/10 text-blue-700 hover:bg-blue-500/20"
            )}
          >
            <span>Trong tuần này</span>
            {summary.thisWeekCount > 0 && (
              <span className="text-xs font-bold">({summary.thisWeekCount})</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handlePillClick(activeFilter === "IN_PROGRESS" ? "ALL" : "IN_PROGRESS")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
              activeFilter === "IN_PROGRESS"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <span>Đang làm</span>
            {inProgressCount > 0 && (
              <span className="text-xs font-bold">({inProgressCount})</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handlePillClick(activeFilter === "NEEDS_REVIEW" ? "ALL" : "NEEDS_REVIEW")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
              activeFilter === "NEEDS_REVIEW"
                ? "bg-purple-600 text-white font-semibold shadow-xs"
                : "bg-purple-500/10 text-purple-700 hover:bg-purple-500/20"
            )}
          >
            <span>Chờ lãnh đạo duyệt</span>
            {summary.waitingApprovalCount > 0 && (
              <span className="text-xs font-bold">({summary.waitingApprovalCount})</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handlePillClick(activeFilter === "REVISION" ? "ALL" : "REVISION")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
              activeFilter === "REVISION"
                ? "bg-amber-600 text-white font-semibold shadow-xs"
                : "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20"
            )}
          >
            <span>Cần chỉnh sửa</span>
            {summary.revisionRequestedCount > 0 && (
              <span className="text-xs font-bold">({summary.revisionRequestedCount})</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handlePillClick(activeFilter === "COMPLETED" ? "ALL" : "COMPLETED")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
              activeFilter === "COMPLETED"
                ? "bg-emerald-600 text-white font-semibold shadow-xs"
                : "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
            )}
          >
            <span>Đã hoàn thành</span>
            {summary.completedCount > 0 && (
              <span className="text-xs font-bold">({summary.completedCount})</span>
            )}
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
      <div
        role="tabpanel"
        id="ownership-tabpanel"
        aria-labelledby={`tab-ownership-${ownershipFilter.toLowerCase()}`}
      >
      {filteredGroupedTasks.length === 0 ? (
        groupedTasks.length === 0 && !searchTerm && activeFilter === "ALL" && ownershipFilter === "ALL" ? (
          <div className="rounded-2xl border border-border/70 p-12 text-center bg-card/50 shadow-xs">
            <div className="mx-auto size-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-3">
              <CheckCircle2 className="size-6" strokeWidth={1.5} />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-foreground">
              Tuyệt vời! Bạn không có công việc nào tồn đọng
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
              Tất cả nhiệm vụ được giao đã hoàn thành hoặc đang chờ phân công mới.
            </p>
            <div className="mt-4 flex items-center justify-center">
              <Button
                id="tour-empty-state-cta"
                size="sm"
                className="text-xs min-h-[44px] sm:h-8 px-3.5 gap-1.5"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("qcet:open-create-task"));
                }}
              >
                <Plus className="size-3.5" />
                <span>Đề xuất nhiệm vụ / Tờ trình mới</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center bg-card/40">
            <div className="mx-auto size-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground mb-3">
              <Inbox className="size-6" strokeWidth={1.5} />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              Không tìm thấy nhiệm vụ nào
            </h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
              Không có công việc nào thỏa mãn tiêu chí tìm kiếm hoặc bộ lọc hiện tại.
            </p>
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOwnershipFilter("ALL");
                  setActiveFilter("ALL");
                  setSearchTerm("");
                }}
                className="text-xs min-h-[44px] sm:h-8 gap-1.5 rounded-xl border-border/80 hover:bg-muted/80 cursor-pointer"
              >
                <span>Xóa bộ lọc &amp; tìm kiếm</span>
              </Button>
            </div>
          </div>
        )
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
                        <span className="text-xs font-semibold text-primary/80 bg-primary/10 px-2.5 py-0.5 rounded-md">
                          {group.parentTask.categoryLabel}
                        </span>
                      )}

                      {/* Origin Badge */}
                      {group.parentTask.origin === "SELF_INITIATED" ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500/30 text-amber-700 bg-amber-500/10 text-xs font-medium"
                        >
                          Tự khởi xướng
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-blue-500/30 text-blue-700 bg-blue-500/10 text-xs font-medium"
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
                            ? "bg-rose-500/15 text-rose-700 border border-rose-500/20"
                            : parentCountdown.variant === "warning"
                            ? "bg-amber-500/15 text-amber-700 border border-amber-500/20"
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
                        className="text-xs min-h-[44px] sm:min-h-[32px] sm:h-8 px-2 gap-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
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
                      <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                        <Layers className="size-3.5" strokeWidth={1.5} />
                        <span>
                          {group.isLeading
                            ? `Tất cả công việc chi tiết (${group.allSubTasks.length})`
                            : `Công việc phân công cho tôi (${group.userSubTasks.length})`}
                        </span>
                      </span>
                    </div>

                    {group.isAwaitingAssignment ? (
                      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs text-blue-900">
                        <div className="flex items-start gap-2.5">
                          <AlertCircle
                            className="size-4 shrink-0 text-blue-600 mt-0.5"
                            strokeWidth={1.5}
                          />
                          <div className="space-y-0.5">
                            <p className="font-semibold text-blue-800">
                              Chờ phân công nhiệm vụ cụ thể
                            </p>
                            <p className="text-blue-900/90">
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
                      <div className="border-l-2 border-primary/20 pl-3 sm:pl-4 ml-1 sm:ml-2 space-y-2.5">
                        {subTasksToRender.map((subTask, subIdx) => {
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
                                  {group.parentTask?.title && (
                                    <span
                                      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20 max-w-[240px] truncate shrink-0"
                                      title={`Thuộc nhiệm vụ: ${group.parentTask.title}`}
                                    >
                                      Thuộc nhiệm vụ: {group.parentTask.title}
                                    </span>
                                  )}
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
                                        ? "bg-rose-500/15 text-rose-700 border border-rose-500/20"
                                        : countdownInfo.variant === "warning"
                                        ? "bg-amber-500/15 text-amber-700 border border-amber-500/20"
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
                                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900">
                                  <div className="flex items-start gap-2">
                                    <AlertTriangle
                                      className="size-4 shrink-0 text-amber-600 mt-0.5"
                                      strokeWidth={1.5}
                                    />
                                    <div className="space-y-0.5">
                                      <p className="font-semibold text-amber-800">
                                        Yêu cầu chỉnh sửa từ Trưởng đơn vị:
                                      </p>
                                      <p className="text-amber-900/90">
                                        {subTask.rejectionReason}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Blocked alert */}
                              {hasBlocked && subTask.blockedReason && (
                                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-900">
                                  <div className="flex items-start gap-2">
                                    <AlertCircle
                                      className="size-4 shrink-0 text-rose-600 mt-0.5"
                                      strokeWidth={1.5}
                                    />
                                    <div className="space-y-0.5">
                                      <p className="font-semibold text-rose-800">
                                        Lý do tắc nghẽn công việc:
                                      </p>
                                      <p className="text-rose-900/90">
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
                                      className="text-xs min-h-[44px] sm:min-h-[32px] sm:h-8 rounded-xl gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
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
                                    id={subIdx === 0 ? "tour-deliverable-action" : undefined}
                                    variant={subTask.status === "COMPLETED" ? "outline" : "default"}
                                    onClick={() => handleOpenSubmitModal(subTask)}
                                    className={cn(
                                      "text-xs min-h-[44px] sm:min-h-[32px] sm:h-8 rounded-xl gap-1.5 cursor-pointer transition-all",
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
                  aria-label="Số lượng nhiệm vụ hiển thị trên mỗi trang"
                  className="min-h-[44px] sm:min-h-[32px] rounded-lg border border-border/70 bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-ring cursor-pointer"
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
                  className="min-h-[44px] sm:min-h-[32px] px-2.5 py-1.5 rounded-lg border border-border/70 bg-card hover:bg-muted text-xs font-medium text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
                        "size-11 sm:size-8 rounded-lg text-xs font-medium transition-all cursor-pointer",
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
                  className="min-h-[44px] sm:min-h-[32px] px-2.5 py-1.5 rounded-lg border border-border/70 bg-card hover:bg-muted text-xs font-medium text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>

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
