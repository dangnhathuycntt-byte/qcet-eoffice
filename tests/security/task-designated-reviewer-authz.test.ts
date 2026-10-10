/**
 * T-00 (spec task-document-gap-spec.md): đường duyệt cho người duyệt được chỉ định.
 *
 * Lỗi tái hiện: loadTaskAndBuildResource gom mọi TaskActor vào assigneeIds, nên
 * REVIEWER/APPROVER bị bước 10 (SoD) coi là người thực hiện và bị chặn tự duyệt;
 * FOLLOWER/OBSERVER nhận quyền cập nhật tiến độ và nộp kết quả qua isAssignee.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { authorize } from '@/server/authorization/authorization-engine';
import { AuthorizationContextModel, type ActivePositionAssignment } from '@/server/authorization/authorization-context';
import type { AuthorizationResource } from '@/server/authorization/resource';
import { partitionTaskActorUserIds } from '@/domain/tasks/task-actor-roles';
import { AssignmentStatus, AssignmentType, UnitStatus, UnitType } from '@prisma/client';

const UNIT = 'unit_dt';

function position(userId: string, positionCode: string, unitId = UNIT): ActivePositionAssignment {
  return {
    id: `pos_${userId}_${positionCode}`,
    userId,
    positionDefinitionId: `def_${positionCode}`,
    positionCode,
    positionTitle: positionCode,
    positionLevel: 1,
    isLeadership: false,
    unitId,
    unitCode: `CODE_${unitId}`,
    unitName: `Unit ${unitId}`,
    unitType: UnitType.DEPARTMENT,
    unitStatus: UnitStatus.ACTIVE,
    type: AssignmentType.PRIMARY,
    isActing: false,
    effectiveFrom: new Date('2025-01-01'),
    effectiveTo: null,
    status: AssignmentStatus.ACTIVE,
    sourceDecisionNumber: 'QD-01',
  };
}

function ctx(userId: string, positionCode = 'CHUYEN_VIEN', unitId = UNIT) {
  return new AuthorizationContextModel({
    userId,
    user: { id: userId, email: `${userId}@cdktcnqn.edu.vn`, name: userId, isActive: true },
    systemRoles: [],
    positions: [position(userId, positionCode, unitId)],
    responsibilityAreas: [],
    portfolios: [],
    delegations: [],
    bodyMemberships: [],
    primaryUnitIds: [unitId],
    generatedAt: new Date(),
  });
}

const ACTORS = [
  { role: 'DRI', userId: 'u_dri', isPrimaryDRI: true },
  { role: 'COLLABORATOR', userId: 'u_collab' },
  { role: 'FOLLOWER', userId: 'u_follow' },
  { role: 'OBSERVER', userId: 'u_observe' },
  { role: 'REVIEWER', userId: 'u_reviewer' },
  { role: 'APPROVER', userId: 'u_approver' },
  { role: 'LEAD_UNIT', userId: null },
];

function taskResource(): AuthorizationResource {
  const sets = partitionTaskActorUserIds(ACTORS);
  return {
    id: 'task_t00',
    type: 'task',
    scope: 'department',
    departmentId: UNIT,
    leadDepartmentId: UNIT,
    createdById: 'u_creator',
    assignerId: 'u_creator',
    primaryOwnerId: 'u_dri',
    status: 'WAITING_APPROVAL',
    submittedByUserId: 'u_dri',
    ...sets,
  };
}

describe('T-00 partitionTaskActorUserIds', () => {
  test('assigneeIds chỉ gồm vai trò thực hiện, không gồm người theo dõi, quan sát, duyệt', () => {
    const sets = partitionTaskActorUserIds(ACTORS);
    assert.deepEqual([...sets.assigneeIds].sort(), ['u_collab', 'u_dri']);
    assert.deepEqual(sets.collaboratorIds, ['u_collab']);
    assert.deepEqual(sets.followerIds, ['u_follow']);
    assert.deepEqual(sets.observerIds, ['u_observe']);
    assert.deepEqual(sets.reviewerIds, ['u_reviewer']);
    assert.deepEqual(sets.approverIds, ['u_approver']);
  });

  test('bỏ qua actor không có userId và loại trùng', () => {
    const sets = partitionTaskActorUserIds([
      { role: 'COLLABORATOR', userId: 'a' },
      { role: 'COLLABORATOR', userId: 'a' },
      { role: 'LEAD_UNIT', userId: null },
    ]);
    assert.deepEqual(sets.assigneeIds, ['a']);
    assert.deepEqual(sets.collaboratorIds, ['a']);
  });
});

describe('T-00 người duyệt được chỉ định', () => {
  test('chuyên viên được chỉ định REVIEWER đọc, thẩm tra và duyệt được', () => {
    const c = ctx('u_reviewer');
    assert.equal(authorize(c, 'task.read', taskResource()).allowed, true);
    assert.equal(authorize(c, 'task.review', taskResource()).allowed, true);
    assert.equal(authorize(c, 'task.approve', taskResource()).allowed, true);
  });

  test('chuyên viên được chỉ định APPROVER duyệt được', () => {
    const res = authorize(ctx('u_approver'), 'task.approve', taskResource());
    assert.equal(res.allowed, true, res.reason);
  });

  test('trưởng đơn vị khác được chỉ định APPROVER không bị chặn ranh giới đơn vị', () => {
    const res = authorize(ctx('u_approver', 'TRUONG_PHONG', 'unit_khac'), 'task.approve', taskResource());
    assert.equal(res.allowed, true, res.reason);
  });

  test('chuyên viên không được chỉ định không duyệt được', () => {
    assert.equal(authorize(ctx('u_other'), 'task.approve', taskResource()).allowed, false);
    assert.equal(authorize(ctx('u_other'), 'task.review', taskResource()).allowed, false);
  });

  test('người phối hợp không duyệt được (N4)', () => {
    assert.equal(authorize(ctx('u_collab'), 'task.approve', taskResource()).allowed, false);
  });

  test('người được chỉ định duyệt nhưng cũng là DRI bị chặn tự duyệt', () => {
    const resource = { ...taskResource(), reviewerIds: ['u_dri'], approverIds: ['u_dri'] };
    const res = authorize(ctx('u_dri'), 'task.approve', resource);
    assert.equal(res.allowed, false);
    assert.equal(res.rejectionCode, 'SOD_VIOLATION');
  });
});

describe('T-00 người theo dõi và quan sát chỉ đọc', () => {
  test('người theo dõi đọc được nhưng không cập nhật, không nộp kết quả', () => {
    const c = ctx('u_follow');
    assert.equal(authorize(c, 'task.read', taskResource()).allowed, true);
    assert.equal(authorize(c, 'task.update_execution', taskResource()).allowed, false);
    assert.equal(authorize(c, 'task.submit_result', taskResource()).allowed, false);
  });

  test('người quan sát không cập nhật được', () => {
    assert.equal(authorize(ctx('u_observe'), 'task.update_execution', taskResource()).allowed, false);
  });

  test('người duyệt được chỉ định không có quyền thực hiện', () => {
    assert.equal(authorize(ctx('u_reviewer'), 'task.submit_result', taskResource()).allowed, false);
  });
});
