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
    submittedBy?: string;
    submittedAt?: string;
    complianceScore?: number;
  }>;
  myPendingSubmissions: Array<{
    task: StaffTask;
    parentTaskTitle: string;
    dueDate?: string;
    isOverdue: boolean;
  }>;
}

export interface UnifiedAdaptiveWorkspaceProps {
  user: AuthUser;
  tasks: SchoolTask[];
  initialScope?: WorkspaceScope;
  forcedRole?: "ADMIN" | "MANAGER" | "STAFF";
  selectedDepartment?: string;
  onSelectTask: (task: SchoolTask | StaffTask) => void;
  onReview?: (payload: ApprovalActionPayload) => Promise<void> | void;
  onSubmitDeliverable?: (payload: DeliverableSubmissionPayload) => Promise<void> | void;
  onStatusChange?: (taskId: string, status: TaskStatus, note?: string) => void;
  onSendReminder?: (targetDeptOrUser: string, reason: string) => void;
  onCreateTask?: (level: "TRUONG" | "DON_VI", parentTaskId?: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}
