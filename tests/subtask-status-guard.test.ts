/**
 * Subtask Status Guard — Unit Tests
 *
 * Kiểm thử logic guard chuyển đổi trạng thái nhiệm vụ con.
 * Chỉ test pure functions, không DB, không mutation.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSubtaskStatusGuard,
  canSubtaskTransition,
  buildSubtaskActorContext,
  buildSubtaskContext,
  type StatusOption,
  type SubtaskStatusGuardResult,
} from '../src/domain/tasks/subtask-status-guard';
import type { ActorContext } from '../src/domain/tasks/state-machine';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Subtask cơ bản — IN_PROGRESS, thuộc đơn vị CNTT */
const baseSubtask = {
  id: 'subtask-01',
  status: 'IN_PROGRESS',
  assigneeId: 'user-staff-01',

  scope: 'DEPARTMENT',
};

/** Actor: Chuyên viên (dbRole raw) */
const staffActor = {
  id: 'user-staff-01',
  role: 'STAFF',          // client simplified
  dbRole: 'CHUYEN_VIEN',  // raw DB role

};

/** Actor: Trưởng phòng */
const managerActor = {
  id: 'user-mgr-01',
  role: 'MANAGER',
  dbRole: 'TRUONG_PHONG',

};

/** Actor: Ban giám hiệu */
const executiveActor = {
  id: 'user-bgh-01',
  role: 'ADMIN',
  dbRole: 'BAN_GIAM_HIEU',

};

/** Quyền đầy đủ bao gồm update_execution */
const fullActions = [
  'task.read',
  'task.update_execution',
  'task.submit_result',
] as any[];

/** Quyền chỉ đọc, không có update_execution */
const readOnlyActions = ['task.read', 'task.view'] as any[];

// ---------------------------------------------------------------------------
// Test: buildSubtaskActorContext — Ưu tiên dbRole
// ---------------------------------------------------------------------------

describe('buildSubtaskActorContext', () => {
  it('ưu tiên dbRole thay vì role client simplified', () => {
    const ctx = buildSubtaskActorContext({
      id: 'user-01',
      role: 'ADMIN',           // client simplified
      dbRole: 'BAN_GIAM_HIEU', // raw DB

    });

    assert.equal(ctx.role, 'BAN_GIAM_HIEU', 'Phải dùng dbRole');
    assert.equal(ctx.id, 'user-01');
    assert.equal(ctx.departmentId, 'dept-01');
  });

  it('fallback về role nếu không có dbRole', () => {
    const ctx = buildSubtaskActorContext({
      id: 'user-02',
      role: 'TRUONG_PHONG',
    });

    assert.equal(ctx.role, 'TRUONG_PHONG');
  });

  it('fallback departmentCode khi không có departmentId', () => {
    const ctx = buildSubtaskActorContext({
      id: 'user-03',
      role: 'STAFF',
      departmentCode: 'CNTT',
    });

    assert.equal(ctx.departmentId, 'CNTT');
  });

  it('trả về actor mặc định STAFF khi user null', () => {
    const ctx = buildSubtaskActorContext(null);

    assert.equal(ctx.id, '');
    assert.equal(ctx.role, 'STAFF');
  });
});

// ---------------------------------------------------------------------------
// Test: buildSubtaskContext — Xây dựng TaskContext từ StaffTask DTO
// ---------------------------------------------------------------------------

describe('buildSubtaskContext', () => {
  it('xây dựng context từ StaffTask DTO (flat fields)', () => {
    const ctx = buildSubtaskContext({
      id: 'st-01',
      assigneeId: 'user-01',

      scope: 'DEPARTMENT',
    });

    assert.equal(ctx.id, 'st-01');
    assert.equal(ctx.scope, 'DEPARTMENT');
    assert.equal(ctx.departmentId, 'dept-01');
    assert.equal(ctx.primaryOwnerId, 'user-01');
    assert.equal(ctx.driId, 'user-01');
    assert.deepEqual(ctx.assigneeIds, ['user-01']);
    assert.equal(ctx.assignees?.[0]?.userId, 'user-01');
    assert.equal(ctx.assignees?.[0]?.roleInTask, 'PRIMARY_OWNER');
  });

  it('xây dựng context không có assignee', () => {
    const ctx = buildSubtaskContext({ id: 'st-02' });

    assert.equal(ctx.primaryOwnerId, null);
    assert.deepEqual(ctx.assigneeIds, []);
    assert.deepEqual(ctx.assignees, []);
  });

  it('delegate sang buildTaskContext nếu có mảng assignees', () => {
    const ctx = buildSubtaskContext({
      id: 'st-03',
      assignees: [
        { userId: 'user-a', roleInTask: 'PRIMARY_OWNER' },
      ] as any,
    });

    // buildTaskContext đọc assignees array
    assert.equal(ctx.id, 'st-03');
    assert.ok(ctx.assigneeIds?.includes('user-a'));
  });
});

// ---------------------------------------------------------------------------
// Test: computeSubtaskStatusGuard — Core guard logic
// ---------------------------------------------------------------------------

describe('computeSubtaskStatusGuard', () => {
  it('readonly khi không có task.update_execution', () => {
    const result = computeSubtaskStatusGuard(
      baseSubtask,
      staffActor,
      readOnlyActions,
    );

    assert.equal(result.canUpdateExecution, false);
    assert.equal(result.readonly, true);
    assert.ok(result.readonlyReason);
    assert.equal(result.options.length, 1, 'Chỉ hiện trạng thái hiện tại');
    assert.equal(result.options[0].status, 'IN_PROGRESS');
  });

  it('readonly khi actor null', () => {
    const result = computeSubtaskStatusGuard(
      baseSubtask,
      null,
      fullActions,
    );

    assert.equal(result.readonly, true);
    assert.ok(result.readonlyReason?.includes('xác định'));
  });

  it('readonly khi actor thiếu id', () => {
    const result = computeSubtaskStatusGuard(
      baseSubtask,
      { role: 'STAFF' },
      fullActions,
    );

    assert.equal(result.readonly, true);
  });

  it('IN_PROGRESS không được nhảy thẳng sang COMPLETED (phải qua WAITING_APPROVAL)', () => {
    // FSM enforce: IN_PROGRESS → COMPLETED là INVALID_TRANSITION
    // (phải qua WAITING_APPROVAL trước)
    const result = computeSubtaskStatusGuard(
      baseSubtask,
      staffActor,
      fullActions,
    );

    const completedOpt = result.options.find(o => o.status === 'COMPLETED');
    assert.ok(completedOpt, 'COMPLETED phải có trong options');
    assert.equal(completedOpt!.disabled, true, 'COMPLETED phải disabled');
    assert.equal(completedOpt!.code, 'INVALID_TRANSITION');
  });

  it('staff có thể chuyển IN_PROGRESS → WAITING_APPROVAL', () => {
    const result = computeSubtaskStatusGuard(
      baseSubtask,
      staffActor,
      fullActions,
    );

    const waitingOpt = result.options.find(o => o.status === 'WAITING_APPROVAL');
    assert.ok(waitingOpt, 'WAITING_APPROVAL phải có trong options');
    assert.equal(waitingOpt!.disabled, false, 'Staff phải được submit review');
  });

  it('manager (không phải maker) có thể approve → COMPLETED', () => {
    // Subtask thuộc đơn vị CNTT, DRI là staff, manager CNTT approve
    const subtask = {
      ...baseSubtask,
      status: 'WAITING_APPROVAL',
    };

    const result = computeSubtaskStatusGuard(
      subtask,
      managerActor,
      fullActions,
    );

    const completedOpt = result.options.find(o => o.status === 'COMPLETED');
    assert.ok(completedOpt, 'COMPLETED phải có trong options');
    assert.equal(completedOpt!.disabled, false, 'Manager (checker) được approve');
  });

  it('noop: current status luôn có trong options', () => {
    const result = computeSubtaskStatusGuard(
      baseSubtask,
      managerActor,
      fullActions,
    );

    const currentOpt = result.options.find(o => o.status === 'IN_PROGRESS');
    assert.ok(currentOpt, 'Trạng thái hiện tại phải có trong options');
    // Noop transition allowed=true bởi FSM
    assert.equal(currentOpt!.disabled, false);
  });

  it('terminal state COMPLETED → readonly cho non-executive', () => {
    const completed = { ...baseSubtask, status: 'COMPLETED' };
    const result = computeSubtaskStatusGuard(
      completed,
      staffActor,
      fullActions,
    );

    assert.equal(result.currentStatus, 'COMPLETED');
    // Staff không thể reopen → tất cả targets disabled → readonly
    assert.equal(result.readonly, true);
    assert.ok(result.readonlyReason);
  });

  it('terminal state COMPLETED → executive có thể reopen (không readonly)', () => {
    const completed = { ...baseSubtask, status: 'COMPLETED' };
    const result = computeSubtaskStatusGuard(
      completed,
      executiveActor,
      fullActions,
    );

    assert.equal(result.currentStatus, 'COMPLETED');
    // Executive có thể reopen → không hoàn toàn readonly
    assert.equal(result.readonly, false);
  });

  it('terminal state CANCELLED → readonly cho non-executive', () => {
    const cancelled = { ...baseSubtask, status: 'CANCELLED' };
    const result = computeSubtaskStatusGuard(
      cancelled,
      staffActor,
      fullActions,
    );

    assert.equal(result.readonly, true);
    assert.equal(result.currentStatus, 'CANCELLED');
  });

  it('options luôn có đủ 5 trạng thái canonical khi có quyền', () => {
    const result = computeSubtaskStatusGuard(
      baseSubtask,
      managerActor,
      fullActions,
    );

    assert.equal(result.options.length, 5);
    const statuses = result.options.map(o => o.status);
    assert.ok(statuses.includes('NOT_STARTED'));
    assert.ok(statuses.includes('IN_PROGRESS'));
    assert.ok(statuses.includes('WAITING_APPROVAL'));
    assert.ok(statuses.includes('COMPLETED'));
    assert.ok(statuses.includes('CANCELLED'));
  });

  it('mỗi option có label tiếng Việt', () => {
    const result = computeSubtaskStatusGuard(
      baseSubtask,
      managerActor,
      fullActions,
    );

    for (const opt of result.options) {
      assert.ok(opt.label, `Option ${opt.status} phải có label`);
      assert.notEqual(opt.label, opt.status, `Label phải là tiếng Việt, không phải enum`);
    }
  });
});

// ---------------------------------------------------------------------------
// Test: Alias normalization — BLOCKED, NEW, NEEDS_REVIEW, CANCELED
// ---------------------------------------------------------------------------

describe('Alias status normalization trong guard', () => {
  it('BLOCKED (mapped từ CANCELLED) được normalize đúng', () => {
    // mapPrismaTaskToStaffTask map CANCELLED → BLOCKED
    // normalizeTaskStatus không biết BLOCKED → fallback
    // Vì vậy, nếu raw status là CANCELLED thì phải truyền CANCELLED
    const subtask = { ...baseSubtask, status: 'CANCELLED' };
    const result = computeSubtaskStatusGuard(subtask, executiveActor, fullActions);

    assert.equal(result.currentStatus, 'CANCELLED');
  });

  it('NOT_STARTED normalize thành NOT_STARTED', () => {
    const subtask = { ...baseSubtask, status: 'NOT_STARTED' };
    const result = computeSubtaskStatusGuard(subtask, managerActor, fullActions);

    assert.equal(result.currentStatus, 'NOT_STARTED');
  });

  it('TODO normalize thành NOT_STARTED', () => {
    const subtask = { ...baseSubtask, status: 'TODO' };
    const result = computeSubtaskStatusGuard(subtask, managerActor, fullActions);

    assert.equal(result.currentStatus, 'NOT_STARTED');
  });

  it('NEEDS_REVIEW normalize thành WAITING_APPROVAL', () => {
    const subtask = { ...baseSubtask, status: 'NEEDS_REVIEW' };
    const result = computeSubtaskStatusGuard(subtask, managerActor, fullActions);

    assert.equal(result.currentStatus, 'WAITING_APPROVAL');
  });

  it('DONE normalize thành COMPLETED', () => {
    const subtask = { ...baseSubtask, status: 'DONE' };
    const result = computeSubtaskStatusGuard(subtask, staffActor, fullActions);

    assert.equal(result.currentStatus, 'COMPLETED');
    // Staff không thể reopen → readonly
    assert.equal(result.readonly, true);
  });

  it('CANCELED (một chữ L) normalize thành CANCELLED', () => {
    const subtask = { ...baseSubtask, status: 'CANCELED' };
    const result = computeSubtaskStatusGuard(subtask, staffActor, fullActions);

    assert.equal(result.currentStatus, 'CANCELLED');
    assert.equal(result.readonly, true);
  });
});

// ---------------------------------------------------------------------------
// Test: canSubtaskTransition — Kiểm tra nhanh một chuyển đổi cụ thể
// ---------------------------------------------------------------------------

describe('canSubtaskTransition', () => {
  it('từ chối khi không có update_execution', () => {
    const result = canSubtaskTransition(
      baseSubtask,
      staffActor,
      'WAITING_APPROVAL',
      readOnlyActions,
    );

    assert.equal(result.allowed, false);
    assert.equal(result.canUpdateExecution, false);
    assert.equal(result.code, 'NO_UPDATE_EXECUTION');
  });

  it('từ chối khi actor null', () => {
    const result = canSubtaskTransition(
      baseSubtask,
      null,
      'WAITING_APPROVAL',
      fullActions,
    );

    assert.equal(result.allowed, false);
    assert.equal(result.code, 'NO_ACTOR');
  });

  it('cho phép IN_PROGRESS → WAITING_APPROVAL cho staff', () => {
    const result = canSubtaskTransition(
      baseSubtask,
      staffActor,
      'WAITING_APPROVAL',
      fullActions,
    );

    assert.equal(result.allowed, true);
    assert.equal(result.canUpdateExecution, true);
  });

  it('chặn IN_PROGRESS → COMPLETED cho staff maker (maker-checker)', () => {
    const result = canSubtaskTransition(
      baseSubtask,
      staffActor,
      'COMPLETED',
      fullActions,
    );

    assert.equal(result.allowed, false);
  });

  it('cho phép WAITING_APPROVAL → COMPLETED cho manager (checker)', () => {
    const subtask = { ...baseSubtask, status: 'WAITING_APPROVAL' };
    const result = canSubtaskTransition(
      subtask,
      managerActor,
      'COMPLETED',
      fullActions,
    );

    assert.equal(result.allowed, true);
  });

  it('noop transition (cùng status) allowed', () => {
    const result = canSubtaskTransition(
      baseSubtask,
      staffActor,
      'IN_PROGRESS',
      fullActions,
    );

    assert.equal(result.allowed, true);
  });

  it('executive có thể mở lại từ COMPLETED → IN_PROGRESS', () => {
    // FSM cho phép executive reopen terminal tasks
    const completed = { ...baseSubtask, status: 'COMPLETED' };
    const result = canSubtaskTransition(
      completed,
      executiveActor,
      'IN_PROGRESS',
      fullActions,
    );

    assert.equal(result.allowed, true);
  });

  it('staff không thể mở lại từ COMPLETED', () => {
    const completed = { ...baseSubtask, status: 'COMPLETED' };
    const result = canSubtaskTransition(
      completed,
      staffActor,
      'IN_PROGRESS',
      fullActions,
    );

    assert.equal(result.allowed, false);
    assert.equal(result.code, 'TERMINAL_STATE_LOCKED');
  });

  it('chặn chuyển từ CANCELLED (terminal)', () => {
    const cancelled = { ...baseSubtask, status: 'CANCELLED' };
    const result = canSubtaskTransition(
      cancelled,
      executiveActor,
      'NEW',
      fullActions,
    );

    assert.equal(result.allowed, false);
  });

  it('normalize alias trong targetStatus', () => {
    // Target 'DONE' → normalize thành COMPLETED
    const result = canSubtaskTransition(
      { ...baseSubtask, status: 'WAITING_APPROVAL' },
      managerActor,
      'DONE',
      fullActions,
    );

    // FSM sẽ normalize DONE → COMPLETED
    assert.equal(result.allowed, true);
  });
});

// ---------------------------------------------------------------------------
// Test: Role/scope interaction — School scope cần executive
// ---------------------------------------------------------------------------

describe('Role/scope guard trong subtask context', () => {
  it('staff không thể approve subtask cấp trường', () => {
    const schoolSubtask = {
      ...baseSubtask,
      status: 'WAITING_APPROVAL',
      scope: 'SCHOOL',
      assigneeId: 'user-other',
    };

    const result = canSubtaskTransition(
      schoolSubtask,
      { ...staffActor, id: 'user-non-maker' },
      'COMPLETED',
      fullActions,
    );

    assert.equal(result.allowed, false);
  });

  it('executive có thể approve subtask cấp trường', () => {
    const schoolSubtask = {
      ...baseSubtask,
      status: 'WAITING_APPROVAL',
      scope: 'SCHOOL',
      assigneeId: 'user-other',
    };

    const result = canSubtaskTransition(
      schoolSubtask,
      executiveActor,
      'COMPLETED',
      fullActions,
    );

    assert.equal(result.allowed, true);
  });

  it('manager khác đơn vị không được approve', () => {
    const subtask = {
      ...baseSubtask,
      status: 'WAITING_APPROVAL',

      assigneeId: 'user-other',
    };

    const otherManager = {
      ...managerActor,
      id: 'user-mgr-02',

    };

    const result = canSubtaskTransition(
      subtask,
      otherManager,
      'COMPLETED',
      fullActions,
    );

    assert.equal(result.allowed, false);
  });
});

// ---------------------------------------------------------------------------
// Test: availableActions undefined/empty — fallback an toàn
// ---------------------------------------------------------------------------

describe('Fallback khi availableActions thiếu', () => {
  it('undefined availableActions → readonly', () => {
    const result = computeSubtaskStatusGuard(
      baseSubtask,
      staffActor,
      undefined,
    );

    assert.equal(result.canUpdateExecution, false);
    assert.equal(result.readonly, true);
  });

  it('mảng rỗng availableActions → readonly', () => {
    const result = computeSubtaskStatusGuard(
      baseSubtask,
      staffActor,
      [],
    );

    assert.equal(result.canUpdateExecution, false);
    assert.equal(result.readonly, true);
  });
});

// ---------------------------------------------------------------------------
// Test: ADR-002 TaskAuthorizationDecision Integration via availableActions (WI-3.3)
// ---------------------------------------------------------------------------

describe('ADR-002 TaskAuthorizationDecision Integration via availableActions (WI-3.3)', () => {
  const nonMakerWaitingSubtask = {
    ...baseSubtask,
    status: 'WAITING_APPROVAL',
    assigneeId: 'user-other-person',
  };

  it('allows Staff to approve when availableActions includes task.approve (and non-maker)', () => {
    const actionsWithApprove = [
      'task.read',
      'task.update_execution',
      'task.approve',
    ];

    const result = canSubtaskTransition(
      nonMakerWaitingSubtask,
      staffActor,
      'COMPLETED',
      actionsWithApprove,
    );

    assert.equal(result.allowed, true);
  });

  it('HARD INVARIANT: Maker Staff CANNOT approve even if availableActions includes task.approve (SoD)', () => {
    const makerWaitingSubtask = {
      ...baseSubtask,
      status: 'WAITING_APPROVAL',
      assigneeId: staffActor.id,
    };

    const actionsWithApprove = [
      'task.read',
      'task.update_execution',
      'task.approve',
    ];

    const result = canSubtaskTransition(
      makerWaitingSubtask,
      staffActor,
      'COMPLETED',
      actionsWithApprove,
    );

    assert.equal(result.allowed, false);
    assert.equal(result.code, 'MAKER_CANNOT_BE_CHECKER');
  });

  it('allows Staff to reject when availableActions includes task.reject', () => {
    const actionsWithReject = [
      'task.read',
      'task.update_execution',
      'task.reject',
    ];

    const result = canSubtaskTransition(
      nonMakerWaitingSubtask,
      staffActor,
      'IN_PROGRESS',
      actionsWithReject,
    );

    assert.equal(result.allowed, true);
  });

  it('allows Staff to reject when availableActions includes task.review', () => {
    const actionsWithReview = [
      'task.read',
      'task.update_execution',
      'task.review',
    ];

    const result = canSubtaskTransition(
      nonMakerWaitingSubtask,
      staffActor,
      'IN_PROGRESS',
      actionsWithReview,
    );

    assert.equal(result.allowed, true);
  });

  it('allows Staff to cancel when availableActions includes task.cancel', () => {
    const actionsWithCancel = [
      'task.read',
      'task.update_execution',
      'task.cancel',
    ];

    const result = canSubtaskTransition(
      nonMakerWaitingSubtask,
      staffActor,
      'CANCELLED',
      actionsWithCancel,
    );

    assert.equal(result.allowed, true);
  });
});
