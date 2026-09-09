/**
 * Task Data Transfer Objects (DTOs) & Sanitization Mappers
 *
 * Implements OWASP API3 (Excessive Data Exposure) safeguards.
 * Ensures zero leakage of internal database structures, raw secrets,
 * or circular relations. Provides clean, consistent contracts for task lists,
 * summaries, and details.
 */

import {
  toUserSummaryDTO,
  type UserSummaryDTO,
  type UserDepartmentDTO,
} from './user-dto';

export interface TaskSummaryDTO {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string;
  progress: number;
  version: number;
}

export interface TaskListDTO {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string;
  progress: number;
  department?: UserDepartmentDTO | null;
  leadAssignee?: UserSummaryDTO | null;
  assignees?: UserSummaryDTO[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDeliverableDTO {
  id: string;
  taskId?: string;
  title: string;
  fileUrl: string;
  fileType?: string | null;
  fileSize?: number | null;
  reviewStatus: string;
  reviewNote?: string | null;
  uploadedBy?: UserSummaryDTO | null;
  reviewer?: UserSummaryDTO | null;
  reviewedAt?: string | null;
  createdAt?: string;
}

export interface TaskResolutionDTO {
  id: string;
  taskId: string;
  resolutionType: string;
  directiveNote?: string | null;
  grantedDays?: number | null;
  previousDueDate?: string | null;
  newDueDate?: string | null;
  actor?: UserSummaryDTO | null;
  createdAt?: string;
}

export interface TaskDetailDTO extends TaskListDTO {
  description?: string | null;
  scope?: string;
  startDate?: string | null;
  completedAt?: string | null;
  createdBy?: UserSummaryDTO | null;
  parentTaskId?: string | null;
  parentTask?: TaskSummaryDTO | null;
  subTasks?: TaskSummaryDTO[];
  deliverables?: TaskDeliverableDTO[];
  resolutions?: TaskResolutionDTO[];
  dacumTaskDefId?: string | null;
  academicMonth?: number;
  academicYear?: string;
}

function toISOStringSafe(val: unknown): string {
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? new Date(0).toISOString() : val.toISOString();
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

function extractDateString(val: unknown): string {
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? '' : val.toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }
  return '';
}

function extractVersion(raw: Record<string, any>): number {
  if (typeof raw.version === 'number' && !isNaN(raw.version)) {
    return raw.version;
  }
  if (typeof raw.version === 'string') {
    const parsed = parseInt(raw.version, 10);
    if (!isNaN(parsed)) return parsed;
  }
  if (raw.updatedAt) {
    const ts = new Date(raw.updatedAt).getTime();
    if (!isNaN(ts)) return ts;
  }
  return 1;
}

function extractProgress(raw: Record<string, any>): number {
  if (typeof raw.progress === 'number' && !isNaN(raw.progress)) {
    return raw.progress;
  }
  if (typeof raw.progressPercent === 'number' && !isNaN(raw.progressPercent)) {
    return raw.progressPercent;
  }
  return 0;
}

function extractDepartment(raw: Record<string, any>): UserDepartmentDTO | null {
  if (raw.department && typeof raw.department === 'object') {
    return {
      id: String(raw.department.id ?? raw.departmentId ?? ''),
      code: raw.department.code ?? raw.department.shortName ?? null,
      name: String(raw.department.name ?? ''),
    };
  }
  if (typeof raw.department === 'string' && raw.department.trim()) {
    return {
      id: String(raw.departmentId ?? ''),
      code: raw.departmentCode ?? null,
      name: raw.department,
    };
  }
  if (raw.departmentId) {
    return {
      id: String(raw.departmentId),
      code: raw.departmentCode ?? null,
      name: raw.departmentName ?? String(raw.departmentId),
    };
  }
  return null;
}

function extractUserFromAssignee(item: any): UserSummaryDTO | null {
  if (!item || typeof item !== 'object') return null;

  // Prisma relation: TaskAssignee.user
  if (item.user && typeof item.user === 'object') {
    return toUserSummaryDTO(item.user);
  }

  // Already user-shaped: { id, name, email, role, avatarUrl }
  if (item.name && (item.id || item.userId)) {
    return toUserSummaryDTO({
      id: item.id ?? item.userId,
      name: item.name,
      email: item.email ?? '',
      role: item.role ?? item.roleInTask ?? 'CHUYEN_VIEN',
      avatarUrl: item.avatarUrl ?? item.avatar ?? null,
    });
  }

  // Domain shape: { userId, userName, userEmail, userAvatar, roleInTask }
  if (item.userName) {
    return toUserSummaryDTO({
      id: item.userId ?? item.id,
      name: item.userName,
      email: item.userEmail ?? item.email ?? '',
      role: item.roleInTask ?? item.role ?? 'CHUYEN_VIEN',
      avatarUrl: item.userAvatar ?? item.avatarUrl ?? item.avatar ?? null,
    });
  }

  return null;
}

function extractAssignees(raw: Record<string, any>): UserSummaryDTO[] {
  if (!Array.isArray(raw.assignees)) return [];
  return raw.assignees
    .map(extractUserFromAssignee)
    .filter((a): a is UserSummaryDTO => a !== null);
}

function extractLeadAssignee(raw: Record<string, any>): UserSummaryDTO | null {
  // Direct leadAssignee property
  if (raw.leadAssignee && typeof raw.leadAssignee === 'object') {
    return extractUserFromAssignee(raw.leadAssignee);
  }

  // Domain primaryOwner
  if (raw.primaryOwner && typeof raw.primaryOwner === 'object') {
    return extractUserFromAssignee(raw.primaryOwner);
  }

  // Find in assignees array
  if (Array.isArray(raw.assignees)) {
    const lead = raw.assignees.find((a: any) => {
      const role = a?.roleInTask ?? a?.role;
      return (
        role === 'PRIMARY_OWNER' ||
        role === 'primary_owner' ||
        role === 'LEAD' ||
        role === 'lead'
      );
    });
    if (lead) {
      return extractUserFromAssignee(lead);
    }
  }

  return null;
}

function extractDeliverables(raw: Record<string, any>): TaskDeliverableDTO[] {
  if (!Array.isArray(raw.deliverables)) return [];

  return raw.deliverables
    .filter((d: any) => d && typeof d === 'object')
    .map((d: any) => ({
      id: String(d.id ?? ''),
      taskId: d.taskId ? String(d.taskId) : undefined,
      title: String(d.title ?? ''),
      fileUrl: String(d.fileUrl ?? ''),
      fileType: d.fileType ?? null,
      fileSize: typeof d.fileSize === 'number' ? d.fileSize : null,
      reviewStatus: String(d.reviewStatus ?? 'PENDING'),
      reviewNote: d.reviewNote ?? null,
      uploadedBy: d.uploadedBy
        ? toUserSummaryDTO(d.uploadedBy)
        : d.uploadedById
        ? toUserSummaryDTO({
            id: d.uploadedById,
            name: d.uploadedByName ?? '',
            email: '',
            role: 'CHUYEN_VIEN',
          })
        : null,
      reviewer: d.reviewer
        ? toUserSummaryDTO(d.reviewer)
        : d.reviewerId
        ? toUserSummaryDTO({
            id: d.reviewerId,
            name: d.reviewerName ?? '',
            email: '',
            role: 'CHUYEN_VIEN',
          })
        : null,
      reviewedAt: d.reviewedAt ? extractDateString(d.reviewedAt) : null,
      createdAt: d.createdAt ? extractDateString(d.createdAt) : undefined,
    }));
}

function extractResolutions(raw: Record<string, any>): TaskResolutionDTO[] {
  if (!Array.isArray(raw.resolutions)) return [];

  return raw.resolutions
    .filter((r: any) => r && typeof r === 'object')
    .map((r: any) => ({
      id: String(r.id ?? ''),
      taskId: String(r.taskId ?? ''),
      resolutionType: String(r.resolutionType ?? ''),
      directiveNote: r.directiveNote ?? null,
      grantedDays: typeof r.grantedDays === 'number' ? r.grantedDays : null,
      previousDueDate: r.previousDueDate ? extractDateString(r.previousDueDate) : null,
      newDueDate: r.newDueDate ? extractDateString(r.newDueDate) : null,
      actor: r.actor
        ? toUserSummaryDTO(r.actor)
        : r.actorId
        ? toUserSummaryDTO({
            id: r.actorId,
            name: r.actorName ?? '',
            email: '',
            role: 'ADMIN',
          })
        : null,
      createdAt: r.createdAt ? extractDateString(r.createdAt) : undefined,
    }));
}

/**
 * Maps raw task to TaskSummaryDTO.
 * Returns null if raw task is null, undefined, or not an object.
 */
export function toTaskSummaryDTO(rawTask: unknown): TaskSummaryDTO | null {
  if (!rawTask || typeof rawTask !== 'object') return null;
  const task = rawTask as Record<string, any>;

  return {
    id: String(task.id ?? ''),
    code: String(task.code ?? ''),
    title: String(task.title ?? ''),
    status: String(task.status ?? ''),
    priority: String(task.priority ?? ''),
    dueDate: extractDateString(task.dueDate),
    progress: extractProgress(task),
    version: extractVersion(task),
  };
}

/**
 * Maps raw task to TaskListDTO.
 * Returns null if raw task is null, undefined, or not an object.
 */
export function toTaskListDTO(rawTask: unknown): TaskListDTO | null {
  if (!rawTask || typeof rawTask !== 'object') return null;
  const task = rawTask as Record<string, any>;

  return {
    id: String(task.id ?? ''),
    code: String(task.code ?? ''),
    title: String(task.title ?? ''),
    status: String(task.status ?? ''),
    priority: String(task.priority ?? ''),
    dueDate: extractDateString(task.dueDate),
    progress: extractProgress(task),
    department: extractDepartment(task),
    leadAssignee: extractLeadAssignee(task),
    assignees: extractAssignees(task),
    version: extractVersion(task),
    createdAt: toISOStringSafe(task.createdAt),
    updatedAt: toISOStringSafe(task.updatedAt),
  };
}

/**
 * Maps raw task to TaskDetailDTO.
 * Returns null if raw task is null, undefined, or not an object.
 */
export function toTaskDetailDTO(rawTask: unknown): TaskDetailDTO | null {
  if (!rawTask || typeof rawTask !== 'object') return null;
  const task = rawTask as Record<string, any>;

  const base = toTaskListDTO(task);
  if (!base) return null;

  return {
    ...base,
    description: task.description ?? null,
    scope: task.scope ? String(task.scope) : undefined,
    startDate: task.startDate ? extractDateString(task.startDate) : null,
    completedAt: task.completedAt ? extractDateString(task.completedAt) : null,
    createdBy: task.createdBy
      ? toUserSummaryDTO(task.createdBy)
      : task.createdById
      ? toUserSummaryDTO({
          id: task.createdById,
          name: task.createdByName ?? '',
          email: '',
          role: 'STAFF',
        })
      : null,
    parentTaskId: task.parentTaskId ? String(task.parentTaskId) : null,
    parentTask: task.parentTask ? toTaskSummaryDTO(task.parentTask) : null,
    subTasks: Array.isArray(task.subTasks)
      ? task.subTasks
          .map(toTaskSummaryDTO)
          .filter((s): s is TaskSummaryDTO => s !== null)
      : [],
    deliverables: extractDeliverables(task),
    resolutions: extractResolutions(task),
    dacumTaskDefId: task.dacumTaskDefId ? String(task.dacumTaskDefId) : null,
    academicMonth: typeof task.academicMonth === 'number' ? task.academicMonth : undefined,
    academicYear: task.academicYear ? String(task.academicYear) : undefined,
  };
}

/**
 * Array mapping helpers
 */
export function toTaskSummaryDTOArray(rawTasks: unknown[]): TaskSummaryDTO[] {
  if (!Array.isArray(rawTasks)) return [];
  return rawTasks
    .map(toTaskSummaryDTO)
    .filter((t): t is TaskSummaryDTO => t !== null);
}

export function toTaskListDTOArray(rawTasks: unknown[]): TaskListDTO[] {
  if (!Array.isArray(rawTasks)) return [];
  return rawTasks
    .map(toTaskListDTO)
    .filter((t): t is TaskListDTO => t !== null);
}
