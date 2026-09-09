import type { AuthUser } from "@/types/auth";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import type { DeliverableSubmissionPayload, ApprovalActionPayload } from "@/types/workspace";

export type WorkspaceScope = "school" | "unit" | "my";

export interface AdaptiveWorkspaceMetrics {
  totalTasks: number;
  urgentOverdueCount: number;
  waitingApprovalCount: number;
  completedRate: number;
  labelScope: string;
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
  user: AuthUser;
  tasks: SchoolTask[];
  initialScope?: WorkspaceScope;
  forcedScope?: WorkspaceScope;
  forcedRole?: "ADMIN" | "MANAGER" | "STAFF";
  selectedDepartment?: string;
  contextTitle?: string;
  contextBadge?: string;
  initialLoading?: boolean;
  isLoading?: boolean;
  isOffline?: boolean;
  errorMessage?: string | null;
  hideScopeSwitcher?: boolean;
  onSelectTask: (task: SchoolTask | StaffTask) => void;
  onReview?: (payload: ApprovalActionPayload) => Promise<void> | void;
  onSubmitDeliverable?: (payload: DeliverableSubmissionPayload) => Promise<void> | void;
  onStatusChange?: (taskId: string, status: TaskStatus, note?: string) => void;
  onSendReminder?: (targetDeptOrUser: string, reason: string) => void;
  onCreateTask?: (scope: WorkspaceScope | "TRUONG" | "DON_VI", parentTaskId?: string) => void;
  onCreateSubtask?: (parentTaskId: string) => void;
  onRefresh?: () => void;
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
}
