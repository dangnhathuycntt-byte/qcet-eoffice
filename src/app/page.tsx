"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  SchoolTask,
  StaffTask,
  UpcomingItem,
  DashboardPayload,
  TaskStatus,
} from "@/types/dashboard";
import { getMockDashboardPayload } from "@/lib/mock-dashboard-data";
import {
  computeSchoolTaskRollup,
  computeDashboardStats,
} from "@/lib/dashboard-aggregator";
import {
  ExecutiveStatStrip,
  type WorkboxFilter,
} from "@/components/dashboard/executive-stat-strip";
import {
  ExecutiveActionCenter,
  type ExecutiveFilter,
} from "@/components/dashboard/executive-action-center";
import { DepartmentProgressMatrix } from "@/components/dashboard/department-progress-matrix";
import {
  computeExecutiveActionStats,
  computeDepartmentHealthMatrix,
  filterTasksByExecutive,
} from "@/lib/executive-matrix-aggregator";
import { CascadingTaskTable } from "@/components/dashboard/cascading-task-table";
import { TaskKanbanBoard } from "@/components/tasks/task-kanban-board";
import { CalendarMonthView } from "@/components/calendar/calendar-month-view";
import {
  UnifiedTaskToolbar,
  type TaskScope,
  type TaskViewMode,
  filterTasksByScope,
} from "@/components/dashboard/unified-task-toolbar";
import {
  TaskDetailSideSheet,
  isSchoolTask,
} from "@/components/dashboard/task-detail-side-sheet";
import {
  CreateTaskModal,
  CreateTaskFormData,
} from "@/components/dashboard/create-task-modal";
import { CATEGORY_TABS } from "@/components/dashboard/cascading-task-table";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  getDefaultScopeForRole,
  parseScopeParam,
  scopeToParam,
  parseViewModeParam,
  filterTasksHub,
} from "@/lib/unified-task-hub";

function DashboardLoadingFallback() {
  return (
    <div className="max-w-[1440px] w-full mx-auto space-y-6 pb-24 md:pb-10 animate-pulse">
      <div className="h-16 rounded-2xl bg-muted/40" />
      <div className="h-28 rounded-2xl bg-muted/40" />
      <div className="h-14 rounded-2xl bg-muted/40" />
      <div className="h-96 rounded-2xl bg-muted/40" />
    </div>
  );
}

function UnifiedTaskHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // 1. URL Query Parameter sync for scope, view, and department
  const scopeQuery = searchParams.get("scope");
  const viewQuery = searchParams.get("view");
  const deptQuery = searchParams.get("dept");

  const defaultScope = React.useMemo(
    () => getDefaultScopeForRole(user?.role),
    [user?.role]
  );

  const [scope, setScope] = React.useState<TaskScope>(() =>
    parseScopeParam(scopeQuery, defaultScope)
  );
  const [viewMode, setViewMode] = React.useState<TaskViewMode>(() =>
    parseViewModeParam(viewQuery, "table")
  );
  const [selectedDepartment, setSelectedDepartment] = React.useState<string>(
    deptQuery || "ALL"
  );
  const [selectedCategory, setSelectedCategory] = React.useState<string>("ALL");
  const [selectedPriority, setSelectedPriority] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [activeWorkbox, setActiveWorkbox] = React.useState<WorkboxFilter>("ALL");
  const [executiveFilter, setExecutiveFilter] =
    React.useState<ExecutiveFilter>("ALL");

  // Keep state in sync with URL query changes
  React.useEffect(() => {
    if (scopeQuery) {
      setScope(parseScopeParam(scopeQuery, defaultScope));
    } else {
      setScope(defaultScope);
    }
  }, [scopeQuery, defaultScope]);

  React.useEffect(() => {
    if (viewQuery) {
      setViewMode(parseViewModeParam(viewQuery, "table"));
    }
  }, [viewQuery]);

  React.useEffect(() => {
    if (deptQuery !== null) {
      setSelectedDepartment(deptQuery);
    }
  }, [deptQuery]);

  // URL updating helper
  const updateUrlParams = React.useCallback(
    (updates: { scope?: TaskScope; view?: TaskViewMode; dept?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (updates.scope !== undefined) {
        params.set("scope", scopeToParam(updates.scope));
      }
      if (updates.view !== undefined) {
        params.set("view", updates.view);
      }
      if (updates.dept !== undefined) {
        if (updates.dept && updates.dept !== "ALL") {
          params.set("dept", updates.dept);
        } else {
          params.delete("dept");
        }
      }
      router.replace(`/?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const handleScopeChange = (newScope: TaskScope) => {
    setScope(newScope);
    updateUrlParams({ scope: newScope });
  };

  const handleViewModeChange = (newMode: TaskViewMode) => {
    setViewMode(newMode);
    updateUrlParams({ view: newMode });
  };

  const handleDepartmentChange = (newDept: string) => {
    setSelectedDepartment(newDept);
    updateUrlParams({ dept: newDept });
  };

  // 2. Synchronous optimistic initial state from getMockDashboardPayload (0ms blank screen)
  const [dashboardData, setDashboardData] = React.useState<DashboardPayload>(() =>
    getMockDashboardPayload()
  );
  const [selectedTask, setSelectedTask] = React.useState<
    SchoolTask | StaffTask | null
  >(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [initialAssigneeName, setInitialAssigneeName] = React.useState<
    string | undefined
  >(undefined);

  // Background sync with /api/dashboard/overview
  React.useEffect(() => {
    let isMounted = true;

    async function syncDashboardOverview() {
      try {
        const response = await fetch("/api/dashboard/overview");
        if (response.ok && isMounted) {
          const liveData: DashboardPayload = await response.json();
          if (liveData && liveData.tasks && liveData.stats) {
            setDashboardData(liveData);
          }
        }
      } catch {
        // Silently preserve high-fidelity optimistic payload on network/offline fallback
      }
    }

    syncDashboardOverview();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handler to manually trigger sync/refresh
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/dashboard/overview");
      if (response.ok) {
        const liveData: DashboardPayload = await response.json();
        if (liveData && liveData.tasks && liveData.stats) {
          setDashboardData(liveData);
        }
      }
    } catch {
      // Keep existing data
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  // Scoped tasks for Executive Stat Strip
  const scopedBaseTasks = React.useMemo(
    () => filterTasksByScope(dashboardData.tasks, scope, user, selectedDepartment),
    [dashboardData.tasks, scope, user, selectedDepartment]
  );

  const displayedStats = React.useMemo(() => {
    if (scopedBaseTasks.length > 0) return computeDashboardStats(scopedBaseTasks);
    return computeDashboardStats(dashboardData.tasks);
  }, [scopedBaseTasks, dashboardData.tasks]);

  // Executive cockpit data (only computed for ADMIN/BGH users)
  const isExecutive = user?.role === "ADMIN";

  const executiveStats = React.useMemo(
    () => (isExecutive ? computeExecutiveActionStats(dashboardData.tasks) : null),
    [dashboardData.tasks, isExecutive]
  );

  const departmentHealth = React.useMemo(
    () => (isExecutive ? computeDepartmentHealthMatrix(dashboardData.tasks) : []),
    [dashboardData.tasks, isExecutive]
  );

  // Master filtered tasks feeding Work Canvas
  const filteredTasks = React.useMemo(() => {
    let result = filterTasksHub({
      tasks: dashboardData.tasks,
      scope,
      workboxFilter: activeWorkbox,
      category: selectedCategory,
      priority: selectedPriority,
      department: selectedDepartment,
      searchQuery,
      user,
    });
    if (isExecutive && executiveFilter !== "ALL") {
      result = filterTasksByExecutive(result, executiveFilter);
    }
    return result;
  }, [
    dashboardData.tasks,
    scope,
    activeWorkbox,
    selectedCategory,
    selectedPriority,
    selectedDepartment,
    searchQuery,
    user,
    isExecutive,
    executiveFilter,
  ]);

  const parentSchoolTaskTitle = React.useMemo(() => {
    if (!selectedTask || isSchoolTask(selectedTask)) return undefined;
    const parent = dashboardData.tasks.find(
      (t) => t.id === selectedTask.parentSchoolTaskId
    );
    return parent?.title;
  }, [selectedTask, dashboardData.tasks]);

  // Optimistic status update when changed inside TaskDetailSideSheet or Kanban
  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    setDashboardData((prev) => {
      const updatedTasks: SchoolTask[] = prev.tasks.map((st) => {
        if (st.id === taskId) {
          const schoolStatus: "IN_PROGRESS" | "COMPLETED" =
            newStatus === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";
          return { ...st, status: schoolStatus };
        }
        const updatedSubs: StaffTask[] = st.subTasks.map((sub) =>
          sub.id === taskId ? { ...sub, status: newStatus } : sub
        );
        return { ...st, subTasks: updatedSubs };
      });
      const rolledUpTasks = updatedTasks.map((t) => computeSchoolTaskRollup(t));
      return {
        ...prev,
        tasks: rolledUpTasks,
        stats: computeDashboardStats(rolledUpTasks),
      };
    });

    setSelectedTask((prev) => {
      if (!prev || prev.id !== taskId) return prev;
      if (isSchoolTask(prev)) {
        const schoolStatus: "IN_PROGRESS" | "COMPLETED" =
          newStatus === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";
        return { ...prev, status: schoolStatus };
      }
      return { ...prev, status: newStatus };
    });
  };

  // Task creation handler with full rollup recalculation
  const handleCreateTask = (data: CreateTaskFormData) => {
    const todayStr = "2026-09-04";

    setDashboardData((prev) => {
      let updatedTasks = [...prev.tasks];

      if (data.level === "TRUONG") {
        const newTask: SchoolTask = {
          id: `task-${Date.now()}`,
          title: data.title,
          category: data.category,
          categoryLabel:
            CATEGORY_TABS.find((c) => c.id === data.category)?.label || data.category,
          leadAssigneeName: data.leadAssigneeName,
          coAssignees: data.coAssignees,
          assignedDate: todayStr,
          dueDate: data.dueDate,
          status: "IN_PROGRESS",
          subTasks: [],
          totalSubTasks: 0,
          completedSubTasks: 0,
          progressPercent: 0,
        };
        updatedTasks.unshift(newTask);
      } else {
        const newSubTask: StaffTask = {
          id: `sub-${Date.now()}`,
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
                subTasks: [newSubTask, ...st.subTasks],
              };
            }
            return st;
          });
        } else if (updatedTasks.length > 0) {
          updatedTasks[0] = {
            ...updatedTasks[0],
            subTasks: [newSubTask, ...updatedTasks[0].subTasks],
          };
        }
      }

      const rolledUp = updatedTasks.map((t) => computeSchoolTaskRollup(t));
      return {
        ...prev,
        tasks: rolledUp,
        stats: computeDashboardStats(rolledUp),
      };
    });
  };

  // Listen to global task events
  React.useEffect(() => {
    const handleGlobalTaskCreated = (e: Event) => {
      const customEvent = e as CustomEvent<CreateTaskFormData>;
      if (customEvent.detail) {
        handleCreateTask(customEvent.detail);
      }
    };

    const handleGlobalOpenCreate = (e: Event) => {
      const customEvent = e as CustomEvent<{ leadAssigneeName?: string }>;
      if (customEvent?.detail?.leadAssigneeName) {
        setInitialAssigneeName(customEvent.detail.leadAssigneeName);
      } else {
        setInitialAssigneeName(undefined);
      }
      setIsCreateModalOpen(true);
    };

    window.addEventListener("qcet:task-created", handleGlobalTaskCreated);
    window.addEventListener("qcet:open-create-task", handleGlobalOpenCreate);
    return () => {
      window.removeEventListener("qcet:task-created", handleGlobalTaskCreated);
      window.removeEventListener("qcet:open-create-task", handleGlobalOpenCreate);
    };
  }, []);

  return (
    <div
      className="max-w-[1440px] w-full mx-auto space-y-6 pb-24 md:pb-10"
      data-slot="twenty-dashboard"
      data-hub="unified-task-hub"
    >
      {/* Header: Focused on Executive Task Management */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10.5px] font-bold bg-primary/10 text-primary border border-primary/20 shadow-2xs font-mono">
              Năm học 2025 - 2026
            </span>
            <span className="text-[11px] text-muted-foreground font-medium">
              Học kỳ I
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground font-heading">
            Quản lý Giao việc & Nhiệm vụ
          </h1>
          <p className="text-xs text-muted-foreground mt-1 text-balance">
            Trung tâm điều hành và giao việc hợp nhất: Phân cấp nhiệm vụ toàn trường, khoa phòng và cá nhân
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer disabled:opacity-60 shadow-2xs"
            title="Làm mới dữ liệu từ máy chủ"
          >
            <RefreshCw
              strokeWidth={1.5}
              className={`size-3.5 ${isRefreshing ? "animate-spin text-foreground" : ""}`}
            />
            <span className="hidden sm:inline">Làm mới dữ liệu</span>
          </button>
        </div>
      </div>

      {/* Executive Stat Strip / Interactive Workbox Filter */}
      <section aria-label="Chỉ số điều hành toàn trường">
        <ExecutiveStatStrip
          stats={displayedStats}
          activeFilter={activeWorkbox}
          onFilterChange={(filter) => setActiveWorkbox(filter)}
        />
      </section>

      {/* Executive Cockpit (BGH only) */}
      {isExecutive && executiveStats && (
        <section aria-label="Khoang điều hành Ban Giám hiệu" className="space-y-4">
          <ExecutiveActionCenter
            stats={executiveStats}
            activeFilter={executiveFilter}
            onFilterChange={setExecutiveFilter}
          />
          <DepartmentProgressMatrix
            departments={departmentHealth}
            selectedDepartment={selectedDepartment}
            onSelectDepartment={handleDepartmentChange}
          />
        </section>
      )}

      {/* Unified Task Toolbar */}
      <section aria-label="Thanh công cụ điều khiển nhiệm vụ">
        <UnifiedTaskToolbar
          scope={scope}
          onScopeChange={handleScopeChange}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          selectedDepartment={selectedDepartment}
          onDepartmentChange={handleDepartmentChange}
          selectedPriority={selectedPriority}
          onPriorityChange={setSelectedPriority}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onNewTaskClick={() => setIsCreateModalOpen(true)}
          totalTasksCount={filteredTasks.length}
        />
      </section>

      {/* Dynamic Work Canvas */}
      <section
        aria-label="Không gian làm việc nhiệm vụ"
        className="min-h-[420px]"
        data-slot="work-canvas"
      >
        {viewMode === "table" && (
          <CascadingTaskTable
            tasks={filteredTasks}
            onSelectTask={(task) => setSelectedTask(task)}
            onAddTask={() => setIsCreateModalOpen(true)}
            onStatusChange={handleStatusChange}
            hideWorkbox={true}
            hideToolbar={true}
          />
        )}

        {viewMode === "kanban" && (
          <TaskKanbanBoard
            tasks={filteredTasks}
            onSelectTask={(task) => setSelectedTask(task)}
            onStatusChange={handleStatusChange}
            onAddTask={() => setIsCreateModalOpen(true)}
          />
        )}

        {viewMode === "calendar" && (
          <CalendarMonthView
            tasks={filteredTasks}
            onSelectTask={(task) => setSelectedTask(task)}
            onAddTask={() => setIsCreateModalOpen(true)}
          />
        )}
      </section>

      {/* TaskDetailSideSheet Slide-Over */}
      <TaskDetailSideSheet
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onStatusChange={handleStatusChange}
        parentSchoolTaskTitle={parentSchoolTaskTitle}
      />

      {/* CreateTaskModal Dialog */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setInitialAssigneeName(undefined);
        }}
        onSubmit={handleCreateTask}
        schoolTasks={dashboardData.tasks}
        initialLeadAssigneeName={initialAssigneeName}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <React.Suspense fallback={<DashboardLoadingFallback />}>
      <UnifiedTaskHubContent />
    </React.Suspense>
  );
}
