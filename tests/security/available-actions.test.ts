import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAvailableActions,
  buildDocumentResource,
  CANONICAL_MEETING_ACTIONS,
  CANONICAL_DOCUMENT_ACTIONS,
  CANONICAL_TASK_ACTIONS,
  getCandidateActionsForResource,
} from '@/server/authorization/available-actions';
import type { CapabilityAction } from '@/server/authorization/capability';
import {
  AuthorizationContextModel,
  SystemRole,
  type ActivePositionAssignment,
  type ActivePortfolioAssignment,
  type ActiveDelegationGrant,
  type ActiveBodyMembership,
} from '@/server/authorization/authorization-context';
import type { AuthorizationResource } from '@/server/authorization/resource';
import {
  AssignmentStatus,
  AssignmentType,
  UnitStatus,
  UnitType,
  BodyStatus,
  BodyMemberRole,
  OrganizationalBodyType,
  MeetingStatus,
  MeetingParticipantRole,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { MeetingService } from '@/server/services/meeting-service';

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

function createPosition(overrides: {
  userId?: string;
  positionCode: string;
  positionTitle?: string;
  unitId: string;
  unitName?: string;
  unitType?: UnitType;
  isLeadership?: boolean;
}): ActivePositionAssignment {
  return {
    id: `asg_${overrides.positionCode}`,
    userId: overrides.userId ?? 'usr_test',
    positionDefinitionId: `posdef_${overrides.positionCode}`,
    positionCode: overrides.positionCode,
    positionTitle: overrides.positionTitle ?? overrides.positionCode,
    positionLevel: 1,
    isLeadership: overrides.isLeadership ?? false,
    unitId: overrides.unitId,
    unitCode: overrides.unitId,
    unitName: overrides.unitName ?? overrides.unitId,
    unitType: overrides.unitType ?? UnitType.DEPARTMENT,
    unitStatus: UnitStatus.ACTIVE,
    type: AssignmentType.PRIMARY,
    isActing: false,
    effectiveFrom: new Date('2025-01-01'),
    effectiveTo: null,
    status: AssignmentStatus.ACTIVE,
    sourceDecisionNumber: null,
  };
}

describe('Task 10: Canonical Available Actions Computation', () => {
  // --------------------------------------------------------------------------
  // 1. Meeting Resources: Participants, Chairs, Secretaries, Outsiders
  // --------------------------------------------------------------------------
  describe('Meeting availableActions', () => {
    const meetingDrafted: AuthorizationResource = {
      type: 'meeting',
      id: 'meet_drafted_1',
      status: 'MINUTES_DRAFTED',
      participantIds: ['usr_participant', 'usr_chair', 'usr_secretary'],
      chairIds: ['usr_chair'],
      secretaryIds: ['usr_secretary'],
      organizerId: 'usr_chair',
      unitId: 'unit_academic',
    };

    const meetingHeld: AuthorizationResource = {
      type: 'meeting',
      id: 'meet_held_1',
      status: 'HELD',
      participantIds: ['usr_participant', 'usr_chair', 'usr_secretary'],
      chairIds: ['usr_chair'],
      secretaryIds: ['usr_secretary'],
      organizerId: 'usr_chair',
      unitId: 'unit_academic',
    };

    const meetingInvited: AuthorizationResource = {
      type: 'meeting',
      id: 'meet_invited_1',
      status: 'INVITED',
      participantIds: ['usr_participant', 'usr_chair', 'usr_secretary'],
      chairIds: ['usr_chair'],
      secretaryIds: ['usr_secretary'],
      organizerId: 'usr_chair',
      unitId: 'unit_academic',
    };

    test('chair gets meeting.confirm_minutes when status is MINUTES_DRAFTED', () => {
      const chairContext = createContext({ userId: 'usr_chair' });
      const actions = computeAvailableActions(chairContext, meetingDrafted);

      assert.ok(actions.includes('meeting.read'), 'Chair must have meeting.read');
      assert.ok(actions.includes('meeting.update'), 'Chair must have meeting.update');
      assert.ok(actions.includes('meeting.manage_participants'), 'Chair must have meeting.manage_participants');
      assert.ok(actions.includes('meeting.draft_minutes'), 'Chair must have meeting.draft_minutes');
      assert.ok(actions.includes('meeting.confirm_minutes'), 'Chair must have meeting.confirm_minutes');
      // Resolution is blocked until MINUTES_CONFIRMED
      assert.strictEqual(
        actions.includes('meeting.create_resolution'),
        false,
        'Chair cannot create resolution until minutes are confirmed'
      );
    });

    test('chair gets meeting.create_resolution when status is MINUTES_CONFIRMED', () => {
      const confirmedMeeting: AuthorizationResource = {
        type: 'meeting',
        id: 'meet_confirmed_1',
        status: 'MINUTES_CONFIRMED',
        participantIds: ['usr_chair'],
        chairIds: ['usr_chair'],
        secretaryIds: [],
        organizerId: 'usr_chair',
      };
      const chairContext = createContext({ userId: 'usr_chair' });
      const actions = computeAvailableActions(chairContext, confirmedMeeting);

      assert.ok(actions.includes('meeting.create_resolution'), 'Chair can create resolution when minutes confirmed');
      assert.ok(actions.includes('meeting.publish_resolution'), 'Chair can publish resolution when minutes confirmed');
    });

    test('chair gets meeting.confirm_minutes when status is HELD', () => {
      const chairContext = createContext({ userId: 'usr_chair' });
      const actions = computeAvailableActions(chairContext, meetingHeld);

      assert.ok(actions.includes('meeting.confirm_minutes'), 'Chair can confirm minutes in HELD state');
    });

    test('chair does NOT get meeting.confirm_minutes when status is INVITED (workflow state guard)', () => {
      const chairContext = createContext({ userId: 'usr_chair' });
      const actions = computeAvailableActions(chairContext, meetingInvited);

      assert.ok(actions.includes('meeting.read'), 'Chair can read invited meeting');
      assert.strictEqual(
        actions.includes('meeting.confirm_minutes'),
        false,
        'Chair cannot confirm minutes before meeting is held or minutes drafted'
      );
    });

    test('secretary gets meeting.draft_minutes but NOT meeting.confirm_minutes', () => {
      const secretaryContext = createContext({ userId: 'usr_secretary' });
      const actions = computeAvailableActions(secretaryContext, meetingDrafted);

      assert.ok(actions.includes('meeting.read'), 'Secretary must have meeting.read');
      assert.ok(actions.includes('meeting.draft_minutes'), 'Secretary must have meeting.draft_minutes');
      assert.strictEqual(
        actions.includes('meeting.confirm_minutes'),
        false,
        'Secretary alone cannot confirm minutes without chair role'
      );
    });

    test('dual role (chair + secretary) gets both draft_minutes and confirm_minutes', () => {
      const dualResource: AuthorizationResource = {
        type: 'meeting',
        id: 'meet_dual_1',
        status: 'MINUTES_DRAFTED',
        participantIds: ['usr_dual'],
        chairIds: ['usr_dual'],
        secretaryIds: ['usr_dual'],
        organizerId: 'usr_dual',
      };
      const dualContext = createContext({ userId: 'usr_dual' });
      const actions = computeAvailableActions(dualContext, dualResource);

      assert.ok(actions.includes('meeting.draft_minutes'), 'Dual role has meeting.draft_minutes');
      assert.ok(actions.includes('meeting.confirm_minutes'), 'Dual role has meeting.confirm_minutes');
    });

    test('regular participant gets meeting.read but no administrative or minutes actions', () => {
      const participantContext = createContext({ userId: 'usr_participant' });
      const actions = computeAvailableActions(participantContext, meetingDrafted);

      assert.deepStrictEqual(actions, ['meeting.read'], 'Regular participant only has meeting.read');
      assert.strictEqual(actions.includes('meeting.draft_minutes'), false);
      assert.strictEqual(actions.includes('meeting.confirm_minutes'), false);
      assert.strictEqual(actions.includes('meeting.update'), false);
      assert.strictEqual(actions.includes('meeting.manage_participants'), false);
      assert.strictEqual(actions.includes('meeting.create_resolution'), false);
    });

    test('outsider gets empty actions for meeting', () => {
      const outsiderContext = createContext({ userId: 'usr_outsider' });
      const actions = computeAvailableActions(outsiderContext, meetingDrafted);

      assert.deepStrictEqual(actions, [], 'Outsider must receive an empty available actions array');
    });

    test('MeetingService.getMeeting returns meeting with availableActions attached', async () => {
      const originalFindUnique = (prisma.meeting as any).findUnique;
      (prisma.meeting as any).findUnique = async () => ({
        id: 'meet_test_integration',
        title: 'Cuộc họp giao ban',
        status: MeetingStatus.MINUTES_DRAFT,
        unitId: 'unit_1',
        organizerId: 'usr_chair',
        participants: [
          { userId: 'usr_chair', role: MeetingParticipantRole.CHAIR, attendanceStatus: 'ATTENDING' },
        ],
        resolutions: [],
      });

      try {
        const chairContext = createContext({ userId: 'usr_chair' });
        const result = await MeetingService.getMeeting('meet_test_integration', chairContext);

        assert.ok(result, 'Meeting result should be defined');
        assert.ok(Array.isArray((result as any).availableActions), 'availableActions should be an array');
        assert.ok(
          (result as any).availableActions.includes('meeting.confirm_minutes'),
          'Should include meeting.confirm_minutes'
        );
        assert.ok(
          (result as any).availableActions.includes('meeting.read'),
          'Should include meeting.read'
        );
      } finally {
        (prisma.meeting as any).findUnique = originalFindUnique;
      }
    });
  });

  // --------------------------------------------------------------------------
  // 2. Document Resources: Classification, Roles, Clerical Duties
  // --------------------------------------------------------------------------
  describe('Document availableActions', () => {
    const restrictedDoc: AuthorizationResource = {
      type: 'document_incoming',
      id: 'doc_restricted_1',
      classification: 'RESTRICTED',
      securityLevel: 'MAT',
      status: 'CHO_TIEP_NHAN',
      leadUnitId: 'unit_training',
    };

    const internalDoc: AuthorizationResource = {
      type: 'document_incoming',
      id: 'doc_internal_1',
      classification: 'INTERNAL',
      securityLevel: 'THUONG',
      status: 'DANG_XU_LY',
      leadUnitId: 'unit_training',
    };

    test('RESTRICTED document yields empty actions for unauthorized staff', () => {
      const staffContext = createContext({
        userId: 'usr_staff_normal',
        primaryUnitIds: ['unit_training'],
      });
      const actions = computeAvailableActions(staffContext, restrictedDoc);

      assert.deepStrictEqual(
        actions,
        [],
        'Unauthorized staff must receive empty actions for RESTRICTED/MAT document'
      );
    });

    test('Rector (HIEU_TRUONG) has executive actions on documents but zero clerical operational actions', () => {
      const rectorContext = createContext({
        userId: 'usr_rector',
        positions: [
          createPosition({
            userId: 'usr_rector',
            positionCode: 'HIEU_TRUONG',
            positionTitle: 'Hiệu trưởng',
            unitId: 'unit_bgh',
            unitName: 'Ban Giám hiệu',
            unitType: UnitType.SCHOOL,
            isLeadership: true,
          }),
        ],
      });

      const actions = computeAvailableActions(rectorContext, internalDoc);

      assert.ok(actions.includes('document.read'), 'Rector can read internal document');
      assert.ok(actions.includes('document.direct'), 'Rector can give directives');
      assert.ok(actions.includes('document.assign_unit'), 'Rector can assign units');
      assert.ok(actions.includes('document.review_content'), 'Rector can review content');
      assert.ok(actions.includes('document.sign'), 'Rector can sign documents');

      // Clerical prohibitions per Decree 30/2020/ND-CP
      assert.strictEqual(actions.includes('document.register'), false, 'Rector cannot register doc');
      assert.strictEqual(actions.includes('document.assign_number'), false, 'Rector cannot assign number');
      assert.strictEqual(actions.includes('document.organization_sign'), false, 'Rector cannot apply stamp');
      assert.strictEqual(actions.includes('document.issue'), false, 'Rector cannot issue doc');
      assert.strictEqual(actions.includes('document.archive'), false, 'Rector cannot archive doc');
    });

    test('Clerk (VAN_THU) has clerical actions but cannot direct document', () => {
      const clerkContext = createContext({
        userId: 'usr_clerk',
        positions: [
          createPosition({
            userId: 'usr_clerk',
            positionCode: 'VAN_THU',
            positionTitle: 'Cán bộ văn thư',
            unitId: 'unit_clerical',
            unitName: 'Bộ phận Văn thư',
            unitType: UnitType.DEPARTMENT,
            isLeadership: false,
          }),
        ],
      });

      const actions = computeAvailableActions(clerkContext, internalDoc);

      assert.ok(actions.includes('document.read'), 'Clerk can read document');
      assert.ok(actions.includes('document.register'), 'Clerk can register');
      assert.ok(actions.includes('document.review_format'), 'Clerk can review format');
      assert.ok(actions.includes('document.assign_number'), 'Clerk can assign number');
      assert.ok(actions.includes('document.organization_sign'), 'Clerk can stamp organization seal');
      assert.ok(actions.includes('document.issue'), 'Clerk can issue');
      assert.ok(actions.includes('document.archive'), 'Clerk can archive');

      // Cannot direct
      assert.strictEqual(actions.includes('document.direct'), false, 'Clerk cannot direct document');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Separation of Powers: SYSTEM_ADMIN Gets Zero Institutional Executive Actions
  // --------------------------------------------------------------------------
  describe('SYSTEM_ADMIN Separation of Powers', () => {
    const adminContext = createContext({
      userId: 'usr_sysadmin',
      systemRoles: [SystemRole.SYSTEM_ADMIN],
    });

    test('SYSTEM_ADMIN gets empty actions on meetings', () => {
      const meeting: AuthorizationResource = {
        type: 'meeting',
        id: 'meet_admin_check',
        status: 'MINUTES_DRAFTED',
        participantIds: ['usr_sysadmin'],
        chairIds: ['usr_sysadmin'],
        secretaryIds: ['usr_sysadmin'],
      };

      const actions: CapabilityAction[] = computeAvailableActions(adminContext, meeting);

      assert.strictEqual(actions.includes('meeting.confirm_minutes'), false);
      assert.strictEqual(actions.includes('meeting.draft_minutes'), false);
      assert.strictEqual(actions.includes('meeting.update'), false);
      assert.deepStrictEqual(
        actions,
        [],
        'SYSTEM_ADMIN must be strictly denied all institutional meeting actions'
      );
    });

    test('SYSTEM_ADMIN gets zero institutional executive/clerical actions on documents', () => {
      const doc: AuthorizationResource = {
        type: 'document_incoming',
        id: 'doc_admin_check',
        classification: 'INTERNAL',
        status: 'DANG_XU_LY',
      };

      const actions: CapabilityAction[] = computeAvailableActions(adminContext, doc);

      assert.strictEqual(actions.includes('document.direct'), false);
      assert.strictEqual(actions.includes('document.sign'), false);
      assert.strictEqual(actions.includes('document.register'), false);
      assert.strictEqual(actions.includes('document.read'), false);
      assert.deepStrictEqual(
        actions,
        [],
        'SYSTEM_ADMIN must be strictly denied all institutional document actions'
      );
    });
  });

  // --------------------------------------------------------------------------
  // 4. Task Candidate Actions & Candidate Filtering
  // --------------------------------------------------------------------------
  describe('Task availableActions & Custom Candidates', () => {
    test('task candidate action list contains standard task capabilities', () => {
      assert.deepStrictEqual(CANONICAL_TASK_ACTIONS, [
        'task.read',
        'task.create',
        'task.review',
        'task.approve',
        'task.reassign',
        'task.monitor',
      ]);
    });

    test('getCandidateActionsForResource maps resource types accurately', () => {
      assert.deepStrictEqual(
        getCandidateActionsForResource({ type: 'meeting', id: '1' }),
        CANONICAL_MEETING_ACTIONS
      );
      assert.deepStrictEqual(
        getCandidateActionsForResource({ type: 'document', id: '1' }),
        CANONICAL_DOCUMENT_ACTIONS
      );
      assert.deepStrictEqual(
        getCandidateActionsForResource({ type: 'document_incoming', id: '1' }),
        CANONICAL_DOCUMENT_ACTIONS
      );
      assert.deepStrictEqual(
        getCandidateActionsForResource({ type: 'document_outgoing', id: '1' }),
        CANONICAL_DOCUMENT_ACTIONS
      );
      assert.deepStrictEqual(
        getCandidateActionsForResource({ type: 'task', id: '1' }),
        CANONICAL_TASK_ACTIONS
      );
      assert.deepStrictEqual(
        getCandidateActionsForResource({ type: 'unknown_type' as any, id: '1' }),
        []
      );
    });

    test('custom candidateActions filters only specified actions', () => {
      const chairContext = createContext({ userId: 'usr_chair' });
      const meetingDrafted: AuthorizationResource = {
        type: 'meeting',
        id: 'meet_custom_1',
        status: 'MINUTES_DRAFTED',
        participantIds: ['usr_chair'],
        chairIds: ['usr_chair'],
        secretaryIds: [],
      };

      const customCandidates = ['meeting.confirm_minutes', 'meeting.publish_resolution'] as const;
      const actions = computeAvailableActions(
        chairContext,
        meetingDrafted,
        [...customCandidates]
      );

      assert.ok(actions.includes('meeting.confirm_minutes'));
      assert.strictEqual(actions.includes('meeting.read'), false, 'Non-requested candidate omitted');
    });

    test('buildDocumentResource correctly formats document attributes', () => {
      const rawDoc = {
        id: 'doc_123',
        type: 'VAN_BAN_DEN',
        classification: 'INTERNAL',
        securityLevel: 'THUONG',
        leadDepartmentId: 'dept_it',
        creatorId: 'user_a',
      };

      const res = buildDocumentResource(rawDoc);
      assert.strictEqual(res.type, 'document_incoming');
      assert.strictEqual(res.id, 'doc_123');
      assert.strictEqual(res.classification, 'INTERNAL');
      assert.strictEqual(res.leadUnitId, 'dept_it');
      assert.strictEqual(res.creatorId, 'user_a');
    });
  });
});
