"use client";

import * as React from "react";
import { Inbox, AlertTriangle, Loader2, Layers, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { UnifiedAdaptiveWorkspaceProps, WorkspaceScope, ViewMode } from "./types";
import {
  useAdaptiveWorkspaceData,
  countScopeTasks,
} from "./hooks/use-adaptive-workspace-data";
import { AdaptiveScopeHeader } from "./components/adaptive-scope-header";
import { UnifiedTaskToolbar, type TableDensity } from "@/components/tasks/unified-task-toolbar";
import { parseTaskUrlParams, syncTaskUrlParams } from "@/hooks/use-task-filters";
import { matchesUser } from "@/lib/role-task-filter";
import {
  filterTasksByAcademicMonthStrict,
  getSystemReferenceDate,
  isTaskPastDue,
} from "@/lib/academic-calendar";
import { AdaptiveMetricStrip } from "./components/adaptive-metric-strip";
import { UniversalActionQueue } from "./components/universal-action-queue";
import { ActiveFilterBreadcrumb } from "./components/active-filter-breadcrumb";
import { ModularCascadingTaskTable } from "@/components/tasks/table/modular-cascading-task-table";
import { TaskKanbanBoard } from "@/components/tasks/task-kanban-board";
import { CreateTaskModal, type CreateTaskFormData } from "@/components/dashboard/create-task-modal";
import { TaskDetailSideSheet, isSchoolTask } from "@/components/dashboard/task-detail-side-sheet";
import { UnassignedDepartmentState } from "./components/unassigned-department-state";
import { isExecutiveUser, isManagerUser } from "@/components/layout/scope-switcher";
import { ReviewActionDialog } from "@/components/portal/review-action-dialog";
import { SubmitDeliverableModal } from "@/components/portal/submit-deliverable-modal";
import { Button } from "@/components/ui/button";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import { useAuth, isUserUnassignedDepartment } from "@/lib/auth-context";
import {
  applyOptimisticStatusChange,
  applyOptimisticCreateTask,
} from "./utils/task-workspace-mutations";
import { cn } from "@/lib/utils";

export { type WorkspaceScope, type ViewMode, matchesUser };

/**
 * Helper to check waiting approval status across parent and subtasks
 */
export function isTaskWaitingApproval(status?: TaskStatus | string | null): boolean {
  if (!status) return false;
  return (
    status === "WAITING_APPROVAL" ||
    (status as string) === "PENDING_EXECUTIVE_APPROVAL" ||
    (status as string) === "NEEDS_REVIEW" ||
    (status as string) === "PENDING" ||
    (status as string) === "IN_REVIEW"
  );
}

/**
 * Checks whether a task is active (IN_PROGRESS, TODO, NOT_STARTED)
 */
export function isActiveTaskStatus(status?: TaskStatus | string | null): boolean {
  if (!status) return false;
  return status === "IN_PROGRESS" || status === "TODO" || status === "NOT_STARTED";
}

/**
 * Checks whether a task or its subtasks is overdue relative to canonical system reference date.
 * Excludes completed parent tasks. Accounts for uncompleted subtasks being overdue if parent is not completed.
 */
export function isTaskOverdueOrHasOverdueSubtask(
  t: SchoolTask,
  refDate: string = getSystemReferenceDate()
): boolean {
  if (t.status === "COMPLETED") return false;
  const parentOverdue = Boolean(t.dueDate && isTaskPastDue(t.dueDate, refDate));
  const subtaskOverdue = Boolean(
    t.subTasks?.some(
      (st) => st.status !== "COMPLETED" && Boolean(st.dueDate && isTaskPastDue(st.dueDate, refDate))
    )
  );
  return parentOverdue || subtaskOverdue;
}

/**
 * Helper to check if a task or any of its subtasks is assigned to user or user's unit.
 */
export function isTaskAssignedToUserOrUnit(
  t: SchoolTask,
  user?: AuthUser | null
): boolean {
  if (!user) return true;
  const userDept = user.departmentCode || user.department || "";
  const matchUser = Boolean(
    t.assignedTo === user.name ||
    (t as any).assignedToId === user.id ||
    t.leadAssigneeName === user.name ||
    (t as any).leadAssigneeId === user.id ||
    matchesUser(t.leadAssigneeName, user) ||
    matchesUser(t.assignedTo, user) ||
    t.subTasks?.some(
      (st) =>
        st.assignedTo === user.name ||
        (st as any).assignedToId === user.id ||
        st.assigneeName === user.name ||
        st.assigneeId === user.id ||
        matchesUser(st.assignedTo, user) ||
        matchesUser(st.assigneeName, user)
    )
  );
  const matchUnit = Boolean(
    userDept &&
      (t.departmentCode?.toUpperCase() === userDept.toUpperCase() ||
        t.department?.toLowerCase() === userDept.toLowerCase() ||
        t.leadDepartmentCode?.toUpperCase() === userDept.toUpperCase() ||
        t.leadDepartment?.toLowerCase() === userDept.toLowerCase() ||
        t.subTasks?.some(
          (st) =>
            st.departmentCode?.toUpperCase() === userDept.toUpperCase() ||
            st.department?.toLowerCase() === userDept.toLowerCase()
        ))
  );
  return matchUser || matchUnit;
}

/**
 * Options for filtering displayed tasks in UnifiedAdaptiveWorkspace
 */
export interface FilterDisplayedTasksOptions {
  tasks: SchoolTask[];
  search?: string;
  status?: string;
  category?: string;
  priority?: string;
  academicMonth?: number | "ALL";
  overdue?: boolean;
  workbox?: string;
  user?: AuthUser | null;
}

/**
 * Pure canonical filtering engine for tasks displayed in the unified workspace.
 */
export function filterDisplayedTasks({
  tasks,
  search,
  status,
  category,
  priority,
  academicMonth,
  overdue,
  workbox,
  user,
}: FilterDisplayedTasksOptions): SchoolTask[] {
  let result = tasks;

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

  // 2. Status / Smart Filter Pills
  if (status && status !== "ALL" && status !== "all") {
    const refDate = getSystemReferenceDate();
    if (status === "my" || status === "my_tasks") {
      if (user) {
        result = result.filter(
          (t) =>
            t.leadAssigneeName === user.name ||
            matchesUser(t.leadAssigneeName, user) ||
            t.assignedTo === user.name ||
            matchesUser(t.assignedTo, user) ||
            t.subTasks?.some(
              (s) =>
                s.assigneeName === user.name ||
                matchesUser(s.assigneeName, user) ||
                (s as any).assignedTo === user.name ||
                matchesUser((s as any).assignedTo, user)
            )
        );
      }
    } else if (status === "waiting_approval" || status === "review") {
      result = result.filter(
        (t) =>
          isTaskWaitingApproval(t.status) ||
          Boolean(t.subTasks?.some((s) => isTaskWaitingApproval(s.status)))
      );
    } else if (status === "overdue") {
      result = result.filter((t) => isTaskOverdueOrHasOverdueSubtask(t, refDate));
    } else if (status === "today") {
      result = result.filter((t) => Boolean(t.dueDate && t.dueDate.startsWith(refDate)));
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
      result = result.filter((t) => t.status === status);
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
        return Boolean(
          t.assignedTo === user.name ||
          (t as any).assignedToId === user.id ||
          t.leadAssigneeName === user.name ||
          (t as any).leadAssigneeId === user.id ||
          matchesUser(t.leadAssigneeName, user) ||
          matchesUser(t.assignedTo, user) ||
          t.subTasks?.some(
            (st) =>
              st.assignedTo === user.name ||
              (st as any).assignedToId === user.id ||
              st.assigneeName === user.name ||
              st.assigneeId === user.id ||
              matchesUser(st.assignedTo, user) ||
              matchesUser(st.assigneeName, user)
          )
        );
      });
    } else if (wb === "overdue" || wb === "urgent_overdue") {
      result = result.filter((t) => isTaskOverdueOrHasOverdueSubtask(t));
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
  if (academicMonth && academicMonth !== "ALL") {
    result = filterTasksByAcademicMonthStrict(result, Number(academicMonth), "2026-2027");
  }

  // 7. Overdue flag
  if (overdue) {
    result = result.filter((t) => isTaskOverdueOrHasOverdueSubtask(t));
  }

  return result;
}

export function UnifiedAdaptiveWorkspace({
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
}: UnifiedAdaptiveWorkspaceProps) {
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
    if (initialTasks && initialTasks.length > 0) return;

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
      role === "TRUONG_KHOA"
    ) {
      return "unit";
    }
    return "my";
  }, [forcedScope, propScope, initialScope, forcedRole, user]);

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

  const handleScopeChange = React.useCallback(
    (newScope: WorkspaceScope) => {
      setActiveScope(newScope);
      onScopeChange?.(newScope);
    },
    [onScopeChange]
  );

  // View mode management (Table vs Kanban)
  const [internalViewMode, setInternalViewMode] = React.useState<ViewMode>(
    initialViewMode || controlledViewMode || "table"
  );

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
    },
    [onViewModeChange]
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

  let router: ReturnType<typeof useRouter> | null = null;
  try {
    router = useRouter();
  } catch {
    router = null;
  }

  const handleSelectTask = React.useCallback(
    (task: SchoolTask | StaffTask) => {
      setInternalSelectedTask(task);
      setIsDetailOpen(true);
      onSelectTask?.(task);
    },
    [onSelectTask]
  );

  const handleCloseDetail = React.useCallback(() => {
    setIsDetailOpen(false);
    setInternalSelectedTask(null);
  }, []);

  const effectiveReviewerRole: "ADMIN" | "MANAGER" | "STAFF" = React.useMemo(() => {
    if (forcedRole) return forcedRole;
    if (isExecutiveUser(user)) return "ADMIN";
    if (isManagerUser(user)) return "MANAGER";
    return "STAFF";
  }, [forcedRole, user]);

  const isExecutive = effectiveReviewerRole === "ADMIN" || isExecutiveUser(user);

  // Filter state synchronized with props
  const [internalDept, setInternalDept] = React.useState<string | undefined>(selectedDepartment);
  const [internalStatus, setInternalStatus] = React.useState<string | undefined>(activeStatus);
  const [internalSearch, setInternalSearch] = React.useState<string | undefined>(searchQuery);
  const [internalOverdue, setInternalOverdue] = React.useState<boolean>(Boolean(isOverdueOnly));
  const [internalWorkbox, setInternalWorkbox] = React.useState<string | undefined>(activeWorkbox);
  const [currentCategory, setCurrentCategory] = React.useState<string>("ALL");
  const [currentPriority, setCurrentPriority] = React.useState<string>("ALL");
  const [currentMonth, setCurrentMonth] = React.useState<number | "ALL">("ALL");
  const [tableDensity, setTableDensity] = React.useState<TableDensity>("comfortable");

  React.useEffect(() => {
    setInternalDept(selectedDepartment);
  }, [selectedDepartment]);

  React.useEffect(() => {
    setInternalStatus(activeStatus);
  }, [activeStatus]);

  React.useEffect(() => {
    setInternalSearch(searchQuery);
  }, [searchQuery]);

  React.useEffect(() => {
    setInternalOverdue(Boolean(isOverdueOnly));
  }, [isOverdueOnly]);

  React.useEffect(() => {
    setInternalWorkbox(activeWorkbox);
  }, [activeWorkbox]);

  const currentDept = internalDept ?? selectedDepartment;
  const currentStatus = internalStatus ?? activeStatus;
  const currentSearch = internalSearch ?? searchQuery;
  const currentOverdue = internalOverdue || Boolean(isOverdueOnly);
  const currentWorkbox = internalWorkbox ?? activeWorkbox;

  // URL Synchronization: Read initial URL parameters on mount
  const [hasInitializedUrl, setHasInitializedUrl] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || hasInitializedUrl) return;
    try {
      const urlParams = parseTaskUrlParams(window.location.search);
      if (
        urlParams.scope &&
        (urlParams.scope === "school" ||
          urlParams.scope === "unit" ||
          urlParams.scope === "my")
      ) {
        if (urlParams.scope === "school" && !isExecutive) {
          // unpermitted
        } else {
          setActiveScope(urlParams.scope);
          onScopeChange?.(urlParams.scope);
        }
      }
      if (urlParams.dept) {
        setInternalDept(urlParams.dept);
        onDepartmentChange?.(urlParams.dept);
      }
      if (urlParams.status) {
        setInternalStatus(urlParams.status);
        onStatusFilterChange?.(urlParams.status);
      }
      if (urlParams.workbox) {
        setInternalWorkbox(urlParams.workbox);
        onWorkboxChange?.(urlParams.workbox);
      }
      if (urlParams.month !== undefined) {
        setCurrentMonth(urlParams.month);
      }
      if (urlParams.q !== undefined) {
        setInternalSearch(urlParams.q);
        onSearchChange?.(urlParams.q);
      }
      if (
        urlParams.view &&
        (urlParams.view === "table" || urlParams.view === "kanban")
      ) {
        setInternalViewMode(urlParams.view);
        onViewModeChange?.(urlParams.view);
      }
      if (urlParams.taskId && tasks.length > 0) {
        const isMatch = (t: SchoolTask | StaffTask) =>
          t.id === urlParams.taskId ||
          (t as any).code === urlParams.taskId ||
          (t as any).taskCode === urlParams.taskId;

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
      setHasInitializedUrl(true);
    } catch {
      setHasInitializedUrl(true);
    }
  }, [
    hasInitializedUrl,
    tasks,
    isExecutive,
    onScopeChange,
    onDepartmentChange,
    onStatusFilterChange,
    onSearchChange,
    onViewModeChange,
    onSelectTask,
  ]);

  // Handle browser back/forward navigation for URL selection
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopState = () => {
      try {
        const urlParams = parseTaskUrlParams(window.location.search);
        if (urlParams.taskId) {
          const isMatch = (t: SchoolTask | StaffTask) =>
            t.id === urlParams.taskId ||
            (t as any).code === urlParams.taskId ||
            (t as any).taskCode === urlParams.taskId;

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
  }, [tasks]);

  // Synchronize when propSelectedTaskId changes externally
  React.useEffect(() => {
    if (propSelectedTaskId) {
      const isMatch = (t: SchoolTask | StaffTask) =>
        t.id === propSelectedTaskId ||
        (t as any).code === propSelectedTaskId ||
        (t as any).taskCode === propSelectedTaskId;

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
    }
  }, [propSelectedTaskId, tasks]);

  // Sync state changes to URL query parameters
  React.useEffect(() => {
    if (!hasInitializedUrl) return;
    syncTaskUrlParams(
      {
        scope: activeScope,
        dept: currentDept,
        status: currentStatus,
        month: currentMonth,
        q: currentSearch,
        view: viewMode,
        taskId:
          isDetailOpen && internalSelectedTask
            ? (internalSelectedTask as any).code ||
              (internalSelectedTask as any).taskCode ||
              internalSelectedTask.id
            : null,
      },
      router ?? undefined
    );
  }, [
    hasInitializedUrl,
    activeScope,
    currentDept,
    currentStatus,
    currentMonth,
    currentSearch,
    viewMode,
    isDetailOpen,
    internalSelectedTask?.id,
    (internalSelectedTask as any)?.code,
    (internalSelectedTask as any)?.taskCode,
    router,
  ]);

  const { scopedTasks, metrics, actionQueue } = useAdaptiveWorkspaceData(
    tasks,
    user,
    activeScope,
    currentDept
  );

  // Compute counts for smart filter pills (Tất cả, Của tôi, Chờ duyệt, Quá hạn, Hôm nay)
  const tabCounts = React.useMemo(() => {
    const refDate = getSystemReferenceDate();
    let myCount = 0;
    let waitingApprovalCount = 0;
    let overdueCount = 0;
    let todayCount = 0;

    for (const t of scopedTasks) {
      if (
        user &&
        (t.leadAssigneeName === user.name ||
          matchesUser(t.leadAssigneeName, user) ||
          t.assignedTo === user.name ||
          matchesUser(t.assignedTo, user) ||
          t.subTasks?.some(
            (s) =>
              s.assigneeName === user.name ||
              matchesUser(s.assigneeName, user) ||
              (s as any).assignedTo === user.name ||
              matchesUser((s as any).assignedTo, user)
          ))
      ) {
        myCount++;
      }
      if (
        isTaskWaitingApproval(t.status) ||
        t.subTasks?.some((s) => isTaskWaitingApproval(s.status))
      ) {
        waitingApprovalCount++;
      }
      if (isTaskOverdueOrHasOverdueSubtask(t, refDate)) {
        overdueCount++;
      }
      if (t.dueDate && t.dueDate.startsWith(refDate)) {
        todayCount++;
      }
    }

    const pendingSubmissionsCount = actionQueue.myPendingSubmissions.length;
    const effectiveWaitingApprovalCount =
      actionQueue.pendingApprovals.length > 0
        ? actionQueue.pendingApprovals.length
        : waitingApprovalCount;

    return {
      all: scopedTasks.length,
      my: myCount,
      waiting_approval: effectiveWaitingApprovalCount,
      pending_submission: pendingSubmissionsCount,
      overdue: overdueCount,
      today: todayCount,
    };
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
    if (currentWorkbox === "my_tasks" || currentWorkbox === "my") {
      return "my";
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
    (filterType: "approvals" | "submissions" | "overdue" | "all") => {
      setIsActionQueueOpen(false);
      if (filterType === "approvals") {
        setInternalStatus("waiting_approval");
        setInternalWorkbox("my_pending_approval");
        setInternalOverdue(false);
        onStatusFilterChange?.("waiting_approval");
        onWorkboxChange?.("my_pending_approval");
        onOverdueFilterChange?.(false);
      } else if (filterType === "submissions") {
        setInternalStatus("pending_submission");
        setInternalWorkbox("my_pending_submission");
        setInternalOverdue(false);
        onStatusFilterChange?.("pending_submission");
        onWorkboxChange?.("my_pending_submission");
        onOverdueFilterChange?.(false);
      } else if (filterType === "overdue") {
        setInternalStatus("overdue");
        setInternalWorkbox("overdue");
        setInternalOverdue(true);
        onStatusFilterChange?.("overdue");
        onWorkboxChange?.("overdue");
        onOverdueFilterChange?.(true);
      } else {
        setInternalStatus(undefined);
        setInternalWorkbox("ALL");
        setInternalOverdue(false);
        onStatusFilterChange?.(undefined);
        onWorkboxChange?.("ALL");
        onOverdueFilterChange?.(false);
      }
    },
    [onStatusFilterChange, onWorkboxChange, onOverdueFilterChange]
  );

  // Filter tasks based on search, smart status, workbox, category, priority, month, and overdue criteria
  const displayedTasks = React.useMemo(() => {
    return filterDisplayedTasks({
      tasks: scopedTasks,
      search: currentSearch,
      status: currentStatus,
      workbox: currentWorkbox,
      category: currentCategory,
      priority: currentPriority,
      academicMonth: currentMonth,
      overdue: currentOverdue,
      user,
    });
  }, [
    scopedTasks,
    currentSearch,
    currentStatus,
    currentWorkbox,
    currentCategory,
    currentPriority,
    currentMonth,
    currentOverdue,
    user,
  ]);

  const handleResetFilters = React.useCallback(() => {
    setInternalDept(undefined);
    setInternalStatus(undefined);
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
  }, [
    onResetFilters,
    onDepartmentChange,
    onStatusFilterChange,
    onSearchChange,
    onOverdueFilterChange,
    onWorkboxChange,
    onAction,
  ]);

  const handleRemoveDept = React.useCallback(() => {
    setInternalDept(undefined);
    if (onDepartmentChange) onDepartmentChange("ALL");
  }, [onDepartmentChange]);

  const handleRemoveStatus = React.useCallback(() => {
    setInternalStatus(undefined);
    if (onStatusFilterChange) onStatusFilterChange(undefined);
  }, [onStatusFilterChange]);

  const handleRemoveSearch = React.useCallback(() => {
    setInternalSearch(undefined);
    if (onSearchChange) onSearchChange("");
  }, [onSearchChange]);

  const handleRemoveOverdue = React.useCallback(() => {
    setInternalOverdue(false);
    if (onOverdueFilterChange) onOverdueFilterChange(false);
  }, [onOverdueFilterChange]);

  const handleRemoveWorkbox = React.useCallback(() => {
    setInternalWorkbox("ALL");
    if (onWorkboxChange) onWorkboxChange("ALL");
  }, [onWorkboxChange]);

  const isStaff =
    !isExecutiveUser(user) &&
    !isManagerUser(user) &&
    forcedRole !== "ADMIN" &&
    forcedRole !== "MANAGER" &&
    forcedScope !== "school" &&
    forcedScope !== "unit";

  // Compute scope badge counts for AdaptiveScopeHeader tabs
  const badgeCounts = React.useMemo<Partial<Record<WorkspaceScope, number>>>(() => {
    return {
      school: tasks.length,
      unit: countScopeTasks(tasks, user, "unit", selectedDepartment),
      my: countScopeTasks(tasks, user, "my", selectedDepartment),
    };
  }, [tasks, user, selectedDepartment]);

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

  const handleCreateTaskSubmit = React.useCallback(
    async (formData: CreateTaskFormData) => {
      const previousData = internalTasks;
      const todayStr = getSystemReferenceDate();
      setInternalTasks((prev) => applyOptimisticCreateTask(prev, formData, todayStr));
      setIsCreateModalOpen(false);

      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          throw new Error("Lỗi tạo nhiệm vụ");
        }
      } catch (err) {
        setInternalTasks(previousData);
      }
    },
    [internalTasks]
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

      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus, note }),
        });
        if (!res.ok) {
          throw new Error("Lỗi cập nhật trạng thái");
        }
      } catch (err) {
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

  // Refresh handler
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
            className="text-xs h-8 px-3 shrink-0 bg-background hover:bg-muted"
          >
            Thử lại
          </Button>
        </aside>
      )}

      {/* 1. Unified Task Toolbar: Single Unified Surface (Scope, Search, Smart Pills, Popover, View, Density) */}
      {!hideScopeSwitcher && (
        <UnifiedTaskToolbar
          scope={activeScope}
          onScopeChange={handleScopeChange}
          user={user}
          userRole={effectiveReviewerRole}
          isExecutive={isExecutive}
          badgeCounts={badgeCounts}
          isUnassignedDepartment={isUnassigned}
          searchQuery={currentSearch || ""}
          onSearchChange={(q) => {
            setInternalSearch(q);
            onSearchChange?.(q);
          }}
          loading={effectiveIsRefreshing}
          onNewTaskClick={handleCreateTaskClick}
          canCreateTask={true}
          activeTab={effectiveActiveTab}
          onTabChange={(tab) => {
            if (tab === "all") {
              setInternalStatus(undefined);
              setInternalWorkbox("ALL");
              setInternalOverdue(false);
              onStatusFilterChange?.(undefined);
              onWorkboxChange?.("ALL");
              onOverdueFilterChange?.(false);
            } else if (tab === "waiting_approval" || tab === "review") {
              setInternalStatus(tab);
              setInternalWorkbox("my_pending_approval");
              setInternalOverdue(false);
              onStatusFilterChange?.(tab);
              onWorkboxChange?.("my_pending_approval");
              onOverdueFilterChange?.(false);
            } else if (tab === "pending_submission") {
              setInternalStatus(tab);
              setInternalWorkbox("my_pending_submission");
              setInternalOverdue(false);
              onStatusFilterChange?.(tab);
              onWorkboxChange?.("my_pending_submission");
              onOverdueFilterChange?.(false);
            } else if (tab === "my") {
              setInternalStatus(tab);
              setInternalWorkbox("my_tasks");
              setInternalOverdue(false);
              onStatusFilterChange?.(tab);
              onWorkboxChange?.("my_tasks");
              onOverdueFilterChange?.(false);
            } else if (tab === "overdue") {
              setInternalStatus(tab);
              setInternalWorkbox("overdue");
              setInternalOverdue(true);
              onStatusFilterChange?.(tab);
              onWorkboxChange?.("overdue");
              onOverdueFilterChange?.(true);
            } else {
              setInternalStatus(tab);
              onStatusFilterChange?.(tab);
            }
          }}
          tabCounts={tabCounts}
          selectedDepartment={currentDept || "ALL"}
          onDepartmentChange={(dept) => {
            setInternalDept(dept);
            onDepartmentChange?.(dept);
          }}
          selectedCategory={currentCategory}
          onCategoryChange={setCurrentCategory}
          selectedPriority={currentPriority}
          onPriorityChange={setCurrentPriority}
          selectedAcademicMonth={currentMonth}
          onAcademicMonthChange={setCurrentMonth}
          onResetFilters={handleResetFilters}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          density={tableDensity}
          onDensityChange={setTableDensity}
          onRefresh={handleRefresh}
          isRefreshing={effectiveIsRefreshing}
          totalTasksCount={tasks.length}
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
            {/* Active Filter Breadcrumb */}
            <ActiveFilterBreadcrumb
              department={currentDept}
              status={currentStatus}
              search={currentSearch}
              overdue={currentOverdue}
              workbox={currentWorkbox}
              totalFilteredCount={displayedTasks.length}
              totalCount={tasks.length}
              onResetFilters={handleResetFilters}
              onRemoveDepartment={handleRemoveDept}
              onRemoveStatus={handleRemoveStatus}
              onRemoveSearch={handleRemoveSearch}
              onRemoveOverdue={handleRemoveOverdue}
              onRemoveWorkbox={handleRemoveWorkbox}
            />

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
                    className="text-xs h-8 px-3 cursor-pointer"
                  >
                    Tạo nhiệm vụ mới
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={effectiveIsRefreshing}
                    className="text-xs h-8 px-3 cursor-pointer"
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
          </div>
        </div>
      ) : (
        <div
          data-slot="task-workspace-canvas"
          className="w-full space-y-3 min-w-0"
        >
          <div
            data-slot="full-width-task-canvas"
            className="w-full space-y-3 min-w-0"
          >
          {/* Active Filter Breadcrumb & Action Queue Quick Trigger */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex-1 min-w-0">
              <ActiveFilterBreadcrumb
                department={currentDept}
                status={currentStatus}
                search={currentSearch}
                overdue={currentOverdue}
                workbox={currentWorkbox}
                totalFilteredCount={displayedTasks.length}
                totalCount={tasks.length}
                onResetFilters={handleResetFilters}
                onRemoveDepartment={handleRemoveDept}
                onRemoveStatus={handleRemoveStatus}
                onRemoveSearch={handleRemoveSearch}
                onRemoveOverdue={handleRemoveOverdue}
                onRemoveWorkbox={handleRemoveWorkbox}
              />
            </div>

            {(actionQueue.pendingApprovals.length > 0 || actionQueue.myPendingSubmissions.length > 0) && (
              <button
                type="button"
                data-slot="action-queue-trigger"
                onClick={() => setIsActionQueueOpen(true)}
                className="inline-flex min-h-[44px] sm:min-h-8 sm:h-8 items-center gap-2 px-3 py-1.5 rounded-xl border border-primary/25 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold cursor-pointer transition-colors shrink-0 self-start sm:self-auto"
                aria-label="Mở hàng đợi xử lý công việc"
                title="Mở Hộp việc khẩn cấp (Smart Workbox)"
              >
                <Layers className="size-3.5" strokeWidth={1.5} />
                <span>Hộp việc xử lý</span>
                <span className="font-mono text-xs px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground tabular-nums leading-none">
                  {actionQueue.pendingApprovals.length + actionQueue.myPendingSubmissions.length}
                </span>
              </button>
            )}
          </div>

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
                  className="text-xs h-8 px-3 cursor-pointer"
                >
                  Tạo nhiệm vụ mới
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={effectiveIsRefreshing}
                  className="text-xs h-8 px-3 cursor-pointer"
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
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 bg-card/90">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-primary" strokeWidth={1.5} />
                <h3 className="text-sm font-bold text-foreground">
                  Hộp việc khẩn cấp (Smart Workbox)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsActionQueueOpen(false)}
                className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
                aria-label="Đóng hàng đợi"
              >
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4 thin-scrollbar">
              <AdaptiveMetricStrip metrics={metrics} scope={activeScope} />
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
          </aside>
        </>
      )}

      {/* 3. Detail Side Sheet (shown when task selected) */}
      {!disableInternalDetail && (
        <TaskDetailSideSheet
          task={internalSelectedTask}
          isOpen={Boolean(isDetailOpen && internalSelectedTask)}
          onClose={handleCloseDetail}
          onStatusChange={handleStatusChange}
          onAddSubTask={(parentId) => {
            openCreateModal("DON_VI", parentId);
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
          parentSchoolTaskTitle={
            internalSelectedTask && !isSchoolTask(internalSelectedTask)
              ? (internalSelectedTask as StaffTask).parentSchoolTaskTitle ||
                displayedTasks.find((t) =>
                  t.subTasks?.some((s) => s.id === internalSelectedTask.id)
                )?.title
              : undefined
          }
          currentUser={user}
        />
      )}

      {/* 4. Task Creation Modal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateTaskSubmit}
        schoolTasks={displayedTasks}
        initialLevel={createInitialLevel}
        initialParentTaskId={createInitialParentId}
        initialParentTaskTitle={
          createInitialParentId
            ? displayedTasks.find((t) => t.id === createInitialParentId)?.title
            : undefined
        }
        initialParentTaskDueDate={
          createInitialParentId
            ? displayedTasks.find((t) => t.id === createInitialParentId)?.dueDate
            : undefined
        }
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
