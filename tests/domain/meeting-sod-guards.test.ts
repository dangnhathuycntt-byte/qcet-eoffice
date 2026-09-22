/**
 * Test Suite: Meeting Minutes Confirmation Separation of Duties (SoD) Guards (WI-6.1c / Issue #83)
 *
 * Verifies RFC-10:
 * 1. Rule 10.7 SoD Invariant: Secretary / Minutes Drafter != Meeting Minutes Confirmer
 *    - Rejects confirmation attempt by Secretary with SOD_VIOLATION
 *    - Allows Chair / Authorized Leader who is NOT Secretary to confirm minutes
 * 2. Immutability Protection: Cannot modify finalized meeting (MINUTES_CONFIRMED)
 */

import * as nodeTest from 'node:test';
import assert from 'node:assert/strict';
import {
  MeetingStatus,
  UnitType,
  UnitStatus,
  AssignmentType,
  AssignmentStatus,
} from '@prisma/client';
import { authorize } from '../../src/server/authorization/authorization-engine';
import {
  AuthorizationContextModel,
  type ActivePositionAssignment,
} from '../../src/server/authorization/authorization-context';
import type { AuthorizationResource } from '../../src/server/authorization';
import {
  assertTransition,
  assertMeetingNotFinalized,
  FinalizedMeetingError,
} from '../../src/domain/meetings/state-machine';

const describe: any = (globalThis as any).describe || nodeTest.describe;
const it: any = (globalThis as any).it || (globalThis as any).test || nodeTest.it;

function createPosition(data: {
  id?: string;
  userId: string;
  positionCode: string;
  positionTitle?: string;
  unitId: string;
  isLeadership?: boolean;
}): ActivePositionAssignment {
  return {
    id: data.id ?? `pos_${data.positionCode}_${data.unitId}`,
    userId: data.userId,
    positionDefinitionId: `def_${data.positionCode}`,
    positionCode: data.positionCode,
    positionTitle: data.positionTitle ?? data.positionCode,
    positionLevel: 1,
    isLeadership: data.isLeadership ?? false,
    unitId: data.unitId,
    unitCode: `CODE_${data.unitId}`,
    unitName: `Unit ${data.unitId}`,
    unitType: UnitType.SCHOOL,
    unitStatus: UnitStatus.ACTIVE,
    type: AssignmentType.PRIMARY,
    isActing: false,
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
    status: AssignmentStatus.ACTIVE,
    sourceDecisionNumber: 'QD-01',
  };
}

function createAuthContext(userId: string, positionCode: string, unitId: string, isLeadership: boolean) {
  return new AuthorizationContextModel({
    userId,
    user: {
      id: userId,
      email: `${userId}@cdktcnqn.edu.vn`,
      name: `User ${userId}`,
      isActive: true,
    },
    systemRoles: [],
    positions: [
      createPosition({
        userId,
        positionCode,
        unitId,
        isLeadership,
      }),
    ],
    responsibilityAreas: [],
    portfolios: [],
    delegations: [],
    bodyMemberships: [],
    primaryUnitIds: [unitId],
  });
}

describe('WI-6.1c: Meeting Minutes Confirmation SoD Guards (RFC-10)', () => {
  const chairUserContext = createAuthContext('user-rector-chair-01', 'HIEU_TRUONG', 'unit-bgh', true);
  const secretaryUserContext = createAuthContext('user-clerk-secretary-02', 'TRUONG_PHONG', 'unit-hcth', true);

  const meetingResource: AuthorizationResource = {
    type: 'meeting',
    id: 'meeting-test-101',
    status: 'MINUTES_DRAFT',
    chairId: 'user-rector-chair-01',
    chairIds: ['user-rector-chair-01'],
    secretaryId: 'user-clerk-secretary-02',
    secretaryIds: ['user-clerk-secretary-02'],
    participantIds: ['user-rector-chair-01', 'user-clerk-secretary-02'],
  };

  describe('1. Rule 10.7 Separation of Duties (SoD) Enforcement', () => {
    it('REJECTS confirmation attempt by Chair who also served as Secretary (Dual-role SoD Violation)', () => {
      // In a meeting where the Chair also acted as Secretary (Self-approval scenario)
      const dualRoleMeeting: AuthorizationResource = {
        type: 'meeting',
        id: 'meeting-test-dual',
        status: 'MINUTES_DRAFT',
        chairId: 'user-rector-chair-01',
        chairIds: ['user-rector-chair-01'],
        secretaryId: 'user-rector-chair-01', // Chair also drafted/acted as Secretary
        secretaryIds: ['user-rector-chair-01'],
        participantIds: ['user-rector-chair-01'],
      };

      const authResult = authorize(
        chairUserContext,
        'meeting.confirm_minutes',
        dualRoleMeeting
      );

      assert.equal(authResult.allowed, false, 'Chair who acted as Secretary must NOT be allowed to self-confirm');
      assert.equal(
        authResult.rejectionCode,
        'SOD_VIOLATION',
        'Rejection code must be SOD_VIOLATION'
      );
      assert.ok(
        authResult.reason?.includes('phân lập trách nhiệm'),
        'Reason must indicate SoD violation'
      );
      assert.equal(
        authResult.auditRecord?.policyMatched,
        'STEP_10_SECRETARY_NOT_CONFIRMER',
        'Audit policy matched must be STEP_10_SECRETARY_NOT_CONFIRMER'
      );
    });

    it('REJECTS confirmation by pure Secretary with INSUFFICIENT_CAPABILITY (Non-chair cannot confirm)', () => {
      const authResult = authorize(
        secretaryUserContext,
        'meeting.confirm_minutes',
        meetingResource
      );

      assert.equal(authResult.allowed, false);
      assert.equal(authResult.rejectionCode, 'INSUFFICIENT_CAPABILITY');
    });

    it('ALLOWS confirmation by Chair who is NOT Secretary', () => {
      const authResult = authorize(
        chairUserContext,
        'meeting.confirm_minutes',
        meetingResource
      );

      assert.equal(authResult.allowed, true, 'Chair must be allowed to confirm minutes');
      assert.equal(authResult.statusCode, 'GRANTED');
    });

    it('REJECTS confirmation if actor is listed in secretaryIds even if holding executive position', () => {
      // Create a user who is Vice Rector (executive) but acted as Secretary in this specific meeting
      const executiveSecretaryContext = createAuthContext(
        'user-vice-rector-sec-03',
        'PHO_HIEU_TRUONG',
        'unit-bgh',
        true
      );

      const meetingWithExecutiveSecretary: AuthorizationResource = {
        type: 'meeting',
        id: 'meeting-test-102',
        status: 'MINUTES_DRAFT',
        chairId: 'user-rector-chair-01',
        chairIds: ['user-rector-chair-01', 'user-vice-rector-sec-03'], // Co-chair
        secretaryId: 'user-vice-rector-sec-03',
        secretaryIds: ['user-vice-rector-sec-03'],
        participantIds: ['user-rector-chair-01', 'user-vice-rector-sec-03'],
      };

      const authResult = authorize(
        executiveSecretaryContext,
        'meeting.confirm_minutes',
        meetingWithExecutiveSecretary
      );

      assert.equal(
        authResult.allowed,
        false,
        'Executive role MUST NOT bypass Maker-Checker SoD when acting as Secretary'
      );
      assert.equal(authResult.rejectionCode, 'SOD_VIOLATION');
      assert.equal(authResult.auditRecord?.policyMatched, 'STEP_10_SECRETARY_NOT_CONFIRMER');
    });
  });

  describe('2. State Machine Immutability & Finalization Guards', () => {
    it('allows transition from MINUTES_DRAFT to MINUTES_CONFIRMED', () => {
      assert.doesNotThrow(() => {
        assertTransition(MeetingStatus.MINUTES_DRAFT, MeetingStatus.MINUTES_CONFIRMED);
      });
    });

    it('assertMeetingNotFinalized allows active states and blocks terminal states', () => {
      assert.doesNotThrow(() => {
        assertMeetingNotFinalized(MeetingStatus.INVITED, 'thêm người tham dự');
      });
      assert.doesNotThrow(() => {
        assertMeetingNotFinalized(MeetingStatus.MINUTES_DRAFT, 'soạn thảo');
      });

      assert.throws(
        () => assertMeetingNotFinalized(MeetingStatus.MINUTES_CONFIRMED, 'sửa đổi'),
        (err: any) => {
          assert.ok(err instanceof FinalizedMeetingError);
          assert.equal(err.status, 'MINUTES_CONFIRMED');
          return true;
        }
      );

      assert.throws(
        () => assertMeetingNotFinalized(MeetingStatus.CANCELLED, 'thêm người tham dự'),
        (err: any) => {
          assert.ok(err instanceof FinalizedMeetingError);
          assert.equal(err.status, 'CANCELLED');
          return true;
        }
      );
    });
  });
});
