import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  authorize,
  assertAuthorized,
} from '@/server/authorization/authorization-engine';
import {
  AuthorizationContextModel,
  SystemRole,
  type ActivePositionAssignment,
  type ActivePortfolioAssignment,
  type ActiveDelegationGrant,
  type ActiveBodyMembership,
} from '@/server/authorization/authorization-context';
import type {
  MeetingResource,
  DocumentResource,
  TaskResource,
  AuthorizationResource,
} from '@/server/authorization/resource';
import {
  SeparationOfPowersError,
  SeparationOfDutiesError,
  PortfolioMismatchError,
  DelegationExpiredError,
  AccountDisabledAuthError,
  AccountNotFoundError,
  AuthorizationError,
} from '@/server/authorization/errors';
import { AssignmentStatus, AssignmentType, UnitStatus, UnitType, BodyStatus, BodyMemberRole, OrganizationalBodyType, DelegationStatus, ResponsibilityCategory } from '@prisma/client';

function createContext(overrides: {
  userId?: string;
  isActive?: boolean;
  systemRoles?: SystemRole[];
  positions?: ActivePositionAssignment[];
  portfolios?: ActivePortfolioAssignment[];
  delegations?: ActiveDelegationGrant[];
  bodyMemberships?: ActiveBodyMembership[];
  primaryUnitIds?: string[];
}): AuthorizationContextModel {
  const userId = overrides.userId ?? 'usr_test_1';
  return new AuthorizationContextModel({
    userId,
    user: {
      id: userId,
      email: `${userId}@cdktcnqn.edu.vn`,
      name: `User ${userId}`,
      isActive: overrides.isActive ?? true,
    },
    systemRoles: overrides.systemRoles ?? [],
    positions: overrides.positions ?? [],
    responsibilityAreas: (overrides.portfolios ?? []).map((p) => p.responsibilityArea),
    portfolios: overrides.portfolios ?? [],
    delegations: overrides.delegations ?? [],
    bodyMemberships: overrides.bodyMemberships ?? [],
    primaryUnitIds: overrides.primaryUnitIds ?? [],
    generatedAt: new Date(),
  });
}

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

describe('Unified Authorization Engine (Task 4)', () => {
  // Step 1: Account / Session Validation
  describe('Step 1: Account / Session Validation', () => {
    test('DENY with UNAUTHENTICATED if context or user missing', () => {
      // @ts-expect-error test null context
      const res = authorize(null, 'meeting.read');
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, 'UNAUTHENTICATED');
      assert.equal(res.statusCode, 'UNAUTHENTICATED');
    });

    test('DENY with DEACTIVATED_ACCOUNT if user is disabled', () => {
      const ctx = createContext({ isActive: false });
      const res = authorize(ctx, 'meeting.read');
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, 'DEACTIVATED_ACCOUNT');
      assert.equal(res.statusCode, 'DEACTIVATED_ACCOUNT');

      assert.throws(() => assertAuthorized(ctx, 'meeting.read'), AccountDisabledAuthError);
    });
  });

  // Step 2: Resource Classification
  describe('Step 2: Resource Classification Allowed', () => {
    test('DENY with STATE_SECRET_STRICT_PROHIBITION for STATE_SECRET / TUYET_MAT', () => {
      const ctx = createContext({
        positions: [createPosition({ positionCode: 'HIEU_TRUONG', unitId: 'bgh', isLeadership: true })],
      });
      const doc: DocumentResource = {
        id: 'doc_secret',
        type: 'document',
        classification: 'TUYET_MAT',
      };
      const res = authorize(ctx, 'document.read', doc);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, 'STATE_SECRET_STRICT_PROHIBITION');
    });

    test('DENY with PERSONAL_DATA_PRIVACY_BREACH for PERSONAL data without subject or explicit grant', () => {
      const ctx = createContext({ userId: 'usr_outsider' });
      const doc: DocumentResource = {
        id: 'doc_personal',
        type: 'document',
        classification: 'PERSONAL',
        creatorId: 'usr_owner',
      };
      const res = authorize(ctx, 'document.read', doc);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, 'PERSONAL_DATA_PRIVACY_BREACH');
    });

    test('ALLOW access to PERSONAL data if user is subject (creator/target/primaryOwner)', () => {
      const ctx = createContext({ userId: 'usr_owner' });
      const task: TaskResource = {
        id: 'task_personal',
        type: 'task',
        classification: 'PERSONAL',
        primaryOwnerId: 'usr_owner',
      };
      const res = authorize(ctx, 'task.read', task);
      assert.equal(res.allowed, true);
    });
  });

  // Step 3: Explicit Technical-Admin Restriction (Separation of Powers)
  describe('Step 3: Explicit Technical-Admin Restriction (Separation of Powers)', () => {
    test('SYSTEM_ADMIN cannot perform institutional business actions (task.approve, document.sign, meeting.confirm_minutes, meeting.create_resolution)', () => {
      const ctx = createContext({
        userId: 'admin_1',
        systemRoles: [SystemRole.SYSTEM_ADMIN],
      });

      const doc: DocumentResource = { id: 'doc_1', type: 'document', status: 'APPROVED' };
      const resDoc = authorize(ctx, 'document.sign', doc);
      assert.equal(resDoc.allowed, false);
      assert.equal(resDoc.rejectionCode, 'SEPARATION_OF_POWERS_VIOLATION');
      assert.throws(() => assertAuthorized(ctx, 'document.sign', doc), SeparationOfPowersError);

      const meeting: MeetingResource = { id: 'm_1', type: 'meeting', status: 'COMPLETED', chairIds: ['admin_1'] };
      const resMeeting = authorize(ctx, 'meeting.confirm_minutes', meeting);
      assert.equal(resMeeting.allowed, false);
      assert.equal(resMeeting.rejectionCode, 'SEPARATION_OF_POWERS_VIOLATION');

      const resRes = authorize(ctx, 'meeting.create_resolution', meeting);
      assert.equal(resRes.allowed, false);
      assert.equal(resRes.rejectionCode, 'SEPARATION_OF_POWERS_VIOLATION');

      const task: TaskResource = { id: 't_1', type: 'task' };
      const resTask = authorize(ctx, 'task.approve', task);
      assert.equal(resTask.allowed, false);
      assert.equal(resTask.rejectionCode, 'SEPARATION_OF_POWERS_VIOLATION');
    });

    test('SYSTEM_ADMIN can perform technical administration (account.manage, system.configure, audit.view, task.monitor)', () => {
      const ctx = createContext({
        userId: 'admin_1',
        systemRoles: [SystemRole.SYSTEM_ADMIN],
      });
      assert.equal(authorize(ctx, 'account.manage').allowed, true);
      assert.equal(authorize(ctx, 'system.configure').allowed, true);
      assert.equal(authorize(ctx, 'audit.view').allowed, true);
      assert.equal(authorize(ctx, 'task.monitor').allowed, true);
    });

    test('Non-admin cannot perform technical administration capabilities', () => {
      const ctx = createContext({
        userId: 'staff_1',
        positions: [createPosition({ positionCode: 'CHUYEN_VIEN', unitId: 'dept_cntt' })],
      });
      const res = authorize(ctx, 'system.configure');
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, 'INSUFFICIENT_CAPABILITY');
    });
  });

  // Step 4: Direct Resource Relationship
  describe('Step 4: Direct Resource Relationship', () => {
    test('Meeting permissions: participant / organizer / body member can read; outsider denied', () => {
      const meeting: MeetingResource = {
        id: 'm_dept',
        type: 'meeting',
        organizerId: 'user_org',
        participantIds: ['user_part'],
        chairIds: ['user_chair'],
        secretaryIds: ['user_sec'],
        status: 'IN_PROGRESS',
      };

      const ctxParticipant = createContext({ userId: 'user_part' });
      assert.equal(authorize(ctxParticipant, 'meeting.read', meeting).allowed, true);

      const ctxOutsider = createContext({ userId: 'user_stranger' });
      const resOutsider = authorize(ctxOutsider, 'meeting.read', meeting);
      assert.equal(resOutsider.allowed, false);
      assert.equal(resOutsider.rejectionCode, 'INSUFFICIENT_RELATIONSHIP');
    });

    test('Secretary can draft minutes; non-secretary outsider cannot', () => {
      const meeting: MeetingResource = {
        id: 'm_draft',
        type: 'meeting',
        secretaryIds: ['user_sec'],
        chairIds: ['user_chair'],
        status: 'IN_PROGRESS',
      };

      const ctxSec = createContext({ userId: 'user_sec' });
      assert.equal(authorize(ctxSec, 'meeting.draft_minutes', meeting).allowed, true);

      const ctxOutsider = createContext({ userId: 'user_other' });
      assert.equal(authorize(ctxOutsider, 'meeting.draft_minutes', meeting).allowed, false);
    });

    test('Single DRI rule: Collaborator cannot reassign primary DRI', () => {
      const task: TaskResource = {
        id: 't_dri',
        type: 'task',
        primaryOwnerId: 'user_dri',
        collaboratorIds: ['user_collab'],
      };

      const ctxCollab = createContext({
        userId: 'user_collab',
        positions: [createPosition({ positionCode: 'CHUYEN_VIEN', unitId: 'dept_dt' })],
      });

      const res = authorize(ctxCollab, 'task.reassign', task);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, 'COLLABORATOR_CANNOT_REASSIGN_DRI');
    });
  });

  // Step 5: Position Capability
  describe('Step 5: Position Capability', () => {
    test('HIEU_TRUONG (Rector) has broad institutional management authority', () => {
      const ctx = createContext({
        userId: 'ht_1',
        positions: [createPosition({ positionCode: 'HIEU_TRUONG', unitId: 'bgh', isLeadership: true })],
      });

      const task: TaskResource = { id: 't_inst', type: 'task', creatorId: 'dept_head_1' };
      assert.equal(authorize(ctx, 'task.approve', task).allowed, true);
      assert.equal(authorize(ctx, 'document.direct').allowed, true);
    });

    test('HIEU_TRUONG cannot perform clerical operations (document.assign_number, review_format, archive)', () => {
      const ctx = createContext({
        userId: 'ht_1',
        positions: [createPosition({ positionCode: 'HIEU_TRUONG', unitId: 'bgh', isLeadership: true })],
      });

      const resNumber = authorize(ctx, 'document.assign_number');
      assert.equal(resNumber.allowed, false);
      assert.equal(resNumber.rejectionCode, 'INSUFFICIENT_CAPABILITY');

      const resFormat = authorize(ctx, 'document.review_format');
      assert.equal(resFormat.allowed, false);
      assert.equal(resFormat.rejectionCode, 'INSUFFICIENT_CAPABILITY');
    });

    test('VAN_THU (Clerk) can perform clerical operations but cannot direct incoming documents', () => {
      const ctx = createContext({
        userId: 'clerk_1',
        positions: [createPosition({ positionCode: 'VAN_THU', unitId: 'dept_hcqt' })],
      });

      assert.equal(authorize(ctx, 'document.register').allowed, true);
      assert.equal(authorize(ctx, 'document.assign_number').allowed, true);
      assert.equal(authorize(ctx, 'document.review_format').allowed, true);

      const resDirect = authorize(ctx, 'document.direct');
      assert.equal(resDirect.allowed, false);
      assert.equal(resDirect.rejectionCode, 'INSUFFICIENT_CAPABILITY');
    });
  });

  // Step 6: Portfolio Responsibility Boundary
  describe('Step 6: Portfolio Responsibility Boundary', () => {
    test('PHO_HIEU_TRUONG with TRAINING portfolio is allowed for TRAINING but DENIED for FINANCE', () => {
      const trainingPortfolio: ActivePortfolioAssignment = {
        id: 'port_train',
        positionAssignmentId: 'pos_pht_1',
        responsibilityAreaId: 'area_train',
        responsibilityArea: {
          id: 'area_train',
          code: 'TRAINING',
          name: 'Đào tạo & ĐBCL',
          description: null,
          category: ResponsibilityCategory.ACADEMIC,
        },
        effectiveFrom: new Date('2025-01-01'),
        effectiveTo: null,
        sourceDecisionNumber: 'QD-420',
      };

      const ctx = createContext({
        userId: 'pht_1',
        positions: [createPosition({ id: 'pos_pht_1', positionCode: 'PHO_HIEU_TRUONG', unitId: 'bgh', isLeadership: true })],
        portfolios: [trainingPortfolio],
      });

      const trainingDoc: DocumentResource = {
        id: 'doc_train',
        type: 'document',
        portfolio: 'TRAINING',
        status: 'APPROVED',
      };
      assert.equal(authorize(ctx, 'document.review_content', trainingDoc).allowed, true);

      const financeDoc: DocumentResource = {
        id: 'doc_fin',
        type: 'document',
        portfolio: 'FINANCE',
        status: 'APPROVED',
      };
      const resFinance = authorize(ctx, 'document.review_content', financeDoc);
      assert.equal(resFinance.allowed, false);
      assert.equal(resFinance.rejectionCode, 'PORTFOLIO_MISMATCH');
      assert.throws(() => assertAuthorized(ctx, 'document.review_content', financeDoc), PortfolioMismatchError);
    });
  });

  // Step 7: Organizational Scope
  describe('Step 7: Organizational Scope', () => {
    test('Department Head allowed for own unit resources, DENIED for another unit tasks', () => {
      const ctx = createContext({
        userId: 'head_cntt',
        positions: [createPosition({ positionCode: 'TRUONG_PHONG', unitId: 'dept_cntt', isLeadership: true })],
        primaryUnitIds: ['dept_cntt'],
      });

      const ownUnitTask: TaskResource = {
        id: 'task_cntt',
        type: 'task',
        leadUnitId: 'dept_cntt',
        status: 'PENDING_APPROVAL',
      };
      assert.equal(authorize(ctx, 'task.approve', ownUnitTask).allowed, true);

      const otherUnitTask: TaskResource = {
        id: 'task_kh',
        type: 'task',
        leadUnitId: 'dept_kh',
        status: 'PENDING_APPROVAL',
      };
      const resOther = authorize(ctx, 'task.approve', otherUnitTask);
      assert.equal(resOther.allowed, false);
      assert.equal(resOther.rejectionCode, 'DEPARTMENT_BOUNDARY_VIOLATION');
    });

    test('User cùng OU policy: staff can create task in own unit, but denied for other unit or school-wide', () => {
      const ctx = createContext({
        userId: 'staff_cntt',
        positions: [createPosition({ positionCode: 'CHUYEN_VIEN', unitId: 'dept_cntt' })],
        primaryUnitIds: ['dept_cntt'],
      });

      // Allowed in own unit
      const ownTask: TaskResource = {
        id: 't_create_own',
        type: 'task',
        leadUnitId: 'dept_cntt',
        scope: 'department',
      };
      assert.equal(authorize(ctx, 'task.create', ownTask).allowed, true);

      // Denied for another unit
      const otherTask: TaskResource = {
        id: 't_create_other',
        type: 'task',
        leadUnitId: 'dept_kh',
        scope: 'department',
      };
      const resOther = authorize(ctx, 'task.create', otherTask);
      assert.equal(resOther.allowed, false);
      assert.equal(resOther.rejectionCode, 'DEPARTMENT_BOUNDARY_VIOLATION');

      // Denied for school-wide scope
      const schoolTask: TaskResource = {
        id: 't_create_school',
        type: 'task',
        leadUnitId: 'dept_cntt',
        scope: 'school',
      };
      const resSchool = authorize(ctx, 'task.create', schoolTask);
      assert.equal(resSchool.allowed, false);
      assert.equal(resSchool.rejectionCode, 'DEPARTMENT_BOUNDARY_VIOLATION');
    });

    test('BGH can create task school-wide and for any unit', () => {
      const bghCtx = createContext({
        userId: 'bgh_user',
        positions: [createPosition({ positionCode: 'HIEU_TRUONG', unitId: 'bgh', isLeadership: true })],
      });

      const schoolTask: TaskResource = {
        id: 't_school_bgh',
        type: 'task',
        scope: 'school',
      };
      assert.equal(authorize(bghCtx, 'task.create', schoolTask).allowed, true);

      const anyUnitTask: TaskResource = {
        id: 't_any_unit',
        type: 'task',
        leadUnitId: 'dept_cntt',
        scope: 'department',
      };
      assert.equal(authorize(bghCtx, 'task.create', anyUnitTask).allowed, true);
    });
  });

  // Step 8: Valid Delegation Fallback
  describe('Step 8: Valid Delegation Fallback', () => {
    test('Active DelegationGrant allows action outside regular scope', () => {
      const grant: ActiveDelegationGrant = {
        id: 'grant_1',
        grantorAssignmentId: 'pos_ht',
        grantorUserId: 'user_ht',
        granteeAssignmentId: 'pos_head_cntt',
        granteeUserId: 'head_cntt',
        responsibilityAreaId: 'area_fin',
        responsibilityArea: {
          id: 'area_fin',
          code: 'FINANCE',
          name: 'Tài chính',
          description: null,
          category: ResponsibilityCategory.OPERATIONAL,
        },
        action: 'task.approve',
        resourceScope: 'INSTITUTION_WIDE',
        validFrom: new Date('2025-01-01'),
        validUntil: new Date('2026-12-31'),
        sourceDocumentNumber: 'UQ-01',
        reason: 'Hiệu trưởng ủy quyền',
        status: DelegationStatus.ACTIVE,
        revokedAt: null,
        revokedReason: null,
        scopeRules: [],
      };

      const ctx = createContext({
        userId: 'head_cntt',
        positions: [createPosition({ id: 'pos_head_cntt', positionCode: 'TRUONG_PHONG', unitId: 'dept_cntt', isLeadership: true })],
        delegations: [grant],
      });

      const financeTask: TaskResource = {
        id: 'task_fin',
        type: 'task',
        leadUnitId: 'dept_tckt',
        portfolio: 'FINANCE',
        status: 'SUBMITTED',
      };

      const res = authorize(ctx, 'task.approve', financeTask);
      assert.equal(res.allowed, true);
      assert.equal(res.delegationUsed, 'grant_1');
    });

    test('Expired delegation DENIES with DELEGATION_EXPIRED', () => {
      const grant: ActiveDelegationGrant = {
        id: 'grant_exp',
        grantorAssignmentId: 'pos_ht',
        grantorUserId: 'user_ht',
        granteeAssignmentId: 'pos_head_cntt',
        granteeUserId: 'head_cntt',
        responsibilityAreaId: null,
        action: 'task.approve',
        resourceScope: 'INSTITUTION_WIDE',
        validFrom: new Date('2025-01-01'),
        validUntil: new Date('2025-06-01'),
        sourceDocumentNumber: 'UQ-EXP',
        reason: 'Expired',
        status: DelegationStatus.ACTIVE,
        revokedAt: null,
        revokedReason: null,
        scopeRules: [],
      };

      const ctx = createContext({
        userId: 'head_cntt',
        positions: [createPosition({ id: 'pos_head_cntt', positionCode: 'TRUONG_PHONG', unitId: 'dept_cntt', isLeadership: true })],
        delegations: [grant],
      });

      const otherTask: TaskResource = {
        id: 'task_other',
        type: 'task',
        leadUnitId: 'dept_other',
        status: 'SUBMITTED',
      };

      const res = authorize(ctx, 'task.approve', otherTask);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, 'DELEGATION_EXPIRED');
      assert.throws(() => assertAuthorized(ctx, 'task.approve', otherTask), DelegationExpiredError);
    });

    test('Statutory non-delegable power cannot be delegated (NON_DELEGABLE_POWER_VIOLATION)', () => {
      const grant: ActiveDelegationGrant = {
        id: 'grant_nd',
        grantorAssignmentId: 'pos_ht',
        grantorUserId: 'user_ht',
        granteeAssignmentId: 'pos_pht',
        granteeUserId: 'pht_1',
        responsibilityAreaId: null,
        action: 'position.manage_leadership',
        resourceScope: 'INSTITUTION_WIDE',
        validFrom: new Date('2025-01-01'),
        validUntil: new Date('2026-12-31'),
        sourceDocumentNumber: 'UQ-ILLEGAL',
        reason: 'Bổ nhiệm',
        status: DelegationStatus.ACTIVE,
        revokedAt: null,
        revokedReason: null,
        scopeRules: [],
      };

      const ctx = createContext({
        userId: 'pht_1',
        positions: [createPosition({ id: 'pos_pht', positionCode: 'PHO_HIEU_TRUONG', unitId: 'bgh', isLeadership: true })],
        delegations: [grant],
      });

      const res = authorize(ctx, 'position.manage_leadership');
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, 'NON_DELEGABLE_POWER_VIOLATION');
    });
  });

  // Step 9: Workflow State
  describe('Step 9: Workflow State', () => {
    test('Cannot sign document if draft is not approved (status is DRAFT)', () => {
      const ctx = createContext({
        userId: 'ht_1',
        positions: [createPosition({ positionCode: 'HIEU_TRUONG', unitId: 'bgh', isLeadership: true })],
      });

      const draftDoc: DocumentResource = {
        id: 'doc_draft',
        type: 'document',
        status: 'DRAFT',
      };

      const res = authorize(ctx, 'document.sign', draftDoc);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, 'INVALID_WORKFLOW_STATE');
    });

    test('Chair cannot confirm meeting minutes if meeting is still SCHEDULED', () => {
      const ctx = createContext({
        userId: 'chair_1',
        positions: [createPosition({ positionCode: 'TRUONG_KHOA', unitId: 'khoa_cntt', isLeadership: true })],
      });

      const meeting: MeetingResource = {
        id: 'm_sched',
        type: 'meeting',
        chairIds: ['chair_1'],
        status: 'SCHEDULED',
      };

      const res = authorize(ctx, 'meeting.confirm_minutes', meeting);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, 'INVALID_WORKFLOW_STATE');
    });
  });

  // Step 10: Separation of Duties (Anti-Self-Approval & Role Conflicts)
  describe('Step 10: Separation of Duties (Anti-Self-Approval & Role Conflicts)', () => {
    test('Drafter cannot sign own document (SOD_VIOLATION)', () => {
      const ctx = createContext({
        userId: 'ht_1',
        positions: [createPosition({ positionCode: 'HIEU_TRUONG', unitId: 'bgh', isLeadership: true })],
      });

      const doc: DocumentResource = {
        id: 'doc_self',
        type: 'document',
        drafterId: 'ht_1',
        status: 'APPROVED',
      };

      const res = authorize(ctx, 'document.sign', doc);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, 'SOD_VIOLATION');
      assert.throws(() => assertAuthorized(ctx, 'document.sign', doc), SeparationOfDutiesError);
    });

    test('Task creator / primary owner cannot approve own task (SOD_VIOLATION)', () => {
      const ctx = createContext({
        userId: 'head_1',
        positions: [createPosition({ positionCode: 'TRUONG_PHONG', unitId: 'dept_dt', isLeadership: true })],
      });

      const task1: TaskResource = {
        id: 't_created',
        type: 'task',
        creatorId: 'head_1',
        leadUnitId: 'dept_dt',
        status: 'SUBMITTED',
      };
      assert.equal(authorize(ctx, 'task.approve', task1).allowed, false);

      const task2: TaskResource = {
        id: 't_dri',
        type: 'task',
        primaryOwnerId: 'head_1',
        leadUnitId: 'dept_dt',
        status: 'SUBMITTED',
      };
      assert.equal(authorize(ctx, 'task.approve', task2).allowed, false);
    });

    test('Signer cannot number document (SOD_VIOLATION)', () => {
      const ctx = createContext({
        userId: 'signer_1',
        positions: [createPosition({ positionCode: 'VAN_THU', unitId: 'dept_hcqt' })],
      });

      const doc: DocumentResource = {
        id: 'doc_sign_num',
        type: 'document',
        signerId: 'signer_1',
        status: 'SIGNED',
      };

      const res = authorize(ctx, 'document.assign_number', doc);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, 'SOD_VIOLATION');
    });
  });

  // Default DENY
  describe('Default DENY', () => {
    test('staff roles cannot mutate unrelated tasks in their own unit', () => {
      for (const positionCode of ['GIANG_VIEN', 'CAN_BO_CHUYEN_VIEN_CANONICAL']) {
        const ctx = createContext({
          userId: 'staff_1',
          positions: [createPosition({ userId: 'staff_1', positionCode, unitId: 'khoa_cntt' })],
          primaryUnitIds: ['khoa_cntt'],
        });
        const task: TaskResource = { id: 'unrelated_task', type: 'task', leadUnitId: 'khoa_cntt' };
        for (const action of ['task.update_metadata', 'task.update_execution'] as const) {
          assert.equal(authorize(ctx, action, task).allowed, false, positionCode + ': ' + action);
        }
        assert.equal(authorize(ctx, 'task.create', task).allowed, true);
      }
    });
    test('Unmatched action / resource is denied by default', () => {
      const ctx = createContext({
        userId: 'staff_1',
        positions: [createPosition({ positionCode: 'GIANG_VIEN', unitId: 'khoa_cntt' })],
      });

      const randomTask: TaskResource = {
        id: 'task_random',
        type: 'task',
        leadUnitId: 'khoa_kinhte',
      };

      const res = authorize(ctx, 'task.cancel', randomTask);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, 'INSUFFICIENT_CAPABILITY');
    });
  });
});
