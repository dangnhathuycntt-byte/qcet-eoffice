/**
 * Subtask Status Guard — Kiểm soát chuyển đổi trạng thái nhiệm vụ con
 *
 * Helper thuần (pure function) cung cấp danh sách trạng thái khả dụng cho
 * nhiệm vụ con dựa trên:
 * 1. availableActions đã được authorize bởi ReBAC (task.update_execution)
 * 2. FSM transition rules từ TaskStateMachine (role/scope/maker-checker)
 * 3. Normalize alias status (BLOCKED/NEW/NEEDS_REVIEW → canonical)
 *
 * Không thay đổi global state-machine, không import React/Next.js.
 * Dùng chung cho cả drawer UI (main sẽ integrate) và API validation.
 */

import type { CapabilityAction } from '@/server/authorization/capability';
import { ORG_UNIT_READ_CUTOVER } from '@/lib/feature-flags';
import {
  type ActorContext,
  type TaskContext,
  type CanonicalTaskStatus,
  type TransitionResult,
  type TaskAuthorizationDecision,
  normalizeTaskStatus,
  buildActorContext,
  buildTaskContext,
  taskStateMachine,
  getStatusLabel,
} from './state-machine';

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
  /** leadUnitId: OrganizationalUnit ID dùng khi ORG_UNIT_READ_CUTOVER bật */
  leadUnitId?: string | null;
  isDelegated?: boolean;
  delegatedTaskIds?: string[];
} | null): ActorContext {
  if (!user || !user.id) {
    return buildActorContext(null);
  }

  // Ưu tiên dbRole (raw DB role) để FSM categorizeRole hoạt động chính xác
  const canonicalRole = user.dbRole || user.role || 'STAFF';
  const departmentId = ORG_UNIT_READ_CUTOVER
    ? (user.leadUnitId || user.departmentId || user.departmentCode || user.department || null)
    : (user.departmentId || user.departmentCode || user.department || null);

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
  /** leadUnitId: OrganizationalUnit ID dùng khi ORG_UNIT_READ_CUTOVER bật */
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

  const effectiveDepartmentId = ORG_UNIT_READ_CUTOVER
    ? (subtask.leadUnitId || subtask.departmentId || null)
    : (subtask.departmentId || null);

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

/**
 * Tính toán danh sách trạng thái khả dụng cho subtask, kết hợp:
 * - ReBAC availableActions (task.update_execution)
 * - FSM transition rules (maker-checker, scope, role)
 *
 * @param subtask   — StaffTask hoặc raw task entity
 * @param actor     — AuthUser/session (chấp nhận cả client và server shape)
 * @param availableActions — Mảng CapabilityAction đã compute bởi authorizeSubTasks
 * @returns SubtaskStatusGuardResult
 */
export function computeSubtaskStatusGuard(
  subtask: {
    id: string;
    status: string;
    assigneeId?: string;
    departmentId?: string | null;
    scope?: string;
    createdById?: string;
    collaborators?: Array<{ id: string; role?: string }>;
    deliverables?: Array<{ uploadedById?: string }>;
    [key: string]: unknown;
  },
  actor: {
    id?: string;
    role?: string;
    dbRole?: string;
    departmentId?: string | null;
    departmentCode?: string | null;
    department?: string | null;
    isDelegated?: boolean;
    delegatedTaskIds?: string[];
  } | null | undefined,
  availableActions?: CapabilityAction[] | string[],
): SubtaskStatusGuardResult {
  const currentStatus = normalizeTaskStatus(subtask.status);

  // 1. Kiểm tra quyền update_execution từ ReBAC
  const actions = availableActions || [];
  const canUpdateExecution = actions.includes('task.update_execution' as CapabilityAction);

  // 2. Actor không có quyền → readonly
  if (!canUpdateExecution) {
    return {
      currentStatus,
      canUpdateExecution: false,
      readonly: true,
      readonlyReason: 'Bạn không có quyền thay đổi trạng thái nhiệm vụ này.',
      options: [
        {
          status: currentStatus,
          label: getStatusLabel(currentStatus),
          disabled: false, // current luôn hiển thị
        },
      ],
    };
  }

  // 3. Actor thiếu id → readonly
  if (!actor?.id) {
    return {
      currentStatus,
      canUpdateExecution: true,
      readonly: true,
      readonlyReason: 'Không xác định được người thao tác.',
      options: [
        {
          status: currentStatus,
          label: getStatusLabel(currentStatus),
          disabled: false,
        },
      ],
    };
  }

  // 4. Xây dựng context cho FSM
  const actorCtx = buildSubtaskActorContext(actor);
  const taskCtx = buildSubtaskContext(subtask);

  // 5. Construct TaskAuthorizationDecision từ availableActions (ADR-002 Pure Domain Authority)
  const authDecision: TaskAuthorizationDecision = {
    canApprove: actions.includes('task.approve' as CapabilityAction) ? true : undefined,
    canReject: (actions.includes('task.reject' as CapabilityAction) || actions.includes('task.review' as CapabilityAction)) ? true : undefined,
    canCancel: actions.includes('task.cancel' as CapabilityAction) ? true : undefined,
  };

  // 6. Lấy tất cả transitions từ FSM với pure authority decision
  const transitions = taskStateMachine.getAllowedTransitions(
    actorCtx,
    taskCtx,
    currentStatus,
    authDecision,
  );

  // 7. Build options list
  const options: StatusOption[] = transitions.map((t) => ({
    status: t.status,
    label: getStatusLabel(t.status),
    disabled: !t.allowed,
    reason: t.reason,
    code: t.code,
  }));

  // 7. Xác định readonly: tất cả target đều bị chặn (trừ noop)
  const hasAnyAllowed = transitions.some(
    (t) => t.allowed && t.status !== currentStatus,
  );

  return {
    currentStatus,
    canUpdateExecution: true,
    readonly: !hasAnyAllowed,
    readonlyReason: !hasAnyAllowed
      ? `Không có chuyển đổi trạng thái nào khả dụng với quyền hiện tại.`
      : undefined,
    options,
  };
}

/**
 * Kiểm tra nhanh một chuyển đổi cụ thể có được phép không.
 * Kết hợp ReBAC check + FSM check trong 1 call.
 */
export function canSubtaskTransition(
  subtask: {
    id: string;
    status: string;
    assigneeId?: string;
    departmentId?: string | null;
    scope?: string;
    createdById?: string;
    [key: string]: unknown;
  },
  actor: {
    id?: string;
    role?: string;
    dbRole?: string;
    departmentId?: string | null;
    departmentCode?: string | null;
    department?: string | null;
    isDelegated?: boolean;
    delegatedTaskIds?: string[];
  } | null | undefined,
  targetStatus: string,
  availableActions?: CapabilityAction[] | string[],
): TransitionResult & { canUpdateExecution: boolean } {
  const actions = availableActions || [];
  const canUpdateExecution = actions.includes('task.update_execution' as CapabilityAction);

  if (!canUpdateExecution) {
    return {
      allowed: false,
      reason: 'Bạn không có quyền thay đổi trạng thái nhiệm vụ này.',
      code: 'NO_UPDATE_EXECUTION',
      canUpdateExecution: false,
    };
  }

  if (!actor?.id) {
    return {
      allowed: false,
      reason: 'Không xác định được người thao tác.',
      code: 'NO_ACTOR',
      canUpdateExecution: true,
    };
  }

  const actorCtx = buildSubtaskActorContext(actor);
  const taskCtx = buildSubtaskContext(subtask);
  const authDecision: TaskAuthorizationDecision = {
    canApprove: actions.includes('task.approve' as CapabilityAction) ? true : undefined,
    canReject: (actions.includes('task.reject' as CapabilityAction) || actions.includes('task.review' as CapabilityAction)) ? true : undefined,
    canCancel: actions.includes('task.cancel' as CapabilityAction) ? true : undefined,
  };

  const result = taskStateMachine.canTransition(
    actorCtx,
    taskCtx,
    subtask.status,
    targetStatus,
    authDecision,
  );

  return { ...result, canUpdateExecution: true };
}
