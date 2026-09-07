export interface SchoolTask {
  id: string;
  title: string;
  description: string;
  department: string;
  assignedTo: string;
  dueDate: string;
  status: 'not_started' | 'in_progress' | 'waiting_approval' | 'completed' | 'overdue' | 'cancelled' | string;
  priority: 'urgent' | 'high' | 'medium' | 'low' | string;
  progress: number;
  academicMonth: number;
  collaborators?: string[];
  category: string;
  academicYear?: string;
  [key: string]: any;
}

export interface PrismaTaskWithRelations {
  id: string;
  code: string;
  title: string;
  description: string | null;
  scope: string;
  status: string;
  priority: string;
  progressPercent: number;
  academicMonth: number;
  academicYear: string;
  startDate: Date;
  dueDate: Date;
  completedAt?: Date | null;
  departmentId: string | null;
  department?: {
    id: string;
    name: string;
    shortName?: string | null;
  } | null;
  assignees?: {
    userId: string;
    roleInTask: string;
    user?: {
      name: string;
      avatarUrl?: string | null;
    } | null;
  }[];
  deliverables?: {
    id: string;
    title: string;
    fileUrl: string;
    reviewStatus: string;
  }[];
}

export interface PrismaTaskCreateInput {
  title: string;
  description: string | null;
  scope: 'SCHOOL' | 'DEPARTMENT' | 'INDIVIDUAL';
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'WAITING_APPROVAL' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  progressPercent: number;
  academicMonth: number;
  academicYear: string;
  dueDate: Date;
  createdById: string;
  departmentId?: string | null;
  [key: string]: any;
}

export function mapPrismaTaskToSchoolTask(raw: PrismaTaskWithRelations): SchoolTask {
  // Tìm người chủ trì chính
  const primaryOwner = raw.assignees?.find(a => a.roleInTask === 'PRIMARY_OWNER');
  const collaborators = raw.assignees
    ?.filter(a => a.roleInTask === 'COLLABORATOR')
    .map(a => a.user?.name || '')
    .filter(Boolean);

  // Ánh xạ trạng thái chuẩn hóa
  const statusMap: Record<string, SchoolTask['status']> = {
    NOT_STARTED: 'not_started',
    IN_PROGRESS: 'in_progress',
    WAITING_APPROVAL: 'waiting_approval',
    COMPLETED: 'completed',
    OVERDUE: 'overdue',
    CANCELLED: 'cancelled'
  };

  // Ánh xạ độ ưu tiên
  const priorityMap: Record<string, SchoolTask['priority']> = {
    URGENT: 'urgent',
    HIGH: 'high',
    NORMAL: 'medium',
    LOW: 'low'
  };

  const isoDueDate = raw.dueDate instanceof Date
    ? raw.dueDate.toISOString().split('T')[0]
    : String(raw.dueDate).split('T')[0];

  return {
    id: raw.id,
    title: raw.title,
    description: raw.description || '',
    department: raw.department?.name || 'Chưa phân bổ',
    assignedTo: primaryOwner?.user?.name || 'Chưa phân công',
    dueDate: isoDueDate,
    status: statusMap[raw.status] || 'in_progress',
    priority: priorityMap[raw.priority] || 'medium',
    progress: raw.progressPercent ?? 0,
    academicMonth: raw.academicMonth ?? 9,
    collaborators: collaborators && collaborators.length > 0 ? collaborators : undefined,
    category: raw.scope === 'SCHOOL' ? 'Chỉ đạo cấp Trường' : 'Chuyên môn Khoa/Phòng'
  };
}

export function mapSchoolTaskToPrismaCreateInput(
  task: Partial<SchoolTask>,
  creatorId: string,
  departmentId?: string
): PrismaTaskCreateInput {
  const reverseStatusMap: Record<string, PrismaTaskCreateInput['status']> = {
    not_started: 'NOT_STARTED',
    in_progress: 'IN_PROGRESS',
    waiting_approval: 'WAITING_APPROVAL',
    completed: 'COMPLETED',
    overdue: 'OVERDUE',
    cancelled: 'CANCELLED'
  };

  const reversePriorityMap: Record<string, PrismaTaskCreateInput['priority']> = {
    urgent: 'URGENT',
    high: 'HIGH',
    medium: 'NORMAL',
    normal: 'NORMAL',
    low: 'LOW'
  };

  const scope: PrismaTaskCreateInput['scope'] =
    task.category === 'Chỉ đạo cấp Trường' ? 'SCHOOL' : 'DEPARTMENT';

  const dueDate = task.dueDate ? new Date(task.dueDate) : new Date();

  return {
    title: task.title || '',
    description: task.description || null,
    scope,
    status: (task.status && reverseStatusMap[task.status]) || 'NOT_STARTED',
    priority: (task.priority && reversePriorityMap[task.priority]) || 'NORMAL',
    progressPercent: task.progress ?? 0,
    academicMonth: task.academicMonth ?? 9,
    academicYear: task.academicYear || '2026-2027',
    dueDate,
    createdById: creatorId,
    departmentId: departmentId || (task as any).departmentId || null,
  };
}
