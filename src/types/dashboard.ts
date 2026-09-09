export type TaskStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'WAITING_APPROVAL'
  | 'PENDING_EXECUTIVE_APPROVAL'
  | 'NEEDS_REVIEW'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'NEW';

export type TaskCategory =
  | 'CHUYEN_DOI_SO'
  | 'TRUYEN_THONG'
  | 'CNTT'
  | 'ATTT'
  | 'THU_VIEN'
  | 'BAO_CAO'
  | 'KHAC';

export type AIRiskStatus = 'CLEAN' | 'NEEDS_ATTENTION' | 'HIGH_RISK';
export type AISuggestedAction = 'QUICK_APPROVE' | 'REQUEST_CHANGES' | 'MANUAL_INSPECT';
export type TriageStatus = 'NONE' | 'PENDING_TRIAGE' | 'ACCEPTED' | 'REJECTED';

export interface AIFlagItem {
  type: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
}

export interface AIReviewSummary {
  status: AIRiskStatus;
  executiveSummary: string;
  complianceScore: number;
  dacumCriteriaMatched: string[];
  flags: AIFlagItem[];
  suggestedAction: AISuggestedAction;
  analyzedAt: string;
  suggestedFeedback?: string;
}

export interface EscalationMeta {
  submittedForReviewAt?: string;
  reviewDeadline?: string;
  isEscalated?: boolean;
  escalatedAt?: string;
  escalatedToRole?: 'ADMIN';
  escalationNote?: string;
}

export interface DeliverableItem {
  id: string;
  name: string;
  url?: string;
  fileType?: string;
  submittedAt?: string;
}

export interface StaffTask {
  id: string;
  code?: string;
  title: string;
  assigneeName: string;
  assigneeId?: string;
  assigneeAvatar?: string;
  status: TaskStatus;
  dueDate: string;
  internalDueDate?: string;
  parentSchoolTaskId?: string;
  parentSchoolTaskTitle?: string;
  parentSchoolTaskCode?: string;
  parentTaskScope?: string;
  parentTask?: {
    id: string;
    code?: string;
    title: string;
    scope?: string;
  };
  updatedAt: string;
  deliverables?: DeliverableItem[];
  deliverableDescription?: string;
  vtvlRole?: string;
  blockedReason?: string;
  rejectionReason?: string;
  requiresReview?: boolean;
  department?: string;
  departmentCode?: string;
  assignedTo?: string;
  departmentId?: string;
  triageStatus?: TriageStatus;
  triageSourceDept?: string;
  triageRequestedBy?: string;
  triageRejectionReason?: string;
  escalation?: EscalationMeta;
  aiReview?: AIReviewSummary;
  collaborators?: {
    id: string;
    name: string;
    avatarUrl?: string;
    role?: string;
  }[];
  coAssignees?: {
    id: string;
    name: string;
    avatarUrl?: string;
    role?: string;
  }[];
  subItems?: {
    id: string;
    title: string;
    assigneeId?: string;
    assigneeName?: string;
    dueDate?: string;
    status: TaskStatus;
  }[];
  progressPercent?: number;
}

export type TaskOrigin = 'SCHOOL' | 'SELF_INITIATED';

export interface SchoolTask {
  id: string;
  taskCode?: string;
  code?: string;
  title: string;
  description?: string;
  category: TaskCategory;
  categoryLabel: string;
  academicMonth?: number;
  academicYear?: string;
  status: TaskStatus;
  priority?: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  dueDate: string;
  startDate?: string;
  progressPercent: number;
  totalSubTasks: number;
  completedSubTasks: number;
  leadDepartment?: string;
  leadDepartmentCode?: string;
  leadDepartmentId?: string;
  department?: string;
  departmentCode?: string;
  departmentId?: string;
  assignedTo?: string;
  leadAssigneeName: string;
  leadAssigneeId?: string;
  leadAssigneeAvatar?: string;
  coAssignees: string[];
  coDepartments?: string[];
  coDepartmentCodes?: string[];
  assignedDate: string;
  subTasks: StaffTask[];
  executiveCriteria?: string;
  origin?: TaskOrigin;
  vtvlRole?: string;
  parentTaskId?: string;
  parentTaskTitle?: string;
  parentTaskCode?: string;
  parentTask?: {
    id: string;
    code: string;
    title: string;
    scope?: string;
  };
  dacumTaskDefId?: string;
  dacumTaskDef?: {
    id: string;
    code: string;
    title: string;
    standardHours?: number;
    dutyTitle?: string;
  };
  completionReport?: {
    summary: string;
    submittedBy: string;
    submittedAt: string;
    reportUrl?: string;
  };
}

export function isSchoolTask(task: unknown): task is SchoolTask {
  if (!task || typeof task !== "object") return false;
  return "taskCode" in task || ("subTasks" in task && Array.isArray((task as { subTasks: unknown }).subTasks));
}

export interface CollaborationRequest {
  id: string;
  schoolTaskId: string;
  schoolTaskTitle: string;
  fromDeptCode: string;
  fromDeptName: string;
  toDeptCode: string;
  toDeptName: string;
  requestedBy: string;
  description: string;
  requiredDeliverables: string;
  dueDate: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  assignedStaffIds?: string[];
  rejectionReason?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalSchoolTasks: number;
  schoolTasksInProgress: number;
  schoolTasksCompleted: number;
  schoolTasksNotStarted?: number;
  schoolTasksWaitingApproval?: number;
  schoolTasksOverdue?: number;
  totalStaffTasks: number;
  staffTasksInProgress: number;
  staffTasksCompleted: number;
  staffTasksNotStarted?: number;
  staffTasksWaitingApproval?: number;
  staffTasksOverdue?: number;
  needsReviewTasksCount: number;
  overdueTasksCount: number;
  averageSchoolProgressPercent: number;
  completionRate?: number;
  cancelledTasksCount?: number;
  pendingTriageCount?: number;
  escalatedReviewCount?: number;

  // Real-time server aggregator stats
  totalTasks?: number;
  inProgressTasks?: number;
  completedTasks?: number;
  overdueTasks?: number;
  pendingApprovals?: number;
}

export interface ActivityEvent {
  id: string;
  actorName: string;
  action: string;
  targetTitle: string;
  timestamp: string;
  category: TaskCategory;
}

export interface UpcomingItem {
  id: string;
  title: string;
  dueDate: string;
  assigneeName: string;
  assigneeAvatar?: string;
  level: 'Trường' | 'Đơn vị';
  category?: TaskCategory;
  isOverdue?: boolean;
  /** The real task/subtask ID this item corresponds to, for side-sheet lookup */
  taskId?: string;
}

export interface DashboardPayload {
  stats: DashboardStats;
  tasks: SchoolTask[];
  upcoming: UpcomingItem[];
  activities: ActivityEvent[];
  source?: 'notion-live' | 'mock-fallback' | 'mock' | 'database';
  departmentHealth?: any[];
  syncTimestamp?: string;
}

export type { DepartmentPersonnel, DepartmentPersonnelGroup } from "@/lib/departments";

