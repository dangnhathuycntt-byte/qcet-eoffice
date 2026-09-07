export type TaskStatus = 'NEW' | 'IN_PROGRESS' | 'BLOCKED' | 'NEEDS_REVIEW' | 'COMPLETED';

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
  title: string;
  assigneeName: string;
  assigneeId?: string;
  assigneeAvatar?: string;
  status: TaskStatus;
  dueDate: string;
  internalDueDate?: string;
  parentSchoolTaskId: string;
  updatedAt: string;
  deliverables?: DeliverableItem[];
  deliverableDescription?: string;
  vtvlRole?: string;
  blockedReason?: string;
  rejectionReason?: string;
  requiresReview?: boolean;
  departmentCode?: string;
  departmentId?: string;
  triageStatus?: TriageStatus;
  triageSourceDept?: string;
  triageRequestedBy?: string;
  triageRejectionReason?: string;
  escalation?: EscalationMeta;
  aiReview?: AIReviewSummary;
}

export interface SchoolTask {
  id: string;
  title: string;
  category: TaskCategory;
  categoryLabel: string;
  leadAssigneeName: string;
  leadAssigneeId?: string;
  leadAssigneeAvatar?: string;
  leadDepartment?: string;
  leadDepartmentCode?: string;
  leadDepartmentId?: string;
  coAssignees: string[];
  coDepartments?: string[];
  coDepartmentCodes?: string[];
  assignedDate: string;
  dueDate: string;
  status: 'IN_PROGRESS' | 'PENDING_EXECUTIVE_APPROVAL' | 'COMPLETED';
  subTasks: StaffTask[];
  totalSubTasks: number;
  completedSubTasks: number;
  progressPercent: number;
  executiveCriteria?: string;
  completionReport?: {
    summary: string;
    submittedBy: string;
    submittedAt: string;
    reportUrl?: string;
  };
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
  totalStaffTasks: number;
  staffTasksInProgress: number;
  staffTasksCompleted: number;
  needsReviewTasksCount: number;
  overdueTasksCount: number;
  averageSchoolProgressPercent: number;
  pendingTriageCount?: number;
  escalatedReviewCount?: number;
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
  source?: 'notion-live' | 'mock-fallback' | 'mock';
}

