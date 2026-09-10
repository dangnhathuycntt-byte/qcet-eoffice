"use client";

import * as React from "react";
import type {
  SchoolTask,
  StaffTask,
  UpcomingItem,
  DashboardStats,
  TaskStatus,
  ActivityEvent,
  DashboardPayload,
} from "@/types/dashboard";
import type { WorkspaceZone, DeliverableSubmissionPayload, ApprovalActionPayload } from "@/types/workspace";
import type { TaskScope, TaskViewMode } from "@/components/dashboard/unified-task-toolbar";
import type { AuthUser } from "@/types/auth";
import type { WorkboxFilter } from "@/components/dashboard/executive-stat-strip";
import type { ExecutiveFilter, ExecutiveActionStats, DepartmentHealthSummary, ExecutiveActionItem } from "@/lib/executive-matrix-aggregator";
import type { DelegationRule } from "@/types/delegation";
import type { CreateTaskFormData } from "@/components/dashboard/create-task-modal";
import type { AcademicMonthInfo } from "@/lib/academic-calendar";
import { useModalState } from "@/hooks/use-modal-state";
import { useDashboardState } from "@/hooks/use-dashboard-state";

// 1. Navigation Context
export interface DashboardNavContextValue {
  activeZone: WorkspaceZone;
  scope: TaskScope;
  viewMode: TaskViewMode;
  isStaffExpanded: boolean;
  useAdvancedToolbar: boolean;
  handleZoneChange: (zone: WorkspaceZone) => void;
  handleScopeChange: (scope: TaskScope) => void;
  handleViewModeChange: (view: TaskViewMode) => void;
  handleToggleStaffExpanded: () => void;
  setIsStaffExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  setUseAdvancedToolbar: React.Dispatch<React.SetStateAction<boolean>>;
}

export const DashboardNavContext = React.createContext<DashboardNavContextValue | null>(null);

export function useDashboardNav(): DashboardNavContextValue {
  const context = React.useContext(DashboardNavContext);
  if (!context) {
    throw new Error("useDashboardNav must be used within a DashboardStateProvider");
  }
  return context;
}

// 2. Data Context
export interface DashboardDataContextValue {
  tasks: SchoolTask[];
  stats: DashboardStats;
  upcoming: UpcomingItem[];
  activities: ActivityEvent[];
  filteredTasks: SchoolTask[];
  scopedBaseTasks: SchoolTask[];
  monthScopedBaseTasks?: SchoolTask[];
  priorOverdueBacklog?: SchoolTask[];
  monthlyTaskCounts: Record<number, number>;
  selectedMonthPeriod: AcademicMonthInfo | null;
  displayedStats: DashboardStats;
  user: AuthUser | null;
  effectiveManagerUser: AuthUser | null;
  isExecutive: boolean;
  isManager: boolean;
  isStaff: boolean;
  isUnitView: boolean;
  isSchoolView: boolean;
  selectedDepartment: string;
  selectedAcademicMonth: number | "ALL";
  activeWorkbox: WorkboxFilter;
  executiveFilter: ExecutiveFilter;
  searchQuery: string;
  selectedPriority: string;
  selectedCategory: string;
  departmentHealth: DepartmentHealthSummary[];
  executiveStats: ExecutiveActionStats | null;
  executiveActionItems?: ExecutiveActionItem[];
  roleUpcoming: UpcomingItem[];
  parentSchoolTaskTitle?: string;
  delegations: DelegationRule[];
  delegationDeptCode: string;
  isRefreshing: boolean;
}

export const DashboardDataContext = React.createContext<DashboardDataContextValue | null>(null);

export function useDashboardData(): DashboardDataContextValue {
  const context = React.useContext(DashboardDataContext);
  if (!context) {
    throw new Error("useDashboardData must be used within a DashboardStateProvider");
  }
  return context;
}

export function useOptionalDashboardData(): DashboardDataContextValue | null {
  return React.useContext(DashboardDataContext);
}

// 3. Actions Context
export interface DashboardActionsContextValue {
  handleDepartmentChange: (dept: string) => void;
  handleAcademicMonthChange: (month: number | "ALL") => void;
  setActiveWorkbox: React.Dispatch<React.SetStateAction<WorkboxFilter>>;
  setExecutiveFilter: React.Dispatch<React.SetStateAction<ExecutiveFilter>>;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setSelectedPriority: React.Dispatch<React.SetStateAction<string>>;
  setSelectedCategory: React.Dispatch<React.SetStateAction<string>>;
  handleResetFilters: () => void;
  handleStatusChange: (taskId: string, newStatus: TaskStatus, note?: string) => void;
  handleSubmitDeliverable: (payload: DeliverableSubmissionPayload) => Promise<void>;
  handleReviewAction: (payload: ApprovalActionPayload) => Promise<void>;
  handleCreateTask: (data: CreateTaskFormData) => void;
  handleManualRefresh: () => Promise<void>;
  handleSaveDelegation: (ruleData: Omit<DelegationRule, "id" | "createdAt">) => void;
  handleRevokeDelegation: (ruleId: string) => void;
  handleSelectUpcoming: (item: UpcomingItem) => SchoolTask | StaffTask | undefined;
}

export const DashboardActionsContext = React.createContext<DashboardActionsContextValue | null>(null);

export function useDashboardActions(): DashboardActionsContextValue {
  const context = React.useContext(DashboardActionsContext);
  if (!context) {
    throw new Error("useDashboardActions must be used within a DashboardStateProvider");
  }
  return context;
}

export function useOptionalDashboardActions(): DashboardActionsContextValue | null {
  return React.useContext(DashboardActionsContext);
}

// 4. Modal Context
export interface DashboardModalContextValue {
  selectedTask: SchoolTask | StaffTask | null;
  isCreateModalOpen: boolean;
  initialTaskLevel: "TRUONG" | "DON_VI";
  initialParentTaskId?: string;
  initialAssigneeName?: string;
  initialTitle?: string;
  isDelegationModalOpen: boolean;
  delegationDeptCode: string;
  openTaskDetail: (task: SchoolTask | StaffTask) => void;
  closeTaskDetail: () => void;
  openCreateModal: (
    level?: "TRUONG" | "DON_VI",
    parentId?: string,
    assigneeName?: string,
    initialTitle?: string
  ) => void;
  closeCreateModal: () => void;
  openDelegationModal: (deptCode?: string) => void;
  closeDelegationModal: () => void;
}

export const DashboardModalContext = React.createContext<DashboardModalContextValue | null>(null);

export function useDashboardModal(): DashboardModalContextValue {
  const context = React.useContext(DashboardModalContext);
  if (!context) {
    throw new Error("useDashboardModal must be used within a DashboardStateProvider");
  }
  return context;
}

// Top-Level Provider
export function DashboardStateProvider({
  children,
  initialData,
}: {
  children: React.ReactNode;
  initialData?: DashboardPayload;
}) {
  const modalState = useModalState();
  const dashboardState = useDashboardState(
    modalState.openTaskDetail,
    modalState.openCreateModal,
    initialData
  );

  // Synchronize status change with modal selected task
  const handleStatusChangeWithSync = React.useCallback(
    (taskId: string, newStatus: TaskStatus, note?: string) => {
      dashboardState.handleStatusChange(taskId, newStatus, note);
      modalState.setSelectedTask((prev) => {
        if (!prev || prev.id !== taskId) return prev;
        if ("subTasks" in prev) {
          const schoolStatus: "IN_PROGRESS" | "COMPLETED" =
            newStatus === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";
          return { ...prev, status: schoolStatus };
        }
        return { ...prev, status: newStatus };
      });
    },
    [dashboardState.handleStatusChange, modalState.setSelectedTask]
  );

  const handleSubmitDeliverableWithSync = React.useCallback(
    async (payload: DeliverableSubmissionPayload) => {
      await dashboardState.handleSubmitDeliverable(payload);
      modalState.setSelectedTask((prev) => {
        if (!prev || prev.id !== payload.taskId) return prev;
        if ("subTasks" in prev) {
          return { ...prev, status: "PENDING_EXECUTIVE_APPROVAL" as const };
        }
        return { ...prev, status: "NEEDS_REVIEW" as const };
      });
    },
    [dashboardState.handleSubmitDeliverable, modalState.setSelectedTask]
  );

  const handleReviewActionWithSync = React.useCallback(
    async (payload: ApprovalActionPayload) => {
      await dashboardState.handleReviewAction(payload);
      let statusToSet: TaskStatus = "IN_PROGRESS";
      if (payload.decision === "approved") {
        statusToSet = "COMPLETED";
      } else if (payload.decision === "revision_requested") {
        statusToSet = "IN_PROGRESS";
      } else if (payload.decision === "rejected") {
        statusToSet = "BLOCKED";
      }

      modalState.setSelectedTask((prev) => {
        if (!prev || prev.id !== payload.taskId) return prev;
        if ("subTasks" in prev) {
          const schoolStatus: "IN_PROGRESS" | "COMPLETED" =
            payload.decision === "approved" ? "COMPLETED" : "IN_PROGRESS";
          return { ...prev, status: schoolStatus };
        }
        return { ...prev, status: statusToSet };
      });
    },
    [dashboardState.handleReviewAction, modalState.setSelectedTask]
  );

  const parentSchoolTaskTitle = React.useMemo(() => {
    if (!modalState.selectedTask || "subTasks" in modalState.selectedTask) return undefined;
    const parent = dashboardState.tasks.find(
      (t) => t.id === (modalState.selectedTask as StaffTask).parentSchoolTaskId
    );
    return parent?.title;
  }, [modalState.selectedTask, dashboardState.tasks]);

  // Global listener for opening task detail from external triggers (e.g. CommandSearchModal)
  React.useEffect(() => {
    const handleOpenTaskDetail = (e: Event) => {
      const customEvent = e as CustomEvent<{ task?: SchoolTask | StaffTask; taskId?: string }>;
      if (customEvent.detail?.task) {
        modalState.openTaskDetail(customEvent.detail.task);
      } else if (customEvent.detail?.taskId && dashboardState.tasks) {
        const id = customEvent.detail.taskId;
        const found = dashboardState.tasks.find((t) => t.id === id);
        if (found) {
          modalState.openTaskDetail(found);
        } else {
          for (const parent of dashboardState.tasks) {
            const sub = parent.subTasks?.find((s) => s.id === id);
            if (sub) {
              modalState.openTaskDetail(sub);
              break;
            }
          }
        }
      }
    };
    window.addEventListener("qcet:open-task-detail", handleOpenTaskDetail);
    return () => window.removeEventListener("qcet:open-task-detail", handleOpenTaskDetail);
  }, [modalState.openTaskDetail, dashboardState.tasks]);

  // 1. Nav value: Stable unless activeZone, scope, viewMode, or view toggles change
  const navValue = React.useMemo<DashboardNavContextValue>(
    () => ({
      activeZone: dashboardState.activeZone,
      scope: dashboardState.scope,
      viewMode: dashboardState.viewMode,
      isStaffExpanded: dashboardState.isStaffExpanded,
      useAdvancedToolbar: dashboardState.useAdvancedToolbar,
      handleZoneChange: dashboardState.handleZoneChange,
      handleScopeChange: dashboardState.handleScopeChange,
      handleViewModeChange: dashboardState.handleViewModeChange,
      handleToggleStaffExpanded: dashboardState.handleToggleStaffExpanded,
      setIsStaffExpanded: dashboardState.setIsStaffExpanded,
      setUseAdvancedToolbar: dashboardState.setUseAdvancedToolbar,
    }),
    [
      dashboardState.activeZone,
      dashboardState.scope,
      dashboardState.viewMode,
      dashboardState.isStaffExpanded,
      dashboardState.useAdvancedToolbar,
      dashboardState.handleZoneChange,
      dashboardState.handleScopeChange,
      dashboardState.handleViewModeChange,
      dashboardState.handleToggleStaffExpanded,
      dashboardState.setIsStaffExpanded,
      dashboardState.setUseAdvancedToolbar,
    ]
  );

  // 2. Data value: Re-rendered when datasets or filter conditions change
  const dataValue = React.useMemo<DashboardDataContextValue>(
    () => ({
      tasks: dashboardState.tasks,
      stats: dashboardState.stats,
      upcoming: dashboardState.upcoming,
      activities: dashboardState.activities,
      filteredTasks: dashboardState.filteredTasks,
      scopedBaseTasks: dashboardState.scopedBaseTasks,
      monthScopedBaseTasks: dashboardState.monthScopedBaseTasks,
      priorOverdueBacklog: dashboardState.priorOverdueBacklog,
      monthlyTaskCounts: dashboardState.monthlyTaskCounts,
      selectedMonthPeriod: dashboardState.selectedMonthPeriod,
      displayedStats: dashboardState.displayedStats,
      user: dashboardState.user,
      effectiveManagerUser: dashboardState.effectiveManagerUser,
      isExecutive: dashboardState.isExecutive,
      isManager: dashboardState.isManager,
      isStaff: dashboardState.isStaff,
      isUnitView: dashboardState.isUnitView,
      isSchoolView: dashboardState.isSchoolView,
      selectedDepartment: dashboardState.selectedDepartment,
      selectedAcademicMonth: dashboardState.selectedAcademicMonth,
      activeWorkbox: dashboardState.activeWorkbox,
      executiveFilter: dashboardState.executiveFilter,
      searchQuery: dashboardState.searchQuery,
      selectedPriority: dashboardState.selectedPriority,
      selectedCategory: dashboardState.selectedCategory,
      departmentHealth: dashboardState.departmentHealth,
      executiveStats: dashboardState.executiveStats,
      executiveActionItems: dashboardState.executiveActionItems,
      roleUpcoming: dashboardState.roleUpcoming,
      parentSchoolTaskTitle,
      delegations: dashboardState.delegations,
      delegationDeptCode: dashboardState.delegationDeptCode,
      isRefreshing: dashboardState.isRefreshing,
    }),
    [
      dashboardState.tasks,
      dashboardState.stats,
      dashboardState.upcoming,
      dashboardState.activities,
      dashboardState.filteredTasks,
      dashboardState.scopedBaseTasks,
      dashboardState.monthScopedBaseTasks,
      dashboardState.priorOverdueBacklog,
      dashboardState.monthlyTaskCounts,
      dashboardState.selectedMonthPeriod,
      dashboardState.displayedStats,
      dashboardState.user,
      dashboardState.effectiveManagerUser,
      dashboardState.isExecutive,
      dashboardState.isManager,
      dashboardState.isStaff,
      dashboardState.isUnitView,
      dashboardState.isSchoolView,
      dashboardState.selectedDepartment,
      dashboardState.selectedAcademicMonth,
      dashboardState.activeWorkbox,
      dashboardState.executiveFilter,
      dashboardState.searchQuery,
      dashboardState.selectedPriority,
      dashboardState.selectedCategory,
      dashboardState.departmentHealth,
      dashboardState.executiveStats,
      dashboardState.executiveActionItems,
      dashboardState.roleUpcoming,
      parentSchoolTaskTitle,
      dashboardState.delegations,
      dashboardState.delegationDeptCode,
      dashboardState.isRefreshing,
    ]
  );

  // 3. Actions value: Properly tracked references to avoid stale closures
  const actionsValue = React.useMemo<DashboardActionsContextValue>(
    () => ({
      handleDepartmentChange: dashboardState.handleDepartmentChange,
      handleAcademicMonthChange: dashboardState.handleAcademicMonthChange,
      setActiveWorkbox: dashboardState.setActiveWorkbox,
      setExecutiveFilter: dashboardState.setExecutiveFilter,
      setSearchQuery: dashboardState.setSearchQuery,
      setSelectedPriority: dashboardState.setSelectedPriority,
      setSelectedCategory: dashboardState.setSelectedCategory,
      handleResetFilters: dashboardState.handleResetFilters,
      handleStatusChange: handleStatusChangeWithSync,
      handleSubmitDeliverable: handleSubmitDeliverableWithSync,
      handleReviewAction: handleReviewActionWithSync,
      handleCreateTask: dashboardState.handleCreateTask,
      handleManualRefresh: dashboardState.handleManualRefresh,
      handleSaveDelegation: dashboardState.handleSaveDelegation,
      handleRevokeDelegation: dashboardState.handleRevokeDelegation,
      handleSelectUpcoming: dashboardState.handleSelectUpcoming,
    }),
    [
      dashboardState.handleDepartmentChange,
      dashboardState.handleAcademicMonthChange,
      dashboardState.setActiveWorkbox,
      dashboardState.setExecutiveFilter,
      dashboardState.setSearchQuery,
      dashboardState.setSelectedPriority,
      dashboardState.setSelectedCategory,
      dashboardState.handleResetFilters,
      handleStatusChangeWithSync,
      handleSubmitDeliverableWithSync,
      handleReviewActionWithSync,
      dashboardState.handleCreateTask,
      dashboardState.handleManualRefresh,
      dashboardState.handleSaveDelegation,
      dashboardState.handleRevokeDelegation,
      dashboardState.handleSelectUpcoming,
    ]
  );

  // 4. Modal value: Re-rendered only when modal target/state changes
  const modalValue = React.useMemo<DashboardModalContextValue>(
    () => ({
      selectedTask: modalState.selectedTask,
      isCreateModalOpen: modalState.isCreateModalOpen,
      initialTaskLevel: modalState.initialTaskLevel,
      initialParentTaskId: modalState.initialParentTaskId,
      initialAssigneeName: modalState.initialAssigneeName,
      initialTitle: modalState.initialTitle,
      isDelegationModalOpen: modalState.isDelegationModalOpen,
      delegationDeptCode: modalState.delegationDeptCode,
      openTaskDetail: modalState.openTaskDetail,
      closeTaskDetail: modalState.closeTaskDetail,
      openCreateModal: modalState.openCreateModal,
      closeCreateModal: modalState.closeCreateModal,
      openDelegationModal: modalState.openDelegationModal,
      closeDelegationModal: modalState.closeDelegationModal,
    }),
    [
      modalState.selectedTask,
      modalState.isCreateModalOpen,
      modalState.initialTaskLevel,
      modalState.initialParentTaskId,
      modalState.initialAssigneeName,
      modalState.initialTitle,
      modalState.isDelegationModalOpen,
      modalState.delegationDeptCode,
      modalState.openTaskDetail,
      modalState.closeTaskDetail,
      modalState.openCreateModal,
      modalState.closeCreateModal,
      modalState.openDelegationModal,
      modalState.closeDelegationModal,
    ]
  );

  return (
    <DashboardNavContext.Provider value={navValue}>
      <DashboardDataContext.Provider value={dataValue}>
        <DashboardActionsContext.Provider value={actionsValue}>
          <DashboardModalContext.Provider value={modalValue}>
            {children}
          </DashboardModalContext.Provider>
        </DashboardActionsContext.Provider>
      </DashboardDataContext.Provider>
    </DashboardNavContext.Provider>
  );
}
