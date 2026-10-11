/**
 * Subtask Status Guard — Unit Tests
 *
 * Kiểm thử logic guard chuyển đổi trạng thái nhiệm vụ con.
 * Chỉ test pure functions, không DB, không mutation.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSubtaskActorContext, buildSubtaskContext, type StatusOption, type SubtaskStatusGuardResult } from '../src/domain/tasks/subtask-status-guard';
import type { ActorContext } from '../src/domain/tasks/state-machine';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Subtask cơ bản — IN_PROGRESS, thuộc đơn vị CNTT */
const baseSubtask = {
  id: 'subtask-01',
  status: 'IN_PROGRESS',
  assigneeId: 'user-staff-01',
  departmentId: 'dept-cntt',
  scope: 'DEPARTMENT',
};

/** Actor: Chuyên viên (dbRole raw) */
const staffActor = {
  id: 'user-staff-01',
  role: 'STAFF',          // client simplified
  dbRole: 'CHUYEN_VIEN',  // raw DB role
  departmentId: 'dept-cntt',
};

/** Actor: Trưởng phòng */
const managerActor = {
  id: 'user-mgr-01',
  role: 'MANAGER',
  dbRole: 'TRUONG_PHONG',
  departmentId: 'dept-cntt',
};

/** Actor: Ban giám hiệu */
const executiveActor = {
  id: 'user-bgh-01',
  role: 'ADMIN',
  dbRole: 'BAN_GIAM_HIEU',
  departmentId: null,
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
      departmentId: 'dept-01',
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
      departmentId: 'dept-01',
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
