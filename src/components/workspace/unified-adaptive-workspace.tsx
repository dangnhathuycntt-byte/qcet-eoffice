"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { Inbox, AlertTriangle, Loader2, Layers, X, ChevronRight, CircleAlert, Clock } from "lucide-react";
import type { UnifiedAdaptiveWorkspaceProps, WorkspaceScope, ViewMode, UniversalActionQueueItems } from "./types";
import {
  deriveAdaptiveWorkspaceData,
  countScopeTasks,
} from "./hooks/use-adaptive-workspace-data";
import { AdaptiveScopeHeader } from "./components/adaptive-scope-header";
import {
  UnifiedTaskToolbar,
  filterTasksByScope,
  type TableDensity,
} from "@/components/dashboard/unified-task-toolbar";
import {
  type SavedTaskView,
  type TaskViewCriteria,
  findPresetById,
} from "@/lib/saved-views/saved-views-store";
import { workspaceScopeToTaskScope } from "@/lib/unified-task-hub";
import { useWorkspaceQuery, type UseWorkspaceQueryReturn } from "@/hooks/use-workspace-query";
import { parseWorkspaceQuery } from "@/lib/workspace-query";
import { matchesUser } from "@/lib/role-task-filter";
import {
  filterTasksByAcademicMonthStrict,
  getSystemReferenceDate,
  getCurrentAcademicPeriod,
  isTaskPastDue,
} from "@/lib/academic-calendar";
import { formatDisplayDate } from "@/lib/format/date";
import { AdaptiveMetricStrip } from "./components/adaptive-metric-strip";
import { UniversalActionQueue } from "./components/universal-action-queue";
import { ActionQueueShell } from "./action-queue-shell";
import { ActiveFilterBreadcrumb } from "./components/active-filter-breadcrumb";
import { ModularCascadingTaskTable } from "@/components/tasks/table/modular-cascading-task-table";
const TaskKanbanBoard = dynamic(
  () => import("@/components/tasks/task-kanban-board").then((m) => ({ default: m.TaskKanbanBoard })),
  { ssr: false }
);
import type { CreateTaskFormData } from "@/components/dashboard/create-task-modal";
import { isSchoolTask } from "@/types/dashboard";
const LinearTaskDetailView = dynamic(
  () => import("@/components/tasks/detail/linear-task-detail-view").then((m) => ({ default: m.LinearTaskDetailView })),
  { ssr: false }
);
const LinearPeekPreviewModal = dynamic(
  () => import("@/components/tasks/preview/linear-peek-preview-modal").then((m) => ({ default: m.LinearPeekPreviewModal })),
  { ssr: false }
);
import { UnassignedDepartmentState } from "./components/unassigned-department-state";
import { isExecutiveUser, isManagerUser } from "@/components/layout/scope-switcher";
import { Button } from "@/components/ui/button";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import { useAuth, isUserUnassignedDepartment } from "@/lib/auth-context";
import { useLinearTaskShortcuts } from "@/hooks/use-linear-task-shortcuts";
import { useListScrollRestore } from "@/hooks/use-list-scroll-restore";

const LinearCreateTaskModal = dynamic(
  () => import("@/components/tasks/create/linear-create-task-modal").then((mod) => mod.LinearCreateTaskModal),
  { ssr: false }
);

const ReviewActionDialog = dynamic(
  () => import("@/components/portal/review-action-dialog").then((mod) => mod.ReviewActionDialog),
  { ssr: false }
);

const SubmitDeliverableModal = dynamic(
  () => import("@/components/portal/submit-deliverable-modal").then((mod) => mod.SubmitDeliverableModal),
  { ssr: false }
);
import { applyOptimisticStatusChange } from "./utils/task-workspace-mutations";
import { updateTaskStatus } from "@/lib/tasks/task-actions";
import type { CreateTaskSubmitResult } from "@/lib/adapters/create-task-mapper";
import { cn } from "@/lib/utils";
import {
  filterTasksByTime,
  NO_TASK_TIME_FILTER,
  type TaskTimeFilter,
} from "@/lib/task-time-filter";

export { type WorkspaceScope, type ViewMode, matchesUser };

import {
  isTaskWaitingApproval,
  isActiveTaskStatus,
  isTaskOverdueOrHasOverdueSubtask,
  isTaskAssignedToUser,
  isTaskAssignedToUserOrUnit,
  computeWorkspaceTabCounts,
} from "@/lib/workspace-metrics-aggregator";

export {
  isTaskWaitingApproval,
  isActiveTaskStatus,
  isTaskOverdueOrHasOverdueSubtask,
  isTaskAssignedToUserOrUnit,
};

/**
 * Options for filtering displayed tasks in UnifiedAdaptiveWorkspace
 */
export interface FilterDisplayedTasksOptions {
  tasks: SchoolTask[];
  search?: string;
  status?: string;
  deadline?: string;
  category?: string;
  priority?: string;
  academicMonth?: number | "ALL";
  timeFilter?: TaskTimeFilter;
  overdue?: boolean;
  workbox?: string;
  user?: AuthUser | null;
  referenceDate?: string;
}

/**
 * Pure canonical filtering engine for tasks displayed in the unified workspace.
 */
export function filterDisplayedTasks({
  tasks,
  search,
  status,
  deadline,
  category,
  priority,
  academicMonth,
  timeFilter,
  overdue,
  workbox,
  user,
  referenceDate,
}: FilterDisplayedTasksOptions): SchoolTask[] {
  // Issue #21: Only show top-level (parent) tasks in the list.
  // Child tasks are still available as nested subTasks on each parent.
  let result = tasks.filter((t) => !t.parentTaskId);
  const activeRefDate = referenceDate || getSystemReferenceDate();

  // 1. Search Query
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    result = result.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.code?.toLowerCase().includes(q) ||
        t.leadAssigneeName?.toLowerCase().includes(q) ||
        t.assignedTo?.toLowerCase().includes(q) ||
        t.subTasks?.some(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.assigneeName?.toLowerCase().includes(q) ||
            (s as any).assignedTo?.toLowerCase().includes(q)
        )
    );
  }

  // 2. Status Filter
  if (status && status !== "ALL" && status !== "all") {
    const refDate = getSystemReferenceDate();
    if (status === "my" || status === "my_tasks") {
      if (user) {
        result = result.filter((t) => isTaskAssignedToUser(t, user));
      }
    } else if (status === "waiting_approval" || status === "review") {
      result = result.filter(
        (t) =>
          isTaskWaitingApproval(t.status) ||
          Boolean(t.subTasks?.some((s) => isTaskWaitingApproval(s.status)))
      );
    } else if (status === "new") {
      result = result.filter(
        (t) =>
          (t.status as string) === "NEW" ||
          (t.status as string) === "new" ||
          t.status === "NOT_STARTED" ||
          (t.status as string) === "ASSIGNED"
      );
    } else if (status === "in_progress") {
      result = result.filter(
        (t) => t.status === "IN_PROGRESS" || (t.status as string) === "in_progress"
      );
    } else if (status === "completed") {
      result = result.filter(
        (t) => t.status === "COMPLETED" || (t.status as string) === "completed"
      );
    } else if (status === "overdue") {
      result = result.filter((t) => isTaskOverdueOrHasOverdueSubtask(t, refDate));
    } else if (status === "today") {
      result = result.filter((t) => Boolean(t.dueDate && t.dueDate.startsWith(refDate)));
    } else if (status === "this_week") {
      const refDateObj = new Date(refDate);
      const endOfWeekObj = new Date(refDateObj);
      endOfWeekObj.setDate(endOfWeekObj.getDate() + 7);
      const endOfWeekStr = endOfWeekObj.toISOString().split("T")[0];
      result = result.filter((t) => {
        if (t.status === "COMPLETED" || (t.status as string) === "CANCELLED") return false;
        const taskDue = t.dueDate;
        if (taskDue && taskDue >= refDate && taskDue <= endOfWeekStr) return true;
        return Boolean(
          t.subTasks?.some(
            (s) => s.status !== "COMPLETED" && s.dueDate && s.dueDate >= refDate && s.dueDate <= endOfWeekStr
          )
        );
      });
    } else if (status === "pending_submission" || status === "waiting_submission") {
      result = result.filter((t) => {
        if (t.status === "COMPLETED") return false;
        const isTaskActive =
          isActiveTaskStatus(t.status) ||
          Boolean(t.subTasks?.some((st) => isActiveTaskStatus(st.status)));
        if (!isTaskActive) return false;
        return isTaskAssignedToUserOrUnit(t, user);
      });
    } else {
      result = result.filter(
        (t) =>
          (t.status as string) === status ||
          (t.status as string)?.toLowerCase() === status.toLowerCase()
      );
    }
  }

  // 2b. Deadline Filter (Orthogonal SLA Dimension)
  if (deadline && deadline !== "ALL" && deadline !== "all") {
    const refDate = getSystemReferenceDate();
    if (deadline === "today") {
      result = result.filter((t) => Boolean(t.dueDate && t.dueDate.startsWith(refDate)));
    } else if (deadline === "this_week") {
      const refDateObj = new Date(refDate);
      const endOfWeekObj = new Date(refDateObj);
      endOfWeekObj.setDate(endOfWeekObj.getDate() + 7);
      const endOfWeekStr = endOfWeekObj.toISOString().split("T")[0];
      result = result.filter((t) => {
        if (t.status === "COMPLETED" || (t.status as string) === "CANCELLED") return false;
        const taskDue = t.dueDate;
        if (taskDue && taskDue >= refDate && taskDue <= endOfWeekStr) return true;
        return Boolean(
          t.subTasks?.some(
            (s) => s.status !== "COMPLETED" && s.dueDate && s.dueDate >= refDate && s.dueDate <= endOfWeekStr
          )
        );
      });
    } else if (deadline === "overdue") {
      result = result.filter((t) => isTaskOverdueOrHasOverdueSubtask(t, refDate));
    }
  }

  // 3. Workbox Filter
  if (workbox && workbox !== "ALL" && workbox !== "all") {
    const wb = workbox.trim().toLowerCase();
    if (
      wb === "my_pending_approval" ||
      wb === "review" ||
      wb === "waiting_approval" ||
      wb === "needs_review" ||
      wb === "pending_approval"
    ) {
      result = result.filter(
        (t) =>
          isTaskWaitingApproval(t.status) ||
          Boolean(t.subTasks?.some((s) => isTaskWaitingApproval(s.status)))
      );
    } else if (
      wb === "my_pending_submission" ||
      wb === "pending_submission"
    ) {
      result = result.filter((t) => {
        if (t.status === "COMPLETED") return false;
        const isTaskActive =
          isActiveTaskStatus(t.status) ||
          Boolean(t.subTasks?.some((st) => isActiveTaskStatus(st.status)));
        if (!isTaskActive) return false;
        return isTaskAssignedToUserOrUnit(t, user);
      });
    } else if (
      wb === "my_tasks" ||
      wb === "my" ||
      wb === "my_action" ||
      wb === "my_received"
    ) {
      result = result.filter((t) => {
        if (!user) return true;
        return isTaskAssignedToUser(t, user);
      });
    } else if (wb === "overdue" || wb === "urgent_overdue") {
      result = result.filter((t) => isTaskOverdueOrHasOverdueSubtask(t, activeRefDate));
    } else if (wb === "completed") {
      result = result.filter((t) => t.status === "COMPLETED" || t.progressPercent === 100);
    }
  }

  // 4. Category Filter
  if (category && category !== "ALL") {
    result = result.filter((t) => t.category === category);
  }

  // 5. Priority Filter
  if (priority && priority !== "ALL") {
    result = result.filter((t) => t.priority === priority);
  }

  // 6. Academic Month Filter
  if (timeFilter) {
    result = filterTasksByTime(result, timeFilter);
  } else if (academicMonth && academicMonth !== "ALL") {
    result = filterTasksByAcademicMonthStrict(result, Number(academicMonth), "2026-2027");
  }

  // 7. Overdue flag
  if (overdue) {
    result = result.filter((t) => isTaskOverdueOrHasOverdueSubtask(t, activeRefDate));
  }

  // API payloads may contain the same child both flattened and nested. React rows
  // need one stable identity; keep the first canonical occurrence at this boundary.
  return Array.from(new Map(result.map((task) => [task.id, task])).values());
}

/* ---------------------------------------------------------------------------
 * Executive Dashboard Inline Sections
 * Renders ONLY when scope="school" AND user is BGH (executive).
 * Placed between toolbar and task table in full-width layout.
 * --------------------------------------------------------------------------- */

interface ExecutiveDashboardSectionsProps {
  metrics: {
    totalTasks: number;
    completedCount: number;
    completedRate: number;
    urgentOverdueCount: number;
    waitingApprovalCount: number;
  };
  actionQueue: UniversalActionQueueItems;
  displayedTasks: SchoolTask[];
  onSelectTask: (task: SchoolTask | StaffTask) => void;
  onReview?: (task: SchoolTask | StaffTask) => void;
  onViewAllApprovals?: () => void;
  onViewAllOverdue?: () => void;
}

function ExecutiveDashboardSections({
  metrics,
  actionQueue,
  displayedTasks,
  onSelectTask,
  onReview,
  onViewAllApprovals,
  onViewAllOverdue,
}: ExecutiveDashboardSectionsProps) {
  const refDate = getSystemReferenceDate();
  const MAX_ROWS = 5;

  // Attention tasks: overdue and upcoming (due within 7 days)
  const { overdueTasks, upcomingTasks } = React.useMemo(() => {
    const now = new Date(refDate);
    const sevenDaysLater = new Date(now);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    const overdue: SchoolTask[] = [];
    const upcoming: SchoolTask[] = [];

    for (const t of displayedTasks) {
      if (t.status === "COMPLETED" || t.status === "CANCELLED") continue;
      if (!t.dueDate) continue;

      if (isTaskPastDue(t.dueDate, refDate)) {
        overdue.push(t);
      } else {
        const due = new Date(t.dueDate);
        if (due <= sevenDaysLater) {
          upcoming.push(t);
        }
      }
    }

    return { overdueTasks: overdue, upcomingTasks: upcoming };
  }, [displayedTasks, refDate]);

  const pendingApprovals = actionQueue.pendingApprovals;
  const visibleApprovals = pendingApprovals.slice(0, MAX_ROWS);
  const hasMoreApprovals = pendingApprovals.length > MAX_ROWS;

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      NOT_STARTED: "Chưa bắt đầu",
      IN_PROGRESS: "Đang thực hiện",
      NEEDS_REVIEW: "Chờ duyệt",
      WAITING_APPROVAL: "Chờ phê duyệt",
      COMPLETED: "Hoàn thành",
      CANCELLED: "Đã hủy",
      OVERDUE: "Quá hạn",
    };
    return map[status] || status;
  };

  return (
    <>
      {/* A. Compact Metric Strip */}
      <div
        data-slot="executive-summary-strip"
        className="flex flex-wrap items-center gap-x-0 gap-y-2 rounded-xl border border-border/60 bg-card px-4 py-2.5 text-sm"
      >
        <div className="flex items-center gap-1.5 px-3 py-1">
          <span className="text-muted-foreground">Tổng nhiệm vụ:</span>
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {metrics.totalTasks}
          </span>
        </div>
        <div className="h-4 w-px bg-border/60 shrink-0 hidden sm:block" aria-hidden="true" />
        <div className="flex items-center gap-1.5 px-3 py-1">
          <span className="text-muted-foreground">Đã hoàn thành:</span>
          <span className="font-mono font-semibold tabular-nums text-emerald-700">
            {metrics.completedCount}/{metrics.totalTasks}
          </span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            ({metrics.completedRate}%)
          </span>
        </div>
        <div className="h-4 w-px bg-border/60 shrink-0 hidden sm:block" aria-hidden="true" />
        <div className="flex items-center gap-1.5 px-3 py-1">
          <span className="text-muted-foreground">Quá hạn:</span>
          <span
            className={cn(
              "font-mono font-semibold tabular-nums",
              metrics.urgentOverdueCount > 0 ? "text-rose-700" : "text-foreground"
            )}
          >
            {metrics.urgentOverdueCount}
          </span>
        </div>
        <div className="h-4 w-px bg-border/60 shrink-0 hidden sm:block" aria-hidden="true" />
        <div className="flex items-center gap-1.5 px-3 py-1">
          <span className="text-muted-foreground">Chờ bạn duyệt:</span>
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {metrics.waitingApprovalCount}
          </span>
        </div>
      </div>

      {/* B. Cần bạn xử lý — Pending Approval Table */}
      <section data-slot="executive-action-table" className="space-y-3">
        <h2 className="text-sm font-bold text-foreground">Cần bạn xử lý</h2>
        {pendingApprovals.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">
            Không có nhiệm vụ nào cần bạn xử lý
          </p>
        ) : (
          <>
            {/* Table header — hidden on mobile, shown as grid on sm+ */}
            <div className="hidden sm:grid sm:grid-cols-[1fr_160px_120px_100px] gap-3 px-3 pb-1.5 text-xs font-medium text-muted-foreground border-b border-border/40">
              <span>Nhiệm vụ</span>
              <span>Đơn vị chủ trì</span>
              <span>Hạn xử lý</span>
              <span className="text-right">Thao tác</span>
            </div>
            <div className="divide-y divide-border/40">
              {visibleApprovals.map((item) => {
                const t = item.task;
                const dept =
                  ("leadDepartment" in t ? t.leadDepartment : undefined) ||
                  ("department" in t ? t.department : undefined) ||
                  "";
                const dueDate = "dueDate" in t ? t.dueDate : undefined;

                return (
                  <div
                    key={t.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_160px_120px_100px] gap-1 sm:gap-3 items-center px-3 py-2.5"
                  >
                    {/* Task title + submitter */}
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onSelectTask(t)}
                        className="text-left text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer line-clamp-2 block max-w-full min-h-[44px] sm:min-h-0 flex items-center"
                      >
                        {t.title}
                      </button>
                      {item.submittedBy && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {item.submittedBy}
                        </p>
                      )}
                    </div>
                    {/* Department */}
                    <span className="text-xs text-muted-foreground truncate">
                      {dept || "-"}
                    </span>
                    {/* Due date */}
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {formatDisplayDate(dueDate)}
                    </span>
                    {/* Review button */}
                    <div className="sm:text-right">
                      <button
                        type="button"
                        onClick={() => {
                          if (onReview) {
                            onReview(t);
                          } else {
                            onSelectTask(t);
                          }
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer min-h-[44px] sm:min-h-0"
                      >
                        Xem xét
                        <ChevronRight className="size-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {hasMoreApprovals && (
              <button
                type="button"
                onClick={() => onViewAllApprovals?.()}
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer px-3 py-2 min-h-[44px] sm:min-h-0"
              >
                Xem tất cả {pendingApprovals.length} nhiệm vụ
                <ChevronRight className="size-3 inline ml-0.5" strokeWidth={1.5} />
              </button>
            )}
          </>
        )}
      </section>

      {/* C. Nhiệm vụ cần chú ý — Overdue + Upcoming */}
      {(overdueTasks.length > 0 || upcomingTasks.length > 0) && (
        <section data-slot="executive-attention-section" className="space-y-4">
          <h2 className="text-sm font-bold text-foreground">Nhiệm vụ cần chú ý</h2>

          {/* Quá hạn */}
          {overdueTasks.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 px-1">
                <CircleAlert className="size-3.5 text-rose-600" strokeWidth={1.5} />
                <h3 className="text-xs font-semibold text-rose-700">
                  Quá hạn ({overdueTasks.length})
                </h3>
              </div>
              {/* Column headers */}
              <div className="hidden sm:grid sm:grid-cols-[1fr_160px_120px_120px] gap-3 px-3 pb-1 text-xs font-medium text-muted-foreground border-b border-border/40">
                <span>Nhiệm vụ</span>
                <span>Đơn vị</span>
                <span>Hạn</span>
                <span>Trạng thái</span>
              </div>
              <div className="divide-y divide-border/40">
                {overdueTasks.slice(0, MAX_ROWS).map((t) => (
                  <div
                    key={t.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_160px_120px_120px] gap-1 sm:gap-3 items-center px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectTask(t)}
                      className="text-left text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer line-clamp-2 min-h-[44px] sm:min-h-0 flex items-center"
                    >
                      {t.title}
                    </button>
                    <span className="text-xs text-muted-foreground truncate">
                      {t.leadDepartment || t.department || "-"}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-rose-700">
                      {formatDisplayDate(t.dueDate)}
                    </span>
                    <span className="text-xs text-rose-600">{statusLabel(t.status)}</span>
                  </div>
                ))}
              </div>
              {overdueTasks.length > MAX_ROWS && (
                <button
                  type="button"
                  onClick={() => onViewAllOverdue?.()}
                  className="text-xs text-primary hover:text-primary/80 font-medium cursor-pointer px-3 py-1 min-h-[44px] sm:min-h-0"
                >
                  Xem tất cả {overdueTasks.length} nhiệm vụ quá hạn
                  <ChevronRight className="size-3 inline ml-0.5" strokeWidth={1.5} />
                </button>
              )}
            </div>
          )}

          {/* Sắp đến hạn */}
          {upcomingTasks.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 px-1">
                <Clock className="size-3.5 text-amber-600" strokeWidth={1.5} />
                <h3 className="text-xs font-semibold text-amber-700">
                  Sắp đến hạn ({upcomingTasks.length})
                </h3>
              </div>
              {/* Column headers */}
              <div className="hidden sm:grid sm:grid-cols-[1fr_160px_120px_120px] gap-3 px-3 pb-1 text-xs font-medium text-muted-foreground border-b border-border/40">
                <span>Nhiệm vụ</span>
                <span>Đơn vị</span>
                <span>Hạn</span>
                <span>Trạng thái</span>
              </div>
              <div className="divide-y divide-border/40">
                {upcomingTasks.slice(0, MAX_ROWS).map((t) => (
                  <div
                    key={t.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_160px_120px_120px] gap-1 sm:gap-3 items-center px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectTask(t)}
                      className="text-left text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer line-clamp-2 min-h-[44px] sm:min-h-0 flex items-center"
                    >
                      {t.title}
                    </button>
                    <span className="text-xs text-muted-foreground truncate">
                      {t.leadDepartment || t.department || "-"}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-amber-700">
                      {formatDisplayDate(t.dueDate)}
                    </span>
                    <span className="text-xs text-muted-foreground">{statusLabel(t.status)}</span>
                  </div>
                ))}
              </div>
              {upcomingTasks.length > MAX_ROWS && (
                <button
                  type="button"
                  onClick={() => onViewAllOverdue?.()}
                  className="text-xs text-primary hover:text-primary/80 font-medium cursor-pointer px-3 py-1 min-h-[44px] sm:min-h-0"
                >
                  Xem tất cả {upcomingTasks.length} nhiệm vụ sắp đến hạn
                  <ChevronRight className="size-3 inline ml-0.5" strokeWidth={1.5} />
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}

function UnifiedAdaptiveWorkspaceInner({
  user: initialUser,
  tasks: controlledTasks,
  initialTasks,
  scope: propScope,
  initialScope,
  forcedScope,
  onScopeChange,
  forcedRole,
  selectedDepartment,
  contextTitle,
  contextBadge,
  initialLoading,
  isLoading,
  isOffline,
  errorMessage,
  hideScopeSwitcher,
  className,
  viewMode: controlledViewMode,
  initialViewMode,
  onViewModeChange,
  onSelectTask,
  onReview,
  onSubmitDeliverable,
  onStatusChange,
  onSendReminder,
  onCreateTask,
  onCreateSubtask,
  onRefresh,
  isRefreshing,
  onAction,
  activeStatus,
  searchQuery,
  isOverdueOnly,
  activeWorkbox,
  onDepartmentChange,
  onStatusFilterChange,
  onSearchChange,
  onOverdueFilterChange,
  onWorkboxChange,
  onResetFilters,
  enableSplitCockpit = false,
  disableInternalDetail = false,
  selectedTaskId: propSelectedTaskId,
  workspaceQuery,
}: UnifiedAdaptiveWorkspaceProps & { workspaceQuery: UseWorkspaceQueryReturn }) {
  const auth = useAuth();
  const fallbackUser: AuthUser = React.useMemo(
    () => ({
      id: "guest",
      name: "Khách",
      email: "guest@qcet.edu.vn",
      role: "STAFF",
      roleLabel: "Chuyên viên",
      department: "",
      departmentCode: "",
    }),
    []
  );

  const effectiveUser = initialUser || auth.user;
  const user = effectiveUser || fallbackUser;
  const setIsProfileModalOpen = auth.setIsProfileModalOpen;

  // Internal task collection for standalone/uncontrolled mode
  const [internalTasks, setInternalTasks] = React.useState<SchoolTask[]>(
    initialTasks || controlledTasks || []
  );
  const [isInternalLoading, setIsInternalLoading] = React.useState(false);
  const [internalError, setInternalError] = React.useState<string | null>(null);
  const [isRefreshingInternal, setIsRefreshingInternal] = React.useState(false);

  // Synchronize internal tasks when controlledTasks changes
  React.useEffect(() => {
    if (controlledTasks !== undefined) {
      setInternalTasks(controlledTasks);
    }
  }, [controlledTasks]);

  // Self-contained data fetching when tasks are not provided
  React.useEffect(() => {
    if (controlledTasks !== undefined) return;
    if (initialTasks !== undefined) return;

    let isMounted = true;
    setIsInternalLoading(true);
    fetch("/api/dashboard/overview")
      .then((res) => {
        if (!res.ok) throw new Error("Không thể tải danh sách công việc");
        return res.json();
      })
      .then((data) => {
        if (isMounted && data?.tasks) {
          setInternalTasks(data.tasks);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setInternalError(err instanceof Error ? err.message : "Lỗi kết nối");
        }
      })
      .finally(() => {
        if (isMounted) setIsInternalLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [controlledTasks, initialTasks]);

  const tasks = controlledTasks !== undefined ? controlledTasks : internalTasks;

  // Determine default scope based on user role or explicit props
  const defaultScope: WorkspaceScope = React.useMemo(() => {
    if (forcedScope) return forcedScope;
    if (propScope) return propScope;
    if (initialScope) return initialScope;
    const role = (user?.role || user?.dbRole || "").toUpperCase();
    if (
      forcedRole === "ADMIN" ||
      isExecutiveUser(user) ||
      role === "ADMIN" ||
      role === "BAN_GIAM_HIEU" ||
      role === "BGH"
    ) {
      return "school";
    }
    if (
      forcedRole === "MANAGER" ||
      isManagerUser(user) ||
      role === "MANAGER" ||
      role === "TRUONG_PHONG" ||
      role === "TRUONG_DON_VI" ||
      role === "TRUONG_KHOA" ||
      role === "PHO_PHONG" ||
      role === "PHO_KHOA"
    ) {
      return "unit";
    }
    return "my";
  }, [forcedScope, propScope, initialScope, forcedRole, user]);

  const effectiveReviewerRole: "ADMIN" | "MANAGER" | "STAFF" = React.useMemo(() => {
    if (forcedRole) return forcedRole;
    if (isExecutiveUser(user)) return "ADMIN";
    if (isManagerUser(user)) return "MANAGER";
    return "STAFF";
  }, [forcedRole, user]);

  const isExecutive = effectiveReviewerRole === "ADMIN" || isExecutiveUser(user);

  const currentAcademicMonth = React.useMemo(() => getCurrentAcademicPeriod().month, []);

  // workspaceQuery được truyền vào từ wrapper UnifiedAdaptiveWorkspace — không gọi hook ở đây.

  const [activeScope, setActiveScope] = React.useState<WorkspaceScope>(defaultScope);

  // Synchronize when forcedScope, propScope, or initialScope changes externally
  React.useEffect(() => {
    if (forcedScope) {
      setActiveScope(forcedScope);
    } else if (propScope) {
      setActiveScope(propScope);
    } else if (initialScope) {
      setActiveScope(initialScope);
    }
  }, [forcedScope, propScope, initialScope]);

  const isManager = isManagerUser(user) || isExecutive;

  const handleScopeChange = React.useCallback(
    (newScope: WorkspaceScope) => {
      setActiveScope(newScope);
      setInternalStatus(undefined);
      setInternalDeadline(undefined);
      setInternalWorkbox("ALL");
      setInternalOverdue(false);
      setInternalSearch(undefined);
      setCurrentPriority("ALL");
      setCurrentCategory("ALL");
      if (newScope !== "unit") {
        setInternalDept("ALL");
      }
      onScopeChange?.(newScope);
      workspaceQuery?.setScope(newScope, { shallow: true, replace: true });
    },
    [onScopeChange, workspaceQuery]
  );

  // View mode management (Table vs Kanban)
  // Precedence: explicit URL ?view= > persisted preference > default "table"
  const [internalViewMode, setInternalViewMode] = React.useState<ViewMode>(() => {
    if (controlledViewMode) return controlledViewMode;
    if (typeof window !== "undefined") {
      try {
        const sp = new URLSearchParams(window.location.search);
        const urlView = sp.get("view");
        if (urlView === "table" || urlView === "kanban") {
          return urlView;
        }
      } catch {
        // ignore
      }
    }
    if (
      workspaceQuery?.queryState.view &&
      (workspaceQuery.queryState.view === "table" || workspaceQuery.queryState.view === "kanban")
    ) {
      if (typeof window !== "undefined") {
        try {
          const sp = new URLSearchParams(window.location.search);
          if (sp.has("view")) {
            return workspaceQuery.queryState.view;
          }
        } catch {
          // ignore
        }
      }
    }
    if (typeof window !== "undefined") {
      try {
        const persisted = window.localStorage.getItem("qcet_task_view_mode");
        if (persisted === "table" || persisted === "kanban") {
          return persisted;
        }
      } catch {
        // ignore
      }
    }
    return initialViewMode || "table";
  });

  React.useEffect(() => {
    if (controlledViewMode) {
      setInternalViewMode(controlledViewMode);
    }
  }, [controlledViewMode]);

  const viewMode = controlledViewMode || internalViewMode;

  const handleViewModeChange = React.useCallback(
    (mode: ViewMode) => {
      setInternalViewMode(mode);
      onViewModeChange?.(mode);
      workspaceQuery?.setView(mode, { replace: true, shallow: true });
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("qcet_task_view_mode", mode);
        } catch {
          // ignore
        }
      }
    },
    [onViewModeChange, workspaceQuery]
  );

  // Interactive dialog states for task review and deliverable submission
  const [reviewingTask, setReviewingTask] = React.useState<SchoolTask | StaffTask | null>(null);
  const [submittingTask, setSubmittingTask] = React.useState<SchoolTask | StaffTask | null>(null);

  // Initial task selection from propSelectedTaskId if provided
  const initialTaskFromProp = React.useMemo<SchoolTask | StaffTask | null>(() => {
    if (!propSelectedTaskId) return null;
    const directFound = tasks.find(
      (t) => t.id === propSelectedTaskId || (t as any).code === propSelectedTaskId
    );
    if (directFound) return directFound;

    for (const t of tasks) {
      const sub = t.subTasks?.find(
        (s) => s.id === propSelectedTaskId || (s as any).code === propSelectedTaskId
      );
      if (sub) return sub;
    }
    return null;
  }, [propSelectedTaskId, tasks]);

  // Task selection state
  const [internalSelectedTask, setInternalSelectedTask] = React.useState<SchoolTask | StaffTask | null>(initialTaskFromProp);
  // Progressive disclosure detail side sheet open state
  const [isDetailOpen, setIsDetailOpen] = React.useState(Boolean(initialTaskFromProp));
  // Action queue drawer open state for full-width layout mode
  const [isActionQueueOpen, setIsActionQueueOpen] = React.useState(false);

  const router = React.useContext(AppRouterContext);
  const { saveScrollAndParams } = useListScrollRestore();

  const handleSelectTask = React.useCallback(
    (task: SchoolTask | StaffTask) => {
      saveScrollAndParams();
      if (onSelectTask) {
        onSelectTask(task);
        return;
      }
      setInternalSelectedTask(task);
      setIsDetailOpen(true);
      const taskIdOrCode =
        (task as any).code || (task as any).taskCode || task.id;
      workspaceQuery?.setSelectedTask(taskIdOrCode, { replace: true });
      router?.push(`/tasks/${task.id}`);
    },
    [onSelectTask, workspaceQuery, router, saveScrollAndParams]
  );

  const handleCloseDetail = React.useCallback(() => {
    setIsDetailOpen(false);
    setInternalSelectedTask(null);
    workspaceQuery?.setSelectedTask(null, { replace: true });
  }, [workspaceQuery]);

  // Peek preview modal state (Linear Image #8)
  const [peekTask, setPeekTask] = React.useState<SchoolTask | StaffTask | null>(null);

  // Filter state synchronized with props
  const [internalDept, setInternalDept] = React.useState<string | undefined>(() => {
    if (selectedDepartment !== undefined) return selectedDepartment;
    return workspaceQuery?.queryState.unit || workspaceQuery?.queryState.dept || undefined;
  });
  const [internalStatus, setInternalStatus] = React.useState<string | undefined>(() => {
    if (activeStatus !== undefined) return activeStatus;
    if (workspaceQuery?.queryState.status && workspaceQuery.queryState.status !== "ALL") {
      return workspaceQuery.queryState.status;
    }
    return undefined;
  });
  const [internalDeadline, setInternalDeadline] = React.useState<string | undefined>(() => {
    return workspaceQuery?.queryState.deadline || undefined;
  });
  const [internalSearch, setInternalSearch] = React.useState<string | undefined>(() => {
    if (searchQuery !== undefined) return searchQuery;
    return workspaceQuery?.queryState.query || workspaceQuery?.queryState.q || undefined;
  });
  const [internalOverdue, setInternalOverdue] = React.useState<boolean>(() => {
    if (isOverdueOnly !== undefined) return Boolean(isOverdueOnly);
    return workspaceQuery?.queryState.attention === "overdue" || workspaceQuery?.queryState.deadline === "overdue";
  });
  const [internalWorkbox, setInternalWorkbox] = React.useState<string | undefined>(() => {
    if (activeWorkbox !== undefined) return activeWorkbox;
    if (isOverdueOnly === false) return "ALL";
    const att = workspaceQuery?.queryState.attention;
    if (att === "overdue" || workspaceQuery?.queryState.deadline === "overdue") return "overdue";
    if (att === "requires_my_approval") return "my_pending_approval";
    if (att === "requires_my_action") return "my_pending_submission";
    return "ALL";
  });
  const [currentCategory, setCurrentCategory] = React.useState<string>("ALL");
  const [currentPriority, setCurrentPriority] = React.useState<string>("ALL");
  const [currentMonth, setCurrentMonth] = React.useState<number | "ALL">(() => {
    if (workspaceQuery?.queryState.month !== undefined) return workspaceQuery.queryState.month;
    return "ALL";
  });
  const [timeFilter, setTimeFilter] = React.useState<TaskTimeFilter>(() => {
    const query = workspaceQuery?.queryState;
    if (query?.time === "range" && query.dateFrom && query.dateTo) return { kind: "range", from: query.dateFrom, to: query.dateTo };
    if (query?.time && query.time !== "range") return { kind: "preset", preset: query.time };
    if (typeof query?.month === "number") return { kind: "month", month: query.month };
    return NO_TASK_TIME_FILTER;
  });
  const [tableDensity, setTableDensity] = React.useState<TableDensity>("compact");
  const [activeViewId, setActiveViewId] = React.useState<string | null>(null);

  // Controlled props take absolute precedence when defined; undefined delegates to internal state (uncontrolled)
  const currentDept = selectedDepartment !== undefined ? selectedDepartment : (internalDept ?? "ALL");
  const currentStatus = activeStatus !== undefined ? activeStatus : internalStatus;
  const currentSearch = searchQuery !== undefined ? searchQuery : internalSearch;
  const currentOverdue = isOverdueOnly !== undefined ? Boolean(isOverdueOnly) : internalOverdue;
  const currentWorkbox = activeWorkbox !== undefined
    ? activeWorkbox
    : (isOverdueOnly === false && internalWorkbox === "overdue" ? "ALL" : internalWorkbox);

  // Synchronize state with canonical workspace query (URL-driven navigation: back/forward)
  React.useEffect(() => {
    const { queryState } = workspaceQuery;

    if (!propScope && !forcedScope && queryState.scope) {
      setActiveScope(queryState.scope);
    }
    if (selectedDepartment === undefined) {
      if (queryState.unit || queryState.dept) {
        setInternalDept(queryState.unit || queryState.dept);
      } else {
        setInternalDept("ALL");
      }
    }
    if (activeStatus === undefined) {
      if (queryState.status && queryState.status !== "ALL") {
        setInternalStatus(queryState.status);
      } else {
        setInternalStatus(undefined);
      }
    }
    const qVal = queryState.query || queryState.q;
    if (searchQuery === undefined) {
      setInternalSearch(qVal || undefined);
    }
    if (queryState.priority !== undefined) {
      setCurrentPriority(queryState.priority);
    } else {
      setCurrentPriority("ALL");
    }
    if (queryState.category !== undefined) {
      setCurrentCategory(queryState.category);
    } else {
      setCurrentCategory("ALL");
    }
    if (queryState.deadline !== undefined) {
      setInternalDeadline(queryState.deadline);
    } else {
      setInternalDeadline(undefined);
    }
    if (queryState.month !== undefined) {
      setCurrentMonth(queryState.month);
    } else {
      setCurrentMonth("ALL");
    }
    if (queryState.time === "range" && queryState.dateFrom && queryState.dateTo) {
      setTimeFilter({ kind: "range", from: queryState.dateFrom, to: queryState.dateTo });
    } else if (queryState.time && queryState.time !== "range") {
      setTimeFilter({ kind: "preset", preset: queryState.time });
    } else if (typeof queryState.month === "number") {
      setTimeFilter({ kind: "month", month: queryState.month });
    } else {
      setTimeFilter(NO_TASK_TIME_FILTER);
    }
    if (isOverdueOnly === undefined) {
      if (queryState.attention === "overdue" || queryState.deadline === "overdue") {
        setInternalOverdue(true);
      } else {
        setInternalOverdue(false);
      }
    }
    if (activeWorkbox === undefined) {
      if (queryState.attention === "overdue" || queryState.deadline === "overdue") {
        setInternalWorkbox("overdue");
      } else if (queryState.attention === "requires_my_approval") {
        setInternalWorkbox("my_pending_approval");
      } else if (queryState.attention === "requires_my_action") {
        setInternalWorkbox("my_pending_submission");
      } else {
        setInternalWorkbox("ALL");
      }
    }
    // View sync: only sync from URL if URL explicitly contains the view parameter
    // (avoid resetting to "table" when URL has no view parameter or when queryState defaults)
    if (queryState.view && (queryState.view === "table" || queryState.view === "kanban")) {
      if (typeof window !== "undefined") {
        try {
          const sp = new URLSearchParams(window.location.search);
          if (sp.has("view")) {
            setInternalViewMode(queryState.view);
          }
        } catch {
          // ignore
        }
      }
    }
  }, [
    workspaceQuery.queryState.scope,
    workspaceQuery.queryState.unit,
    workspaceQuery.queryState.dept,
    workspaceQuery.queryState.status,
    workspaceQuery.queryState.query,
    workspaceQuery.queryState.q,
    workspaceQuery.queryState.month,
    workspaceQuery.queryState.time,
    workspaceQuery.queryState.dateFrom,
    workspaceQuery.queryState.dateTo,
    workspaceQuery.queryState.priority,
    workspaceQuery.queryState.category,
    workspaceQuery.queryState.deadline,
    workspaceQuery.queryState.attention,
    workspaceQuery.queryState.view,
    propScope,
    forcedScope,
    selectedDepartment,
    activeStatus,
    searchQuery,
    isOverdueOnly,
    activeWorkbox,
    initialViewMode,
    isExecutive,
  ]);

  // Deep-linked task selection from queryState or prop
  const effectiveSelectedTaskId =
    propSelectedTaskId || workspaceQuery?.queryState.selectedTaskId;

  React.useEffect(() => {
    if (effectiveSelectedTaskId && tasks.length > 0) {
      const isMatch = (t: SchoolTask | StaffTask) =>
        t.id === effectiveSelectedTaskId ||
        (t as any).code === effectiveSelectedTaskId ||
        (t as any).taskCode === effectiveSelectedTaskId;

      let found: SchoolTask | StaffTask | undefined = tasks.find(isMatch);
      if (!found) {
        for (const t of tasks) {
          const sub = t.subTasks?.find(isMatch);
          if (sub) {
            found = sub;
            break;
          }
        }
      }
      if (found) {
        setInternalSelectedTask(found);
        setIsDetailOpen(true);
        onSelectTask?.(found);
      }
    } else if (!effectiveSelectedTaskId && !propSelectedTaskId && isDetailOpen) {
      setInternalSelectedTask(null);
      setIsDetailOpen(false);
    }
  }, [effectiveSelectedTaskId, tasks, onSelectTask, propSelectedTaskId, isDetailOpen]);

  // Fallback initial URL parameter parsing for non-App Router environments
  const [hasInitializedFallbackUrl, setHasInitializedFallbackUrl] = React.useState(false);
  React.useEffect(() => {
    if (workspaceQuery || hasInitializedFallbackUrl || typeof window === "undefined") return;
    try {
      const parsed = parseWorkspaceQuery(window.location.search);
      if (parsed.scope && (parsed.scope === "school" || parsed.scope === "unit" || parsed.scope === "my")) {
        if (parsed.scope !== "school" || isExecutive) {
          setActiveScope(parsed.scope);
          onScopeChange?.(parsed.scope);
        }
      }
      if (parsed.unit) {
        setInternalDept(parsed.unit);
        onDepartmentChange?.(parsed.unit);
      }
      if (parsed.status && parsed.status !== "ALL") {
        setInternalStatus(parsed.status);
        onStatusFilterChange?.(parsed.status);
      }
      const parsedQ = parsed.query || parsed.q;
      if (parsedQ) {
        setInternalSearch(parsedQ);
        onSearchChange?.(parsedQ);
      }
      if (parsed.view && (parsed.view === "table" || parsed.view === "kanban")) {
        setInternalViewMode(parsed.view);
        onViewModeChange?.(parsed.view);
      }
      if (parsed.month !== undefined && parsed.month !== "ALL") {
        setCurrentMonth(parsed.month);
      }
      if (parsed.selectedTaskId && tasks.length > 0) {
        const isMatch = (t: SchoolTask | StaffTask) =>
          t.id === parsed.selectedTaskId ||
          (t as any).code === parsed.selectedTaskId ||
          (t as any).taskCode === parsed.selectedTaskId;

        let found: SchoolTask | StaffTask | undefined = tasks.find(isMatch);
        if (!found) {
          for (const t of tasks) {
            const sub = t.subTasks?.find(isMatch);
            if (sub) {
              found = sub;
              break;
            }
          }
        }
        if (found) {
          setInternalSelectedTask(found);
          setIsDetailOpen(true);
          onSelectTask?.(found);
        }
      }
      setHasInitializedFallbackUrl(true);
    } catch {
      setHasInitializedFallbackUrl(true);
    }
  }, [
    workspaceQuery,
    hasInitializedFallbackUrl,
    tasks,
    isExecutive,
    onScopeChange,
    onDepartmentChange,
    onStatusFilterChange,
    onSearchChange,
    onViewModeChange,
    onSelectTask,
  ]);

  // Fallback popstate listener for non-App Router environments
  React.useEffect(() => {
    if (workspaceQuery || typeof window === "undefined") return;

    const handlePopState = () => {
      try {
        const parsed = parseWorkspaceQuery(window.location.search);
        if (parsed.selectedTaskId) {
          const isMatch = (t: SchoolTask | StaffTask) =>
            t.id === parsed.selectedTaskId ||
            (t as any).code === parsed.selectedTaskId ||
            (t as any).taskCode === parsed.selectedTaskId;

          let found: SchoolTask | StaffTask | undefined = tasks.find(isMatch);
          if (!found) {
            for (const t of tasks) {
              const sub = t.subTasks?.find(isMatch);
              if (sub) {
                found = sub;
                break;
              }
            }
          }
          if (found) {
            setInternalSelectedTask(found);
            setIsDetailOpen(true);
          }
        } else {
          setInternalSelectedTask(null);
          setIsDetailOpen(false);
        }
      } catch {
        // Safe fallback
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [workspaceQuery, tasks]);

  // Canonical Scope Filtering: NEVER mutate subtasks in-memory
  // Issue #21: Only scope-filter top-level tasks; child tasks remain nested
  const scopedTasks = React.useMemo(() => {
    const topLevel = tasks.filter((t) => !t.parentTaskId);
    return filterTasksByScope(
      topLevel,
      workspaceScopeToTaskScope(activeScope),
      user,
      currentDept
    );
  }, [tasks, activeScope, user, currentDept]);

  // Derive metrics and actionQueue without subtask mutation
  const { metrics, actionQueue } = React.useMemo(() => {
    const data = deriveAdaptiveWorkspaceData({
      tasks: scopedTasks,
      user,
      scope: "school",
      selectedDepartment: currentDept,
    });
    const labelScope =
      activeScope === "school"
        ? "Toàn trường"
        : activeScope === "unit"
        ? currentDept || user?.departmentCode || user?.department || "Đơn vị"
        : "Cá nhân";
    return {
      metrics: {
        ...data.metrics,
        labelScope,
      },
      actionQueue: data.actionQueue,
    };
  }, [scopedTasks, user, activeScope, currentDept]);

  const actionQueueTotal =
    actionQueue.pendingApprovals.length + actionQueue.myPendingSubmissions.length;

  // Scope Badge Counts: Total tasks visible per scope BEFORE search/supplementary filters
  // Issue #21: Count only top-level tasks (parentTaskId is falsy)
  const calculatedScopeBadgeCounts = React.useMemo<Record<WorkspaceScope, number>>(() => {
    const topLevel = tasks.filter((t) => !t.parentTaskId);
    const myTasks = filterTasksByScope(topLevel, "my", user);
    const unitTasks = filterTasksByScope(topLevel, "unit", user, currentDept);
    const schoolTasks = filterTasksByScope(topLevel, "school", user, currentDept);

    return {
      my: myTasks.length,
      unit: unitTasks.length,
      school: schoolTasks.length,
    };
  }, [tasks, user, currentDept]);

  // Compute counts for smart filter pills (Tất cả, Của tôi, Chờ duyệt, Quá hạn, Hôm nay)
  const tabCounts = React.useMemo(() => {
    return computeWorkspaceTabCounts({
      scopedTasks,
      user,
      referenceDate: getSystemReferenceDate(),
      pendingApprovalsCount: actionQueue.pendingApprovals.length,
      pendingSubmissionsCount: actionQueue.myPendingSubmissions.length,
    });
  }, [
    scopedTasks,
    user,
    actionQueue.pendingApprovals.length,
    actionQueue.myPendingSubmissions.length,
  ]);

  const effectiveActiveTab = React.useMemo(() => {
    if (
      currentWorkbox === "my_pending_approval" ||
      currentWorkbox === "waiting_approval" ||
      currentWorkbox === "review"
    ) {
      return "waiting_approval";
    }
    if (
      currentWorkbox === "my_pending_submission" ||
      currentWorkbox === "pending_submission"
    ) {
      return "pending_submission";
    }
    if (currentWorkbox === "my_tasks" || currentWorkbox === "my" || currentStatus === "my") {
      return "all";
    }
    if (
      currentWorkbox === "overdue" ||
      currentWorkbox === "urgent_overdue" ||
      currentOverdue
    ) {
      return "overdue";
    }
    return currentStatus || "all";
  }, [currentWorkbox, currentOverdue, currentStatus]);

  const handleFilterCanvasFromWorkbox = React.useCallback(
    (
      filterType:
        | "approvals"
        | "submissions"
        | "overdue"
        | "all"
        | "today"
        | "waiting_approval"
        | "pending_submission"
        | "my"
        | string,
      navOptions?: { replace?: boolean }
    ) => {
      setIsActionQueueOpen(false);

      // Determine whether we are already in this filter state to avoid adding duplicate history entries
      let isSameState = false;
      if (
        filterType === "approvals" ||
        filterType === "waiting_approval" ||
        filterType === "review"
      ) {
        isSameState =
          currentStatus === "waiting_approval" &&
          (currentWorkbox === "my_pending_approval" ||
            workspaceQuery?.queryState.attention === "requires_my_approval");
      } else if (
        filterType === "submissions" ||
        filterType === "pending_submission"
      ) {
        isSameState =
          currentStatus === "pending_submission" &&
          (currentWorkbox === "my_pending_submission" ||
            workspaceQuery?.queryState.attention === "requires_my_action");
      } else if (filterType === "overdue") {
        isSameState =
          Boolean(currentOverdue) &&
          (currentStatus === "overdue" ||
            workspaceQuery?.queryState.attention === "overdue");
      } else if (filterType === "all" || filterType === "ALL") {
        isSameState =
          (!currentStatus || currentStatus === "ALL" || currentStatus === "all") &&
          (!workspaceQuery?.queryState.attention ||
            workspaceQuery?.queryState.attention === "ALL") &&
          !currentOverdue;
      } else if (filterType === "my") {
        isSameState = activeScope === "my";
      } else if (filterType === "today") {
        isSameState = currentStatus === "today";
      } else {
        isSameState = currentStatus === filterType;
      }

      // Intentional drill-down creates a new history entry (push); selecting the same state replaces
      const shouldReplace = navOptions?.replace ?? (isSameState ? true : false);

      if (
        filterType === "approvals" ||
        filterType === "waiting_approval" ||
        filterType === "review"
      ) {
        setInternalStatus("waiting_approval");
        setInternalWorkbox("my_pending_approval");
        setInternalOverdue(false);
        onStatusFilterChange?.("waiting_approval");
        onWorkboxChange?.("my_pending_approval");
        onOverdueFilterChange?.(false);
        workspaceQuery?.updateWorkspaceQuery(
          {
            status: "WAITING_APPROVAL",
            attention: "requires_my_approval",
          },
          { replace: shouldReplace }
        );
      } else if (
        filterType === "submissions" ||
        filterType === "pending_submission"
      ) {
        setInternalStatus("pending_submission");
        setInternalWorkbox("my_pending_submission");
        setInternalOverdue(false);
        onStatusFilterChange?.("pending_submission");
        onWorkboxChange?.("my_pending_submission");
        onOverdueFilterChange?.(false);
        workspaceQuery?.updateWorkspaceQuery(
          {
            status: "IN_PROGRESS",
            attention: "requires_my_action",
          },
          { replace: shouldReplace }
        );
      } else if (filterType === "overdue") {
        setInternalStatus("overdue");
        setInternalWorkbox("overdue");
        setInternalOverdue(true);
        onStatusFilterChange?.("overdue");
        onWorkboxChange?.("overdue");
        onOverdueFilterChange?.(true);
        workspaceQuery?.updateWorkspaceQuery(
          {
            status: "ALL",
            attention: "overdue",
          },
          { replace: shouldReplace }
        );
      } else if (filterType === "today") {
        setInternalStatus("today");
        setInternalWorkbox("ALL");
        setInternalOverdue(false);
        onStatusFilterChange?.("today");
        onWorkboxChange?.("ALL");
        onOverdueFilterChange?.(false);
        workspaceQuery?.updateWorkspaceQuery(
          {
            status: "ALL",
            attention: undefined,
          },
          { replace: shouldReplace }
        );
      } else if (filterType === "all" || filterType === "ALL") {
        setInternalStatus(undefined);
        setInternalWorkbox("ALL");
        setInternalOverdue(false);
        onStatusFilterChange?.(undefined);
        onWorkboxChange?.("ALL");
        onOverdueFilterChange?.(false);
        workspaceQuery?.updateWorkspaceQuery(
          {
            status: "ALL",
            attention: undefined,
          },
          { replace: shouldReplace }
        );
      } else if (filterType === "my") {
        handleScopeChange("my");
        setInternalStatus(undefined);
        setInternalWorkbox("ALL");
        setInternalOverdue(false);
        onStatusFilterChange?.(undefined);
        onWorkboxChange?.("ALL");
        onOverdueFilterChange?.(false);
        workspaceQuery?.updateWorkspaceQuery(
          {
            scope: "my",
            status: "ALL",
            attention: undefined,
          },
          { replace: shouldReplace }
        );
      } else {
        setInternalStatus(filterType);
        setInternalWorkbox("ALL");
        setInternalOverdue(false);
        onStatusFilterChange?.(filterType);
        onWorkboxChange?.("ALL");
        onOverdueFilterChange?.(false);
        workspaceQuery?.updateWorkspaceQuery(
          {
            status: (filterType as any) || "ALL",
            attention: undefined,
          },
          { replace: shouldReplace }
        );
      }
    },
    [
      currentStatus,
      currentWorkbox,
      currentOverdue,
      activeScope,
      onStatusFilterChange,
      onWorkboxChange,
      onOverdueFilterChange,
      workspaceQuery,
      handleScopeChange,
    ]
  );

  const handleStatusFilterChange = React.useCallback(
    (status: string) => {
      const normStatus = status === "all" ? undefined : status;
      setInternalStatus(normStatus);
      onStatusFilterChange?.(normStatus);
      workspaceQuery?.setStatus((normStatus as any) || "ALL", { shallow: true, replace: true });
    },
    [onStatusFilterChange, workspaceQuery]
  );

  const handleDeadlineFilterChange = React.useCallback(
    (deadline: string) => {
      const normDeadline = deadline === "all" ? undefined : deadline;
      setInternalDeadline(normDeadline);
      const isOverdue = normDeadline === "overdue";
      setInternalOverdue(isOverdue);
      onOverdueFilterChange?.(isOverdue);
      workspaceQuery?.updateWorkspaceQuery(
        {
          deadline: normDeadline,
          attention: isOverdue ? "overdue" : undefined,
        },
        { shallow: true, replace: true }
      );
    },
    [onOverdueFilterChange, workspaceQuery]
  );

  const handlePriorityChange = React.useCallback(
    (prio: string) => {
      const clean = prio && prio !== "ALL" ? prio : "ALL";
      setCurrentPriority(clean);
      workspaceQuery?.setPriority(clean !== "ALL" ? clean : undefined, { shallow: true, replace: true });
    },
    [workspaceQuery]
  );

  const handleCategoryChange = React.useCallback(
    (cat: string) => {
      const clean = cat && cat !== "ALL" ? cat : "ALL";
      setCurrentCategory(clean);
      workspaceQuery?.setCategory(clean !== "ALL" ? clean : undefined, { shallow: true, replace: true });
    },
    [workspaceQuery]
  );

  // Filter tasks based on search, smart status, deadline, workbox, category, priority, month, and overdue criteria
  const displayedTasks = React.useMemo(() => {
    return filterDisplayedTasks({
      tasks: scopedTasks,
      search: currentSearch,
      status: currentStatus,
      deadline: internalDeadline,
      workbox: currentWorkbox,
      category: currentCategory,
      priority: currentPriority,
      academicMonth: currentMonth,
      timeFilter,
      overdue: currentOverdue,
      user,
    });
  }, [
    scopedTasks,
    currentSearch,
    currentStatus,
    internalDeadline,
    currentWorkbox,
    currentCategory,
    currentPriority,
    currentMonth,
    timeFilter,
    currentOverdue,
    user,
  ]);

  const handlePeekNext = React.useCallback(() => {
    if (!peekTask || displayedTasks.length === 0) return;
    const currentIndex = displayedTasks.findIndex((t) => t.id === peekTask.id);
    if (currentIndex >= 0 && currentIndex < displayedTasks.length - 1) {
      setPeekTask(displayedTasks[currentIndex + 1]);
    }
  }, [peekTask, displayedTasks]);

  const handlePeekPrev = React.useCallback(() => {
    if (!peekTask || displayedTasks.length === 0) return;
    const currentIndex = displayedTasks.findIndex((t) => t.id === peekTask.id);
    if (currentIndex > 0) {
      setPeekTask(displayedTasks[currentIndex - 1]);
    }
  }, [peekTask, displayedTasks]);

  // Hook Space key on table row to open LinearPeekPreviewModal
  React.useEffect(() => {
    const handleGlobalSpaceKeyDown = (e: KeyboardEvent) => {
      if (e.key !== " " && e.key !== "Spacebar") return;

      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tagName = target.tagName.toLowerCase();
      if (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        tagName === "button" ||
        target.isContentEditable ||
        target.getAttribute("role") === "checkbox" ||
        target.getAttribute("role") === "button"
      ) {
        return;
      }

      // Check if target or parent has data-task-id
      const rowEl = target.closest("[data-task-id]");
      if (!rowEl) return;
      const taskId = rowEl.getAttribute("data-task-id");
      if (!taskId) return;

      const found = displayedTasks.find(
        (t) => t.id === taskId || (t as any).code === taskId || (t as any).taskCode === taskId
      );
      if (found) {
        e.preventDefault();
        e.stopPropagation();
        setPeekTask(found);
      }
    };

    const handleCustomPeek = (e: Event) => {
      const customEvt = e as CustomEvent<{ task: SchoolTask | StaffTask }>;
      if (customEvt.detail?.task) {
        setPeekTask(customEvt.detail.task);
      }
    };

    window.addEventListener("keydown", handleGlobalSpaceKeyDown);
    window.addEventListener("qcet:peek-task", handleCustomPeek);
    return () => {
      window.removeEventListener("keydown", handleGlobalSpaceKeyDown);
      window.removeEventListener("qcet:peek-task", handleCustomPeek);
    };
  }, [displayedTasks]);

  const handleResetFilters = React.useCallback(() => {
    setActiveViewId(null);
    setInternalDept(undefined);
    setInternalStatus(undefined);
    setInternalDeadline(undefined);
    setInternalSearch(undefined);
    setInternalOverdue(false);
    setInternalWorkbox("ALL");
    setCurrentCategory("ALL");
    setCurrentPriority("ALL");
    setCurrentMonth("ALL");
    if (onResetFilters) onResetFilters();
    if (onDepartmentChange) onDepartmentChange("ALL");
    if (onStatusFilterChange) onStatusFilterChange(undefined);
    if (onSearchChange) onSearchChange("");
    if (onOverdueFilterChange) onOverdueFilterChange(false);
    if (onWorkboxChange) onWorkboxChange("ALL");
    if (onAction) onAction("RESET_FILTERS");
    workspaceQuery?.resetFilters({
      shallow: true,
      replace: true,
      preserveScope: true,
      preserveUnit: false,
      preservePeriod: false,
      resetPeriodTo: "all",
      preserveView: true,
    });
  }, [
    onResetFilters,
    onDepartmentChange,
    onStatusFilterChange,
    onSearchChange,
    onOverdueFilterChange,
    onWorkboxChange,
    onAction,
    workspaceQuery,
  ]);

  const handleRemoveDept = React.useCallback(() => {
    setInternalDept(undefined);
    if (onDepartmentChange) onDepartmentChange("ALL");
    workspaceQuery?.setDept(undefined, { replace: true });
  }, [onDepartmentChange, workspaceQuery]);

  const handleRemoveStatus = React.useCallback(() => {
    setInternalStatus(undefined);
    if (onStatusFilterChange) onStatusFilterChange(undefined);
    workspaceQuery?.setStatus("ALL", { replace: true });
  }, [onStatusFilterChange, workspaceQuery]);

  const handleRemoveSearch = React.useCallback(() => {
    setInternalSearch(undefined);
    if (onSearchChange) onSearchChange("");
    workspaceQuery?.setSearchQuery("", { replace: true });
  }, [onSearchChange, workspaceQuery]);

  const handleRemoveOverdue = React.useCallback(() => {
    setInternalOverdue(false);
    if (onOverdueFilterChange) onOverdueFilterChange(false);
    if (workspaceQuery?.queryState.attention === "overdue") {
      workspaceQuery?.setAttention(null, { replace: true });
    }
  }, [onOverdueFilterChange, workspaceQuery]);

  const handleRemoveWorkbox = React.useCallback(() => {
    setInternalWorkbox("ALL");
    if (onWorkboxChange) onWorkboxChange("ALL");
    if (workspaceQuery?.queryState.attention) {
      workspaceQuery?.setAttention(null, { replace: true });
    }
  }, [onWorkboxChange, workspaceQuery]);

  // Current active filter criteria for saved views
  const currentCriteria: TaskViewCriteria = React.useMemo(() => {
    return {
      scope: activeScope,
      dept: currentDept,
      status: currentStatus,
      workbox: currentWorkbox,
      category: currentCategory,
      priority: currentPriority,
      academicMonth: currentMonth,
      q: currentSearch,
      viewMode: viewMode === "kanban" ? "kanban" : "table",
      density: tableDensity,
    };
  }, [
    activeScope,
    currentDept,
    currentStatus,
    currentWorkbox,
    currentCategory,
    currentPriority,
    currentMonth,
    currentSearch,
    viewMode,
    tableDensity,
  ]);

  const handleSelectView = React.useCallback(
    (view: SavedTaskView) => {
      setActiveViewId(view.id);
      const { criteria } = view;

      if (criteria.scope) {
        if (criteria.scope === "school" && !isExecutive) {
          // unpermitted
        } else {
          setActiveScope(criteria.scope);
          onScopeChange?.(criteria.scope);
        }
      }
      const dept = criteria.dept || "ALL";
      setInternalDept(dept);
      onDepartmentChange?.(dept);

      const status = criteria.status;
      setInternalStatus(status);
      onStatusFilterChange?.(status);

      const wb = criteria.workbox || "ALL";
      setInternalWorkbox(wb);
      onWorkboxChange?.(wb);

      if (status === "overdue" || wb === "overdue") {
        setInternalOverdue(true);
        onOverdueFilterChange?.(true);
      } else {
        setInternalOverdue(false);
        onOverdueFilterChange?.(false);
      }

      const cat = criteria.category || "ALL";
      setCurrentCategory(cat);

      const prio = criteria.priority || "ALL";
      setCurrentPriority(prio);

      const month = criteria.academicMonth ?? "ALL";
      setCurrentMonth(month);

      const q = criteria.q || "";
      setInternalSearch(q);
      onSearchChange?.(q);

      if (criteria.viewMode) {
        setInternalViewMode(criteria.viewMode);
        onViewModeChange?.(criteria.viewMode);
      }

      if (criteria.density === "compact" || criteria.density === "comfortable") {
        setTableDensity(criteria.density);
      }

      workspaceQuery?.updateWorkspaceQuery(
        {
          scope: criteria.scope,
          dept: dept !== "ALL" ? dept : undefined,
          unit: dept !== "ALL" ? dept : undefined,
          status: status && status !== "ALL" && status !== "all" ? (status as any) : "ALL",
          month: month !== "ALL" ? month : "ALL",
          q: q ? q : undefined,
          view: criteria.viewMode !== "table" ? (criteria.viewMode as any) : "table",
        },
        { replace: true }
      );
    },
    [
      isExecutive,
      onScopeChange,
      onDepartmentChange,
      onStatusFilterChange,
      onWorkboxChange,
      onOverdueFilterChange,
      onSearchChange,
      onViewModeChange,
      workspaceQuery,
    ]
  );

  // SavedView viewId deep-link hydration (mount-once).
  // View precedence: explicit URL ?view=table|kanban > SavedView layout >
  // persisted preference (qcet_task_view_mode) > table default.
  // Mount hydration only: URL-sync of viewId on select is deferred to the
  // query layer (use-workspace-query does not round-trip viewId).
  const viewIdHydratedRef = React.useRef(false);
  React.useEffect(() => {
    if (viewIdHydratedRef.current) return;
    if (activeViewId) {
      viewIdHydratedRef.current = true;
      return;
    }
    viewIdHydratedRef.current = true;
    if (typeof window === "undefined") return;
    try {
      const sp = new URLSearchParams(window.location.search);
      const viewId = sp.get("viewId") || sp.get("view_id") || sp.get("savedView");
      if (!viewId) return;
      const preset = findPresetById(viewId);
      if (!preset) return;
      handleSelectView(preset);
      const explicitView = sp.get("view");
      if (explicitView === "table" || explicitView === "kanban") {
        handleViewModeChange(explicitView);
      }
    } catch {
      // Ignore malformed query strings; workspace falls back to defaults.
    }
  }, [activeViewId, handleSelectView, handleViewModeChange]);

  const isStaff =
    !isExecutiveUser(user) &&
    !isManagerUser(user) &&
    forcedRole !== "ADMIN" &&
    forcedRole !== "MANAGER" &&
    forcedScope !== "school" &&
    forcedScope !== "unit";

  // Modal creation state
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [createInitialLevel, setCreateInitialLevel] = React.useState<"TRUONG" | "DON_VI">("DON_VI");
  const [createInitialParentId, setCreateInitialParentId] = React.useState<string | undefined>(undefined);

  const openCreateModal = React.useCallback(
    (level: "TRUONG" | "DON_VI", parentId?: string) => {
      setCreateInitialLevel(level);
      setCreateInitialParentId(parentId);
      setIsCreateModalOpen(true);
    },
    []
  );

  // Unified task creation handler: defaults staff to "DON_VI" or "my"
  const handleCreateTaskClick = React.useCallback(() => {
    if (onCreateTask) {
      if (isStaff) {
        const staffScope = activeScope === "unit" ? "DON_VI" : "my";
        onCreateTask(staffScope);
      } else {
        onCreateTask(activeScope);
      }
    } else if (onAction) {
      const staffScope = activeScope === "unit" ? "DON_VI" : "my";
      onAction("CREATE_TASK", { scope: isStaff ? staffScope : activeScope });
    } else {
      openCreateModal(activeScope === "unit" ? "DON_VI" : "TRUONG");
    }
  }, [onCreateTask, onAction, isStaff, activeScope, openCreateModal]);

  // Keyboard shortcut 'C' / 'N P' to trigger task creation when modal is closed
  useLinearTaskShortcuts({
    enabled: !isCreateModalOpen,
    onOpen: handleCreateTaskClick,
  });

  // Canonical refresh: delegates to the parent when the dataset is controlled,
  // otherwise reloads the canonical server collection.
  const handleRefresh = React.useCallback(async () => {
    if (onRefresh) {
      await onRefresh();
      return;
    }
    setIsRefreshingInternal(true);
    try {
      const res = await fetch("/api/dashboard/overview");
      if (res.ok) {
        const data = await res.json();
        if (data?.tasks) {
          setInternalTasks(data.tasks);
          setInternalError(null);
        }
      }
    } catch {
      // transient
    } finally {
      setIsRefreshingInternal(false);
    }
  }, [onRefresh]);

  // Task-creation reconciliation (T73 / Server-Truth-Wins).
  //
  // `CreateTaskModal` is the single writer for the create command: it maps the
  // draft through the canonical adapter, POSTs the strict `CreateTaskInput`, and
  // invokes `onSubmit` only with a server-confirmed DTO. The workspace must not
  // re-issue the mutation (the former duplicate raw POST of the UI form draft was
  // rejected by the strict schema) and must never roll a confirmed create back to
  // a stale pre-create snapshot. Instead it reconciles local state from server
  // truth through the canonical refresh.
  const handleCreateTaskSubmit = React.useCallback(
    async (_formData: CreateTaskFormData, result?: CreateTaskSubmitResult) => {
      setIsCreateModalOpen(false);

      // Without a server-confirmed DTO there is nothing proven to reconcile;
      // leave the list untouched rather than fabricating or rolling back state.
      if (!result?.ok) {
        return;
      }

      await handleRefresh();
    },
    [handleRefresh]
  );

  // Status mutation handler with optimistic UI and rollback
  const handleStatusChange = React.useCallback(
    async (taskId: string, newStatus: TaskStatus, note?: string) => {
      if (onStatusChange) {
        await onStatusChange(taskId, newStatus, note);
        return;
      }
      const previousData = internalTasks;
      setInternalTasks((prev) => applyOptimisticStatusChange(prev, taskId, newStatus));

      const res = await updateTaskStatus(taskId, newStatus, note);
      if (!res.ok) {
        setInternalTasks(previousData);
      }
    },
    [onStatusChange, internalTasks]
  );

  // Urge notification trigger
  const handleUrge = React.useCallback(
    async (taskId: string, taskTitle: string, assigneeName: string) => {
      if (onSendReminder) {
        onSendReminder(assigneeName, `Đôn đốc tiến độ thực hiện nhiệm vụ: ${taskTitle}`);
        return;
      }
      try {
        await fetch("/api/notifications/push/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Đôn đốc công việc",
            body: `Nhiệm vụ "${taskTitle}" cần được đẩy nhanh tiến độ.`,
            data: { taskId, assigneeName },
          }),
        });
      } catch {
        // transient
      }
    },
    [onSendReminder]
  );

  const effectiveIsRefreshing = isRefreshing || isRefreshingInternal;
  const effectiveError = errorMessage || internalError;
  const isUnassigned = isUserUnassignedDepartment(user);

  return (
    <div
      data-slot="unified-adaptive-workspace"
      data-active-scope={activeScope}
      className={cn(
        "space-y-4 pb-2 sm:pb-8",
        className
      )}
    >
      {/* Screen-reader accessible context info when provided by adapter shims (visual banner removed for clean unified canvas) */}
      {(contextTitle || contextBadge) && (
        <aside
          role="region"
          aria-label="Thông tin ngữ cảnh không gian làm việc"
          className="sr-only"
        >
          {contextBadge && <span>{contextBadge}</span>}
          {contextTitle && <span>{contextTitle}</span>}
        </aside>
      )}

      {/* Offline / Server Error Alert Banner */}
      {(isOffline || effectiveError) && (
        <aside
          data-slot="workspace-offline-alert"
          role="alert"
          className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 text-xs"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="size-4 shrink-0 text-amber-700" />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">
                {isOffline ? "Mất kết nối máy chủ" : "Không thể đồng bộ dữ liệu"}
              </p>
              <p className="text-muted-foreground truncate mt-0.5">
                {effectiveError ||
                  "Không thể đồng bộ dữ liệu thời gian thực từ CSDL trường. Vui lòng kiểm tra đường truyền và thử lại."}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={effectiveIsRefreshing}
            className="text-xs min-h-[44px] sm:min-h-8 sm:h-8 px-3 shrink-0 bg-background hover:bg-muted"
          >
            Thử lại
          </Button>
        </aside>
      )}

      {/* Main Canvas Surface: Linear Task Detail (when task selected) OR Workspace List/Table View */}
      {!disableInternalDetail && isDetailOpen && internalSelectedTask ? (
        <div data-slot="in-canvas-linear-detail" className="w-full">
          <LinearTaskDetailView
            task={internalSelectedTask}
            taskId={internalSelectedTask.id}
            onStatusChange={handleStatusChange}
            onPriorityChange={async (taskId, priority) => {
              const pVal = priority === "MEDIUM" ? "NORMAL" : priority;
              setInternalTasks((prev) =>
                prev.map((t) => (t.id === taskId ? { ...t, priority: pVal } : t))
              );
            }}
            onSelectSubTask={(subTaskOrId) => {
              if (typeof subTaskOrId === "string") {
                const isMatch = (t: SchoolTask | StaffTask) =>
                  t.id === subTaskOrId ||
                  (t as any).code === subTaskOrId ||
                  (t as any).taskCode === subTaskOrId;

                const foundSchool = displayedTasks.find(isMatch);
                if (foundSchool) {
                  handleSelectTask(foundSchool);
                  return;
                }
                for (const t of displayedTasks) {
                  const sub = t.subTasks?.find(isMatch);
                  if (sub) {
                    handleSelectTask(sub);
                    return;
                  }
                }
              } else {
                handleSelectTask(subTaskOrId);
              }
            }}
            currentUser={user}
            onRefresh={handleRefresh}
            onSubmitDeliverable={
              onSubmitDeliverable ? (task) => setSubmittingTask(task) : undefined
            }
            onReview={onReview ? (task) => setReviewingTask(task) : undefined}
          />
        </div>
      ) : (
        <>
          {/* 1. Unified Task Toolbar: Single Unified Surface (Scope, Search, Smart Pills, Popover, View, Density) */}
          {!hideScopeSwitcher && (
            <UnifiedTaskToolbar
          scope={activeScope}
          onScopeChange={handleScopeChange}
          user={user}
          userRole={effectiveReviewerRole}
          isExecutive={isExecutive}
          badgeCounts={calculatedScopeBadgeCounts}
          isUnassignedDepartment={isUnassigned}
          searchQuery={currentSearch || ""}
          onSearchChange={(q) => {
            setInternalSearch(q);
            onSearchChange?.(q);
            workspaceQuery?.setSearchQuery(q, { shallow: true, replace: true });
          }}
          loading={effectiveIsRefreshing}
          onNewTaskClick={handleCreateTaskClick}
          canCreateTask={true}
          createButtonLabel="Giao việc"
          activeTab={effectiveActiveTab}
          onTabChange={(tab) => handleFilterCanvasFromWorkbox(tab)}
          selectedStatus={currentStatus || "all"}
          onStatusChange={handleStatusFilterChange}
          selectedDeadline={internalDeadline || "all"}
          onDeadlineChange={handleDeadlineFilterChange}
          tabCounts={tabCounts}
          selectedDepartment={currentDept || "ALL"}
          onDepartmentChange={(dept) => {
            setInternalDept(dept);
            onDepartmentChange?.(dept);
            workspaceQuery?.setDept(dept !== "ALL" ? dept : null, { shallow: true, replace: true });
          }}
          selectedCategory={currentCategory}
          onCategoryChange={handleCategoryChange}
          selectedPriority={currentPriority}
          onPriorityChange={handlePriorityChange}
          selectedAcademicMonth={currentMonth}
          selectedTimeFilter={timeFilter}
          onTimeFilterChange={(next) => {
            setTimeFilter(next);
            const month = next.kind === "month" ? next.month : "ALL";
            setCurrentMonth(month);
            workspaceQuery?.updateWorkspaceQuery((prev) => ({
              ...prev,
              month,
              time: next.kind === "preset" ? next.preset : next.kind === "range" ? "range" : undefined,
              dateFrom: next.kind === "range" ? next.from : undefined,
              dateTo: next.kind === "range" ? next.to : undefined,
            }), { shallow: true, replace: true });
          }}
          onResetFilters={handleResetFilters}
          activeViewId={activeViewId}
          onSelectView={handleSelectView}
          currentCriteria={currentCriteria}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          density={tableDensity}
          onDensityChange={setTableDensity}
          onRefresh={handleRefresh}
          isRefreshing={effectiveIsRefreshing}
          totalTasksCount={scopedTasks.length}
          filteredTasksCount={displayedTasks.length}
          actionQueueCount={actionQueueTotal}
          onOpenActionQueue={() => setIsActionQueueOpen(true)}
          onActionQueueClick={() => setIsActionQueueOpen(true)}
        />
      )}

      {/* Loading state when fetching initial data */}
      {(initialLoading || isLoading || isInternalLoading) && tasks.length === 0 && (
        <div
          data-slot="workspace-loading-state"
          className="p-8 rounded-2xl border border-border/60 bg-card text-center space-y-3"
        >
          <div className="size-8 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary animate-spin">
            <Loader2 className="size-4" />
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            Đang tải dữ liệu nhiệm vụ từ máy chủ QCET...
          </p>
        </div>
      )}

      {/* 2. Workspace Layout: Full-Width Canvas (Default) or Backward-compatible Split Cockpit */}
      {enableSplitCockpit ? (
        <div
          data-slot="split-cockpit-layout"
          className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start"
        >
          {/* Primary Work Table (approx 58-66% width on desktop) */}
          <div
            data-slot="split-cockpit-primary"
            className="lg:col-span-7 xl:col-span-8 space-y-3 min-w-0"
          >
            {/* Action Queue Quick Trigger */}
            {actionQueueTotal > 0 && (
              <div className="flex items-center justify-end pb-1">
                <button
                  type="button"
                  data-slot="action-queue-trigger"
                  onClick={() => setIsActionQueueOpen(true)}
                  className="inline-flex min-h-[44px] sm:min-h-8 sm:h-8 items-center gap-2 px-3 py-1.5 rounded-xl border border-primary/25 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold cursor-pointer transition-colors shrink-0"
                  aria-label="Mở hàng đợi xử lý công việc"
                  title="Mở Hộp việc khẩn cấp (Smart Workbox)"
                >
                  <Layers className="size-3.5" strokeWidth={1.5} />
                  <span>Hộp việc xử lý</span>
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground tabular-nums leading-none">
                    {actionQueueTotal}
                  </span>
                </button>
              </div>
            )}

            {/* Unassigned Department State or Empty State or Table/Kanban */}
            {activeScope === "unit" && isUnassigned ? (
              <UnassignedDepartmentState onOpenProfile={() => setIsProfileModalOpen(true)} />
            ) : tasks.length === 0 && !initialLoading && !isLoading && !isInternalLoading ? (
              <div
                data-slot="workspace-empty-state"
                className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-border/80 bg-card/40 my-2"
              >
                <div className="size-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground mb-3">
                  <Inbox className="size-6" strokeWidth={1.5} />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-foreground mb-1">
                  Chưa có nhiệm vụ nào được phân công trong kỳ này
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mb-5 leading-relaxed">
                  Hiện tại không có nhiệm vụ nào trong cơ sở dữ liệu. Thầy/Cô có thể tạo nhiệm vụ mới hoặc làm mới dữ liệu từ máy chủ.
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleCreateTaskClick}
                    className="text-xs min-h-[44px] sm:min-h-8 sm:h-8 px-3 cursor-pointer"
                  >
                    Tạo nhiệm vụ mới
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={effectiveIsRefreshing}
                    className="text-xs min-h-[44px] sm:min-h-8 sm:h-8 px-3 cursor-pointer"
                  >
                    Làm mới dữ liệu
                  </Button>
                </div>
              </div>
            ) : (
              <div className="pt-0.5">
                {viewMode === "table" ? (
                  <ModularCascadingTaskTable
                    tasks={displayedTasks}
                    selectedTaskId={internalSelectedTask?.id}
                    scope={activeScope === "my" ? "MY_TASKS" : activeScope}
                    hideToolbar={true}
                    density={tableDensity}
                    onDensityChange={setTableDensity}
                    onSelectTask={handleSelectTask}
                    onStatusChange={handleStatusChange}
                    onRefresh={handleRefresh}
                    onAddTask={() =>
                      openCreateModal(activeScope === "unit" ? "DON_VI" : "TRUONG")
                    }
                    onUrge={handleUrge}
                    onOpenSubmitModal={
                      onSubmitDeliverable
                        ? (st) => setSubmittingTask(st)
                        : undefined
                    }
                    emptyStateProps={{
                      searchQuery: currentSearch,
                      activeTab: effectiveActiveTab,
                      attention: workspaceQuery?.queryState.attention,
                      status: currentStatus !== "ALL" ? currentStatus : undefined,
                      department: currentDept !== "ALL" ? currentDept : undefined,
                      category: currentCategory !== "ALL" ? currentCategory : undefined,
                      priority: currentPriority !== "ALL" ? currentPriority : undefined,
                      academicMonth: currentMonth,
                      onResetFilters: handleResetFilters,
                      onAddTask: () =>
                        openCreateModal(activeScope === "unit" ? "DON_VI" : "TRUONG"),
                    }}
                  />
                ) : (
                  <TaskKanbanBoard
                    tasks={displayedTasks}
                    onSelectTask={handleSelectTask}
                    onStatusChange={handleStatusChange}
                    onAddTask={(level, parentId) =>
                      openCreateModal(
                        level || (activeScope === "unit" ? "DON_VI" : "TRUONG"),
                        parentId
                      )
                    }
                    searchQuery={currentSearch}
                  />
                )}
              </div>
            )}
          </div>

          {/* Contextual Side Panel: Action Queue & Metrics (approx 33-42% width on desktop) */}
          <div
            data-slot="split-cockpit-side-panel"
            className="lg:col-span-5 xl:col-span-4 space-y-4 min-w-0"
          >
            {/* Adaptive Metric Strip */}
            <AdaptiveMetricStrip metrics={metrics} scope={activeScope} />

            {/* Universal Action Queue (Approvals & Deliverables) */}
            <ActionQueueShell
              title="Hàng đợi hành động"
              subtitle={
                activeScope === "school"
                  ? "Hồ sơ chờ BGH phê duyệt và nhiệm vụ trọng tâm"
                  : activeScope === "unit"
                  ? "Nhiệm vụ cần thẩm định L1 và phân công đơn vị"
                  : "Nhiệm vụ cần hoàn thành và nộp minh chứng"
              }
              totalCount={actionQueueTotal}
              collapsible={true}
              defaultCollapsed={false}
              className="border-border/70"
            >
              <UniversalActionQueue
                actionQueue={actionQueue}
                onSelectTask={handleSelectTask}
                scope={activeScope}
                onReview={onReview}
                onSubmitDeliverable={onSubmitDeliverable}
                onOpenReview={onReview ? (task) => setReviewingTask(task) : undefined}
                onOpenSubmit={onSubmitDeliverable ? (task) => setSubmittingTask(task) : undefined}
                onCreateSubtask={
                  onCreateSubtask
                    ? onCreateSubtask
                    : onCreateTask
                    ? (parentId) => onCreateTask(activeScope === "unit" ? "DON_VI" : activeScope, parentId)
                    : (parentId) => openCreateModal("DON_VI", parentId)
                }
                onRemindDRI={
                  onSendReminder
                    ? (taskId, target) => onSendReminder(target, `Đôn đốc tiến độ thực hiện nhiệm vụ ${taskId}`)
                    : (taskId) => handleUrge(taskId, taskId, "Người phụ trách")
                }
                onFilterCanvas={handleFilterCanvasFromWorkbox}
              />
            </ActionQueueShell>
          </div>
        </div>
      ) : (
        <div
          data-slot="task-workspace-canvas"
          className="w-full space-y-2.5 min-w-0"
        >
          {/* Inline summary strip — replaces KPI dashboard cards */}
          <div
            data-slot="task-summary-strip"
            className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums select-none pb-0.5"
          >
            <span className="font-semibold text-foreground">{metrics.totalTasks}</span>
            <span>nhiệm vụ</span>
            <span className="text-border">·</span>
            <span className={metrics.waitingApprovalCount > 0 ? "text-amber-600 font-medium" : ""}>{metrics.waitingApprovalCount}</span>
            <span className={metrics.waitingApprovalCount > 0 ? "text-amber-600" : ""}>chờ duyệt</span>
            <span className="text-border">·</span>
            <span className={metrics.urgentOverdueCount > 0 ? "text-rose-600 font-medium" : ""}>{metrics.urgentOverdueCount}</span>
            <span className={metrics.urgentOverdueCount > 0 ? "text-rose-600" : ""}>quá hạn</span>
          </div>

          <div
            data-slot="full-width-task-canvas"
            className="w-full space-y-1 min-w-0"
          >
            {/* Unassigned Department State or Empty State or Table/Kanban */}
          {activeScope === "unit" && isUnassigned ? (
            <UnassignedDepartmentState onOpenProfile={() => setIsProfileModalOpen(true)} />
          ) : tasks.length === 0 && !initialLoading && !isLoading && !isInternalLoading ? (
            <div
              data-slot="workspace-empty-state"
              className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-border/80 bg-card/40 my-2"
            >
              <div className="size-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground mb-3">
                <Inbox className="size-6" strokeWidth={1.5} />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground mb-1">
                Chưa có nhiệm vụ nào được phân công trong kỳ này
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mb-5 leading-relaxed">
                Hiện tại không có nhiệm vụ nào trong cơ sở dữ liệu. Thầy/Cô có thể tạo nhiệm vụ mới hoặc làm mới dữ liệu từ máy chủ.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleCreateTaskClick}
                  className="text-xs min-h-[44px] sm:min-h-8 sm:h-8 px-3 cursor-pointer"
                >
                  Tạo nhiệm vụ mới
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={effectiveIsRefreshing}
                  className="text-xs min-h-[44px] sm:min-h-8 sm:h-8 px-3 cursor-pointer"
                >
                  Làm mới dữ liệu
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {viewMode === "table" ? (
                <ModularCascadingTaskTable
                  tasks={displayedTasks}
                  selectedTaskId={internalSelectedTask?.id}
                  scope={activeScope === "my" ? "MY_TASKS" : activeScope}
                  hideToolbar={true}
                  density={tableDensity}
                  onDensityChange={setTableDensity}
                  onSelectTask={handleSelectTask}
                  onStatusChange={handleStatusChange}
                  onRefresh={handleRefresh}
                  onAddTask={() =>
                    openCreateModal(activeScope === "unit" ? "DON_VI" : "TRUONG")
                  }
                  onUrge={handleUrge}
                  onOpenSubmitModal={
                    onSubmitDeliverable
                      ? (st) => setSubmittingTask(st)
                      : undefined
                  }
                  emptyStateProps={{
                    searchQuery: currentSearch,
                    activeTab: effectiveActiveTab,
                    attention: workspaceQuery?.queryState.attention,
                    status: currentStatus !== "ALL" ? currentStatus : undefined,
                    department: currentDept !== "ALL" ? currentDept : undefined,
                    category: currentCategory !== "ALL" ? currentCategory : undefined,
                    priority: currentPriority !== "ALL" ? currentPriority : undefined,
                    academicMonth: currentMonth,
                    onResetFilters: handleResetFilters,
                    onAddTask: () =>
                      openCreateModal(activeScope === "unit" ? "DON_VI" : "TRUONG"),
                  }}
                />
              ) : (
                <TaskKanbanBoard
                  tasks={displayedTasks}
                  onSelectTask={handleSelectTask}
                  onStatusChange={handleStatusChange}
                  onAddTask={(level, parentId) =>
                    openCreateModal(
                      level || (activeScope === "unit" ? "DON_VI" : "TRUONG"),
                      parentId
                    )
                  }
                  searchQuery={currentSearch}
                />
              )}
            </div>
          )}
          </div>
        </div>
      )}
        </>
      )}

      {/* Action Queue Slide-Over Drawer (in Full-Width Mode) */}
      {!enableSplitCockpit && (
        <>
          {isActionQueueOpen && (
            <div
              data-slot="action-queue-backdrop"
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in !m-0"
              onClick={() => setIsActionQueueOpen(false)}
              aria-hidden="true"
            />
          )}
          <aside
            data-slot="action-queue-drawer"
            className={cn(
              "fixed inset-y-0 right-0 z-40 flex h-full w-full sm:w-[480px] sm:max-w-[480px] flex-col border-l border-border/60 bg-card/98 backdrop-blur-xl shadow-2xl transition-transform duration-300 !m-0",
              isActionQueueOpen ? "translate-x-0" : "translate-x-full pointer-events-none invisible"
            )}
            role="region"
            aria-label="Hàng đợi xử lý công việc"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-white">
              <h3 className="text-sm font-semibold text-slate-900">
                Hàng đợi xử lý công việc
              </h3>
              <button
                type="button"
                onClick={() => setIsActionQueueOpen(false)}
                className="size-7 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Đóng hàng đợi"
              >
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto thin-scrollbar">
              {/* Summary Metrics - Clean Typography & Alignment */}
              <div className="px-5 py-4 space-y-1 text-xs">
                <div className="font-medium text-slate-900">
                  <span className="font-semibold tabular-nums">{metrics?.totalTasks ?? 0}</span> nhiệm vụ {activeScope === "school" ? "toàn trường" : activeScope === "unit" ? "đơn vị" : "cá nhân"}
                </div>
                <div className={cn(metrics?.urgentOverdueCount && metrics.urgentOverdueCount > 0 ? "text-rose-600 font-medium" : "text-slate-500")}>
                  <span className="font-semibold tabular-nums">{metrics?.urgentOverdueCount ?? 0}</span> quá hạn
                </div>
                <div className={cn(metrics?.waitingApprovalCount && metrics.waitingApprovalCount > 0 ? "text-amber-600 font-medium" : "text-slate-500")}>
                  <span className="font-semibold tabular-nums">{metrics?.waitingApprovalCount ?? 0}</span> chờ phân công/duyệt
                </div>
                <div className="text-slate-500">
                  <span className="font-semibold tabular-nums text-slate-700">{typeof metrics?.completedRate === "number" ? `${metrics.completedRate}%` : "0%"}</span> tiến độ
                </div>
              </div>

              <div className="h-px bg-slate-100 mx-5" />

              {/* Actionable items list */}
              <div className="p-5">
                <UniversalActionQueue
                  actionQueue={actionQueue}
                  onSelectTask={handleSelectTask}
                  scope={activeScope}
                  onReview={onReview}
                  onSubmitDeliverable={onSubmitDeliverable}
                  onOpenReview={onReview ? (task) => setReviewingTask(task) : undefined}
                  onOpenSubmit={onSubmitDeliverable ? (task) => setSubmittingTask(task) : undefined}
                  onCreateSubtask={
                    onCreateSubtask
                      ? onCreateSubtask
                      : onCreateTask
                      ? (parentId) => onCreateTask(activeScope === "unit" ? "DON_VI" : activeScope, parentId)
                      : (parentId) => openCreateModal("DON_VI", parentId)
                  }
                  onRemindDRI={
                    onSendReminder
                      ? (taskId, target) => onSendReminder(target, `Đôn đốc tiến độ thực hiện nhiệm vụ ${taskId}`)
                      : (taskId) => handleUrge(taskId, taskId, "Người phụ trách")
                  }
                />
              </div>
            </div>
          </aside>
        </>
      )}

      {/* 3. Linear Peek Preview Modal (Spacebar Quick Look) */}
      <LinearPeekPreviewModal
        task={peekTask}
        isOpen={Boolean(peekTask)}
        onClose={() => setPeekTask(null)}
        onOpenDetail={(t) => {
          setPeekTask(null);
          handleSelectTask(t);
        }}
        onNavigateNext={handlePeekNext}
        onNavigatePrev={handlePeekPrev}
        hasNext={
          peekTask
            ? displayedTasks.findIndex((t) => t.id === peekTask.id) < displayedTasks.length - 1
            : false
        }
        hasPrev={
          peekTask
            ? displayedTasks.findIndex((t) => t.id === peekTask.id) > 0
            : false
        }
      />

      {/* 4. Linear Task Creation Modal */}
      <LinearCreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmitSuccess={async () => {
          setIsCreateModalOpen(false);
          await handleRefresh();
        }}
        initialLevel={createInitialLevel}
        initialParentTaskId={createInitialParentId}
        initialDepartmentCode={currentDept !== "ALL" ? currentDept : user?.departmentCode || undefined}
      />

      {/* 5. Authenticated Review Action Dialog */}
      {reviewingTask && onReview && (
        <ReviewActionDialog
          isOpen={Boolean(reviewingTask)}
          onClose={() => setReviewingTask(null)}
          task={reviewingTask}
          taskId={reviewingTask.id}
          taskTitle={reviewingTask.title}
          reviewerRole={effectiveReviewerRole}
          reviewerName={user.name}
          onReview={async (payload) => {
            await onReview(payload);
            setReviewingTask(null);
          }}
        />
      )}

      {/* 6. Authenticated Submit Deliverable Modal */}
      {submittingTask && onSubmitDeliverable && (
        <SubmitDeliverableModal
          isOpen={Boolean(submittingTask)}
          onClose={() => setSubmittingTask(null)}
          task={submittingTask as any}
          taskId={submittingTask.id}
          taskTitle={submittingTask.title}
          onSubmit={async (payload) => {
            await onSubmitDeliverable(payload);
            setSubmittingTask(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * UnifiedAdaptiveWorkspace — standalone public export.
 *
 * Gọi useWorkspaceQuery nội bộ. Dùng khi không có canonical owner từ ngoài.
 * Đây là entry point backward-compatible cho mọi nơi dùng UAW trực tiếp.
 */
export function UnifiedAdaptiveWorkspace(props: Omit<UnifiedAdaptiveWorkspaceProps, "workspaceQuery">) {
  const currentAcademicMonth = React.useMemo(() => getCurrentAcademicPeriod().month, []);

  const defaultScope: WorkspaceScope = React.useMemo(() => {
    if (props.forcedScope) return props.forcedScope;
    if (props.scope) return props.scope;
    if (props.initialScope) return props.initialScope;
    return "school";
  }, [props.forcedScope, props.scope, props.initialScope]);

  const ownQuery = useWorkspaceQuery({ defaultScope, defaultMonth: currentAcademicMonth });

  return <UnifiedAdaptiveWorkspaceInner {...props} workspaceQuery={ownQuery} />;
}

/**
 * UnifiedAdaptiveWorkspaceControlled — dùng khi caller (e.g. TasksPageClient) là canonical owner
 * của useWorkspaceQuery. Không gọi hook nội bộ → không tạo listener popstate thứ hai.
 */
export function UnifiedAdaptiveWorkspaceControlled(
  props: UnifiedAdaptiveWorkspaceProps & { workspaceQuery: UseWorkspaceQueryReturn }
) {
  return <UnifiedAdaptiveWorkspaceInner {...props} />;
}

export { useTaskFilters } from "@/hooks/use-task-filters";
export { useTaskMutations } from "@/hooks/use-task-mutations";
