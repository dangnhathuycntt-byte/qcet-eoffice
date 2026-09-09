"use client";

import * as React from "react";
import type {
  SchoolTask,
  StaffTask,
  DashboardPayload,
  TaskCategory,
  TaskStatus,
} from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import {
  computeSchoolTaskRollup,
  computeDashboardStats,
} from "@/lib/dashboard-aggregator";
import {
  CATEGORY_TABS,
  type CategoryTab,
} from "@/components/dashboard/cascading-task-table";
import { ModularCascadingTaskTable } from "@/components/tasks/table/modular-cascading-task-table";
import {
  TaskKanbanBoard,
  type TaskLevelFilter,
} from "@/components/tasks/task-kanban-board";
import {
  CreateTaskModal,
  type CreateTaskFormData,
  type TaskLevel,
} from "@/components/dashboard/create-task-modal";
import {
  TaskDetailSideSheet,
  isSchoolTask,
} from "@/components/dashboard/task-detail-side-sheet";
import { cn } from "@/lib/utils";
import { useAuth, isUserUnassignedDepartment } from "@/lib/auth-context";
import { matchesUser } from "@/lib/role-task-filter";
import { filterTasksByRole } from "@/lib/role-task-filter";
import { getDepartmentForMember } from "@/lib/departments";
import { UnassignedDepartmentState } from "@/components/workspace/components/unassigned-department-state";
import {
  LayoutGrid,
  List,
  Plus,
  Search,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
  Building2,
  Calendar,
  School,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type WorkspaceScope = "school" | "unit" | "my";
export type ViewMode = "table" | "kanban";

export interface TaskManagementWorkspaceProps {
  scope?: WorkspaceScope;
  onScopeChange?: (scope: WorkspaceScope) => void;
  className?: string;
  initialViewMode?: ViewMode;
  initialTasks?: SchoolTask[];
}

/**
 * Pure helper function to filter tasks according to workspace scope
 */
export function filterTasksByScope(
  tasks: SchoolTask[],
  scope: WorkspaceScope = "school",
  user?: AuthUser | null
): SchoolTask[] {
  if (scope === "school") {
    return tasks;
  }

  if (scope === "my") {
    if (!user) return [];

    return tasks
      .map((task) => {
        const isLead = matchesUser(task.leadAssigneeName, user);
        const isCoAssignee = Boolean(
          task.coAssignees && task.coAssignees.some((name) => matchesUser(name, user))
        );
        const matchingSubtasks = (task.subTasks || []).filter((sub) =>
          matchesUser(sub.assigneeName, user)
        );

        // If user is DRI (lead), retain full task with all subtasks for coordination
        if (isLead) {
          return { ...task };
        }

        // If user is co-assignee without personal subtasks, show task with subtasks
        if (isCoAssignee && matchingSubtasks.length === 0) {
          return { ...task };
        }

        // If user has specific assigned subtasks, filter to their subtasks
        if (matchingSubtasks.length > 0) {
          return {
            ...task,
            subTasks: matchingSubtasks,
          };
        }

        return null;
      })
      .filter((t): t is SchoolTask => t !== null);
  }

  const userDeptCode = user?.departmentCode;
  const userDeptName = user?.department;

  if (!userDeptCode && !userDeptName) {
    return tasks;
  }

  return tasks
    .map((task) => {
      const matchesMainDept =
        (userDeptCode &&
          (task.departmentCode === userDeptCode ||
            task.leadDepartmentCode === userDeptCode ||
            task.coDepartmentCodes?.includes(userDeptCode))) ||
        (userDeptName &&
          (task.department === userDeptName ||
            task.leadDepartment === userDeptName));

      const matchingSubtasks = (task.subTasks || []).filter((sub) => {
        return (
          (userDeptCode && sub.departmentCode === userDeptCode) ||
          (userDeptName && sub.department === userDeptName) ||
          (user?.name &&
            sub.assigneeName?.toLowerCase().includes(user.name.toLowerCase()))
        );
      });

      if (matchesMainDept) {
        return {
          ...task,
          subTasks: matchingSubtasks.length > 0 ? matchingSubtasks : task.subTasks,
        };
      }

      if (matchingSubtasks.length > 0) {
        return {
          ...task,
          subTasks: matchingSubtasks,
        };
      }

      return null;
    })
    .filter((t): t is SchoolTask => t !== null);
}

/**
 * Pure helper function to apply optimistic status changes and recalculate rollups
 */
export function applyOptimisticStatusChange(
  tasks: SchoolTask[],
  taskId: string,
  newStatus: TaskStatus
): SchoolTask[] {
  const updatedTasks = tasks.map((st) => {
    if (st.id === taskId) {
      const schoolStatus: "IN_PROGRESS" | "COMPLETED" =
        newStatus === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";
      return { ...st, status: schoolStatus };
    }
    const updatedSubs = (st.subTasks || []).map((sub) =>
      sub.id === taskId ? { ...sub, status: newStatus } : sub
    );
    return { ...st, subTasks: updatedSubs };
  });

  return updatedTasks.map((t) => computeSchoolTaskRollup(t));
}

/**
 * Pure helper function to apply optimistic task creation
 */
export function applyOptimisticCreateTask(
  tasks: SchoolTask[],
  data: CreateTaskFormData,
  todayStr: string = new Date().toISOString().split("T")[0]
): SchoolTask[] {
  let updatedTasks = [...tasks];

  if (data.level === "TRUONG") {
    const newTask: SchoolTask = {
      id: `task-temp-${Date.now()}`,
      title: data.title,
      category: data.category,
      categoryLabel:
        CATEGORY_TABS.find((c) => c.id === data.category)?.label || data.category,
      leadAssigneeName: data.leadAssigneeName,
      coAssignees: data.coAssignees || [],
      assignedDate: todayStr,
      dueDate: data.dueDate,
      status: "IN_PROGRESS",
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 0,
    };
    updatedTasks = [newTask, ...updatedTasks];
  } else {
    const newSubTask: StaffTask = {
      id: `sub-temp-${Date.now()}`,
      title: data.title,
      assigneeName: data.leadAssigneeName,
      status: "NEW",
      dueDate: data.dueDate,
      internalDueDate: data.internalDueDate,
      deliverableDescription: data.requiredDeliverables,
      vtvlRole: data.vtvlRole,
      requiresReview: data.requiresReview,
      parentSchoolTaskId: data.parentTaskId || updatedTasks[0]?.id || "task-1",
      updatedAt: todayStr,
    };

    if (data.parentTaskId) {
      updatedTasks = updatedTasks.map((st) => {
        if (st.id === data.parentTaskId) {
          return {
            ...st,
            subTasks: [newSubTask, ...(st.subTasks || [])],
          };
        }
        return st;
      });
    } else if (updatedTasks.length > 0) {
      updatedTasks[0] = {
        ...updatedTasks[0],
        subTasks: [newSubTask, ...(updatedTasks[0].subTasks || [])],
      };
    }
  }

  return updatedTasks.map((t) => computeSchoolTaskRollup(t));
}

export function TaskManagementWorkspace({
  scope = "school",
  onScopeChange,
  className,
  initialViewMode = "kanban",
  initialTasks,
}: TaskManagementWorkspaceProps) {
  const { user, setIsProfileModalOpen } = useAuth();
  const [activeScope, setActiveScope] = React.useState<WorkspaceScope>(scope);

  React.useEffect(() => {
    setActiveScope(scope);
  }, [scope]);

  const handleScopeSwitch = (newScope: WorkspaceScope) => {
    setActiveScope(newScope);
    if (onScopeChange) {
      onScopeChange(newScope);
    }
  };

  const roleStr = String(user?.role || "").toUpperCase();
  const isExecutive =
    roleStr === "ADMIN" ||
    roleStr === "BGH" ||
    roleStr === "BAN_GIAM_HIEU" ||
    roleStr === "HIEU_TRUONG" ||
    roleStr === "PHO_HIEU_TRUONG";

  const [dashboardData, setDashboardData] = React.useState<DashboardPayload | null>(
    initialTasks
      ? {
          tasks: initialTasks,
          stats: computeDashboardStats(initialTasks),
          upcoming: [],
          activities: [],
        }
      : null
  );

  const [isLoading, setIsLoading] = React.useState(!initialTasks);
  const [error, setError] = React.useState<string | null>(null);
  const [mutationError, setMutationError] = React.useState<string | null>(null);
  const [notificationFeedback, setNotificationFeedback] = React.useState<string | null>(
    null
  );
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const [selectedTask, setSelectedTask] = React.useState<
    SchoolTask | StaffTask | null
  >(null);

  // View Mode & Filtering States
  const [viewMode, setViewMode] = React.useState<ViewMode>(initialViewMode);
  const [activeCategory, setActiveCategory] = React.useState<TaskCategory | "ALL">(
    "ALL"
  );
  const [levelFilter, setLevelFilter] = React.useState<TaskLevelFilter>(
    activeScope === "unit" ? "DON_VI" : "ALL"
  );
  const [searchQuery, setSearchQuery] = React.useState("");

  // Create Task Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [createInitialLevel, setCreateInitialLevel] = React.useState<TaskLevel>(
    activeScope === "unit" ? "DON_VI" : "TRUONG"
  );
  const [createInitialParentId, setCreateInitialParentId] = React.useState<
    string | undefined
  >(undefined);

  // Fetch initial data
  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setMutationError(null);
    try {
      const response = await fetch("/api/dashboard/overview");
      if (!response.ok) {
        throw new Error(
          activeScope === "unit"
            ? "Không thể kết nối đến máy chủ danh sách công việc đơn vị"
            : activeScope === "my"
            ? "Không thể kết nối đến máy chủ danh sách công việc của tôi"
            : "Không thể kết nối đến máy chủ danh sách công việc"
        );
      }
      const liveData: DashboardPayload = await response.json();
      if (liveData?.tasks) {
        setDashboardData(liveData);
      } else {
        throw new Error("Dữ liệu nhận được từ máy chủ không hợp lệ");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Đã xảy ra lỗi khi tải dữ liệu công việc";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [activeScope]);

  React.useEffect(() => {
    if (!initialTasks) {
      fetchData();
    }
  }, [fetchData, initialTasks]);

  // Auto-dismiss notification feedback after 4 seconds
  React.useEffect(() => {
    if (!notificationFeedback) return;
    const timer = setTimeout(() => {
      setNotificationFeedback(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [notificationFeedback]);

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setMutationError(null);
    try {
      const response = await fetch("/api/dashboard/overview");
      if (response.ok) {
        const liveData: DashboardPayload = await response.json();
        if (liveData?.tasks) {
          setDashboardData(liveData);
          setError(null);
        }
      }
    } catch {
      // Keep existing data on transient refresh error
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Optimistic Status Transition with Error Rollback
  const handleStatusChange = async (
    taskId: string,
    newStatus: TaskStatus,
    note?: string
  ) => {
    if (!dashboardData) return;
    const previousData = dashboardData;
    setMutationError(null);

    // 1. Optimistic Update
    const rolledUpTasks = applyOptimisticStatusChange(
      dashboardData.tasks,
      taskId,
      newStatus
    );
    setDashboardData({
      ...dashboardData,
      tasks: rolledUpTasks,
      stats: computeDashboardStats(rolledUpTasks),
    });

    // Also update selectedTask if open in SideSheet
    setSelectedTask((prev) => {
      if (!prev || prev.id !== taskId) return prev;
      if (isSchoolTask(prev)) {
        const schoolStatus: "IN_PROGRESS" | "COMPLETED" =
          newStatus === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";
        return { ...prev, status: schoolStatus };
      }
      return { ...prev, status: newStatus };
    });

    // 2. Call API
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, note }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        // Rollback
        setDashboardData(previousData);
        setMutationError(
          errData?.error ||
            "Cập nhật trạng thái nhiệm vụ thất bại. Đã hoàn tác thay đổi."
        );
      }
    } catch (err) {
      // Rollback on network failure
      setDashboardData(previousData);
      setMutationError(
        "Mất kết nối mạng khi cập nhật trạng thái nhiệm vụ. Đã hoàn tác thay đổi."
      );
    }
  };

  // Optimistic Task Creation with Error Rollback
  const handleCreateTask = async (data: CreateTaskFormData) => {
    if (!dashboardData) return;
    const previousData = dashboardData;
    setMutationError(null);
    const todayStr = new Date().toISOString().split("T")[0];

    // 1. Optimistic Update
    const updatedTasks = applyOptimisticCreateTask(
      dashboardData.tasks,
      data,
      todayStr
    );
    setDashboardData({
      ...dashboardData,
      tasks: updatedTasks,
      stats: computeDashboardStats(updatedTasks),
    });

    // 2. Prepare payload and call POST /api/tasks
    try {
      const deptGroup = getDepartmentForMember(data.leadAssigneeName);
      const departmentId = deptGroup?.id || user?.department || "BGH";

      const payload = {
        title: data.title,
        description: data.description || data.requiredDeliverables || "",
        dueDate: data.dueDate,
        departmentId,
        scope: data.level === "TRUONG" ? "SCHOOL" : "DEPARTMENT",
        parentTaskId: data.level === "DON_VI" ? data.parentTaskId : undefined,
        creatorId: user?.id,
      };

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        // Sync real database records and IDs
        handleRefresh();
      } else {
        const errData = await res.json().catch(() => null);
        setDashboardData(previousData);
        setMutationError(
          errData?.error || "Không thể tạo công việc mới trên máy chủ. Đã hoàn tác."
        );
      }
    } catch (err) {
      setDashboardData(previousData);
      setMutationError(
        "Lỗi kết nối khi gửi công việc lên máy chủ. Đã hoàn tác."
      );
    }
  };

  // Urge notification dispatch
  const handleSendUrgeNotification = async (
    taskId: string,
    taskTitle: string,
    assigneeName: string
  ) => {
    setMutationError(null);
    setNotificationFeedback(null);
    try {
      const res = await fetch("/api/notifications/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Đôn đốc tiến độ: ${taskTitle}`,
          body: `Nhắc nhở hoàn thành công việc được giao cho ${
            assigneeName || "cán bộ phụ trách"
          }`,
          linkHref: `/tasks?id=${taskId}`,
        }),
      });

      if (res.ok) {
        setNotificationFeedback(
          `Đã gửi thông báo đôn đốc thành công tới ${
            assigneeName || "cán bộ phụ trách"
          }.`
        );
      } else {
        setNotificationFeedback(
          `Đã ghi nhận yêu cầu đôn đốc công việc "${taskTitle}".`
        );
      }
    } catch {
      setNotificationFeedback(
        `Đã ghi nhận yêu cầu đôn đốc công việc "${taskTitle}".`
      );
    }
  };

  const openCreateModal = (level: TaskLevel, parentId?: string) => {
    setCreateInitialLevel(level);
    setCreateInitialParentId(parentId);
    setIsCreateModalOpen(true);
  };

  // Filter tasks dynamically by active role viewpoint and workspace scope
  const visibleTasks = React.useMemo(() => {
    if (!dashboardData) return [];
    const roleFiltered = filterTasksByRole(dashboardData.tasks, user);
    return filterTasksByScope(roleFiltered, activeScope, user);
  }, [dashboardData, user, activeScope]);

  const parentSchoolTaskTitle = React.useMemo(() => {
    if (!selectedTask || isSchoolTask(selectedTask) || !dashboardData) return undefined;
    const parent = dashboardData.tasks.find(
      (t) => t.id === selectedTask.parentSchoolTaskId
    );
    return parent?.title;
  }, [selectedTask, dashboardData]);

  // Counts for quick stats
  const totalSchoolTasksCount = visibleTasks.length;
  const totalSubTasksCount = visibleTasks.reduce(
    (acc, t) => acc + (t.subTasks ? t.subTasks.length : 0),
    0
  );

  // Full error state when initial load fails
  if (error && !dashboardData) {
    return (
      <div className={cn("max-w-[1440px] w-full mx-auto py-12 px-4", className)}>
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center max-w-md mx-auto space-y-4">
          <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertCircle className="size-6" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground font-heading">
              {activeScope === "unit"
                ? "Không thể tải danh sách công việc đơn vị"
                : activeScope === "my"
                ? "Không thể tải danh sách công việc của tôi"
                : "Không thể tải danh sách công việc"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="gap-1.5 text-xs font-medium"
          >
            <RefreshCw className="size-3.5" strokeWidth={1.5} />
            <span>Thử lại</span>
          </Button>
        </div>
      </div>
    );
  }

  // Loading skeleton state
  if (isLoading && !dashboardData) {
    return (
      <div
        className={cn(
          "max-w-[1440px] w-full mx-auto space-y-4 pb-24 md:pb-10 animate-pulse",
          className
        )}
        aria-label="Đang nạp dữ liệu công việc..."
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-2">
            <div className="h-4 w-28 rounded bg-muted/60" />
            <div className="h-7 w-56 rounded-md bg-muted/80" />
            <div className="h-4 w-80 max-w-full rounded bg-muted/50" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8.5 w-32 rounded-lg bg-muted/60 border border-border/60" />
            <div className="h-8.5 w-24 rounded-lg bg-muted/60 border border-border/60" />
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-3 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-7 w-20 rounded-md bg-muted/50 shrink-0" />
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="h-6 w-44 rounded-md bg-muted/40 border border-border/50" />
              <div className="h-7 w-24 rounded-lg bg-muted/50 border border-border/60" />
            </div>
          </div>
          <div className="pt-2 border-t border-border/40">
            <div className="h-8 w-full rounded-lg bg-muted/30 border border-border/50" />
          </div>
        </div>

        <section className="min-h-[420px]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((col) => (
              <div
                key={col}
                className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3 min-h-[380px]"
              >
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <div className="h-4 w-28 rounded bg-muted/70" />
                  <div className="size-5 rounded-full bg-muted/50" />
                </div>
                <div className="space-y-2.5">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="rounded-lg border border-border/60 bg-card p-3 space-y-2 shadow-2xs"
                    >
                      <div className="h-4 w-3/4 rounded bg-muted/70" />
                      <div className="h-3 w-1/2 rounded bg-muted/40" />
                      <div className="flex items-center justify-between pt-2 border-t border-border/30">
                        <div className="size-6 rounded-full bg-muted/50" />
                        <div className="h-3 w-16 rounded bg-muted/40" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "max-w-[1440px] w-full mx-auto space-y-5 pb-20 md:pb-10",
        className
      )}
      data-slot="task-management-workspace"
      data-scope={activeScope}
    >
      {/* Dynamic Feedback Banners */}
      {mutationError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs font-medium"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" strokeWidth={1.5} />
            <span>{mutationError}</span>
          </div>
          <button
            type="button"
            onClick={() => setMutationError(null)}
            className="p-1 hover:bg-destructive/15 rounded cursor-pointer"
            aria-label="Đóng thông báo lỗi"
          >
            <X className="size-3.5" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {notificationFeedback && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 p-3 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-medium"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" strokeWidth={1.5} />
            <span>{notificationFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotificationFeedback(null)}
            className="p-1 hover:bg-emerald-100 rounded cursor-pointer text-emerald-800"
            aria-label="Đóng thông báo"
          >
            <X className="size-3.5" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Scope Navigation Switcher */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        <div
          role="tablist"
          aria-label="Phạm vi nhiệm vụ"
          className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted/60 border border-border/60 text-xs font-medium"
        >
          {(isExecutive || activeScope === "school") && (
            <button
              type="button"
              role="tab"
              aria-selected={activeScope === "school"}
              onClick={() => handleScopeSwitch("school")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer",
                activeScope === "school"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <School className="size-3.5" strokeWidth={1.5} />
              <span>Nhiệm vụ cấp Trường</span>
            </button>
          )}
          <button
            type="button"
            role="tab"
            aria-selected={activeScope === "unit"}
            onClick={() => handleScopeSwitch("unit")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer",
              activeScope === "unit"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Building2 className="size-3.5" strokeWidth={1.5} />
            <span>Nhiệm vụ Đơn vị</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeScope === "my"}
            onClick={() => handleScopeSwitch("my")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer",
              activeScope === "my"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <User className="size-3.5" strokeWidth={1.5} />
            <span>Nhiệm vụ của tôi</span>
          </button>
        </div>
      </div>

      {/* Header with Title and Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-primary/10 text-primary border border-primary/20 font-mono">
              <Calendar className="size-3" strokeWidth={1.5} />
              Năm học 2025 - 2026
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              Học kỳ I
            </span>
            {activeScope === "unit" && (
              isUserUnassignedDepartment(user) ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                  <AlertCircle className="size-3 text-amber-700" strokeWidth={1.5} />
                  Chưa chọn đơn vị
                </span>
              ) : user?.department ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-secondary text-secondary-foreground border border-border/60">
                  <Building2 className="size-3" strokeWidth={1.5} />
                  {user.department}
                </span>
              ) : null
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-heading">
            {activeScope === "unit"
              ? "Nhiệm vụ Đơn vị"
              : activeScope === "my"
              ? "Nhiệm vụ của tôi"
              : "Nhiệm vụ cấp Trường"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeScope === "unit"
              ? "Theo dõi tiến độ, chi tiết nhiệm vụ và điều phối nhân sự theo từng đơn vị trực thuộc"
              : activeScope === "my"
              ? "Theo dõi và xử lý các nhiệm vụ, công việc được phân công trực tiếp"
              : "Theo dõi tiến độ, phân cấp nhiệm vụ và phối hợp điều hành công việc toàn trường"}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer disabled:opacity-60 shadow-2xs"
            title="Làm mới dữ liệu từ máy chủ"
          >
            <RefreshCw
              strokeWidth={1.5}
              className={cn(
                "size-3.5",
                isRefreshing ? "animate-spin text-foreground" : ""
              )}
            />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          <button
            type="button"
            onClick={() =>
              openCreateModal(
                activeScope === "unit" || user?.role !== "ADMIN" ? "DON_VI" : "TRUONG"
              )
            }
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer shadow-2xs active:scale-95"
          >
            <Plus strokeWidth={1.5} className="size-3.5" />
            <span>
              {user?.role === "STAFF"
                ? "Tạo việc mới"
                : user?.role === "MANAGER"
                ? "Tạo việc / Giao việc"
                : "Giao việc mới"}
            </span>
          </button>
        </div>
      </div>

      {/* Filter Bar & View Mode Switcher */}
      <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-xs p-3 space-y-2.5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto thin-scrollbar pb-1 md:pb-0">
            {CATEGORY_TABS.map((tab: CategoryTab) => {
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={cn(
                    "whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Level Filter & View Mode Switcher */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Level Quick Filter */}
            <div className="hidden sm:flex items-center gap-1 border-r border-border/60 pr-2">
              <button
                type="button"
                onClick={() => setLevelFilter("ALL")}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer font-mono tabular-nums",
                  levelFilter === "ALL"
                    ? "bg-secondary text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Tất cả ({totalSchoolTasksCount + totalSubTasksCount})
              </button>
              <button
                type="button"
                onClick={() => setLevelFilter("TRUONG")}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer font-mono tabular-nums",
                  levelFilter === "TRUONG"
                    ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Cấp Trường ({totalSchoolTasksCount})
              </button>
              <button
                type="button"
                onClick={() => setLevelFilter("DON_VI")}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer font-mono tabular-nums",
                  levelFilter === "DON_VI"
                    ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Đơn vị ({totalSubTasksCount})
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-border/70 bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                  viewMode === "table"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Xem dạng bảng phân cấp"
              >
                <List strokeWidth={1.5} className="size-3.5" />
                <span className="hidden sm:inline">Bảng</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("kanban")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                  viewMode === "kanban"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Xem dạng bảng Kanban"
              >
                <LayoutGrid strokeWidth={1.5} className="size-3.5" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/40">
          <div className="relative flex-1">
            <Search
              strokeWidth={1.5}
              className="size-3.5 text-muted-foreground pointer-events-none absolute left-3 top-2.5"
            />
            <input
              type="text"
              placeholder="Tìm kiếm theo tiêu đề, người phụ trách hoặc công việc đơn vị..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-9 pr-8 rounded-lg border border-border/70 bg-background text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Xóa tìm kiếm"
              >
                <X strokeWidth={1.5} className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content: Modular Cascading Table OR Kanban Board OR UnassignedDepartmentState */}
      <section aria-label="Danh sách công việc" className="min-h-[420px]">
        {activeScope === "unit" && isUserUnassignedDepartment(user) ? (
          <UnassignedDepartmentState onOpenProfile={() => setIsProfileModalOpen(true)} />
        ) : viewMode === "table" ? (
          <ModularCascadingTaskTable
            tasks={visibleTasks}
            onSelectTask={(task) => setSelectedTask(task)}
            onAddTask={() =>
              openCreateModal(
                activeScope === "unit" || user?.role !== "ADMIN" ? "DON_VI" : "TRUONG"
              )
            }
            onStatusChange={handleStatusChange}
            onUrge={handleSendUrgeNotification}
            onRefresh={handleRefresh}
            initialCategory={activeCategory}
            initialDepartment={activeScope === "unit" ? user?.department : undefined}
          />
        ) : (
          <TaskKanbanBoard
            tasks={visibleTasks}
            onSelectTask={(task) => setSelectedTask(task)}
            onStatusChange={handleStatusChange}
            onAddTask={(level, parentId) =>
              openCreateModal(
                level ||
                  (activeScope === "unit" || user?.role !== "ADMIN" ? "DON_VI" : "TRUONG"),
                parentId
              )
            }
            levelFilter={levelFilter}
            categoryFilter={activeCategory}
            searchQuery={searchQuery}
          />
        )}
      </section>

      {/* TaskDetailSideSheet Slide-Over */}
      <TaskDetailSideSheet
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onStatusChange={handleStatusChange}
        onAddSubTask={(parentId) => {
          openCreateModal("DON_VI", parentId);
        }}
        onSelectSubTask={(subTaskOrId) => {
          if (typeof subTaskOrId === "string") {
            const foundSchool = visibleTasks.find((t) => t.id === subTaskOrId);
            if (foundSchool) {
              setSelectedTask(foundSchool);
              return;
            }
            for (const t of visibleTasks) {
              const sub = t.subTasks?.find((s) => s.id === subTaskOrId);
              if (sub) {
                setSelectedTask(sub);
                return;
              }
            }
          } else {
            setSelectedTask(subTaskOrId);
          }
        }}
        parentSchoolTaskTitle={parentSchoolTaskTitle}
        currentUser={user || undefined}
      />

      {/* CreateTaskModal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateTask}
        schoolTasks={visibleTasks}
        initialLevel={createInitialLevel}
        initialParentTaskId={createInitialParentId}
        initialParentTaskTitle={
          createInitialParentId
            ? visibleTasks.find((t) => t.id === createInitialParentId)?.title
            : undefined
        }
        initialParentTaskDueDate={
          createInitialParentId
            ? visibleTasks.find((t) => t.id === createInitialParentId)?.dueDate
            : undefined
        }
      />
    </div>
  );
}

export default TaskManagementWorkspace;
