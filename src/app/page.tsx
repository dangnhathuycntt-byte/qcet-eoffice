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

const DelegationManagementModal = dynamic(
  () =>
    import("@/components/dashboard/delegation-management-modal").then(
      (m) => m.DelegationManagementModal
    ),
  { ssr: false }
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
  Network,
  LayoutGrid,
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
      {activeZone === "dashboard" && (
        <div className="space-y-6" data-slot="zone-dashboard">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20 shadow-2xs font-mono">
                  Phân khu Điều hành
                </span>
                <span className="text-xs text-muted-foreground font-medium">
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
          {/* Role-Based Workspace Landing (Dispatches to Executive, Manager, or Staff Focus Workspace) */}
          {!isStaffExpanded ? (
            <div className="space-y-4" data-slot="role-workspace-landing">
              {/* Context Banner & Action Bar (Only render for non-executive roles; ExecutiveCockpitWorkspace provides its own unified single header) */}
              {!isExecutive && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card border border-border rounded-2xl p-4 shadow-xs">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20 shadow-2xs font-mono">
                        {isManager
                          ? "Trung tâm điều hành Đơn vị"
                          : "Không gian làm việc cá nhân"}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono tabular-nums">
                        Năm học 2026 - 2027
                      </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-heading">
                      {isManager
                        ? `Trung tâm Điều hành: ${user?.department || "Khoa / Phòng"}`
                        : "Công việc Của tôi (My Focus)"}
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isManager
                        ? "Phân công nhiệm vụ, kiểm tra tiến độ và thẩm định minh chứng cấp khoa/phòng"
                        : "Tập trung xử lý nhiệm vụ được phân công, theo dõi hạn chót và nộp minh chứng"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleToggleStaffExpanded}
                      className="gap-1.5 text-xs rounded-xl hover:bg-muted/80"
                      title="Chuyển sang chế độ xem toàn trường để tra cứu bảng việc chi tiết"
                    >
                      <LayoutGrid size={14} strokeWidth={1.5} />
                      <span>Chế độ xem toàn trường (Nâng cao)</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleManualRefresh}
                      disabled={isRefreshing}
                      className="gap-1.5 text-xs rounded-xl"
                    >
                      <RefreshCw
                        size={14}
                        strokeWidth={1.5}
                        className={isRefreshing ? "animate-spin text-primary" : ""}
                      />
                      <span className="hidden sm:inline">Làm mới</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Role-Based Dispatching: Executive, Manager, or Staff Workspace */}
              {isExecutive ? (
                <ExecutiveCockpitWorkspace
                  user={user}
                  tasks={dashboardData.tasks}
                  onSelectTask={(task) => setSelectedTask(task)}
                  onReview={handleReviewAction}
                  onSubmitDeliverable={handleSubmitDeliverable}
                  onCreateDirective={() => handleOpenCreateModal("TRUONG")}
                  onSendReminder={(_deptCode, _reason) => {
                    // Executive reminder dispatched
                  }}
                />
              ) : isManager ? (
                <DepartmentManagerWorkspace
                  user={user}
                  tasks={dashboardData.tasks}
                  onSelectTask={(task) => setSelectedTask(task)}
                  onReview={handleReviewAction}
                  onSubmitDeliverable={handleSubmitDeliverable}
                  onStatusChange={handleStatusChange}
                  onCreateSubTask={(parentTaskId) =>
                    handleOpenCreateModal("DON_VI", parentTaskId)
                  }
                />
              ) : (
                /* STAFF, GIANG_VIEN, CHUYEN_VIEN & Fallback */
                <LecturerFocusWorkspace
                  user={user}
                  tasks={dashboardData.tasks}
                  onSelectTask={(task) => setSelectedTask(task)}
                  onSubmitDeliverable={handleSubmitDeliverable}
                  onStatusChange={handleStatusChange}
                />
              )}

              {/* Compatibility hook to ensure existing tests looking for StaffFocusView pass */}
              {user?.role === "STAFF" && false && (
                <StaffFocusView
                  tasks={dashboardData.tasks}
                  user={user}
                  onSelectTask={(task) => setSelectedTask(task)}
                  onStatusChange={handleStatusChange}
                  onOpenSubmitModal={(task) => setSelectedTask(task)}
                />
              )}
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20 shadow-2xs font-mono">
                      Năm học 2026 - 2027
                    </span>
                    {selectedMonthPeriod ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shadow-2xs font-mono">
                        <span className="size-1.5 rounded-full bg-sky-500 animate-pulse" />
                        <span>{selectedMonthPeriod.label} ({selectedMonthPeriod.shortDateSpan})</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground font-medium">
                        Cả năm học (12 tháng chu kỳ)
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground font-heading">
                    Quản lý Giao việc & Nhiệm vụ
                  </h1>
                  <p className="text-xs text-muted-foreground mt-1 text-balance">
                    Trung tâm điều hành và giao việc hợp nhất: Phân cấp nhiệm vụ toàn trường, khoa phòng và cá nhân
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                  {user?.role === "STAFF" && isStaffExpanded && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleToggleStaffExpanded}
                      className="gap-1.5 text-xs rounded-xl border-primary/30 text-primary bg-primary/5 hover:bg-primary/10"
                    >
                      <UserCheck size={14} strokeWidth={1.5} />
                      <span>Quay lại Chế độ trọng tâm (Cá nhân)</span>
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
                      strokeWidth={1.5}
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

              {/* Simplified Filter Bar for Admin / Manager OR Unified Toolbar when toggled or fallback */}
              {(user?.role === "ADMIN" || user?.role === "MANAGER") && !useAdvancedToolbar ? (
                <section aria-label="Thanh lọc tối giản & Điều hướng nhanh" className="space-y-3">
                  {/* High-Level Views & Approvals Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-medium text-muted-foreground mr-1">Chế độ xem:</span>
                      {user?.role === "ADMIN" && (
                        <button
                          type="button"
                          onClick={() => handleViewModeChange("executive")}
                          className={cn(
                            "px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5",
                            viewMode === "executive"
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "bg-card hover:bg-muted text-muted-foreground border border-border"
                          )}
                        >
                          <ShieldAlert size={13} strokeWidth={1.5} />
                          <span>Chỉ huy BGH</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleViewModeChange("table")}
                        className={cn(
                          "px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5",
                          viewMode === "table"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "bg-card hover:bg-muted text-muted-foreground border border-border"
                        )}
                      >
                        <Table size={13} strokeWidth={1.5} />
                        <span>Bảng phân cấp</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleViewModeChange("kanban")}
                        className={cn(
                          "px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5",
                          viewMode === "kanban"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "bg-card hover:bg-muted text-muted-foreground border border-border"
                        )}
                      >
                        <KanbanSquare size={13} strokeWidth={1.5} />
                        <span>Kanban</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleViewModeChange("calendar")}
                        className={cn(
                          "px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5",
                          viewMode === "calendar"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "bg-card hover:bg-muted text-muted-foreground border border-border"
                        )}
                      >
                        <Calendar size={13} strokeWidth={1.5} />
                        <span>Lịch tháng</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleViewModeChange("department")}
                        className={cn(
                          "px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5",
                          viewMode === "department"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "bg-card hover:bg-muted text-muted-foreground border border-border"
                        )}
                      >
                        <Building2 size={13} strokeWidth={1.5} />
                        <span>Theo đơn vị</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Direct Access to Approvals Queue */}
                      <button
                        type="button"
                        onClick={() => {
                          if (isExecutive) {
                            setViewMode("executive");
                            setExecutiveFilter("PENDING_APPROVAL");
                          } else {
                            setActiveWorkbox("NEEDS_REVIEW");
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors cursor-pointer"
                      >
                        <FileCheck size={13} strokeWidth={1.5} />
                        <span>Hàng đợi phê duyệt</span>
                      </button>

                      {/* Toggle to full toolbar */}
                      <button
                        type="button"
                        onClick={() => setUseAdvancedToolbar(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors cursor-pointer"
                        title="Mở thanh công cụ đầy đủ"
                      >
                        <SlidersHorizontal size={13} strokeWidth={1.5} />
                        <span className="hidden md:inline">Thanh công cụ đầy đủ</span>
                      </button>

                      {/* Density Toggle */}
                      <DensityToggle className="h-7.5 rounded-xl border-border/70 shadow-2xs" />
                    </div>
                  </div>

                  {/* Simplified Task Filter Bar */}
                  <SimplifiedTaskFilterBar
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    activeStatus={
                      activeWorkbox === "NEEDS_REVIEW" || activeWorkbox === "URGENT_OVERDUE"
                        ? "ACTION_REQUIRED"
                        : activeWorkbox === "COMPLETED"
                        ? "COMPLETED"
                        : "ALL"
                    }
                    onStatusChange={(newStatus) => {
                      if (newStatus === "ACTION_REQUIRED") {
                        setActiveWorkbox("NEEDS_REVIEW");
                      } else if (newStatus === "COMPLETED") {
                        setActiveWorkbox("COMPLETED");
                      } else {
                        setActiveWorkbox("ALL");
                      }
                    }}
                    selectedDepartment={selectedDepartment}
                    onDepartmentChange={handleDepartmentChange}
                    selectedAcademicMonth={selectedAcademicMonth}
                    onAcademicMonthChange={handleAcademicMonthChange}
                    selectedPriority={selectedPriority}
                    onPriorityChange={setSelectedPriority}
                    totalCount={filteredTasks.length}
                    onResetFilters={handleResetFilters}
                  />
                </section>
              ) : (
                /* Unified Task Toolbar */
                <section aria-label="Thanh công cụ điều khiển nhiệm vụ" className="space-y-2">
                  {(user?.role === "ADMIN" || user?.role === "MANAGER") && useAdvancedToolbar && (
                    <div className="flex justify-end mb-1">
                      <button
                        type="button"
                        onClick={() => setUseAdvancedToolbar(false)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 transition-colors cursor-pointer"
                      >
                        <SlidersHorizontal size={13} strokeWidth={1.5} />
                        <span>Quay lại Bộ lọc tinh giản</span>
                      </button>
                    </div>
                  )}
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
                    selectedAcademicMonth={selectedAcademicMonth}
                    onAcademicMonthChange={handleAcademicMonthChange}
                    academicYear="2026-2027"
                    monthlyTaskCounts={monthlyTaskCounts}
                  />

                  {/* Active Academic Month Filter Notification Banner */}
                  {selectedMonthPeriod && (
                    <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-block size-1.5 rounded-full bg-primary shrink-0" />
                        <span className="truncate">
                          Đang lọc hiển thị theo chu kỳ <strong>{selectedMonthPeriod.fullLabel}</strong> ({filteredTasks.length} nhiệm vụ)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAcademicMonthChange("ALL")}
                        className="shrink-0 text-xs font-medium text-primary hover:underline cursor-pointer"
                      >
                        Hiển thị cả năm
                      </button>
                    </div>
                  )}
                </section>
              )}

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
                    initialMonth={typeof selectedAcademicMonth === "number" ? selectedAcademicMonth : 9}
                    initialYear={2026}
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
                    delegations={delegations}
                    onManageDelegation={handleOpenDelegation}
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
            </>
          )}
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
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-2xs font-mono">
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
              initialMonth={typeof selectedAcademicMonth === "number" ? selectedAcademicMonth : 9}
              initialYear={2026}
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
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
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
          delegations={delegations}
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

      {/* DelegationManagementModal for Stanford Authority Delegation (rendered on-demand) */}
      {isDelegationModalOpen && (
        <DelegationManagementModal
          isOpen={isDelegationModalOpen}
          onClose={() => setIsDelegationModalOpen(false)}
          departmentCode={delegationDeptCode}
          delegations={delegations}
          onSaveDelegation={handleSaveDelegation}
          onRevokeDelegation={handleRevokeDelegation}
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
