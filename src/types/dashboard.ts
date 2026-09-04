export type TaskStatus = 'NEW' | 'IN_PROGRESS' | 'NEEDS_REVIEW' | 'COMPLETED';

export type TaskCategory =
  | 'CHUYEN_DOI_SO'
  | 'TRUYEN_THONG'
  | 'CNTT'
  | 'ATTT'
  | 'THU_VIEN'
  | 'BAO_CAO'
  | 'KHAC';

export interface StaffTask {
  id: string;
  title: string;
  assigneeName: string;
  assigneeAvatar?: string;
  status: TaskStatus;
  dueDate: string;
  parentSchoolTaskId: string;
  updatedAt: string;
}

export interface SchoolTask {
  id: string;
  title: string;
  category: TaskCategory;
  categoryLabel: string;
  leadAssigneeName: string;
  leadAssigneeAvatar?: string;
  coAssignees: string[];
  assignedDate: string;
  dueDate: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  subTasks: StaffTask[];
  totalSubTasks: number;
  completedSubTasks: number;
  progressPercent: number;
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
}

export interface DashboardPayload {
  stats: DashboardStats;
  tasks: SchoolTask[];
  upcoming: UpcomingItem[];
  activities: ActivityEvent[];
  source?: 'notion-live' | 'mock-fallback' | 'mock';
}

