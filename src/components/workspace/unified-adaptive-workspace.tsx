"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Inbox, AlertTriangle, Loader2, Layers, X } from "lucide-react";
import type { UnifiedAdaptiveWorkspaceProps, WorkspaceScope, ViewMode } from "./types";
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
  isTaskPastDue,
} from "@/lib/academic-calendar";
import { AdaptiveMetricStrip } from "./components/adaptive-metric-strip";
import { UniversalActionQueue } from "./components/universal-action-queue";
import { ActionQueueShell } from "./action-queue-shell";
import { ActiveFilterBreadcrumb } from "./components/active-filter-breadcrumb";
import { ModularCascadingTaskTable } from "@/components/tasks/table/modular-cascading-task-table";
import { TaskKanbanBoard } from "@/components/tasks/task-kanban-board";
import type { CreateTaskFormData } from "@/components/dashboard/create-task-modal";
import { TaskDetailSideSheet, isSchoolTask } from "@/components/dashboard/task-detail-side-sheet";
import { UnassignedDepartmentState } from "./components/unassigned-department-state";
import { isExecutiveUser, isManagerUser } from "@/components/layout/scope-switcher";
import { Button } from "@/components/ui/button";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import { useAuth, isUserUnassignedDepartment } from "@/lib/auth-context";

const CreateTaskModal = dynamic(
  () => import("@/components/dashboard/create-task-modal").then((mod) => mod.CreateTaskModal),
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
import {
  applyOptimisticStatusChange,
  applyOptimisticCreateTask,
} from "./utils/task-workspace-mutations";
import { cn } from "@/lib/utils";

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
        result = result.filter((t) => isTaskAssignedToUser(t, user));
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
        return isTaskAssignedToUser(t, user);
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

  const effectiveReviewerRole: "ADMIN" | "MANAGER" | "STAFF" = React.useMemo(() => {
    if (forcedRole) return forcedRole;
    if (isExecutiveUser(user)) return "ADMIN";
    if (isManagerUser(user)) return "MANAGER";
    return "STAFF";
  }, [forcedRole, user]);

  const isExecutive = effectiveReviewerRole === "ADMIN" || isExecutiveUser(user);

  // Canonical workspace query state manager
  let workspaceQuery: UseWorkspaceQueryReturn | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    workspaceQuery = useWorkspaceQuery();
  } catch {
    workspaceQuery = null;
  }

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
      let target = newScope;
      if (target === "school" && !isExecutive) {
        target = "my";
      }
      setActiveScope(target);
      onScopeChange?.(target);
      workspaceQuery?.setScope(target, { replace: true });
    },
    [isExecutive, onScopeChange, workspaceQuery]
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
      workspaceQuery?.setView(mode, { replace: true });
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

  const handleSelectTask = React.useCallback(
    (task: SchoolTask | StaffTask) => {
      setInternalSelectedTask(task);
      setIsDetailOpen(true);
      const taskIdOrCode =
        (task as any).code || (task as any).taskCode || task.id;
      workspaceQuery?.setSelectedTask(taskIdOrCode, { replace: true });
      onSelectTask?.(task);
    },
    [onSelectTask, workspaceQuery]
  );

  const handleCloseDetail = React.useCallback(() => {
    setIsDetailOpen(false);
    setInternalSelectedTask(null);
    workspaceQuery?.setSelectedTask(null, { replace: true });
  }, [workspaceQuery]);

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
  const [activeViewId, setActiveViewId] = React.useState<string | null>(null);

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

  // Synchronize state with canonical workspace query if not controlled by props
  React.useEffect(() => {
    if (!workspaceQuery) return;
    const { queryState } = workspaceQuery;

    if (!propScope && !forcedScope && queryState.scope) {
      if (queryState.scope !== "school" || isExecutive) {
        setActiveScope(queryState.scope);
      }
    }
    if (!selectedDepartment && (queryState.unit || queryState.dept)) {
      setInternalDept(queryState.unit || queryState.dept);
    }
    if (!activeStatus && queryState.status && queryState.status !== "ALL") {
      setInternalStatus(queryState.status);
    }
    const qVal = queryState.query || queryState.q;
    if (!searchQuery && qVal) {
      setInternalSearch(qVal);
    }
    if (queryState.month !== undefined) {
      setCurrentMonth(queryState.month);
    }
    if (!initialViewMode && queryState.view && (queryState.view === "table" || queryState.view === "kanban")) {
      setInternalViewMode(queryState.view);
    }
  }, [
    workspaceQuery?.queryState.scope,
    workspaceQuery?.queryState.unit,
    workspaceQuery?.queryState.dept,
    workspaceQuery?.queryState.status,
    workspaceQuery?.queryState.query,
    workspaceQuery?.queryState.q,
    workspaceQuery?.queryState.month,
    workspaceQuery?.queryState.view,
    propScope,
    forcedScope,
    selectedDepartment,
    activeStatus,
    searchQuery,
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
  const scopedTasks = React.useMemo(() => {
    return filterTasksByScope(
      tasks,
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
    setActiveViewId(null);
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
    workspaceQuery?.resetFilters({ replace: true, preserveScope: true });
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

      let actionUrl = `/api/tasks/${taskId}/actions/update-progress`;
      let actionBody: any = { note };

      if (newStatus === "IN_PROGRESS") {
        actionUrl = `/api/tasks/${taskId}/actions/start`;
        actionBody = { note };
      } else if (newStatus === "COMPLETED") {
        actionUrl = `/api/tasks/${taskId}/actions/approve`;
        actionBody = { note: note || "Phê duyệt hoàn thành nhiệm vụ" };
      } else if (newStatus === "CANCELLED") {
        actionUrl = `/api/tasks/${taskId}/actions/cancel`;
        actionBody = { reason: note || "Hủy nhiệm vụ" };
      } else if (newStatus === "NEEDS_REVIEW" || newStatus === "WAITING_APPROVAL") {
        actionUrl = `/api/tasks/${taskId}/actions/submit-result`;
        actionBody = { note: note || "Nộp kết quả chờ phê duyệt", completionRate: 100 };
      }

      try {
        const res = await fetch(actionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(actionBody),
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
            className="text-xs min-h-[44px] sm:min-h-8 sm:h-8 px-3 shrink-0 bg-background hover:bg-muted"
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
            workspaceQuery?.setSearchQuery(q, { replace: true });
          }}
          loading={effectiveIsRefreshing}
          onNewTaskClick={handleCreateTaskClick}
          canCreateTask={true}
          createButtonLabel="+ Giao việc"
          activeTab={effectiveActiveTab}
          onTabChange={(tab) => {
            if (tab === "all") {
              setInternalStatus(undefined);
              setInternalWorkbox("ALL");
              setInternalOverdue(false);
              onStatusFilterChange?.(undefined);
              onWorkboxChange?.("ALL");
              onOverdueFilterChange?.(false);
              workspaceQuery?.setStatus("ALL", { replace: true });
              workspaceQuery?.setAttention(null, { replace: true });
            } else if (tab === "waiting_approval" || tab === "review") {
              setInternalStatus(tab);
              setInternalWorkbox("my_pending_approval");
              setInternalOverdue(false);
              onStatusFilterChange?.(tab);
              onWorkboxChange?.("my_pending_approval");
              onOverdueFilterChange?.(false);
              workspaceQuery?.setAttention("requires_my_approval", { replace: true });
            } else if (tab === "pending_submission") {
              setInternalStatus(tab);
              setInternalWorkbox("my_pending_submission");
              setInternalOverdue(false);
              onStatusFilterChange?.(tab);
              onWorkboxChange?.("my_pending_submission");
              onOverdueFilterChange?.(false);
              workspaceQuery?.setAttention("requires_my_action", { replace: true });
            } else if (tab === "my") {
              // 'Của tôi' is strictly a scope dimension; switch active scope to 'my'
              handleScopeChange("my");
              setInternalStatus(undefined);
              setInternalWorkbox("ALL");
              setInternalOverdue(false);
              onStatusFilterChange?.(undefined);
              onWorkboxChange?.("ALL");
              onOverdueFilterChange?.(false);
              workspaceQuery?.setStatus("ALL", { replace: true });
              workspaceQuery?.setAttention(null, { replace: true });
            } else if (tab === "overdue") {
              setInternalStatus(tab);
              setInternalWorkbox("overdue");
              setInternalOverdue(true);
              onStatusFilterChange?.(tab);
              onWorkboxChange?.("overdue");
              onOverdueFilterChange?.(true);
              workspaceQuery?.setAttention("overdue", { replace: true });
            } else {
              setInternalStatus(tab);
              onStatusFilterChange?.(tab);
              workspaceQuery?.setStatus((tab as any) || "ALL", { replace: true });
            }
          }}
          tabCounts={tabCounts}
          selectedDepartment={currentDept || "ALL"}
          onDepartmentChange={(dept) => {
            setInternalDept(dept);
            onDepartmentChange?.(dept);
            workspaceQuery?.setDept(dept, { replace: true });
          }}
          selectedCategory={currentCategory}
          onCategoryChange={setCurrentCategory}
          selectedPriority={currentPriority}
          onPriorityChange={setCurrentPriority}
          selectedAcademicMonth={currentMonth}
          onAcademicMonthChange={(m) => {
            setCurrentMonth(m);
            workspaceQuery?.setPeriod({ month: m !== "ALL" ? m : undefined }, { replace: true });
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
              totalCount={actionQueue.pendingApprovals.length + actionQueue.myPendingSubmissions.length}
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
              <ActionQueueShell
                title="Hàng đợi hành động"
                totalCount={actionQueue.pendingApprovals.length + actionQueue.myPendingSubmissions.length}
                collapsible={false}
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
                />
              </ActionQueueShell>
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

export { useTaskFilters } from "@/hooks/use-task-filters";
export { useTaskMutations } from "@/hooks/use-task-mutations";
