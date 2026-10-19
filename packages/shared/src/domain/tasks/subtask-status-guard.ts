import { type ActorContext, type TaskContext, type CanonicalTaskStatus, buildActorContext, buildTaskContext } from './state-machine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Kết quả đánh giá một lựa chọn trạng thái cho UI select */
export interface StatusOption {
  /** Trạng thái canonical (FSM) */
  status: CanonicalTaskStatus;
  /** Nhãn hiển thị tiếng Việt */
  label: string;
  /** Cho phép chuyển hay không */
  disabled: boolean;
  /** Lý do nếu bị chặn (hiển thị tooltip) */
  reason?: string;
  /** Mã lỗi FSM để UI xử lý đặc biệt nếu cần */
  code?: string;
}

/** Kết quả tổng hợp guard cho một subtask */
export interface SubtaskStatusGuardResult {
  /** Trạng thái hiện tại đã normalize */
  currentStatus: CanonicalTaskStatus;
  /** Có quyền update_execution từ ReBAC không */
  canUpdateExecution: boolean;
  /** Toàn bộ select bị readonly (không có quyền hoặc trạng thái terminal) */
  readonly: boolean;
  /** Lý do readonly */
  readonlyReason?: string;
  /** Danh sách options cho status select (bao gồm current) */
  options: StatusOption[];
}

// ---------------------------------------------------------------------------
// Helpers nội bộ
// ---------------------------------------------------------------------------

/**
 * Xây dựng ActorContext từ AuthUser/session, ưu tiên dbRole (canonical DB role)
 * thay vì role đã simplified bởi client auth context.
 *
 * AuthUser client: role='ADMIN'|'MANAGER'|'STAFF', dbRole='BAN_GIAM_HIEU'|...
 * Server session: role='BAN_GIAM_HIEU'|'TRUONG_PHONG'|... (raw DB)
 */
export function buildSubtaskActorContext(user?: {
  id?: string;
  role?: string;
  dbRole?: string;
  departmentId?: string | null;
  departmentCode?: string | null;
  department?: string | null;
  /** leadUnitId: OrganizationalUnit ID — nguồn đơn vị chuẩn tắc (Phase 9) */
  leadUnitId?: string | null;
  isDelegated?: boolean;
  delegatedTaskIds?: string[];
} | null): ActorContext {
  if (!user || !user.id) {
    return buildActorContext(null);
  }

  // Ưu tiên dbRole (raw DB role) để FSM categorizeRole hoạt động chính xác
  const canonicalRole = user.dbRole || user.role || 'STAFF';
  // Phase 9: legacy `department_id` columns are gone — `leadUnitId` is the sole
  // unit source; the older flat fields remain only as DTO shape fallbacks.
  const departmentId =
    user.leadUnitId || user.departmentId || user.departmentCode || user.department || null;

  return buildActorContext({
    id: user.id,
    role: canonicalRole,
    departmentId,
    isDelegated: user.isDelegated,
    delegatedTaskIds: user.delegatedTaskIds,
  });
}

/**
 * Xây dựng TaskContext tối thiểu từ StaffTask (DTO đã map).
 *
 * StaffTask bị strip một số field (scope, createdById, version) bởi
 * mapPrismaTaskToStaffTask. Helper chấp nhận partial data và fallback
 * an toàn — FSM vẫn enforce đúng với context thiếu (restrictive default).
 */
export function buildSubtaskContext(subtask: {
  id: string;
  assigneeId?: string;
  assigneeName?: string;
  departmentId?: string | null;
  /** leadUnitId: OrganizationalUnit ID — nguồn đơn vị chuẩn tắc (Phase 9) */
  leadUnitId?: string | null;
  scope?: string;
  createdById?: string;
  collaborators?: Array<{ id: string; role?: string }>;
  deliverables?: Array<{ uploadedById?: string }>;
  [key: string]: unknown;
}): TaskContext {
  // Nếu subtask có đủ field raw, delegate cho buildTaskContext gốc
  if ('assignees' in subtask && Array.isArray((subtask as any).assignees)) {
    return buildTaskContext(subtask);
  }

  // Xây dựng từ StaffTask DTO (đã flat)
  const assigneeIds: string[] = [];
  if (subtask.assigneeId) {
    assigneeIds.push(subtask.assigneeId);
  }

  const effectiveDepartmentId = subtask.leadUnitId || subtask.departmentId || null;

  return {
    id: subtask.id,
    scope: subtask.scope,
    createdById: subtask.createdById,
    departmentId: effectiveDepartmentId,
    primaryOwnerId: subtask.assigneeId || null,
    driId: subtask.assigneeId || null,
    assigneeIds,
    assignees: subtask.assigneeId
      ? [{ userId: subtask.assigneeId, roleInTask: 'PRIMARY_OWNER' }]
      : [],
    deliverableUploadedByIds: (subtask.deliverables || [])
      .map((d: any) => d.uploadedById)
      .filter(Boolean) as string[],
  };
}

// ---------------------------------------------------------------------------
// Core Guard
// ---------------------------------------------------------------------------
