/**
 * Canonical Mappers for Task Domain Models, API DTOs, and UI ViewModels.
 *
 * Provides pure, bidirectional mappings:
 * Prisma Record -> TaskDomainModel -> TaskDTO -> TaskViewModel (SchoolTask)
 */

import type {
  TaskDomainModel,
  TaskAssigneeDomain,
  TaskDeliverableDomain,
  TaskDTO,
  TaskAssigneeDTO,
  TaskDeliverableDTO,
  TaskViewModel,
  DomainTaskScope,
  DomainTaskStatus,
  DomainTaskPriority,
  DomainAssigneeRole,
  DomainDeliverableStatus,
} from './types';
import { formatLocalDate } from '../../lib/adapters/task-db-adapter';
import {
  getSystemReferenceDate,
  getSystemReferenceDateStr,
  isTaskPastDue,
  isTaskOverdue,
  getAcademicYear,
} from '../../lib/academic-calendar';

export { getSystemReferenceDate, getSystemReferenceDateStr, isTaskPastDue, isTaskOverdue };
export * from './canonical-semantics';
export * from './attention-resolver';

export function toTaskAssigneeDomain(raw: any): TaskAssigneeDomain {
  const roleInTask: DomainAssigneeRole =
    raw.roleInTask === 'PRIMARY_OWNER' ? 'PRIMARY_OWNER' : 'COLLABORATOR';

  const userName =
    raw.user?.name || raw.userName || raw.name || 'Chưa phân công';

  const userAvatar =
    raw.user?.avatarUrl !== undefined ? raw.user.avatarUrl : raw.userAvatar ?? raw.avatarUrl ?? null;

  const userId =
    raw.userId || raw.user?.id || raw.id || '';

  return {
    userId,
    roleInTask,
    userName,
    userAvatar,
  };
}

/**
 * Map a canonical ReBAC `TaskActor` row onto the legacy assignee domain shape.
 *
 * Phase 9 dropped `TaskAssignee`; the domain model keeps the `PRIMARY_OWNER` /
 * `COLLABORATOR` vocabulary so downstream FSM, SoD and attention logic stay
 * unchanged, but the data now comes from `TaskActor`.
 */
export function toTaskAssigneeDomainFromActor(actor: any): TaskAssigneeDomain {
  return {
    userId: actor?.userId || actor?.user?.id || '',
    roleInTask:
      actor?.isPrimaryDRI === true || actor?.role === 'DRI' || actor?.role === 'PRIMARY_OWNER'
        ? 'PRIMARY_OWNER'
        : 'COLLABORATOR',
    userName: actor?.user?.name || actor?.userName || 'Chưa phân công',
    userAvatar: actor?.user?.avatarUrl ?? actor?.userAvatar ?? null,
  };
}

export function toTaskDeliverableDomain(raw: any, taskIdFallback?: string): TaskDeliverableDomain {
  const reviewStatus: DomainDeliverableStatus =
    raw.reviewStatus === 'APPROVED'
      ? 'APPROVED'
      : raw.reviewStatus === 'REJECTED'
      ? 'REJECTED'
      : raw.reviewStatus === 'REVISION_REQUIRED'
      ? 'REVISION_REQUIRED'
      : 'PENDING';

  return {
    id: raw.id,
    taskId: raw.taskId || taskIdFallback || '',
    title: raw.title || '',
    fileUrl: raw.fileUrl || '',
    fileName: raw.fileName || null,
    fileType: raw.fileType || null,
    fileSize: raw.fileSize || null,
    reviewStatus,
    reviewNote: raw.reviewNote || null,
    uploadedById: raw.uploadedById || null,
    uploadedByName: raw.uploadedBy?.name || raw.uploadedByName || null,
    createdAt: raw.createdAt || new Date(),
    submittedAt: raw.submittedAt || raw.createdAt || null,
  };
}

export function toTaskDomainModel(raw: any, referenceDate?: string): TaskDomainModel {
  if (!raw) {
    throw new Error('Cannot map null or undefined raw task to domain model');
  }

  // Map Assignees — canonical ReBAC `actors` are authoritative; the dropped
  // `assignees` relation is only kept as a shape fallback for legacy callers.
  const assignees: TaskAssigneeDomain[] = Array.isArray(raw.actors) && raw.actors.length > 0
    ? raw.actors.map(toTaskAssigneeDomainFromActor)
    : (Array.isArray(raw.assignees) ? raw.assignees : []).map(toTaskAssigneeDomain);

  const primaryOwner =
    assignees.find((a) => a.roleInTask === 'PRIMARY_OWNER') ||
    (raw.primaryOwner ? toTaskAssigneeDomain(raw.primaryOwner) : null);

  const collaborators = assignees.filter((a) => a.roleInTask === 'COLLABORATOR');

  // Map Deliverables
  const rawDeliverables = Array.isArray(raw.deliverables) ? raw.deliverables : [];
  const deliverables: TaskDeliverableDomain[] = rawDeliverables.map((d: any) =>
    toTaskDeliverableDomain(d, raw.id)
  );

  // Map Subtasks recursively if present
  let subTasks: TaskDomainModel[] | undefined;
  if (Array.isArray(raw.subTasks) && raw.subTasks.length > 0) {
    subTasks = raw.subTasks.map((st: any) => toTaskDomainModel(st, referenceDate));
  }

  const totalSubTasks =
    typeof raw.totalSubTasks === 'number'
      ? raw.totalSubTasks
      : subTasks
      ? subTasks.length
      : 0;

  const completedSubTasks =
    typeof raw.completedSubTasks === 'number'
      ? raw.completedSubTasks
      : subTasks
      ? subTasks.filter(
          (s) => s.status === 'COMPLETED' || (s.status as string) === 'completed'
        ).length
      : 0;

  // Overdue status check
  const dueDateStr = formatLocalDate(raw.dueDate);
  const refDate = referenceDate || getSystemReferenceDateStr();
  const isOverdue = isTaskOverdue(raw.status, raw.dueDate, refDate);

  const scope: DomainTaskScope =
    raw.scope === 'SCHOOL' || raw.scope === 'school'
      ? 'SCHOOL'
      : raw.scope === 'INDIVIDUAL' || raw.scope === 'individual'
      ? 'INDIVIDUAL'
      : 'DEPARTMENT';

  const status: DomainTaskStatus =
    raw.status === 'COMPLETED' || raw.status === 'completed'
      ? 'COMPLETED'
      : raw.status === 'WAITING_APPROVAL' ||
        raw.status === 'waiting_approval' ||
        raw.status === 'PENDING_EXECUTIVE_APPROVAL' ||
        raw.status === 'pending_executive_approval'
      ? 'WAITING_APPROVAL'
      : raw.status === 'CANCELLED' || raw.status === 'cancelled'
      ? 'CANCELLED'
      : raw.status === 'OVERDUE' || raw.status === 'overdue'
      ? 'OVERDUE'
      : raw.status === 'NOT_STARTED' || raw.status === 'not_started'
      ? 'NOT_STARTED'
      : 'IN_PROGRESS';

  const priority: DomainTaskPriority =
    raw.priority === 'URGENT' || raw.priority === 'urgent'
      ? 'URGENT'
      : raw.priority === 'HIGH' || raw.priority === 'high'
      ? 'HIGH'
      : raw.priority === 'LOW' || raw.priority === 'low'
      ? 'LOW'
      : 'NORMAL';

  const parentTask = raw.parentTask
    ? {
        id: raw.parentTask.id,
        code: raw.parentTask.code || '',
        title: raw.parentTask.title || '',
        scope: raw.parentTask.scope,
      }
    : null;

  return {
    id: raw.id,
    code: raw.code || '',
    title: raw.title || '',
    description: raw.description ?? null,
    scope,
    status,
    priority,
    progressPercent: typeof raw.progressPercent === 'number' ? raw.progressPercent : 0,
    dueDate: dueDateStr,
    startDate: raw.startDate ? formatLocalDate(raw.startDate) : null,
    completedAt: raw.completedAt ? formatLocalDate(raw.completedAt) : null,
    academicMonth: typeof raw.academicMonth === 'number' ? raw.academicMonth : 9,
    academicYear: raw.academicYear || getAcademicYear(dueDateStr || getSystemReferenceDate()),
    // Phase 9: unit ownership is canonical `leadUnit` (the `department` relation was dropped).
    departmentId: raw.leadUnitId ?? raw.leadUnit?.id ?? raw.departmentId ?? null,
    departmentName: raw.leadUnit?.name ?? raw.department?.name ?? null,
    departmentCode: raw.leadUnit?.code ?? raw.leadUnit?.shortName ?? raw.department?.shortName ?? null,
    createdById: raw.createdById ?? '',
    parentTaskId: raw.parentTaskId ?? raw.parentTask?.id ?? null,
    parentTask,
    assignees,
    primaryOwner,
    collaborators,
    deliverables,
    subTasks,
    totalSubTasks,
    completedSubTasks,
    dacumTaskDefId: raw.dacumTaskDefId ?? null,
    dacumDutyId: raw.dacumTaskDef?.duty?.id ?? null,
    dacumDutyCode: raw.dacumTaskDef?.duty?.code ?? null,
    dacumTaskDefCode: raw.dacumTaskDef?.code ?? null,
    dacumTaskDefTitle: raw.dacumTaskDef?.title ?? null,
    isOverdue,
    requiresReview: Boolean(raw.dacumTaskDefId || scope === 'SCHOOL'),
  };
}

export function toTaskDTO(domain: TaskDomainModel): TaskDTO {
  const primaryOwner: TaskAssigneeDTO | null = domain.primaryOwner
    ? {
        userId: domain.primaryOwner.userId,
        roleInTask: domain.primaryOwner.roleInTask,
        name: domain.primaryOwner.userName,
        avatarUrl: domain.primaryOwner.userAvatar,
      }
    : null;

  const collaborators: TaskAssigneeDTO[] = domain.collaborators.map((c) => ({
    userId: c.userId,
    roleInTask: c.roleInTask,
    name: c.userName,
    avatarUrl: c.userAvatar,
  }));

  const deliverables: TaskDeliverableDTO[] = domain.deliverables.map((d) => ({
    id: d.id,
    taskId: d.taskId,
    title: d.title,
    fileUrl: d.fileUrl,
    fileName: d.fileName,
    fileType: d.fileType,
    fileSize: d.fileSize,
    reviewStatus: d.reviewStatus,
    reviewNote: d.reviewNote,
    uploadedById: d.uploadedById,
    uploadedByName: d.uploadedByName,
    submittedAt: d.submittedAt ? String(d.submittedAt) : null,
  }));

  return {
    id: domain.id,
    code: domain.code,
    title: domain.title,
    description: domain.description,
    scope: domain.scope,
    status: domain.status,
    priority: domain.priority,
    progressPercent: domain.progressPercent,
    dueDate: domain.dueDate,
    startDate: domain.startDate,
    completedAt: domain.completedAt,
    academicMonth: domain.academicMonth,
    academicYear: domain.academicYear,
    departmentId: domain.departmentId,
    departmentName: domain.departmentName,
    departmentCode: domain.departmentCode,
    createdById: domain.createdById,
    parentTaskId: domain.parentTaskId,
    parentTask: domain.parentTask,
    primaryOwner,
    collaborators,
    deliverables,
    subTasks: domain.subTasks ? domain.subTasks.map(toTaskDTO) : undefined,
    totalSubTasks: domain.totalSubTasks,
    completedSubTasks: domain.completedSubTasks,
    isOverdue: domain.isOverdue,
    requiresReview: domain.requiresReview,
  };
}

export function toTaskViewModel(task: TaskDomainModel | TaskDTO | any): TaskViewModel {
  // If task is not already a domain model or DTO with primaryOwner, convert to domain model first
  const domain: TaskDomainModel =
    'primaryOwner' in task && 'isOverdue' in task && 'assignees' in task
      ? (task as TaskDomainModel)
      : toTaskDomainModel(task);

  const statusMap: Record<string, any> = {
    NOT_STARTED: 'not_started',
    IN_PROGRESS: 'in_progress',
    WAITING_APPROVAL: 'waiting_approval',
    PENDING_EXECUTIVE_APPROVAL: 'pending_executive_approval',
    COMPLETED: 'completed',
    OVERDUE: 'overdue',
    CANCELLED: 'cancelled',
    not_started: 'not_started',
    in_progress: 'in_progress',
    waiting_approval: 'waiting_approval',
    pending_executive_approval: 'pending_executive_approval',
    completed: 'completed',
    overdue: 'overdue',
    cancelled: 'cancelled',
  };

  const priorityMap: Record<string, any> = {
    URGENT: 'urgent',
    HIGH: 'high',
    NORMAL: 'medium',
    LOW: 'low',
    urgent: 'urgent',
    high: 'high',
    normal: 'medium',
    low: 'low',
  };

  const primaryName = domain.primaryOwner?.userName || 'Chưa phân công';
  const primaryId = domain.primaryOwner?.userId || undefined;
  const primaryAvatar = domain.primaryOwner?.userAvatar || undefined;

  const mappedSubTasks = (domain.subTasks || []).map((st) => toTaskViewModel(st));

  // Compute progress with rollup if parent progress is 0 but has subtasks
  let progress = domain.progressPercent;
  if (progress === 0 && mappedSubTasks.length > 0) {
    const totalSubProgress = mappedSubTasks.reduce((acc, st) => {
      const isCompleted = (st.status as string) === 'COMPLETED' || (st.status as string) === 'completed';
      const p = isCompleted ? 100 : (st.progressPercent ?? st.progress ?? 0);
      return acc + (typeof p === 'number' ? p : 0);
    }, 0);
    progress = Math.round(totalSubProgress / mappedSubTasks.length);
  }

  const category =
    domain.scope === 'SCHOOL'
      ? 'Chỉ đạo cấp Trường'
      : domain.scope === 'DEPARTMENT'
      ? 'Chuyên môn Khoa/Phòng'
      : 'Công việc Cá nhân';

  return {
    id: domain.id,
    code: domain.code,
    taskCode: domain.code,
    title: domain.title,
    description: domain.description || '',
    department: domain.departmentName || 'Chưa phân bổ',
    assignedTo: primaryName,
    leadAssigneeName: primaryName,
    leadAssigneeId: primaryId,
    leadAssigneeAvatar: primaryAvatar,
    leadDepartment: domain.departmentName || undefined,
    leadDepartmentCode: domain.departmentCode || undefined,
    leadDepartmentId: domain.departmentId || undefined,
    departmentId: domain.departmentId || undefined,
    departmentCode: domain.departmentCode || undefined,
    dueDate: domain.dueDate,
    assignedDate: domain.startDate || domain.dueDate,
    status: (statusMap[domain.status] || 'in_progress') as any,
    priority: (priorityMap[domain.priority] || 'medium') as any,
    progress,
    progressPercent: progress,
    academicMonth: domain.academicMonth,
    academicYear: domain.academicYear,
    coAssignees: domain.collaborators.map((c) => c.userName),
    category: category as any,
    categoryLabel: category,
    parentTaskId: domain.parentTaskId || undefined,
    parentTaskTitle: domain.parentTask?.title,
    parentTaskCode: domain.parentTask?.code,
    parentTask: domain.parentTask || undefined,
    subTasks: mappedSubTasks as any,
    totalSubTasks: domain.totalSubTasks,
    completedSubTasks: domain.completedSubTasks,
    isOverdue: domain.isOverdue,
    requiresReview: domain.requiresReview,
    deliverableDescription: domain.description || '',
    deliverables: domain.deliverables.map((d) => ({
      id: d.id,
      name: d.title,
      title: d.title,
      url: d.fileUrl,
      fileType: d.fileType || 'application/pdf',
      submittedAt: d.submittedAt ? String(d.submittedAt) : '',
      status: 'SUBMITTED',
    })) as any,
  } as unknown as TaskViewModel;
}
