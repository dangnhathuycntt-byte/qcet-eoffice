import type { AuthUser } from "@/types/auth";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import type { DeliverableSubmissionPayload, ApprovalActionPayload } from "@/types/workspace";

export type WorkspaceScope = "school" | "unit" | "my";
export type ViewMode = "table" | "kanban";

export interface AdaptiveWorkspaceMetrics {
  totalTasks: number;
  urgentOverdueCount: number;
  waitingApprovalCount: number;
  completedRate: number;
  labelScope: string;
  totalParentTasks?: number;
  totalSubtasks?: number;
  totalWorkItems?: number;
}

export interface UniversalActionQueueItems {
  pendingApprovals: Array<{
    task: SchoolTask | StaffTask;
    parentTaskTitle?: string;
    parentTaskCode?: string;
    parentTaskId?: string;
    submittedBy?: string;
    submittedAt?: string;
    complianceScore?: number;
    actionTypeBadge?: string;
  }>;
  myPendingSubmissions: Array<{
    task: SchoolTask | StaffTask;
    parentTaskTitle?: string;
    parentTaskCode?: string;
    parentTaskId?: string;
    dueDate?: string;
    isOverdue: boolean;
    actionTypeBadge?: string;
  }>;
}

export interface UnifiedAdaptiveWorkspaceProps {
  workspaceQuery?: import('@/hooks/use-workspace-query').UseWorkspaceQueryReturn;
  user?: AuthUser;
  tasks?: SchoolTask[];
  initialTasks?: SchoolTask[];
  scope?: WorkspaceScope;
  initialScope?: WorkspaceScope;
  forcedScope?: WorkspaceScope;
  onScopeChange?: (scope: WorkspaceScope) => void;
  forcedRole?: "ADMIN" | "MANAGER" | "STAFF";
  selectedDepartment?: string;
  contextTitle?: string;
  contextBadge?: string;
  initialLoading?: boolean;
  isLoading?: boolean;
  isOffline?: boolean;
  errorMessage?: string | null;
  hideScopeSwitcher?: boolean;
  className?: string;
  viewMode?: ViewMode;
  initialViewMode?: ViewMode;
  onViewModeChange?: (viewMode: ViewMode) => void;
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onReview?: (payload: ApprovalActionPayload) => Promise<void> | void;
  onSubmitDeliverable?: (payload: DeliverableSubmissionPayload) => Promise<void> | void;
  onStatusChange?: (taskId: string, status: TaskStatus, note?: string) => Promise<void> | void;
  onSendReminder?: (targetDeptOrUser: string, reason: string) => void;
  onCreateTask?: (scope: WorkspaceScope | "TRUONG" | "DON_VI", parentTaskId?: string) => void;
  onCreateSubtask?: (parentTaskId: string) => void;
  onRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean;
  onAction?: (action: string, payload?: unknown) => void;
  activeStatus?: TaskStatus | string;
  searchQuery?: string;
  isOverdueOnly?: boolean;
  activeWorkbox?: string;
  onDepartmentChange?: (dept?: string) => void;
  onStatusFilterChange?: (status?: string) => void;
  onSearchChange?: (query: string) => void;
  onOverdueFilterChange?: (overdue: boolean) => void;
  onWorkboxChange?: (workbox?: string) => void;
  onResetFilters?: () => void;
  enableSplitCockpit?: boolean;
  disableInternalDetail?: boolean;
  selectedTaskId?: string;
}
