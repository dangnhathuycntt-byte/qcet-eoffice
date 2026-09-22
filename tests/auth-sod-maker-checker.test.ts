import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkAntiSelfApproval,
  checkSeparationOfDuties,
  assertAntiSelfApproval,
  assertSeparationOfDuties,
  evaluateTaskCapabilityMatrix,
} from '../src/domain/tasks/contract';
import { taskStateMachine } from '../src/domain/tasks/state-machine';
import { isTaskMaker } from '../src/domain/tasks/attention-resolver';
import {
  authorize,
  assertAuthorized,
} from '../src/server/authorization/authorization-engine';
import { SeparationOfDutiesError } from '../src/server/authorization/errors';
import {
  AuthorizationContextModel,
  type ActivePositionAssignment,
  type ActiveDelegationGrant,
} from '../src/server/authorization/authorization-context';
import type { TaskResource } from '../src/server/authorization/resource';
import {
  AssignmentStatus,
  AssignmentType,
  UnitStatus,
  UnitType,
  DelegationStatus,
} from '@prisma/client';

function createPosition(data: {
  id?: string;
  userId?: string;
  positionCode: string;
  positionTitle?: string;
  unitId: string;
  isLeadership?: boolean;
}): ActivePositionAssignment {
  return {
    id: data.id ?? `pos_${data.positionCode}_${data.unitId}`,
    userId: data.userId ?? 'usr_test_1',
    positionDefinitionId: `def_${data.positionCode}`,
    positionCode: data.positionCode,
    positionTitle: data.positionTitle ?? data.positionCode,
    positionLevel: 1,
    isLeadership: data.isLeadership ?? false,
    unitId: data.unitId,
    unitCode: `CODE_${data.unitId}`,
    unitName: `Unit ${data.unitId}`,
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

function createAuthContext(overrides: {
  userId?: string;
  positions?: ActivePositionAssignment[];
  delegations?: ActiveDelegationGrant[];
  primaryUnitIds?: string[];
}): AuthorizationContextModel {
  const userId = overrides.userId ?? 'user_tester_1';
  return new AuthorizationContextModel({
    userId,
    user: {
      id: userId,
      email: `${userId}@cdktcnqn.edu.vn`,
      name: `User ${userId}`,
      isActive: true,
    },
    systemRoles: [],
    positions: overrides.positions ?? [
      createPosition({
        userId,
        positionCode: 'TRUONG_PHONG',
        positionTitle: 'Trưởng phòng Đào tạo',
        unitId: 'dept_dt',
        isLeadership: true,
      }),
    ],
    responsibilityAreas: [],
    portfolios: [],
    delegations: overrides.delegations ?? [],
    bodyMemberships: [],
    primaryUnitIds: overrides.primaryUnitIds ?? ['dept_dt'],
    generatedAt: new Date(),
  });
}

describe('WI-1.1: Unified Maker-Checker SoD Guard & Delegation Invariant (#35)', () => {
  // ==========================================================================
  // a) Creator cannot self-approve
  // ==========================================================================
  describe('a) Creator cannot self-approve', () => {
    it('checkAntiSelfApproval / checkSeparationOfDuties rejects creatorId with SOD_CREATOR_CANNOT_APPROVE', () => {
      const sod1 = checkAntiSelfApproval({
        userId: 'creator_1',
        creatorId: 'creator_1',
        primaryOwnerId: 'other_user',
      });
      assert.equal(sod1.allowed, false);
      assert.equal(sod1.violationCode, 'SOD_CREATOR_CANNOT_APPROVE');

      const sod2 = checkSeparationOfDuties({
        userId: 'creator_2',
        createdById: 'creator_2',
        primaryOwnerId: 'other_user',
      });
      assert.equal(sod2.allowed, false);
      assert.equal(sod2.violationCode, 'SOD_CREATOR_CANNOT_APPROVE');

      assert.throws(
        () => assertAntiSelfApproval({ userId: 'c1', creatorId: 'c1' }),
        (err: any) => err.code === 'SOD_CREATOR_CANNOT_APPROVE'
      );
      assert.throws(
        () => assertSeparationOfDuties({ userId: 'c1', createdById: 'c1' }),
        (err: any) => err.code === 'SOD_CREATOR_CANNOT_APPROVE'
      );
    });

    it('taskStateMachine rejects WAITING_APPROVAL -> COMPLETED when actor is creator', () => {
      const actor = {
        id: 'creator_mgr',
        role: 'TRUONG_PHONG',
        departmentId: 'dept_cntt',
      };
      const task = {
        id: 'task_created_by_actor',
        scope: 'DEPARTMENT',
        departmentId: 'dept_cntt',
        createdById: 'creator_mgr',
        primaryOwnerId: 'staff_1',
        assigneeIds: ['staff_1'],
      };

      const res = taskStateMachine.canTransition(
        actor,
        task,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.equal(res.allowed, false);
      assert.equal(res.code, 'MAKER_CANNOT_BE_CHECKER');
    });

    it('evaluateTaskCapabilityMatrix strips CAN_APPROVE and CAN_REJECT for creator', () => {
      const actor = {
        id: 'rector_creator',
        role: 'HIEU_TRUONG',
        departmentId: null,
      };
      const task = {
        id: 'task_school_1',
        status: 'WAITING_APPROVAL',
        creatorId: 'rector_creator',
        primaryOwnerId: 'staff_1',
      };

      const result = evaluateTaskCapabilityMatrix(actor, task);
      assert.equal(result.matrix.CAN_APPROVE, false);
      assert.equal(result.matrix.CAN_REJECT, false);
      assert.match(result.reasons.CAN_APPROVE || '', /nguyên tắc phân lập trách nhiệm/);
    });

    it('authorizationEngine denies task.approve for creator with SOD_VIOLATION', () => {
      const ctx = createAuthContext({
        userId: 'creator_user',
      });
      const taskResource: TaskResource = {
        id: 'task_001',
        type: 'task',
        creatorId: 'creator_user',
        leadUnitId: 'dept_dt',
        status: 'SUBMITTED',
      };

      const res = authorize(ctx, 'task.approve', taskResource);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, 'SOD_VIOLATION');
      assert.throws(
        () => assertAuthorized(ctx, 'task.approve', taskResource),
        SeparationOfDutiesError
      );
    });
  });

  // ==========================================================================
  // b) Submitter cannot self-approve
  // ==========================================================================
  describe('b) Submitter cannot self-approve', () => {
    it('checkAntiSelfApproval rejects submittedByUserId with SOD_SUBMITTER_CANNOT_APPROVE', () => {
      const sod = checkAntiSelfApproval({
        userId: 'submitter_1',
        creatorId: 'other_user',
        primaryOwnerId: 'other_dri',
        submittedByUserId: 'submitter_1',
      });
      assert.equal(sod.allowed, false);
      assert.equal(sod.violationCode, 'SOD_SUBMITTER_CANNOT_APPROVE');
      assert.match(sod.reason || '', /nộp báo cáo kết quả không được tự phê duyệt/);
    });

    it('checkAntiSelfApproval rejects deliverable uploader with SOD_DELIVERABLE_UPLOADER_CANNOT_APPROVE', () => {
      const sod1 = checkAntiSelfApproval({
        userId: 'uploader_1',
        creatorId: 'other_user',
        primaryOwnerId: 'other_dri',
        deliverableUploadedByIds: ['uploader_1'],
      });
      assert.equal(sod1.allowed, false);
      assert.equal(sod1.violationCode, 'SOD_DELIVERABLE_UPLOADER_CANNOT_APPROVE');

      const sod2 = checkAntiSelfApproval({
        userId: 'uploader_2',
        creatorId: 'other_user',
        primaryOwnerId: 'other_dri',
        deliverables: [{ uploadedById: 'uploader_2' }],
      });
      assert.equal(sod2.allowed, false);
      assert.equal(sod2.violationCode, 'SOD_DELIVERABLE_UPLOADER_CANNOT_APPROVE');
    });

    it('taskStateMachine rejects WAITING_APPROVAL -> COMPLETED when actor is submitter', () => {
      const actor = {
        id: 'mgr_submitter',
        role: 'TRUONG_PHONG',
        departmentId: 'dept_cntt',
      };
      const task = {
        id: 'task_submitted_by_mgr',
        scope: 'DEPARTMENT',
        departmentId: 'dept_cntt',
        createdById: 'admin_1',
        primaryOwnerId: 'staff_1',
        assigneeIds: ['staff_1'],
        submittedByUserId: 'mgr_submitter',
      };

      const res = taskStateMachine.canTransition(
        actor,
        task,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.equal(res.allowed, false);
      assert.equal(res.code, 'MAKER_CANNOT_BE_CHECKER');
    });

    it('authorizationEngine denies task.approve and task.review for submitter with SOD_VIOLATION', () => {
      const ctx = createAuthContext({
        userId: 'submitter_actor',
      });
      const taskResource: TaskResource = {
        id: 'task_submit_1',
        type: 'task',
        creatorId: 'admin_1',
        primaryOwnerId: 'staff_1',
        leadUnitId: 'dept_dt',
        submittedByUserId: 'submitter_actor',
        status: 'SUBMITTED',
      };

      const resApprove = authorize(ctx, 'task.approve', taskResource);
      assert.equal(resApprove.allowed, false);
      assert.equal(resApprove.rejectionCode, 'SOD_VIOLATION');

      const resReview = authorize(ctx, 'task.review', taskResource);
      assert.equal(resReview.allowed, false);
      assert.equal(resReview.rejectionCode, 'SOD_VIOLATION');
    });
  });

  // ==========================================================================
  // c) Actor with delegation who is a Maker CANNOT approve (delegation does not bypass SoD)
  // ==========================================================================
  describe('c) Delegation Invariant: Maker CANNOT approve even with active delegation', () => {
    it('taskStateMachine: DRI with active delegation CANNOT transition to COMPLETED', () => {
      const delegatedDri = {
        id: 'dri_actor',
        role: 'TRUONG_PHONG',
        departmentId: 'dept_cntt',
        isDelegated: true,
        delegatedTaskIds: ['task_dri_1'],
      };
      const task = {
        id: 'task_dri_1',
        scope: 'DEPARTMENT',
        departmentId: 'dept_cntt',
        createdById: 'admin_1',
        primaryOwnerId: 'dri_actor',
        assigneeIds: ['dri_actor'],
      };

      const res = taskStateMachine.canTransition(
        delegatedDri,
        task,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.equal(res.allowed, false);
      assert.equal(res.code, 'MAKER_CANNOT_BE_CHECKER');
    });

    it('taskStateMachine: Creator with active delegation CANNOT transition to COMPLETED', () => {
      const delegatedCreator = {
        id: 'creator_actor',
        role: 'TRUONG_PHONG',
        departmentId: 'dept_cntt',
        isDelegated: true,
        delegatedTaskIds: ['task_creator_1'],
      };
      const task = {
        id: 'task_creator_1',
        scope: 'DEPARTMENT',
        departmentId: 'dept_cntt',
        createdById: 'creator_actor',
        primaryOwnerId: 'staff_2',
        assigneeIds: ['staff_2'],
      };

      const res = taskStateMachine.canTransition(
        delegatedCreator,
        task,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.equal(res.allowed, false);
      assert.equal(res.code, 'MAKER_CANNOT_BE_CHECKER');
    });

    it('evaluateTaskCapabilityMatrix: Actor with valid task.approve delegation who is an assignee CANNOT CAN_APPROVE', () => {
      const actor = {
        id: 'delegated_assignee',
        role: 'CHUYEN_VIEN',
        departmentId: 'dept_1',
      };
      const task = {
        id: 'task_assigned_1',
        status: 'WAITING_APPROVAL',
        creatorId: 'admin_1',
        primaryOwnerId: 'other_lead',
        assigneeIds: ['delegated_assignee', 'other_lead'],
      };
      const activeDelegation = [
        {
          action: 'task.approve',
          granteeUserId: 'delegated_assignee',
          validFrom: new Date('2025-01-01'),
          validUntil: new Date('2028-01-01'),
          status: 'ACTIVE',
        },
      ];

      const result = evaluateTaskCapabilityMatrix(actor, task, activeDelegation);
      assert.equal(result.matrix.CAN_APPROVE, false);
      assert.equal(result.matrix.CAN_REJECT, false);
      assert.match(result.reasons.CAN_APPROVE || '', /nguyên tắc phân lập trách nhiệm/);
    });

    it('authorizationEngine: Actor with valid DelegationGrant who is a Maker CANNOT task.approve (Step 10 SoD overrides Step 8)', () => {
      const userId = 'delegated_maker';
      const grant: ActiveDelegationGrant = {
        id: 'grant_approval_001',
        grantorAssignmentId: 'pos_rector',
        grantorUserId: 'ht_rector',
        granteeAssignmentId: 'pos_grantee',
        granteeUserId: userId,
        responsibilityAreaId: null,
        action: 'task.approve',
        resourceScope: 'INSTITUTION_WIDE',
        validFrom: new Date('2025-01-01'),
        validUntil: new Date('2028-01-01'),
        sourceDocumentNumber: 'UQ-01',
        reason: 'Approval delegation',
        status: DelegationStatus.ACTIVE,
        revokedAt: null,
        revokedReason: null,
        scopeRules: [],
      };

      const ctx = createAuthContext({
        userId,
        positions: [
          createPosition({
            id: 'pos_grantee',
            userId,
            positionCode: 'CAN_BO_CHUYEN_VIEN_CANONICAL',
            positionTitle: 'Chuyên viên',
            unitId: 'dept_dt',
            isLeadership: false,
          }),
        ],
        delegations: [grant],
      });

      // 1. As Creator: MUST FAIL with SOD_VIOLATION
      const taskCreator: TaskResource = {
        id: 'task_del_1',
        type: 'task',
        creatorId: userId,
        leadUnitId: 'dept_dt',
        status: 'SUBMITTED',
      };
      const res1 = authorize(ctx, 'task.approve', taskCreator);
      assert.equal(res1.allowed, false);
      assert.equal(res1.rejectionCode, 'SOD_VIOLATION');

      // 2. As Primary Owner DRI: MUST FAIL with SOD_VIOLATION
      const taskDri: TaskResource = {
        id: 'task_del_2',
        type: 'task',
        creatorId: 'other_user',
        primaryOwnerId: userId,
        leadUnitId: 'dept_dt',
        status: 'SUBMITTED',
      };
      const res2 = authorize(ctx, 'task.approve', taskDri);
      assert.equal(res2.allowed, false);
      assert.equal(res2.rejectionCode, 'SOD_VIOLATION');

      // 3. As Assignee: MUST FAIL with SOD_VIOLATION
      const taskAssignee: TaskResource = {
        id: 'task_del_3',
        type: 'task',
        creatorId: 'other_user',
        primaryOwnerId: 'lead_user',
        assigneeIds: [userId],
        leadUnitId: 'dept_dt',
        status: 'SUBMITTED',
      };
      const res3 = authorize(ctx, 'task.approve', taskAssignee);
      assert.equal(res3.allowed, false);
      assert.equal(res3.rejectionCode, 'SOD_VIOLATION');

      // 4. As Submitter: MUST FAIL with SOD_VIOLATION
      const taskSubmitter: TaskResource = {
        id: 'task_del_4',
        type: 'task',
        creatorId: 'other_user',
        primaryOwnerId: 'lead_user',
        submittedByUserId: userId,
        leadUnitId: 'dept_dt',
        status: 'SUBMITTED',
      };
      const res4 = authorize(ctx, 'task.approve', taskSubmitter);
      assert.equal(res4.allowed, false);
      assert.equal(res4.rejectionCode, 'SOD_VIOLATION');

      // 5. As Deliverable Uploader: MUST FAIL with SOD_VIOLATION
      const taskUploader: TaskResource = {
        id: 'task_del_5',
        type: 'task',
        creatorId: 'other_user',
        primaryOwnerId: 'lead_user',
        uploadedById: userId,
        leadUnitId: 'dept_dt',
        status: 'SUBMITTED',
      };
      const res5 = authorize(ctx, 'task.approve', taskUploader);
      assert.equal(res5.allowed, false);
      assert.equal(res5.rejectionCode, 'SOD_VIOLATION');

      // 6. Control: When actor is NOT a maker, delegation DOES permit approval
      const taskIndependent: TaskResource = {
        id: 'task_del_6',
        type: 'task',
        creatorId: 'other_creator',
        primaryOwnerId: 'other_lead',
        leadUnitId: 'dept_dt',
        status: 'SUBMITTED',
      };
      const res6 = authorize(ctx, 'task.approve', taskIndependent);
      assert.equal(res6.allowed, true);
    });
  });

  // ==========================================================================
  // d) All maker shape variants in attention resolver correctly identify maker
  // ==========================================================================
  describe('d) All maker shape variants in attention resolver correctly identify the maker', () => {
    const TARGET = 'target_user_id';

    it('identifies creator shapes', () => {
      assert.equal(isTaskMaker({ creatorId: TARGET }, TARGET), true);
      assert.equal(isTaskMaker({ createdById: TARGET }, TARGET), true);
      assert.equal(isTaskMaker({ creator: TARGET }, TARGET), true);
      assert.equal(isTaskMaker({ creator: { id: TARGET } }, TARGET), true);
      assert.equal(isTaskMaker({ creator: { userId: TARGET } }, TARGET), true);
    });

    it('identifies DRI / primaryOwner shapes', () => {
      assert.equal(isTaskMaker({ driId: TARGET }, TARGET), true);
      assert.equal(isTaskMaker({ primaryOwnerId: TARGET }, TARGET), true);
      assert.equal(isTaskMaker({ primaryOwner: TARGET }, TARGET), true);
      assert.equal(isTaskMaker({ primaryOwner: { id: TARGET } }, TARGET), true);
      assert.equal(isTaskMaker({ primaryOwner: { userId: TARGET } }, TARGET), true);
    });

    it('identifies assignedTo variants', () => {
      assert.equal(isTaskMaker({ assigneeId: TARGET }, TARGET), true);
      assert.equal(isTaskMaker({ leadAssigneeId: TARGET }, TARGET), true);
      assert.equal(isTaskMaker({ assignedToId: TARGET }, TARGET), true);
      assert.equal(isTaskMaker({ assignedTo: TARGET }, TARGET), true);
      assert.equal(isTaskMaker({ assignedTo: { id: TARGET } }, TARGET), true);
      assert.equal(isTaskMaker({ assignedTo: { userId: TARGET } }, TARGET), true);
    });

    it('identifies assignees array variants', () => {
      assert.equal(isTaskMaker({ assigneeIds: [TARGET, 'other'] }, TARGET), true);
      assert.equal(isTaskMaker({ assignees: [TARGET, 'other'] }, TARGET), true);
      assert.equal(isTaskMaker({ assignees: [{ id: TARGET }, { id: 'other' }] }, TARGET), true);
      assert.equal(isTaskMaker({ assignees: [{ userId: TARGET }, { userId: 'other' }] }, TARGET), true);
    });

    it('identifies collaborators array variants', () => {
      assert.equal(isTaskMaker({ collaborators: [TARGET, 'other'] }, TARGET), true);
      assert.equal(isTaskMaker({ collaborators: [{ id: TARGET }] }, TARGET), true);
      assert.equal(isTaskMaker({ collaborators: [{ userId: TARGET }] }, TARGET), true);
    });

    it('identifies co-assignees variants', () => {
      assert.equal(isTaskMaker({ coAssigneeIds: [TARGET, 'other'] }, TARGET), true);
      assert.equal(isTaskMaker({ coAssignees: [TARGET, 'other'] }, TARGET), true);
      assert.equal(isTaskMaker({ coAssignees: [{ id: TARGET }] }, TARGET), true);
      assert.equal(isTaskMaker({ coAssignees: [{ userId: TARGET }] }, TARGET), true);
    });

    it('identifies submitter variant', () => {
      assert.equal(isTaskMaker({ submittedByUserId: TARGET }, TARGET), true);
    });

    it('identifies deliverable uploader variants', () => {
      assert.equal(isTaskMaker({ uploadedById: TARGET }, TARGET), true);
      assert.equal(isTaskMaker({ deliverableUploadedByIds: [TARGET] }, TARGET), true);
      assert.equal(isTaskMaker({ deliverables: [{ uploadedById: TARGET }] }, TARGET), true);
      assert.equal(isTaskMaker({ deliverables: [{ uploadedByUserId: TARGET }] }, TARGET), true);
    });

    it('returns false when user is completely independent (non-maker)', () => {
      const independentTask = {
        creatorId: 'other_1',
        createdById: 'other_1',
        primaryOwnerId: 'other_2',
        driId: 'other_2',
        assigneeIds: ['other_2', 'other_3'],
        assignees: [{ userId: 'other_2' }, { userId: 'other_3' }],
        collaborators: [{ userId: 'other_4' }],
        coAssigneeIds: ['other_5'],
        submittedByUserId: 'other_6',
        deliverables: [{ uploadedById: 'other_7' }],
      };
      assert.equal(isTaskMaker(independentTask, TARGET), false);
    });

    it('returns false for null, undefined, or empty actor or task', () => {
      assert.equal(isTaskMaker(null, TARGET), false);
      assert.equal(isTaskMaker({}, ''), false);
      assert.equal(isTaskMaker({}, TARGET), false);
    });
  });

  // ==========================================================================
  // e) Equivalence & Parity Regression: Authorization Engine & FSM
  // ==========================================================================
  describe('e) Equivalence & Parity Regression: AuthorizationEngine and FSM return equivalent SoD decisions', () => {
    const actorId = 'actor_equiv_test';
    const deptId = 'dept_dt';

    const testRoles = [
      {
        roleName: 'Creator (creatorId)',
        resource: { creatorId: actorId },
        fsmTask: { creatorId: actorId, createdById: actorId },
      },
      {
        roleName: 'Primary Owner / DRI (primaryOwnerId)',
        resource: { primaryOwnerId: actorId },
        fsmTask: { primaryOwnerId: actorId, driId: actorId },
      },
      {
        roleName: 'Assignee (assigneeIds)',
        resource: { assigneeIds: [actorId] },
        fsmTask: { assigneeIds: [actorId] },
      },
      {
        roleName: 'Submitter (submittedByUserId)',
        resource: { submittedByUserId: actorId },
        fsmTask: { submittedByUserId: actorId },
      },
      {
        roleName: 'Deliverable Uploader (uploadedById)',
        resource: { uploadedById: actorId, deliverableUploadedByIds: [actorId] },
        fsmTask: { deliverableUploadedByIds: [actorId] },
      },
    ];

    for (const { roleName, resource, fsmTask } of testRoles) {
      it(`enforces equivalent rejection for ${roleName} WITHOUT delegation`, () => {
        // 1. Authorization Engine: unit head without delegation
        const ctx = createAuthContext({
          userId: actorId,
          positions: [
            createPosition({
              userId: actorId,
              positionCode: 'TRUONG_PHONG',
              positionTitle: 'Trưởng phòng',
              unitId: deptId,
              isLeadership: true,
            }),
          ],
        });
        const taskResource: TaskResource = {
          id: 'task_eq_1',
          type: 'task',
          leadUnitId: deptId,
          status: 'SUBMITTED',
          ...resource,
        };
        const authResult = authorize(ctx, 'task.approve', taskResource);
        assert.equal(authResult.allowed, false, `AuthEngine allowed for ${roleName}`);
        assert.equal(authResult.rejectionCode, 'SOD_VIOLATION');

        // 2. FSM State Machine: manager actor without delegation
        const fsmActor = {
          id: actorId,
          role: 'TRUONG_PHONG',
          departmentId: deptId,
          isDelegated: false,
        };
        const fsmTaskContext = {
          id: 'task_eq_1',
          scope: 'DEPARTMENT',
          departmentId: deptId,
          ...fsmTask,
        };
        const fsmResult = taskStateMachine.canTransition(
          fsmActor,
          fsmTaskContext,
          'WAITING_APPROVAL',
          'COMPLETED'
        );
        assert.equal(fsmResult.allowed, false, `FSM allowed for ${roleName}`);
        assert.equal(fsmResult.code, 'MAKER_CANNOT_BE_CHECKER');

        // Both engines agree
        assert.equal(authResult.allowed, fsmResult.allowed);
      });

      it(`enforces equivalent rejection for ${roleName} WITH active delegation`, () => {
        // 1. Authorization Engine: user WITH active task.approve delegation
        const grant: ActiveDelegationGrant = {
          id: 'grant_equiv_01',
          grantorAssignmentId: 'pos_rector',
          grantorUserId: 'rector_1',
          granteeAssignmentId: 'pos_grantee',
          granteeUserId: actorId,
          responsibilityAreaId: null,
          action: 'task.approve',
          resourceScope: 'INSTITUTION_WIDE',
          validFrom: new Date('2025-01-01'),
          validUntil: new Date('2028-01-01'),
          sourceDocumentNumber: 'UQ-EQ-01',
          reason: 'Equivalence testing',
          status: DelegationStatus.ACTIVE,
          revokedAt: null,
          revokedReason: null,
          scopeRules: [],
        };
        const ctx = createAuthContext({
          userId: actorId,
          positions: [
            createPosition({
              id: 'pos_grantee',
              userId: actorId,
              positionCode: 'CAN_BO_CHUYEN_VIEN_CANONICAL',
              positionTitle: 'Chuyên viên',
              unitId: deptId,
              isLeadership: false,
            }),
          ],
          delegations: [grant],
        });
        const taskResource: TaskResource = {
          id: 'task_eq_del_1',
          type: 'task',
          leadUnitId: deptId,
          status: 'SUBMITTED',
          ...resource,
        };
        const authResult = authorize(ctx, 'task.approve', taskResource);
        assert.equal(authResult.allowed, false, `AuthEngine allowed delegated ${roleName}`);
        assert.equal(authResult.rejectionCode, 'SOD_VIOLATION');

        // 2. FSM State Machine: staff actor WITH delegation
        const fsmActor = {
          id: actorId,
          role: 'STAFF',
          departmentId: deptId,
          isDelegated: true,
          delegatedTaskIds: ['task_eq_del_1'],
        };
        const fsmTaskContext = {
          id: 'task_eq_del_1',
          scope: 'DEPARTMENT',
          departmentId: deptId,
          ...fsmTask,
        };
        const fsmResult = taskStateMachine.canTransition(
          fsmActor,
          fsmTaskContext,
          'WAITING_APPROVAL',
          'COMPLETED'
        );
        assert.equal(fsmResult.allowed, false, `FSM allowed delegated ${roleName}`);
        assert.equal(fsmResult.code, 'MAKER_CANNOT_BE_CHECKER');

        // Both engines agree
        assert.equal(authResult.allowed, fsmResult.allowed);
      });
    }

    it('enforces equivalent approval for independent non-maker WITH delegation', () => {
      const grant: ActiveDelegationGrant = {
        id: 'grant_equiv_02',
        grantorAssignmentId: 'pos_rector',
        grantorUserId: 'rector_1',
        granteeAssignmentId: 'pos_grantee',
        granteeUserId: actorId,
        responsibilityAreaId: null,
        action: 'task.approve',
        resourceScope: 'INSTITUTION_WIDE',
        validFrom: new Date('2025-01-01'),
        validUntil: new Date('2028-01-01'),
        sourceDocumentNumber: 'UQ-EQ-02',
        reason: 'Equivalence testing control',
        status: DelegationStatus.ACTIVE,
        revokedAt: null,
        revokedReason: null,
        scopeRules: [],
      };
      const ctx = createAuthContext({
        userId: actorId,
        positions: [
          createPosition({
            id: 'pos_grantee',
            userId: actorId,
            positionCode: 'CAN_BO_CHUYEN_VIEN_CANONICAL',
            positionTitle: 'Chuyên viên',
            unitId: deptId,
            isLeadership: false,
          }),
        ],
        delegations: [grant],
      });
      const independentResource: TaskResource = {
        id: 'task_eq_ctrl',
        type: 'task',
        creatorId: 'other_creator',
        primaryOwnerId: 'other_dri',
        assigneeIds: ['other_dri'],
        submittedByUserId: 'other_submitter',
        uploadedById: 'other_uploader',
        leadUnitId: deptId,
        status: 'SUBMITTED',
      };
      const authResult = authorize(ctx, 'task.approve', independentResource);
      assert.equal(authResult.allowed, true);

      const fsmActor = {
        id: actorId,
        role: 'STAFF',
        departmentId: deptId,
        isDelegated: true,
        delegatedTaskIds: ['task_eq_ctrl'],
      };
      const fsmTaskContext = {
        id: 'task_eq_ctrl',
        scope: 'DEPARTMENT',
        departmentId: deptId,
        creatorId: 'other_creator',
        createdById: 'other_creator',
        primaryOwnerId: 'other_dri',
        assigneeIds: ['other_dri'],
        submittedByUserId: 'other_submitter',
        deliverableUploadedByIds: ['other_uploader'],
      };
      const fsmResult = taskStateMachine.canTransition(
        fsmActor,
        fsmTaskContext,
        'WAITING_APPROVAL',
        'COMPLETED'
      );
      assert.equal(fsmResult.allowed, true);

      // Both engines agree
      assert.equal(authResult.allowed, fsmResult.allowed);
    });
  });
});
