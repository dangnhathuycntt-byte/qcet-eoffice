import type { StaffTask, TaskStatus, TaskPriority } from '@/types/dashboard';
import { isTaskOverdue, getSystemReferenceDateStr } from '@/lib/academic-calendar';

export interface SchoolTask {
  id: string;
  code?: string;
  taskCode?: string;
  title: string;
  description: string;
  department: string;
  assignedTo: string;
  leadAssigneeName?: string;
  leadAssigneeId?: string;
  leadAssigneeAvatar?: string;
  leadDepartment?: string;
  leadDepartmentCode?: string;
  leadDepartmentId?: string;
  dueDate: string;
  assignedDate?: string;
  status: 'not_started' | 'in_progress' | 'waiting_approval' | 'completed' | 'overdue' | 'cancelled' | string;
  priority: 'urgent' | 'high' | 'medium' | 'low' | string;
  progress: number;
  progressPercent?: number;
  academicMonth: number;
  collaborators?: string[];
  coAssignees?: string[];
  category: string;
  categoryLabel?: string;
  academicYear?: string;
  parentTaskId?: string;
  parentTaskTitle?: string;
  parentTaskCode?: string;
  parentTask?: {
    id: string;
    code: string;
    title: string;
    scope?: string;
  };
  subTasks?: any[];
  totalSubTasks?: number;
  completedSubTasks?: number;
  isOverdue?: boolean;
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
  updatedAt?: Date | string | null;
  completedAt?: Date | null;
  departmentId: string | null;
  parentTaskId?: string | null;
  parentTask?: {
    id: string;
    code: string;
    title: string;
    scope?: string;
  } | null;
  subTasks?: any[];
  department?: {
    id: string;
    name: string;
    shortName?: string | null;
  } | null;
  assignees?: {
    userId: string;
    roleInTask: string;
    user?: {
      id?: string;
      name: string;
      avatarUrl?: string | null;
    } | null;
  }[];
  deliverables?: {
    id: string;
    title: string;
    fileUrl: string;
    reviewStatus: string;
    createdAt?: Date | string;
    submittedAt?: Date | string;
  }[];
  dacumTaskDefId?: string | null;
  dacumTaskDef?: {
    id: string;
    code: string;
    title: string;
    criteria?: string | null;
    tools?: string | null;
    requiredDeliverables?: string | null;
    standardHours?: number;
    duty?: {
      id: string;
      code: string;
      title: string;
    } | null;
  } | null;
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

export function formatLocalDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(dateObj);
}

export function mapPrismaTaskToStaffTask(raw: PrismaTaskWithRelations): StaffTask {
  const primaryOwner = raw.assignees?.find(a => a.roleInTask === 'PRIMARY_OWNER');
  const collaboratorAssignees = raw.assignees?.filter(a => a.roleInTask === 'COLLABORATOR') || [];

  const assigneeName = primaryOwner?.user?.name || 'Chưa phân công';
  const assigneeId = (primaryOwner?.user as any)?.id || primaryOwner?.userId || undefined;
  const assigneeAvatar = primaryOwner?.user?.avatarUrl || undefined;

  const collaborators = collaboratorAssignees
    .map(a => ({
      id: (a.user as any)?.id || a.userId,
      name: a.user?.name || '',
      avatarUrl: a.user?.avatarUrl || undefined,
      role: 'COLLABORATOR' as const
    }))
    .filter(c => c.name);

  const statusMap: Record<string, TaskStatus> = {
    NOT_STARTED: 'NEW',
    NEW: 'NEW',
    IN_PROGRESS: 'IN_PROGRESS',
    WAITING_APPROVAL: 'NEEDS_REVIEW',
    NEEDS_REVIEW: 'NEEDS_REVIEW',
    COMPLETED: 'COMPLETED',
    OVERDUE: 'BLOCKED',
    BLOCKED: 'BLOCKED',
    CANCELLED: 'BLOCKED'
  };

  const status: TaskStatus = statusMap[raw.status] || 'IN_PROGRESS';
  const isoDueDate = formatLocalDate(raw.dueDate);
  const updatedAt = raw.updatedAt ? formatLocalDate(raw.updatedAt) : formatLocalDate(new Date());

  const parentSchoolTaskId = raw.parentTaskId || raw.parentTask?.id || undefined;
  const parentSchoolTaskTitle = raw.parentTask?.title || undefined;
  const parentSchoolTaskCode = raw.parentTask?.code || undefined;
  const parentTaskScope = raw.parentTask?.scope || undefined;

  return {
    id: raw.id,
    code: raw.code,
    title: raw.title,
    assigneeName,
    assigneeId,
    assigneeAvatar,
    assignedTo: assigneeName,
    status,
    startDate: formatLocalDate(raw.startDate),
    dueDate: isoDueDate,
    internalDueDate: isoDueDate,
    parentSchoolTaskId: parentSchoolTaskId || '',
    parentSchoolTaskTitle,
    parentSchoolTaskCode,
    parentTaskScope,
    updatedAt,
    department: raw.department?.name || undefined,
    departmentCode: (raw.department as any)?.shortName || raw.department?.id || raw.departmentId || undefined,
    departmentId: raw.departmentId || raw.department?.id || undefined,
    deliverableDescription: raw.description || '',
    deliverables: (raw.deliverables || []).map((d: any) => ({
      id: d.id,
      name: d.title,
      url: d.fileUrl,
      fileType: 'application/pdf',
      submittedAt: formatLocalDate(d.createdAt || d.submittedAt || new Date())
    })),
    requiresReview: (raw.dacumTaskDefId != null) || raw.scope === 'SCHOOL',
    collaborators,
    coAssignees: collaborators,
    progressPercent: raw.progressPercent ?? 0,
  };
}

export function mapPrismaTaskToSchoolTask(raw: PrismaTaskWithRelations, referenceDate?: string): SchoolTask {
  // Tìm người chủ trì chính (Single DRI)
  const primaryOwner = raw.assignees?.find(a => a.roleInTask === 'PRIMARY_OWNER');
  const collaboratorAssignees = raw.assignees?.filter(a => a.roleInTask === 'COLLABORATOR') || [];
  const collaborators = collaboratorAssignees
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

  // Ánh xạ độ ưu tiên chuẩn hóa (chuẩn TaskPriority viết hoa)
  const priorityMap: Record<string, SchoolTask['priority']> = {
    URGENT: 'URGENT',
    HIGH: 'HIGH',
    NORMAL: 'NORMAL',
    LOW: 'LOW',
    urgent: 'URGENT',
    high: 'HIGH',
    medium: 'NORMAL',
    normal: 'NORMAL',
    low: 'LOW',
  };

  const isoDueDate = formatLocalDate(raw.dueDate);

  // Ánh xạ danh sách nhiệm vụ con (subTasks)
  const mappedSubTasks: StaffTask[] = (raw.subTasks || []).map((st: any) => {
    if (st && typeof st === 'object' && ('assigneeName' in st || 'internalDueDate' in st)) {
      return {
        ...st,
        parentSchoolTaskId: st.parentSchoolTaskId || raw.id,
        parentSchoolTaskTitle: st.parentSchoolTaskTitle || raw.title,
        parentSchoolTaskCode: st.parentSchoolTaskCode || raw.code,
        parentTaskScope: st.parentTaskScope || raw.scope,
      };
    }
    const staff = mapPrismaTaskToStaffTask(st);
    staff.parentSchoolTaskId = staff.parentSchoolTaskId || raw.id;
    staff.parentSchoolTaskTitle = staff.parentSchoolTaskTitle || raw.title;
    staff.parentSchoolTaskCode = staff.parentSchoolTaskCode || raw.code;
    staff.parentTaskScope = staff.parentTaskScope || raw.scope;
    return staff;
  });

  const totalSubTasks = raw.subTasks ? raw.subTasks.length : 0;
  const completedSubTasks = mappedSubTasks.filter(
    (s: any) => s.status === 'COMPLETED' || s.status === 'completed'
  ).length;

  // Rollup progress: nếu raw.progressPercent là 0 (hoặc chưa gán) nhưng có subtasks thì rollup
  let progress = raw.progressPercent ?? 0;
  if (progress === 0 && mappedSubTasks.length > 0) {
    const totalSubProgress = mappedSubTasks.reduce((acc: number, st: any) => {
      const isCompleted = st.status === 'COMPLETED' || st.status === 'completed';
      const p = isCompleted ? 100 : (st.progressPercent ?? st.progress ?? 0);
      return acc + (typeof p === 'number' ? p : 0);
    }, 0);
    progress = Math.round(totalSubProgress / mappedSubTasks.length);
  }

  const parentTaskId = raw.parentTaskId || raw.parentTask?.id || undefined;
  const parentTaskTitle = raw.parentTask?.title || undefined;
  const parentTaskCode = raw.parentTask?.code || undefined;

  return {
    id: raw.id,
    code: raw.code,
    taskCode: raw.code,
    title: raw.title,
    description: raw.description || '',
    department: raw.department?.name || 'Chưa phân bổ',
    assignedTo: primaryOwner?.user?.name || 'Chưa phân công',
    leadAssigneeName: primaryOwner?.user?.name || 'Chưa phân công',
    leadAssigneeId: (primaryOwner?.user as any)?.id || primaryOwner?.userId || undefined,
    leadAssigneeAvatar: primaryOwner?.user?.avatarUrl || undefined,
    leadDepartment: raw.department?.name,
    leadDepartmentCode: raw.department?.id,
    leadDepartmentId: raw.department?.id,
    departmentId: raw.departmentId || raw.department?.id || undefined,
    departmentCode: (raw.department as any)?.shortName || raw.department?.id || undefined,
    // Đồng bộ chính xác ngày bắt đầu và hạn chót cho chi tiết nhiệm vụ
    startDate: formatLocalDate(raw.startDate),
    dueDate: isoDueDate,
    assignedDate: formatLocalDate(raw.startDate || new Date()),
    status: statusMap[raw.status] || 'in_progress',
    priority: (priorityMap[raw.priority] || (raw.priority as any) || 'NORMAL') as TaskPriority,
    progress,
    progressPercent: progress,
    academicMonth: raw.academicMonth ?? 9,
    academicYear: raw.academicYear || '2026-2027',
    scope: raw.scope,
    collaborators: collaborators && collaborators.length > 0 ? collaborators : undefined,
    coAssignees: collaborators,
    category: raw.scope === 'SCHOOL' ? 'Chỉ đạo cấp Trường' : 'Chuyên môn Khoa/Phòng',
    categoryLabel: raw.scope === 'SCHOOL' ? 'Chỉ đạo cấp Trường' : 'Chuyên môn Khoa/Phòng',
    parentTaskId,
    parentTaskTitle,
    parentTaskCode,
    parentTask: raw.parentTask || undefined,
    subTasks: raw.subTasks ? mappedSubTasks : undefined,
    totalSubTasks,
    completedSubTasks,
    dacumTaskDefId: raw.dacumTaskDefId || undefined,
    dacumTaskDef: raw.dacumTaskDef ? {
      id: raw.dacumTaskDef.id,
      code: raw.dacumTaskDef.code,
      title: raw.dacumTaskDef.title,
      criteria: raw.dacumTaskDef.criteria || undefined,
      tools: raw.dacumTaskDef.tools || undefined,
      requiredDeliverables: raw.dacumTaskDef.requiredDeliverables || undefined,
      standardHours: raw.dacumTaskDef.standardHours || 0,
      dutyTitle: raw.dacumTaskDef.duty?.title,
    } : undefined,
    isOverdue: isTaskOverdue(raw.status, raw.dueDate, referenceDate || getSystemReferenceDateStr()),
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
