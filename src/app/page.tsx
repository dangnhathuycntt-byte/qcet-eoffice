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
import dynamic from "next/dynamic";
import {
  computeExecutiveActionStats,
  computeDepartmentHealthMatrix,
  filterTasksByExecutive,
} from "@/lib/executive-matrix-aggregator";
import { CascadingTaskTable } from "@/components/dashboard/cascading-task-table";
import {
  UnifiedTaskToolbar,
  type TaskScope,
  type TaskViewMode,
  filterTasksByScope,
} from "@/components/dashboard/unified-task-toolbar";
import { isSchoolTask } from "@/components/dashboard/task-detail-side-sheet";
import { CreateTaskFormData } from "@/components/dashboard/create-task-modal";
import { CATEGORY_TABS } from "@/components/dashboard/cascading-task-table";
import { UpcomingDeadlinesWidget } from "@/components/dashboard/upcoming-deadlines-widget";
import { ActivityFeedWidget } from "@/components/dashboard/activity-feed-widget";
import { BentoPortalHub } from "@/components/portal/bento-portal-hub";
import { WorkspaceZone, parseZoneParam } from "@/types/workspace";
import { useSidebar } from "@/components/layout/sidebar-context";

// Dynamic Code-Splitting for Heavy Sub-views & Modals
const TaskKanbanBoard = dynamic(
  () => import("@/components/tasks/task-kanban-board").then((m) => m.TaskKanbanBoard),
  { ssr: false, loading: () => <div className="h-96 rounded-2xl bg-muted/20 animate-pulse" /> }
);

const CalendarMonthView = dynamic(
  () => import("@/components/calendar/calendar-month-view").then((m) => m.CalendarMonthView),
  { ssr: false, loading: () => <div className="h-96 rounded-2xl bg-muted/20 animate-pulse" /> }
);

const DepartmentGroupedTaskView = dynamic(
  () =>
    import("@/components/dashboard/department-grouped-task-view").then(
      (m) => m.DepartmentGroupedTaskView
    ),
  {
    ssr: false,
    loading: () => <div className="h-96 rounded-2xl bg-muted/20 animate-pulse" />,
  }
);

const ExecutiveDepartmentCommandCenter = dynamic(
  () =>
    import("@/components/tasks/executive-department-command-center").then(
      (m) => m.ExecutiveDepartmentCommandCenter
    ),
  {
    ssr: false,
    loading: () => <div className="h-96 rounded-2xl bg-muted/20 animate-pulse" />,
  }
);

const OrganizationTree = dynamic(
  () => import("@/components/org/organization-tree").then((m) => m.OrganizationTree),
  { ssr: false, loading: () => <div className="h-96 rounded-2xl bg-muted/20 animate-pulse" /> }
);

const TaskDetailSideSheet = dynamic(
  () => import("@/components/dashboard/task-detail-side-sheet").then((m) => m.TaskDetailSideSheet),
  { ssr: false }
);

const CreateTaskModal = dynamic(
  () => import("@/components/dashboard/create-task-modal").then((m) => m.CreateTaskModal),
  { ssr: false }
);
import {
  RefreshCw,
  Plus,
  ArrowRight,
  LayoutDashboard,
  CheckSquare,
  Calendar as CalendarIcon,
  Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  filterTasksByRole,
  filterUpcomingByRole,
} from "@/lib/role-task-filter";
import {
  getDefaultScopeForRole,
  getDefaultViewModeForRole,
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
  const { setBadgeCounts } = useSidebar();

  // 1. URL Query Parameter sync for zone, scope, view, and department
  const zoneQuery = searchParams.get("zone");
  const scopeQuery = searchParams.get("scope");
  const viewQuery = searchParams.get("view");
  const deptQuery = searchParams.get("dept");

  const [activeZone, setActiveZone] = React.useState<WorkspaceZone>(() =>
    parseZoneParam(zoneQuery)
  );

  const defaultScope = React.useMemo(
    () => getDefaultScopeForRole(user?.role),
    [user?.role]
  );
  const defaultViewMode = React.useMemo(
    () => getDefaultViewModeForRole(user?.role),
    [user?.role]
  );

  const [scope, setScope] = React.useState<TaskScope>(() =>
    parseScopeParam(scopeQuery, defaultScope)
  );
  const [viewMode, setViewMode] = React.useState<TaskViewMode>(() =>
    parseViewModeParam(viewQuery, defaultViewMode)
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
    if (zoneQuery === "portal") {
      router.replace("/portal");
      return;
    }
    setActiveZone(parseZoneParam(zoneQuery));
  }, [zoneQuery, router]);

  React.useEffect(() => {
    if (scopeQuery) {
      setScope(parseScopeParam(scopeQuery, defaultScope));
    } else {
      setScope(defaultScope);
    }
  }, [scopeQuery, defaultScope]);

  React.useEffect(() => {
    if (viewQuery) {
      setViewMode(parseViewModeParam(viewQuery, defaultViewMode));
    } else {
      setViewMode(defaultViewMode);
    }
  }, [viewQuery, defaultViewMode]);

  React.useEffect(() => {
    if (deptQuery !== null) {
      setSelectedDepartment(deptQuery);
    }
  }, [deptQuery]);

  // URL updating helper
  const updateUrlParams = React.useCallback(
    (updates: {
      zone?: WorkspaceZone;
      scope?: TaskScope;
      view?: TaskViewMode;
      dept?: string;
    }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (updates.zone !== undefined) {
        if (updates.zone === "portal") {
          params.delete("zone");
        } else {
          params.set("zone", updates.zone);
        }
      }
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
      const qs = params.toString();
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    },
    [router, searchParams]
  );

  const handleZoneChange = React.useCallback(
    (newZone: WorkspaceZone) => {
      if (newZone === "portal") {
        router.push("/portal");
        return;
      }
      setActiveZone(newZone);
      updateUrlParams({ zone: newZone });
    },
    [updateUrlParams, router]
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
  const [initialTaskLevel, setInitialTaskLevel] = React.useState<
    "TRUONG" | "DON_VI"
  >("TRUONG");
  const [initialParentTaskId, setInitialParentTaskId] = React.useState<
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

  // Executive cockpit data (only computed for ADMIN/BGH users and when in dashboard zone)
  const isExecutive = user?.role === "ADMIN";

  const executiveStats = React.useMemo(
    () => (isExecutive && activeZone === "dashboard" ? computeExecutiveActionStats(dashboardData.tasks) : null),
    [dashboardData.tasks, isExecutive, activeZone]
  );

  const departmentHealth = React.useMemo(
    () => (isExecutive && activeZone === "dashboard" ? computeDepartmentHealthMatrix(dashboardData.tasks) : []),
    [dashboardData.tasks, isExecutive, activeZone]
  );

  // Master filtered tasks feeding Work Canvas (bypassed on portal/org zones for speed)
  const filteredTasks = React.useMemo(() => {
    if (activeZone === "portal" || activeZone === "org") return [];
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
    activeZone,
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

  // Role-filtered tasks for widgets & notifications
  const roleVisibleTasks = React.useMemo(
    () => filterTasksByRole(dashboardData.tasks, user),
    [dashboardData.tasks, user]
  );

  const roleUpcoming = React.useMemo(
    () =>
      filterUpcomingByRole(
        dashboardData.upcoming,
        user,
        roleVisibleTasks
      ),
    [dashboardData.upcoming, user, roleVisibleTasks]
  );

  const parentSchoolTaskTitle = React.useMemo(() => {
    if (!selectedTask || isSchoolTask(selectedTask)) return undefined;
    const parent = dashboardData.tasks.find(
      (t) => t.id === selectedTask.parentSchoolTaskId
    );
    return parent?.title;
  }, [selectedTask, dashboardData.tasks]);

  // Sync dynamic badge counts with left sidebar (AppSidebar) with identity check to prevent render loops
  React.useEffect(() => {
    // Only alert on actionable/urgent items (real notifications, not static entity totals)
    const urgentTasks = dashboardData.tasks.filter(
      (t) =>
        (t.status === "PENDING_EXECUTIVE_APPROVAL" || t.dueDate <= "2026-09-08") &&
        t.status !== "COMPLETED"
    ).length;
    const todayStr = "2026-09-06";
    const todayEvents = dashboardData.upcoming.filter(
      (item) => item.dueDate === todayStr
    ).length;

    const nextTasks = urgentTasks > 0 ? urgentTasks : undefined;
    const nextCalendar = todayEvents > 0 ? todayEvents : undefined;
    const nextOrg = undefined;
    const nextNotifications = 5;

    setBadgeCounts((prev) => {
      if (
        prev.tasks === nextTasks &&
        prev.calendar === nextCalendar &&
        prev.org === nextOrg &&
        prev.notifications === nextNotifications
      ) {
        return prev;
      }
      return {
        tasks: nextTasks,
        calendar: nextCalendar,
        org: nextOrg,
        notifications: nextNotifications,
      };
    });
  }, [dashboardData.tasks, dashboardData.upcoming, setBadgeCounts]);

  const handleSelectUpcoming = React.useCallback(
    (item: UpcomingItem) => {
      const targetId = item.taskId || item.id;
      const matched = dashboardData.tasks.find((t) => t.id === targetId);
      if (matched) {
        setSelectedTask(matched);
        return;
      }
      for (const parent of dashboardData.tasks) {
        const foundSub = parent.subTasks.find((s) => s.id === targetId);
        if (foundSub) {
          setSelectedTask(foundSub);
          return;
        }
      }
    },
    [dashboardData.tasks]
  );

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

  const handleOpenCreateModal = (
    level: "TRUONG" | "DON_VI" = "TRUONG",
    parentId?: string
  ) => {
    setInitialTaskLevel(level);
    setInitialParentTaskId(parentId);
    setIsCreateModalOpen(true);
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
      data-active-zone={activeZone}
    >
      {/* ========================================================================= */}
      {/* ZONE 1: PORTAL (Cổng thông tin & Trung tâm điều hành Bento Grid)         */}
      {/* ========================================================================= */}
      {activeZone === "portal" && (
        <BentoPortalHub
          tasks={dashboardData.tasks}
          stats={displayedStats}
          upcoming={dashboardData.upcoming}
          activities={dashboardData.activities}
          user={user}
          onNavigateZone={handleZoneChange}
          onSelectTask={(task) => setSelectedTask(task)}
          onOpenCreateTask={handleOpenCreateModal}
          onManualRefresh={handleManualRefresh}
          isRefreshing={isRefreshing}
        />
      )}

      {/* ========================================================================= */}
      {/* ZONE 2: DASHBOARD (Dashboard điều hành & Chỉ số KPI toàn trường)         */}
      {/* ========================================================================= */}
      {activeZone === "dashboard" && (
        <div className="space-y-6" data-slot="zone-dashboard">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10.5px] font-bold bg-primary/10 text-primary border border-primary/20 shadow-2xs font-mono">
                  Phân khu Điều hành
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {isExecutive ? "BGH Giám sát toàn trường" : `Đơn vị: ${user?.department || "QCET"}`}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground font-heading">
                Dashboard Điều Hành & Báo Cáo KPI
              </h1>
              <p className="text-xs text-muted-foreground mt-1 text-balance">
                Theo dõi toàn cảnh tiến độ, điểm nghẽn, và hàng đợi phê duyệt chiến lược của 11 đơn vị
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="gap-1.5 text-xs rounded-xl"
              >
                <RefreshCw
                  size={14}
                  className={isRefreshing ? "animate-spin text-primary" : ""}
                />
                <span className="hidden sm:inline">Làm mới dữ liệu</span>
              </Button>
            </div>
          </div>

          {/* Stat Strip */}
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

          {/* Widgets Grid: Upcoming Deadlines & Live Activity Feed */}
          <section
            aria-label="Tiện ích theo dõi tiến độ và hoạt động"
            className="grid grid-cols-1 lg:grid-cols-2 gap-5"
          >
            <UpcomingDeadlinesWidget
              items={roleUpcoming}
              onSelectTask={handleSelectUpcoming}
            />
            <ActivityFeedWidget activities={dashboardData.activities} />
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ZONE 3: TASKS (Bảng công việc 2 cấp, Lọc & Phân cấp nhiệm vụ)           */}
      {/* ========================================================================= */}
      {activeZone === "tasks" && (
        <div className="space-y-6" data-slot="zone-tasks">
          {/* Header */}
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="gap-1.5 text-xs rounded-xl"
              >
                <RefreshCw
                  size={14}
                  className={isRefreshing ? "animate-spin text-primary" : ""}
                />
                <span className="hidden sm:inline">Làm mới dữ liệu</span>
              </Button>
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
              onNewTaskClick={() => handleOpenCreateModal("TRUONG")}
              totalTasksCount={filteredTasks.length}
              isExecutive={isExecutive}
              userRole={user?.role}
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
                onAddTask={() => handleOpenCreateModal("TRUONG")}
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
                onAddTask={() => handleOpenCreateModal("TRUONG")}
              />
            )}

            {viewMode === "calendar" && (
              <CalendarMonthView
                tasks={filteredTasks}
                onSelectTask={(task) => setSelectedTask(task)}
                onAddTask={() => handleOpenCreateModal("TRUONG")}
              />
            )}

            {viewMode === "department" && (
              <DepartmentGroupedTaskView
                tasks={filteredTasks}
                onSelectTask={(task) => setSelectedTask(task)}
                onStatusChange={handleStatusChange}
                onAddTask={(deptCode) => handleOpenCreateModal("TRUONG")}
                selectedDepartmentFilter={selectedDepartment}
                searchQuery={searchQuery}
              />
            )}

            {viewMode === "executive" && (
              <ExecutiveDepartmentCommandCenter
                tasks={filteredTasks}
                onSelectTask={(task) => setSelectedTask(task)}
                onSelectDepartment={(deptId) => handleDepartmentChange(deptId || "ALL")}
                selectedDepartmentId={selectedDepartment !== "ALL" ? selectedDepartment : null}
              />
            )}
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ZONE 4: CALENDAR (Lịch biểu & Tiến độ tháng/tuần O(1))                   */}
      {/* ========================================================================= */}
      {activeZone === "calendar" && (
        <div className="space-y-6" data-slot="zone-calendar">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10.5px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-2xs font-mono">
                  Phân khu Lịch công tác
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground font-heading">
                Lịch Công Tác & Hạn Chót Toàn Trường
              </h1>
              <p className="text-xs text-muted-foreground mt-1 text-balance">
                Theo dõi lịch trình các nhiệm vụ, sự kiện BGH và hạn chót giao việc theo thời gian thực
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isExecutive && (
                <Button
                  onClick={() => handleOpenCreateModal("TRUONG")}
                  className="gap-1.5 text-xs font-bold rounded-xl"
                >
                  <Plus size={14} />
                  <span>Thêm sự kiện / Việc mới</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="gap-1.5 text-xs rounded-xl"
              >
                <RefreshCw
                  size={14}
                  className={isRefreshing ? "animate-spin text-primary" : ""}
                />
                <span className="hidden sm:inline">Làm mới</span>
              </Button>
            </div>
          </div>

          <section aria-label="Lưới lịch tháng">
            <CalendarMonthView
              tasks={filteredTasks}
              onSelectTask={(task) => setSelectedTask(task)}
              onAddTask={() => handleOpenCreateModal("TRUONG")}
            />
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ZONE 5: ORG (Cơ cấu tổ chức & Danh bạ 11 đơn vị)                         */}
      {/* ========================================================================= */}
      {activeZone === "org" && (
        <div className="space-y-6" data-slot="zone-org">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  <Network className="size-3" strokeWidth={1.5} />
                  <span>CƠ CẤU BỘ MÁY & DANH BẠ QCET</span>
                </span>
                <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
                  • 11 Đơn vị • 95 Cán bộ
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground font-heading">
                Cơ Cấu Tổ Chức & Danh Bạ Cán Bộ
              </h1>
              <p className="text-xs text-muted-foreground mt-1 text-balance">
                Sơ đồ phân cấp bộ máy tổ chức và danh bạ liên hệ toàn trường QCET
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="gap-1.5 text-xs rounded-xl"
              >
                <RefreshCw
                  size={14}
                  className={isRefreshing ? "animate-spin text-primary" : ""}
                />
                <span className="hidden sm:inline">Làm mới danh bạ</span>
              </Button>
            </div>
          </div>

          <section aria-label="Sơ đồ cây tổ chức">
            <OrganizationTree />
          </section>
        </div>
      )}

      {/* TaskDetailSideSheet Slide-Over (only rendered when task is active) */}
      {selectedTask && (
        <TaskDetailSideSheet
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onStatusChange={handleStatusChange}
          parentSchoolTaskTitle={parentSchoolTaskTitle}
        />
      )}

      {/* CreateTaskModal for School-level & Unit-level task creation (rendered on-demand) */}
      {isCreateModalOpen && (
        <CreateTaskModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateTask}
          initialLeadAssigneeName={initialAssigneeName}
          schoolTasks={dashboardData.tasks}
          initialLevel={initialTaskLevel}
          initialParentTaskId={initialParentTaskId}
        />
      )}
    </div>
  );
}

export default function UnifiedTaskHubPage() {
  return (
    <React.Suspense fallback={<DashboardLoadingFallback />}>
      <UnifiedTaskHubContent />
    </React.Suspense>
  );
}
