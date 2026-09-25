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
import { isTaskOverdue } from '@/lib/academic-calendar';
import type { TaskViewerContext } from '@/domain/tasks';

export interface TaskSourceDocumentDTO {
  id: string;
  originalNumber: string;     // Số/Ký hiệu văn bản (vd: 128/TCGDNN-VP)
  summary: string;            // Trích yếu nội dung
  type: string;               // VAN_BAN_DEN | VAN_BAN_DI
  issuedDate: string;         // Ngày ban hành
  issuingAuthority: string;   // Cơ quan ban hành
  registrationNumber: number; // Số vào sổ
  documentYear: number;
}

export interface TaskSummaryDTO {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string;
  progress: number;
  version: number;
  isOverdue?: boolean;
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
  collaborators?: UserSummaryDTO[];
  assignees?: UserSummaryDTO[];
  version: number;
  isOverdue?: boolean;
  viewerContext?: TaskViewerContext | null;
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
  createdById?: string | null;
  departmentId?: string | null;
  parentTaskId?: string | null;
  parentTask?: TaskSummaryDTO | null;
  subTasks?: TaskSummaryDTO[];
  deliverables?: TaskDeliverableDTO[];
  resolutions?: TaskResolutionDTO[];
  dacumTaskDefId?: string | null;
  academicMonth?: number;
  academicYear?: string;
  sourceDocument?: TaskSourceDocumentDTO | null;
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
  if (raw.leadUnit && typeof raw.leadUnit === 'object') {
    return {
      id: String(raw.leadUnit.id ?? raw.leadUnitId ?? ''),
      code: raw.leadUnit.code ?? null,
      name: String(raw.leadUnit.name ?? ''),
    };
  }
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
  if (raw.leadUnitId) {
    return {
      id: String(raw.leadUnitId),
      code: raw.leadUnitCode ?? null,
      name: raw.leadUnitName ?? String(raw.leadUnitId),
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
  // Check V2 actors first
  if (Array.isArray(raw.actors) && raw.actors.length > 0) {
    const actorUsers = raw.actors
      .filter((a: any) => a && (a.user || a.userId))
      .map((a: any) => {
        if (a.user) return toUserSummaryDTO(a.user);
        return toUserSummaryDTO({
          id: a.userId,
          name: a.userName ?? '',
          email: a.userEmail ?? '',
          role: a.role ?? 'CHUYEN_VIEN',
        });
      })
      .filter((u): u is UserSummaryDTO => u !== null);
    if (actorUsers.length > 0) {
      return actorUsers;
    }
  }

  if (!Array.isArray(raw.assignees)) return [];
  return raw.assignees
    .map(extractUserFromAssignee)
    .filter((a): a is UserSummaryDTO => a !== null);
}

function extractLeadAssignee(raw: Record<string, any>): UserSummaryDTO | null {
  // Check V2 actors first (DRI or isPrimaryDRI)
  if (Array.isArray(raw.actors)) {
    const driActor = raw.actors.find(
      (a: any) => a && (a.role === 'DRI' || a.isPrimaryDRI) && (a.user || a.userId)
    );
    if (driActor) {
      if (driActor.user) return toUserSummaryDTO(driActor.user);
      return toUserSummaryDTO({
        id: driActor.userId,
        name: driActor.userName ?? '',
        email: driActor.userEmail ?? '',
        role: 'CHUYEN_VIEN',
      });
    }
  }

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

/**
 * Canonical derived collaborators logic:
 * "Phối hợp của task cha = tập unique Primary DRI/Chủ trì của các nhiệm vụ con active."
 *
 * Rules:
 * - Khi tạo task con và giao cho B → B tự xuất hiện trong Phối hợp của task cha.
 * - Khi task con đổi DRI B → C → parent tự phản ánh C.
 * - Nếu một người phụ trách nhiều task con → chỉ xuất hiện một lần.
 * - Nếu DRI task con trùng DRI task cha → không duplicate vào Phối hợp.
 * - Khi task con bị cancel/archive/re-parent → recompute.
 * - Chỉ tính các task con còn active theo lifecycle canonical (status !== 'CANCELLED', !archivedAt).
 * - Không lưu một nguồn collaborator thủ công song song nếu có thể derive từ TaskActor/child relation.
 */
export function extractDerivedCollaborators(raw: Record<string, any>): UserSummaryDTO[] {
  const lead = extractLeadAssignee(raw);
  const parentLeadId = lead?.id;
  const parentLeadName = (lead?.name || '').trim().toLowerCase();

  const subTasks = Array.isArray(raw.subTasks) ? raw.subTasks : [];
  const activeSubTasks = subTasks.filter((st: any) => {
    if (!st || typeof st !== 'object') return false;
    const s = String(st.status || '').toUpperCase();
    if (s === 'CANCELLED' || s === 'CANCELED') return false;
    if (st.archivedAt) return false;
    return true;
  });

  const collaboratorMap = new Map<string, UserSummaryDTO>();

  for (const st of activeSubTasks) {
    let subLead: UserSummaryDTO | null = null;

    // 1. Check TaskActors on subtask (role === 'DRI' or isPrimaryDRI)
    if (Array.isArray(st.actors)) {
      const driActor = st.actors.find(
        (a: any) => a && (a.role === 'DRI' || a.isPrimaryDRI) && (a.user || a.userId)
      );
      if (driActor) {
        if (driActor.user) {
          subLead = toUserSummaryDTO(driActor.user);
        } else if (driActor.userId) {
          subLead = toUserSummaryDTO({
            id: driActor.userId,
            name: driActor.userName ?? '',
            email: driActor.userEmail ?? '',
            role: 'CHUYEN_VIEN',
          });
        }
      }
    }

    // 2. Check assignees on subtask (roleInTask === 'PRIMARY_OWNER')
    if (!subLead && Array.isArray(st.assignees)) {
      const leadAssignee =
        st.assignees.find((a: any) => {
          const role = a?.roleInTask ?? a?.role;
          return (
            role === 'PRIMARY_OWNER' ||
            role === 'primary_owner' ||
            role === 'LEAD' ||
            role === 'lead'
          );
        }) || st.assignees[0];

      if (leadAssignee) {
        subLead = extractUserFromAssignee(leadAssignee);
      }
    }

    // 3. Fallback: direct lead properties on subtask
    if (!subLead && (st.assigneeId || st.leadAssigneeId || st.assigneeName || st.leadAssigneeName)) {
      const name = st.assigneeName || st.leadAssigneeName;
      if (name) {
        subLead = toUserSummaryDTO({
          id: st.assigneeId || st.leadAssigneeId || `usr_${name.replace(/\s+/g, '_').toLowerCase()}`,
          name,
          avatarUrl: st.assigneeAvatar || st.leadAssigneeAvatar || null,
          email: '',
          role: 'CHUYEN_VIEN',
        });
      }
    }

    if (!subLead || !subLead.name) continue;

    // Rule: Nếu DRI task con trùng DRI task cha → không duplicate vào Phối hợp
    if (parentLeadId && subLead.id === parentLeadId) continue;
    if (parentLeadName && subLead.name.trim().toLowerCase() === parentLeadName) continue;

    // Rule: Nếu một người phụ trách nhiều task con → chỉ xuất hiện một lần
    const key = subLead.id || subLead.name.trim().toLowerCase();
    if (!collaboratorMap.has(key)) {
      collaboratorMap.set(key, subLead);
    }
  }

  return Array.from(collaboratorMap.values());
}

export function toTaskDeliverableDTO(d: Record<string, any>): TaskDeliverableDTO {
  return {
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
  };
}

function extractDeliverables(raw: Record<string, any>): TaskDeliverableDTO[] {
  if (!Array.isArray(raw.deliverables)) return [];

  return raw.deliverables
    .filter((d: any) => d && typeof d === 'object')
    .map((d: any) => toTaskDeliverableDTO(d));
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
    isOverdue: isTaskOverdue(task.status, task.dueDate),
  };
}

/**
 * Maps raw task to TaskListDTO.
 * Returns null if raw task is null, undefined, or not an object.
 */
export function toTaskListDTO(rawTask: unknown): TaskListDTO | null {
  if (!rawTask || typeof rawTask !== 'object') return null;
  const task = rawTask as Record<string, any>;

  const leadAssignee = extractLeadAssignee(task);
  const derivedCollaborators = extractDerivedCollaborators(task);
  const directAssignees = extractAssignees(task);
  const assignees =
    directAssignees.length > 0
      ? directAssignees
      : leadAssignee
      ? [leadAssignee, ...derivedCollaborators]
      : derivedCollaborators;

  return {
    id: String(task.id ?? ''),
    code: String(task.code ?? ''),
    title: String(task.title ?? ''),
    status: String(task.status ?? ''),
    priority: String(task.priority ?? ''),
    dueDate: extractDateString(task.dueDate),
    progress: extractProgress(task),
    department: extractDepartment(task),
    leadAssignee,
    collaborators: derivedCollaborators,
    assignees,
    version: extractVersion(task),
    isOverdue: isTaskOverdue(task.status, task.dueDate),
    viewerContext: task.viewerContext ?? null,
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
    createdById: task.createdById ? String(task.createdById) : (task.createdBy?.id ? String(task.createdBy.id) : null),
    departmentId: task.departmentId
      ? String(task.departmentId)
      : task.leadUnitId
      ? String(task.leadUnitId)
      : task.leadUnit?.id
      ? String(task.leadUnit.id)
      : task.department?.id
      ? String(task.department.id)
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
    sourceDocument: task.linkedDocument
      ? {
          id: String(task.linkedDocument.id ?? ''),
          originalNumber: String(task.linkedDocument.originalNumber ?? ''),
          summary: String(task.linkedDocument.summary ?? ''),
          type: String(task.linkedDocument.type ?? ''),
          issuedDate: task.linkedDocument.issuedDate
            ? extractDateString(task.linkedDocument.issuedDate)
            : '',
          issuingAuthority: String(task.linkedDocument.issuingAuthority ?? ''),
          registrationNumber: Number(task.linkedDocument.registrationNumber ?? 0),
          documentYear: Number(task.linkedDocument.documentYear ?? 0),
        }
      : null,
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
