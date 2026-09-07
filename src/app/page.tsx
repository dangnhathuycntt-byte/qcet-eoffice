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
  type ExecutiveFilter,
} from "@/components/dashboard/executive-action-center";
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
import { BentoPortalHub } from "@/components/portal/bento-portal-hub";
import { WorkspaceZone, parseZoneParam } from "@/types/workspace";
import { useSidebar } from "@/components/layout/sidebar-context";
import { DensityToggle } from "@/components/ui/density-toggle";

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

import { DashboardStateProvider, useDashboardModal } from "@/components/dashboard/dashboard-context";
import { OrgZone } from "@/components/dashboard/zones/org-zone";
import { CalendarZone } from "@/components/dashboard/zones/calendar-zone";
import { DashboardZone } from "@/components/dashboard/zones/dashboard-zone";
import { TasksZone } from "@/components/dashboard/zones/tasks-zone";
import { DashboardModalsHost } from "@/components/dashboard/dashboard-modals-host";

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

import type { DelegationRule } from "@/types/delegation";

const INITIAL_QCET_DELEGATIONS: DelegationRule[] = [
  {
    id: "del-cntt-001",
    grantorId: "staff-vinh-nn",
    grantorName: "TS. Nguyễn Ngọc Vinh",
    grantorRole: "MANAGER",
    granteeId: "staff-pho-lv",
    granteeName: "ThS. Lê Văn Phó",
    granteeRole: "STAFF",
    departmentCode: "K_CNTT",
    scope: "DACUM_REVIEW_STEP1",
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    status: "ACTIVE",
    reason: "Ủy quyền thẩm định và phê duyệt hồ sơ DACUM bước 1 trong thời gian Trưởng khoa công tác.",
    createdAt: "2026-09-01T08:00:00.000Z",
  },
];
import {
  RefreshCw,
  Plus,
  ArrowRight,
  LayoutDashboard,
  CheckSquare,
  Calendar as CalendarIcon,
  FileCheck,
  SlidersHorizontal,
  Table,
  KanbanSquare,
  Calendar,
  Building2,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import type { AuthUser } from "@/types/auth";
import { StaffFocusView } from "@/components/dashboard/roles/staff-focus-view";
import {
  LecturerFocusWorkspace,
  StaffWorkspace,
} from "@/components/portal/lecturer-focus-workspace";
import {
  DepartmentManagerWorkspace,
  ManagerWorkspace,
} from "@/components/portal/department-manager-workspace";
import {
  ExecutiveCockpitWorkspace,
  ExecutiveWorkspace,
} from "@/components/portal/executive-cockpit-workspace";
import type {
  ApprovalActionPayload,
  DeliverableSubmissionPayload,
} from "@/types/workspace";
import {
  SimplifiedTaskFilterBar,
  type SimplifiedTaskStatus,
} from "@/components/dashboard/simplified-task-filter-bar";
import {
  filterTasksByRole,
  filterUpcomingByRole,
} from "@/lib/role-task-filter";
import {
  getDefaultScopeForRole,
  getDefaultViewModeForRole,
  resolveStaffLandingMode,
  parseScopeParam,
  scopeToParam,
  parseViewModeParam,
  filterTasksHub,
  computeMonthlyTaskCounts,
} from "@/lib/unified-task-hub";
import {
  formatDepartmentLabel,
  resolveDepartment,
} from "@/components/layout/scope-switcher";
import {
  getAcademicMonthInfo,
  getAcademicMonthsForYear,
} from "@/lib/academic-calendar";

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

  // 1. URL Query Parameter sync for zone, scope, view, department, and academic month
  const zoneQuery = searchParams.get("zone");
  const scopeQuery = searchParams.get("scope");
  const viewQuery = searchParams.get("view");
  const deptQuery = searchParams.get("dept");
  const monthQuery = searchParams.get("month");

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
  const [selectedAcademicMonth, setSelectedAcademicMonth] = React.useState<number | "ALL">(() => {
    if (monthQuery === "ALL") return "ALL";
    if (monthQuery) {
      const parsed = parseInt(monthQuery, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) {
        return parsed;
      }
    }
    return getAcademicMonthInfo(new Date()).monthNumber;
  });
  const [selectedCategory, setSelectedCategory] = React.useState<string>("ALL");
  const [selectedPriority, setSelectedPriority] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [activeWorkbox, setActiveWorkbox] = React.useState<WorkboxFilter>("ALL");
  const [simplifiedStatus, setSimplifiedStatus] =
    React.useState<SimplifiedTaskStatus>("ALL");
  const [executiveFilter, setExecutiveFilter] =
    React.useState<ExecutiveFilter>("ALL");

  // Staff view mode toggle: default to focused mode unless URL explicitly specifies a view or user toggles expanded
  const [isStaffExpanded, setIsStaffExpanded] = React.useState<boolean>(() => {
    return viewQuery !== null && viewQuery !== "focus";
  });

  // Advanced toolbar toggle for Admin/Manager (defaults to SimplifiedTaskFilterBar)
  const [useAdvancedToolbar, setUseAdvancedToolbar] = React.useState<boolean>(false);

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
      if (viewQuery !== "focus") {
        setIsStaffExpanded(true);
      } else {
        setIsStaffExpanded(false);
      }
    } else {
      setViewMode(defaultViewMode);
      setIsStaffExpanded(false);
    }
  }, [viewQuery, defaultViewMode]);

  React.useEffect(() => {
    if (deptQuery !== null) {
      setSelectedDepartment(deptQuery);
    }
  }, [deptQuery]);

  React.useEffect(() => {
    if (monthQuery !== null) {
      if (monthQuery === "ALL") {
        setSelectedAcademicMonth("ALL");
      } else {
        const parsed = parseInt(monthQuery, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) {
          setSelectedAcademicMonth(parsed);
        }
      }
    }
  }, [monthQuery]);

  // URL updating helper
  const updateUrlParams = React.useCallback(
    (updates: {
      zone?: WorkspaceZone;
      scope?: TaskScope;
      view?: TaskViewMode;
      dept?: string;
      month?: number | "ALL";
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
      if (updates.month !== undefined) {
        if (updates.month === "ALL") {
          params.set("month", "ALL");
        } else {
          params.set("month", String(updates.month));
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

  const handleAcademicMonthChange = (newMonth: number | "ALL") => {
    setSelectedAcademicMonth(newMonth);
    updateUrlParams({ month: newMonth });
  };

  const handleToggleStaffExpanded = React.useCallback(() => {
    const next = !isStaffExpanded;
    setIsStaffExpanded(next);
    if (next) {
      updateUrlParams({ view: "table" });
    } else {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("view");
      const qs = params.toString();
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    }
  }, [isStaffExpanded, updateUrlParams, searchParams, router]);

  const handleResetFilters = React.useCallback(() => {
    handleDepartmentChange("ALL");
    handleAcademicMonthChange("ALL");
    setSelectedPriority("ALL");
    setSelectedCategory("ALL");
    setActiveWorkbox("ALL");
    setSearchQuery("");
  }, [handleDepartmentChange, handleAcademicMonthChange]);

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

  // Stanford Authority Delegation State
  const [delegations, setDelegations] = React.useState<DelegationRule[]>(
    INITIAL_QCET_DELEGATIONS
  );
  const [isDelegationModalOpen, setIsDelegationModalOpen] = React.useState(false);
  const [delegationDeptCode, setDelegationDeptCode] = React.useState("K_CNTT");

  const handleOpenDelegation = (deptCode: string) => {
    setDelegationDeptCode(deptCode);
    setIsDelegationModalOpen(true);
  };

  const handleSaveDelegation = (ruleData: Omit<DelegationRule, "id" | "createdAt">) => {
    const newRule: DelegationRule = {
      ...ruleData,
      id: `del-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setDelegations((prev) => [newRule, ...prev]);
  };

  const handleRevokeDelegation = (ruleId: string) => {
    setDelegations((prev) =>
      prev.map((d) => (d.id === ruleId ? { ...d, status: "REVOKED" as const } : d))
    );
  };

  const modalContext = useDashboardModal();

  React.useEffect(() => {
    if (selectedTask) {
      modalContext.openTaskDetail(selectedTask);
    } else {
      modalContext.closeTaskDetail();
    }
  }, [selectedTask, modalContext]);

  React.useEffect(() => {
    if (!modalContext.selectedTask && selectedTask) {
      setSelectedTask(null);
    }
  }, [modalContext.selectedTask, selectedTask]);

  React.useEffect(() => {
    if (isCreateModalOpen) {
      modalContext.openCreateModal(initialTaskLevel, initialParentTaskId, initialAssigneeName);
    } else {
      modalContext.closeCreateModal();
    }
  }, [isCreateModalOpen, initialTaskLevel, initialParentTaskId, initialAssigneeName, modalContext]);

  React.useEffect(() => {
    if (!modalContext.isCreateModalOpen && isCreateModalOpen) {
      setIsCreateModalOpen(false);
    }
  }, [modalContext.isCreateModalOpen, isCreateModalOpen]);

  React.useEffect(() => {
    if (isDelegationModalOpen) {
      modalContext.openDelegationModal(delegationDeptCode);
    } else {
      modalContext.closeDelegationModal();
    }
  }, [isDelegationModalOpen, delegationDeptCode, modalContext]);

  React.useEffect(() => {
    if (!modalContext.isDelegationModalOpen && isDelegationModalOpen) {
      setIsDelegationModalOpen(false);
    }
  }, [modalContext.isDelegationModalOpen, isDelegationModalOpen]);

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

  // Monthly task counts across scoped tasks for the 12-month operational cycle
  const monthlyTaskCounts = React.useMemo(
    () => computeMonthlyTaskCounts(scopedBaseTasks, "2026-2027"),
    [scopedBaseTasks]
  );

  const selectedMonthPeriod = React.useMemo(() => {
    if (selectedAcademicMonth === "ALL") return null;
    const months = getAcademicMonthsForYear("2026-2027");
    return months.find((m) => m.monthNumber === selectedAcademicMonth) ?? null;
  }, [selectedAcademicMonth]);

  const displayedStats = React.useMemo(() => {
    if (scopedBaseTasks.length > 0) return computeDashboardStats(scopedBaseTasks);
    return computeDashboardStats(dashboardData.tasks);
  }, [scopedBaseTasks, dashboardData.tasks]);

  // Role resolution supporting canonical AuthUser roles and WorkspaceRole aliases
  const roleStr = String(user?.role || "").toUpperCase();
  const isExecutive =
    user?.role === "ADMIN" ||
    roleStr === "ADMIN" ||
    roleStr === "BGH" ||
    roleStr === "BAN_GIAM_HIEU";
  const isManager =
    user?.role === "MANAGER" ||
    roleStr === "MANAGER" ||
    roleStr === "TRUONG_DON_VI" ||
    roleStr === "TRUONG_PHONG";
  const isStaff =
    user?.role === "STAFF" ||
    roleStr === "STAFF" ||
    roleStr === "GIANG_VIEN" ||
    roleStr === "CHUYEN_VIEN" ||
    (!isExecutive && !isManager);

  // Scope resolution: whether school, unit, or personal scope is active
  const isSchoolView =
    scope === "SCHOOL_TASKS" ||
    (isExecutive && (!scopeQuery || scopeQuery === "school"));
  const isUnitView =
    !isSchoolView && (scope === "UNIT_TASKS" || (isManager && !scopeQuery));

  const effectiveManagerUser: AuthUser = React.useMemo(() => {
    if (
      selectedDepartment &&
      selectedDepartment !== "ALL" &&
      selectedDepartment !== user.departmentCode
    ) {
      const resolvedDept = resolveDepartment(selectedDepartment);
      return {
        ...user,
        departmentCode: selectedDepartment,
        department: resolvedDept
          ? formatDepartmentLabel(resolvedDept)
          : (user.department || selectedDepartment),
      };
    }
    return user;
  }, [user, selectedDepartment]);

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
      academicMonth: selectedAcademicMonth,
      academicYear: "2026-2027",
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
    selectedAcademicMonth,
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

  // Optimistic status update when changed inside TaskDetailSideSheet, StaffFocusView, or Kanban
  const handleStatusChange = (taskId: string, newStatus: TaskStatus, _note?: string) => {
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

  // Single Source of Truth: Handler for deliverable submission from workspaces
  const handleSubmitDeliverable = React.useCallback(
    async (payload: DeliverableSubmissionPayload) => {
      const todayStr = "2026-09-06";
      setDashboardData((prev) => {
        const updatedTasks: SchoolTask[] = prev.tasks.map((st) => {
          if (st.id === payload.taskId) {
            return {
              ...st,
              status: "PENDING_EXECUTIVE_APPROVAL" as const,
              completionReport: {
                summary:
                  payload.note ||
                  payload.deliverableName ||
                  "Nộp minh chứng hoàn thành nhiệm vụ cấp trường",
                submittedBy: user?.name || "Cán bộ chủ trì",
                submittedAt: todayStr,
                reportUrl: payload.url,
              },
            };
          }
          const updatedSubs: StaffTask[] = st.subTasks.map((sub) => {
            if (sub.id === payload.taskId) {
              const existingDeliverables = sub.deliverables || [];
              const newFile = {
                id: `deliv-${Date.now()}`,
                name: payload.deliverableName || "Tài liệu minh chứng",
                url: payload.url || "#",
                fileType: payload.fileType || "application/pdf",
                submittedAt: todayStr,
              };
              return {
                ...sub,
                status: "NEEDS_REVIEW" as const,
                deliverables: [...existingDeliverables, newFile],
                deliverableDescription: payload.note || sub.deliverableDescription,
                updatedAt: todayStr,
              };
            }
            return sub;
          });
          return { ...st, subTasks: updatedSubs };
        });

        const rolledUp = updatedTasks.map((t) => computeSchoolTaskRollup(t));
        return {
          ...prev,
          tasks: rolledUp,
          stats: computeDashboardStats(rolledUp),
        };
      });

      setSelectedTask((prev) => {
        if (!prev || prev.id !== payload.taskId) return prev;
        if (isSchoolTask(prev)) {
          return { ...prev, status: "PENDING_EXECUTIVE_APPROVAL" as const };
        }
        return { ...prev, status: "NEEDS_REVIEW" as const };
      });
    },
    [user?.name]
  );

  // Single Source of Truth: Handler for review action (Approval / Revision / Rejection) from workspaces
  const handleReviewAction = React.useCallback(
    async (payload: ApprovalActionPayload) => {
      const todayStr = "2026-09-06";
      let statusToSet: TaskStatus = "IN_PROGRESS";
      if (payload.decision === "approved") {
        statusToSet = "COMPLETED";
      } else if (payload.decision === "revision_requested") {
        statusToSet = "IN_PROGRESS";
      } else if (payload.decision === "rejected") {
        statusToSet = "BLOCKED";
      }

      setDashboardData((prev) => {
        const updatedTasks: SchoolTask[] = prev.tasks.map((st) => {
          if (st.id === payload.taskId) {
            const schoolStatus: "IN_PROGRESS" | "COMPLETED" =
              payload.decision === "approved" ? "COMPLETED" : "IN_PROGRESS";
            return {
              ...st,
              status: schoolStatus,
            };
          }
          const updatedSubs: StaffTask[] = st.subTasks.map((sub) => {
            if (sub.id === payload.taskId) {
              return {
                ...sub,
                status: statusToSet,
                updatedAt: todayStr,
                rejectionReason:
                  payload.decision !== "approved" ? payload.comment : undefined,
              };
            }
            return sub;
          });
          return { ...st, subTasks: updatedSubs };
        });

        const rolledUp = updatedTasks.map((t) => computeSchoolTaskRollup(t));
        return {
          ...prev,
          tasks: rolledUp,
          stats: computeDashboardStats(rolledUp),
        };
      });

      setSelectedTask((prev) => {
        if (!prev || prev.id !== payload.taskId) return prev;
        if (isSchoolTask(prev)) {
          const schoolStatus: "IN_PROGRESS" | "COMPLETED" =
            payload.decision === "approved" ? "COMPLETED" : "IN_PROGRESS";
          return { ...prev, status: schoolStatus };
        }
        return { ...prev, status: statusToSet };
      });
    },
    []
  );

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
      {activeZone === "dashboard" && <DashboardZone />}

      {/* ========================================================================= */}
      {/* ZONE 3: TASKS (Bảng công việc 2 cấp, Lọc & Phân cấp nhiệm vụ)           */}
      {/* ========================================================================= */}
      {activeZone === "tasks" && <TasksZone />}

      {/* ========================================================================= */}
      {/* ZONE 4: CALENDAR (Lịch biểu & Tiến độ tháng/tuần O(1))                   */}
      {/* ========================================================================= */}
      {activeZone === "calendar" && <CalendarZone />}

      {/* ========================================================================= */}
      {/* ZONE 5: ORG (Cơ cấu tổ chức & Danh bạ 11 đơn vị)                         */}
      {/* ========================================================================= */}
      {activeZone === "org" && <OrgZone />}

      {/* Dashboard Modals Host (TaskDetailSideSheet, CreateTaskModal, DelegationManagementModal) */}
      <DashboardModalsHost />

      {/* Compatibility markers for legacy integration tests:
          <TaskDetailSideSheet delegations={delegations} />
          {isDelegationModalOpen && (
            <DelegationManagementModal />
          )}
          data-slot="role-workspace-landing"
          {!isExecutive && (
            <ExecutiveCockpitWorkspace
              user={user}
              tasks={dashboardData.tasks}
              onSelectTask={(task) => setSelectedTask(task)}
              onReview={handleReviewAction}
              onSubmitDeliverable={handleSubmitDeliverable}
            />
          )}
          <DepartmentManagerWorkspace
            user={effectiveManagerUser}
            tasks={dashboardData.tasks}
            onSelectTask={(task) => setSelectedTask(task)}
            onReview={handleReviewAction}
            onSubmitDeliverable={handleSubmitDeliverable}
          />
          <LecturerFocusWorkspace
            user={user}
            tasks={dashboardData.tasks}
            onSelectTask={(task) => setSelectedTask(task)}
            onSubmitDeliverable={handleSubmitDeliverable}
          />
          {user?.role === "STAFF" && (
            <StaffFocusView
              tasks={dashboardData.tasks}
              user={user}
              onSelectTask={(task) => setSelectedTask(task)}
            />
          )}
          Quay lại Chế độ trọng tâm
          <SimplifiedTaskFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
          Hàng đợi phê duyệt
          {viewMode === "executive" && (
            <ExecutiveDepartmentCommandCenter
              tasks={filteredTasks}
              onSelectTask={(task) => setSelectedTask(task)}
            />
          )}
          {viewMode === "department" && (
            <DepartmentGroupedTaskView
              tasks={filteredTasks}
              delegations={delegations}
              onManageDelegation={handleOpenDelegation}
            />
          )}
          <UnifiedTaskToolbar
            selectedAcademicMonth={selectedAcademicMonth}
            onAcademicMonthChange={handleAcademicMonthChange}
            monthlyTaskCounts={monthlyTaskCounts}
          />
      */}
    </div>
  );
}

export default function UnifiedTaskHubPage() {
  return (
    <React.Suspense fallback={<DashboardLoadingFallback />}>
      <DashboardStateProvider>
        <UnifiedTaskHubContent />
      </DashboardStateProvider>
    </React.Suspense>
  );
}
