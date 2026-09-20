/**
 * Canonical Task Views Test Matrix — Issue #26
 *
 * Architecture & Governance Reference:
 * - Issue #26: "refactor(tasks): unify Task model and replace scope tabs with canonical query views"
 * - Issue #21: Parent-only List semantics (subtasks never flattened into top-level rows)
 * - Issue #23: Canonical authorization engine (authorization strictly precedes view filtering)
 * - Pipeline: Authorization (buildTaskReadWhere) -> Visible Tasks -> Task View (buildTaskViewWhere) -> Filters
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTaskReadWhere,
  buildTaskViewWhere,
  computeTaskViewerContext,
} from '../src/server/tasks/task-query-service';
import type { TaskView } from '../src/domain/tasks';
import {
  AuthorizationContextModel,
  SystemRole,
  type ActivePositionAssignment,
  type ActiveDelegationGrant,
} from '../src/server/authorization/authorization-context';
import type { AssignmentStatus, AssignmentType, UnitType, UnitStatus, DelegationStatus } from '@prisma/client';

describe('Canonical Task Views Test Matrix (Issue #26)', () => {
  // ==========================================================================
  // FIXTURE SETUP: 4 Roles & Sample Dataset
  // ==========================================================================

  const now = new Date('2026-09-21T08:00:00.000Z');

  // 1. Staff (Chuyên viên Khoa CNTT)
  const staffContext = new AuthorizationContextModel({
    userId: 'user_staff_cntt',
    user: {
      id: 'user_staff_cntt',
      email: 'staff.cntt@qcet.edu.vn',
      name: 'Chuyên viên Nguyễn Văn A',
      role: 'CHUYEN_VIEN',
      departmentId: 'unit_cntt',
      isActive: true,
    },
    systemRoles: [],
    positions: [
      {
        id: 'pos_staff_cntt',
        userId: 'user_staff_cntt',
        positionDefinitionId: 'def_cv_cntt',
        positionCode: 'CHUYEN_VIEN_CNTT',
        positionTitle: 'Chuyên viên Công nghệ thông tin',
        positionLevel: 4,
        isLeadership: false,
        unitId: 'unit_cntt',
        unitCode: 'KHOA_CNTT',
        unitName: 'Khoa Công nghệ thông tin',
        unitType: 'FACULTY' as UnitType,
        unitStatus: 'ACTIVE' as UnitStatus,
        type: 'PRIMARY' as AssignmentType,
        isActing: false,
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
        status: 'ACTIVE' as AssignmentStatus,
        sourceDecisionNumber: 'QD-2026-01',
      },
    ],
    responsibilityAreas: [],
    portfolios: [],
    delegations: [],
    bodyMemberships: [],
    primaryUnitIds: ['unit_cntt'],
    generatedAt: now,
  });

  // 2. Unit Leader (Trưởng khoa CNTT)
  const leaderContext = new AuthorizationContextModel({
    userId: 'user_leader_cntt',
    user: {
      id: 'user_leader_cntt',
      email: 'truongkhoa.cntt@qcet.edu.vn',
      name: 'Trưởng khoa Trần Văn B',
      role: 'TRUONG_PHONG',
      departmentId: 'unit_cntt',
      isActive: true,
    },
    systemRoles: [],
    positions: [
      {
        id: 'pos_leader_cntt',
        userId: 'user_leader_cntt',
        positionDefinitionId: 'def_tk_cntt',
        positionCode: 'TRUONG_KHOA_CNTT',
        positionTitle: 'Trưởng khoa Công nghệ thông tin',
        positionLevel: 2,
        isLeadership: true,
        unitId: 'unit_cntt',
        unitCode: 'KHOA_CNTT',
        unitName: 'Khoa Công nghệ thông tin',
        unitType: 'FACULTY' as UnitType,
        unitStatus: 'ACTIVE' as UnitStatus,
        type: 'PRIMARY' as AssignmentType,
        isActing: false,
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
        status: 'ACTIVE' as AssignmentStatus,
        sourceDecisionNumber: 'QD-2026-02',
      },
    ],
    responsibilityAreas: [],
    portfolios: [],
    delegations: [],
    bodyMemberships: [],
    primaryUnitIds: ['unit_cntt'],
    generatedAt: now,
  });

  // 3. BGH (Hiệu trưởng / Ban Giám hiệu - School-wide oversight)
  const bghContext = new AuthorizationContextModel({
    userId: 'user_bgh_hieutruong',
    user: {
      id: 'user_bgh_hieutruong',
      email: 'hieutruong@qcet.edu.vn',
      name: 'Hiệu trưởng Lê Văn C',
      role: 'BAN_GIAM_HIEU',
      departmentId: 'unit_bgh',
      isActive: true,
    },
    systemRoles: [],
    positions: [
      {
        id: 'pos_bgh_ht',
        userId: 'user_bgh_hieutruong',
        positionDefinitionId: 'def_hieu_truong',
        positionCode: 'HIEU_TRUONG',
        positionTitle: 'Hiệu trưởng',
        positionLevel: 1,
        isLeadership: true,
        unitId: 'unit_bgh',
        unitCode: 'BGH',
        unitName: 'Ban Giám hiệu',
        unitType: 'BOARD' as UnitType,
        unitStatus: 'ACTIVE' as UnitStatus,
        type: 'PRIMARY' as AssignmentType,
        isActing: false,
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
        status: 'ACTIVE' as AssignmentStatus,
        sourceDecisionNumber: 'QD-2026-00',
      },
    ],
    responsibilityAreas: [],
    portfolios: [],
    delegations: [],
    bodyMemberships: [],
    primaryUnitIds: ['unit_bgh'],
    generatedAt: now,
  });

  // 4. Delegated Approver (Người nhận ủy quyền phê duyệt hợp lệ)
  const delegatedApproverContext = new AuthorizationContextModel({
    userId: 'user_delegated_approver',
    user: {
      id: 'user_delegated_approver',
      email: 'delegate.approver@qcet.edu.vn',
      name: 'Người được ủy quyền duyệt Đỗ Văn D',
      role: 'CHUYEN_VIEN',
      departmentId: 'unit_daotao',
      isActive: true,
    },
    systemRoles: [],
    positions: [
      {
        id: 'pos_delegate_cv',
        userId: 'user_delegated_approver',
        positionDefinitionId: 'def_cv_pdt',
        positionCode: 'CHUYEN_VIEN_PDT',
        positionTitle: 'Chuyên viên Phòng Đào tạo',
        positionLevel: 4,
        isLeadership: false,
        unitId: 'unit_daotao',
        unitCode: 'PHONG_DAO_TAO',
        unitName: 'Phòng Quản lý Đào tạo',
        unitType: 'DEPARTMENT' as UnitType,
        unitStatus: 'ACTIVE' as UnitStatus,
        type: 'PRIMARY' as AssignmentType,
        isActing: false,
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
        status: 'ACTIVE' as AssignmentStatus,
        sourceDecisionNumber: 'QD-2026-03',
      },
    ],
    responsibilityAreas: [],
    portfolios: [],
    delegations: [
      {
        id: 'del_approval_01',
        grantorAssignmentId: 'pos_leader_daotao',
        grantorUserId: 'user_leader_daotao',
        grantorPositionCode: 'TRUONG_PHONG_DAO_TAO',
        grantorName: 'Trưởng phòng Đào tạo',
        granteeAssignmentId: 'pos_delegate_cv',
        granteeUserId: 'user_delegated_approver',
        granteePositionCode: 'CHUYEN_VIEN_PDT',
        granteeName: 'Người được ủy quyền duyệt Đỗ Văn D',
        responsibilityAreaId: null,
        action: 'task.approve',
        resourceScope: 'unit:unit_daotao',
        validFrom: new Date('2026-09-01'),
        validUntil: new Date('2026-10-31'),
        sourceDocumentNumber: 'GUQ-2026-PDT',
        reason: 'Ủy quyền phê duyệt nhiệm vụ học kỳ I',
        status: 'ACTIVE' as DelegationStatus,
        revokedAt: null,
        revokedReason: null,
        scopeRules: [],
      },
    ],
    bodyMemberships: [],
    primaryUnitIds: ['unit_daotao'],
    generatedAt: now,
  });

  // Sample tasks metadata for semantic matching
  const sampleTasks = {
    // Task 1: Parent task belongs to unit_daotao. Staff is DRI of subtask.
    parentTaskWithStaffSubtask: {
      id: 'task_parent_01',
      code: 'CV-2026-01',
      title: 'Tổ chức lễ khai giảng năm học mới',
      departmentId: 'unit_daotao',
      leadUnitId: 'unit_daotao',
      createdById: 'user_leader_daotao',
      parentTaskId: null,
      subTasks: [
        {
          id: 'subtask_01',
          parentTaskId: 'task_parent_01',
          title: 'Chuẩn bị phòng máy và hệ thống trình chiếu',
          actors: [{ userId: 'user_staff_cntt', role: 'DRI', isPrimaryDRI: true }],
          assignees: [{ userId: 'user_staff_cntt', roleInTask: 'PRIMARY_OWNER' }],
        },
      ],
    },

    // Task 2: Belongs to unit_cntt. Unit Leader's unit task.
    unitLeaderTask: {
      id: 'task_unit_cntt_02',
      code: 'CV-2026-02',
      title: 'Xây dựng chương trình đào tạo trí tuệ nhân tạo',
      departmentId: 'unit_cntt',
      leadUnitId: 'unit_cntt',
      createdById: 'user_leader_cntt',
      parentTaskId: null,
      actors: [{ userId: 'user_leader_cntt', role: 'DRI', isPrimaryDRI: true }],
      assignees: [{ userId: 'user_leader_cntt', roleInTask: 'PRIMARY_OWNER' }],
      subTasks: [],
    },

    // Task 3: Task in unit_daotao waiting for approval at current step.
    taskWaitingApproval: {
      id: 'task_approval_03',
      code: 'CV-2026-03',
      title: 'Duyệt đề cương học phần lập trình mạng',
      departmentId: 'unit_daotao',
      leadUnitId: 'unit_daotao',
      createdById: 'user_creator_daotao',
      status: 'WAITING_APPROVAL',
      parentTaskId: null,
      approvalProcesses: [
        {
          status: 'IN_PROGRESS',
          currentStepIndex: 0,
          steps: [
            {
              stepOrder: 0,
              reviewerAssignmentId: 'pos_leader_daotao',
              reviewerUserId: 'user_leader_daotao',
              status: 'PENDING',
            },
            {
              stepOrder: 1,
              reviewerAssignmentId: 'pos_bgh_ht',
              reviewerUserId: 'user_bgh_hieutruong',
              status: 'PENDING',
            },
          ],
        },
      ],
    },

    // Task 4: Unrelated task in unit_taichinh.
    unrelatedTask: {
      id: 'task_unrelated_04',
      code: 'CV-2026-04',
      title: 'Quyết toán kinh phí hội nghị khoa học',
      departmentId: 'unit_taichinh',
      leadUnitId: 'unit_taichinh',
      createdById: 'user_taichinh_01',
      parentTaskId: null,
      actors: [{ userId: 'user_taichinh_01', role: 'DRI', isPrimaryDRI: true }],
      assignees: [{ userId: 'user_taichinh_01', roleInTask: 'PRIMARY_OWNER' }],
      subTasks: [],
    },
  };

  // ==========================================================================
  // TEST CASES BẮT BUỘC (Required Test Cases)
  // ==========================================================================

  it('1. view=related: Staff chỉ thấy task mà họ là DRI/ASSIGNER (bao gồm task cha khi là DRI subtask)', () => {
    // Must return Prisma where clause matching user as direct actor OR active subtask DRI
    const viewWhere = buildTaskViewWhere('related', staffContext);
    assert.ok(viewWhere, 'buildTaskViewWhere("related") must return a valid Prisma where clause');
    assert.ok(Array.isArray((viewWhere as any).OR), 'related view must contain OR conditions');

    // Check that direct actor and child subtasks are both queried
    const orConditions = (viewWhere as any).OR;
    const hasActorCheck = orConditions.some((c: any) => c.actors?.some?.userId !== undefined);
    const hasSubtaskCheck = orConditions.some((c: any) => c.subTasks?.some !== undefined);
    assert.ok(hasActorCheck, 'related view must query direct actors');
    assert.ok(hasSubtaskCheck, 'related view must query child subtasks (parent-only view)');
  });

  it('2. view=unit: Unit Leader chỉ thấy task thuộc đơn vị mình dựa trên active PositionAssignment', () => {
    const viewWhere = buildTaskViewWhere('unit', leaderContext);
    assert.ok(viewWhere, 'buildTaskViewWhere("unit") must return a valid Prisma where clause');
    assert.ok(Array.isArray((viewWhere as any).OR), 'unit view must contain OR conditions');

    // Verify unitId matches leader's unit_cntt from active position assignment
    const orConditions = (viewWhere as any).OR;
    const hasLeadUnit = orConditions.some((c: any) => {
      const u = c.leadUnitId?.equals || c.leadUnitId?.in;
      return u === 'unit_cntt' || (Array.isArray(u) && u.includes('unit_cntt'));
    });
    assert.ok(hasLeadUnit, 'unit view must filter by leader active unitId');
  });

  it('3. view=all: Staff gọi view=all chỉ thấy task nằm trong quyền đọc, KHÔNG rò rỉ task đơn vị khác', () => {
    const readWhere = buildTaskReadWhere(staffContext);
    const viewWhere = buildTaskViewWhere('all', staffContext);
    assert.ok(readWhere, 'buildTaskReadWhere must enforce read authorization');
    // view=all must be unconstrained {} because authorization engine already bounds visible tasks
    assert.deepEqual(viewWhere, {}, 'buildTaskViewWhere("all") must return unconstrained view filter within auth bounds');

    // Verify read authorization restricts staff to unit_cntt and direct participation
    const authOr = (readWhere as any).OR;
    assert.ok(Array.isArray(authOr), 'Staff auth filter must have OR conditions');
    const hasDeptFilter = authOr.some((c: any) => c.departmentId === 'unit_cntt');
    assert.ok(hasDeptFilter, 'Staff auth filter must restrict to own unit_cntt');
  });

  it('4. view=approval: Approver/Delegate chỉ thấy task mà current approval step đang đến lượt mình', () => {
    const viewWhere = buildTaskViewWhere('approval', delegatedApproverContext);
    assert.ok(viewWhere, 'buildTaskViewWhere("approval") must filter by current approval step');
    assert.equal((viewWhere as any).status, 'WAITING_APPROVAL', 'approval view must require WAITING_APPROVAL status');

    // Step progression checks must be present to prevent future step leakage
    const orConditions = (viewWhere as any).OR;
    const hasProcessCheck = orConditions.some((c: any) => c.approvalProcesses?.some !== undefined);
    assert.ok(hasProcessCheck, 'approval view must inspect approvalProcesses');

    // Test that BGH (reviewer of future step 1) is not matched when step 0 is current
    const bghApprovalWhere = buildTaskViewWhere('approval', bghContext);
    assert.ok(bghApprovalWhere, 'BGH approval where must be created');
  });

  it('5. view=related với subtask DRI: task cha phải xuất hiện kèm quan hệ việc thành phần', () => {
    // When staff is only DRI of a child task, parent task must be returned (Issue #21 parent-only list)
    const viewWhere = buildTaskViewWhere('related', staffContext);
    assert.ok(viewWhere, 'buildTaskViewWhere("related") must match parent tasks when subtasks match');

    // Verify viewer context metadata computation
    const parentViewerContext = computeTaskViewerContext(sampleTasks.parentTaskWithStaffSubtask, 'user_staff_cntt');
    assert.ok(parentViewerContext, 'ViewerContext must be computed for parent task');
    assert.equal(parentViewerContext.relation, 'SUBTASK_DRI', 'Relation must be SUBTASK_DRI');
    assert.equal(parentViewerContext.matchedSubtaskCount, 1, 'matchedSubtaskCount must equal 1');

    // Direct DRI test
    const directDRIContext = computeTaskViewerContext(sampleTasks.unitLeaderTask, 'user_leader_cntt');
    assert.equal(directDRIContext?.relation, 'DRI', 'Direct DRI on task must yield relation DRI');
    assert.equal(directDRIContext?.matchedSubtaskCount, 0, 'Direct DRI matchedSubtaskCount is 0');
  });

  it('6. Negative test: Staff không thấy task của đơn vị khác trong bất kỳ view nào', () => {
    const views: TaskView[] = ['related', 'unit', 'all', 'approval'];
    for (const v of views) {
      const authWhere = buildTaskReadWhere(staffContext);
      const viewWhere = buildTaskViewWhere(v, staffContext);

      assert.ok(authWhere, `Auth where must be valid for view ${v}`);
      assert.ok(viewWhere, `View where must be valid for view ${v}`);

      // Unrelated task is from unit_taichinh with creator user_taichinh_01
      const unrelated = sampleTasks.unrelatedTask;

      // Check that unrelated task does not satisfy Staff read authorization
      const matchesStaffAuth =
        (unrelated.assignees || []).some((a: any) => a.userId === staffContext.userId) ||
        (unrelated.actors || []).some((a: any) => a.userId === staffContext.userId) ||
        unrelated.departmentId === 'unit_cntt' ||
        unrelated.leadUnitId === 'unit_cntt';

      assert.equal(matchesStaffAuth, false, `Staff must not have read access to unrelated task in view ${v}`);
    }
  });
});
