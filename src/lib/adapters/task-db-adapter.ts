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
  parentTaskId?: string | null;
  parentTask?: {
    id: string;
    code: string;
    title: string;
    scope?: string;
  } | null;
  subTasks?: any[];
  /** Canonical ReBAC actors (Phase 9: replaces the dropped `assignees` relation). */
  actors?: {
    userId?: string | null;
    role: string;
    isPrimaryDRI: boolean;
    user?: {
      id?: string;
      name: string;
      avatarUrl?: string | null;
    } | null;
  }[];
  /** Canonical unit ownership (Phase 9: replaces the dropped `department` relation). */
  leadUnit?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
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
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'WAITING_APPROVAL' | 'COMPLETED' | 'CANCELLED';
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  progressPercent: number;
  academicMonth: number;
  academicYear: string;
  dueDate: Date;
  createdById: string;
  /** Canonical unit ownership — `Task.departmentId` was dropped in Phase 9. */
  leadUnitId?: string | null;
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

/**
 * Resolve the task's primary DRI from canonical ReBAC actors.
 * Prefers the row flagged `isPrimaryDRI`, falling back to any `DRI` row for
 * records written before the single-primary-DRI invariant was enforced.
 */
export function findPrimaryActor(
  actors: PrismaTaskWithRelations['actors']
): NonNullable<PrismaTaskWithRelations['actors']>[number] | undefined {
  if (!Array.isArray(actors)) return undefined;
  return actors.find((a) => a.isPrimaryDRI) || actors.find((a) => a.role === 'DRI');
}

export function mapPrismaTaskToStaffTask(raw: PrismaTaskWithRelations): StaffTask {
  const primaryOwner = findPrimaryActor(raw.actors);

  const assigneeName = primaryOwner?.user?.name || 'Chưa phân công';
  const assigneeId = primaryOwner?.user?.id || primaryOwner?.userId || undefined;
  const assigneeAvatar = primaryOwner?.user?.avatarUrl || undefined;

  // Subtasks/leaf tasks have no manual collaborators; collaborators are derived only on parent tasks
  const collaborators: any[] = [];

  const statusMap: Record<string, TaskStatus> = {
    NOT_STARTED: 'NEW',
    NEW: 'NEW',
    IN_PROGRESS: 'IN_PROGRESS',
    WAITING_APPROVAL: 'NEEDS_REVIEW',
    NEEDS_REVIEW: 'NEEDS_REVIEW',
    COMPLETED: 'COMPLETED',
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
    department: raw.leadUnit?.name || undefined,
    departmentCode: raw.leadUnit?.code || raw.leadUnit?.id || undefined,
    departmentId: raw.leadUnit?.id || undefined,
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
  // Tìm người chủ trì chính (Single DRI) từ canonical ReBAC actors
  const primaryOwner = findPrimaryActor(raw.actors);
  // Canonical derived collaborators:
  // "Phối hợp của task cha = tập unique Primary DRI/Chủ trì của các nhiệm vụ con active."
  // - Khi tạo task con và giao cho B → B tự xuất hiện trong Phối hợp của task cha.
  // - Khi task con đổi DRI B → C → parent tự phản ánh C.
  // - Nếu một người phụ trách nhiều task con → chỉ xuất hiện một lần.
  // - Nếu DRI task con trùng DRI task cha → không duplicate vào Phối hợp.
  // - Khi task con bị cancel/archive/re-parent → recompute.
  // - Chỉ tính các task con còn active theo lifecycle canonical (status !== 'CANCELLED', !archivedAt).
  const parentLeadId = (primaryOwner?.user as any)?.id || primaryOwner?.userId;
  const parentLeadName = (primaryOwner?.user?.name || '').trim().toLowerCase();

  const collaboratorMap = new Map<string, string>();
  if (Array.isArray(raw.subTasks)) {
    for (const st of raw.subTasks) {
      if (!st || typeof st !== 'object') continue;
      const s = String(st.status || '').toUpperCase();
      if (s === 'CANCELLED' || s === 'CANCELED') continue;
      if (st.archivedAt) continue;

      let subLeadId: string | undefined;
      let subLeadName: string | undefined;

      // Check actors
      if (Array.isArray(st.actors)) {
        const dri = st.actors.find((a: any) => a && (a.role === 'DRI' || a.isPrimaryDRI) && (a.user || a.userId));
        if (dri) {
          subLeadId = dri.userId || dri.user?.id;
          subLeadName = dri.user?.name || dri.userName;
        }
      }

      // Fallback
      if (!subLeadName && (st.assigneeName || st.leadAssigneeName)) {
        subLeadId = st.assigneeId || st.leadAssigneeId;
        subLeadName = st.assigneeName || st.leadAssigneeName;
      }

      if (!subLeadName) continue;

      // Do not duplicate parent's own DRI
      if (parentLeadId && subLeadId && subLeadId === parentLeadId) continue;
      if (parentLeadName && subLeadName.trim().toLowerCase() === parentLeadName) continue;

      const key = subLeadId || subLeadName.trim().toLowerCase();
      if (!collaboratorMap.has(key)) {
        collaboratorMap.set(key, subLeadName);
      }
    }
  }

  const collaborators = Array.from(collaboratorMap.values());

  // Ánh xạ trạng thái chuẩn hóa (chuẩn TaskStatus viết hoa)
  const statusMap: Record<string, TaskStatus> = {
    NOT_STARTED: 'NOT_STARTED',
    IN_PROGRESS: 'IN_PROGRESS',
    WAITING_APPROVAL: 'WAITING_APPROVAL',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    not_started: 'NOT_STARTED',
    in_progress: 'IN_PROGRESS',
    waiting_approval: 'WAITING_APPROVAL',
    completed: 'COMPLETED',
    cancelled: 'CANCELLED',
    NEW: 'NOT_STARTED',
    NEEDS_REVIEW: 'WAITING_APPROVAL',
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
    department: raw.leadUnit?.name || 'Chưa phân bổ',
    assignedTo: primaryOwner?.user?.name || 'Chưa phân công',
    leadAssigneeName: primaryOwner?.user?.name || 'Chưa phân công',
    leadAssigneeId: primaryOwner?.user?.id || primaryOwner?.userId || undefined,
    leadAssigneeAvatar: primaryOwner?.user?.avatarUrl || undefined,
    leadDepartment: raw.leadUnit?.name,
    leadDepartmentCode: raw.leadUnit?.code || raw.leadUnit?.id,
    leadDepartmentId: raw.leadUnit?.id,
    departmentId: raw.leadUnit?.id || undefined,
    departmentCode: raw.leadUnit?.code || raw.leadUnit?.id || undefined,
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
  leadUnitId?: string
): PrismaTaskCreateInput {
  const reverseStatusMap: Record<string, PrismaTaskCreateInput['status']> = {
    not_started: 'NOT_STARTED',
    in_progress: 'IN_PROGRESS',
    waiting_approval: 'WAITING_APPROVAL',
    completed: 'COMPLETED',
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
    leadUnitId: leadUnitId || (task as any).leadUnitId || null,
  };
}
