/**
 * Test Suite: Dossier Archival Separation of Duties (SoD) Guards (WI-6.2c / Issue #84)
 *
 * Verifies RFC-11 & ADR-001:
 * 1. Rule 10.6 SoD Invariant: Submitter / Creator != Archivist (Người nộp lưu không được tự tiếp nhận hồ sơ)
 *    - Rejects accept_archive / archive attempt by responsiblePersonId or submittedById with SOD_VIOLATION
 *    - Allows designated Archivist who is NOT Submitter to accept archive
 * 2. Immutability Protection & Transition Assertions:
 *    - Cannot add items to CLOSED or ARCHIVED dossiers
 *    - Rejection/return transition (SUBMITTED_TO_ARCHIVE -> READY_FOR_ARCHIVE) adheres to FSM
 */

import * as nodeTest from 'node:test';
import assert from 'node:assert/strict';
import {
  DossierStatus,
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
  assertDossierNotImmutable,
} from '../../src/domain/dossiers/state-machine';
import { InvalidTransitionError } from '../../src/server/api/errors';

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

describe('WI-6.2c: Dossier Archival Separation of Duties (SoD) Guards (RFC-11)', () => {
  // Mock contexts
  const archivistUserContext = createAuthContext('user-archivist-01', 'VAN_THU', 'unit-hcth', false);
  const submitterUserContext = createAuthContext('user-submitter-02', 'CHUYEN_VIEN', 'unit-daotao', false);

  const dossierResource: AuthorizationResource = {
    type: 'dossier',
    id: 'dossier-test-201',
    status: 'SUBMITTED_TO_ARCHIVE',
    owningUnitId: 'unit-daotao',
    dossierOwnerId: 'user-submitter-02',
    submittedByUserId: 'user-submitter-02',
  };

  describe('1. Rule 10.6 Separation of Duties (SoD) Enforcement', () => {
    it('REJECTS archival acceptance by regular Specialist with INSUFFICIENT_CAPABILITY', () => {
      // Regular staff without archival duties trying to accept archive
      const authResult = authorize(
        submitterUserContext,
        'dossier.accept_archive',
        dossierResource
      );

      assert.equal(authResult.allowed, false);
      assert.equal(authResult.rejectionCode, 'INSUFFICIENT_CAPABILITY');
    });

    it('REJECTS archival acceptance if user is dossier owner even if holding archivist position', () => {
      // An archivist who created their own unit dossier and tries to self-accept
      const archivistSelfContext = createAuthContext('user-archivist-self-03', 'VAN_THU', 'unit-hcth', false);

      const selfDossierResource: AuthorizationResource = {
        type: 'dossier',
        id: 'dossier-test-202',
        status: 'SUBMITTED_TO_ARCHIVE',
        owningUnitId: 'unit-hcth',
        dossierOwnerId: 'user-archivist-self-03',
        submittedByUserId: 'user-archivist-self-03',
      };

      const authResult = authorize(
        archivistSelfContext,
        'dossier.accept_archive',
        selfDossierResource
      );

      assert.equal(
        authResult.allowed,
        false,
        'Archivist MUST NOT self-accept archives when they are the submitter/owner'
      );
      assert.equal(authResult.rejectionCode, 'SOD_VIOLATION');
      assert.equal(authResult.auditRecord?.policyMatched, 'STEP_10_SUBMITTER_NOT_ARCHIVIST');
    });

    it('ALLOWS archival acceptance by designated Archivist who is NOT the submitter', () => {
      const authResult = authorize(
        archivistUserContext,
        'dossier.accept_archive',
        dossierResource
      );

      assert.equal(authResult.allowed, true, 'Independent archivist must be granted permission');
      assert.equal(authResult.statusCode, 'GRANTED');
    });
  });

  describe('2. State Machine Archival Transition Assertions', () => {
    it('allows transition sequence SUBMITTED_TO_ARCHIVE -> ACCEPTED -> ARCHIVED', () => {
      assert.doesNotThrow(() => {
        assertTransition(DossierStatus.SUBMITTED_TO_ARCHIVE, DossierStatus.ACCEPTED);
        assertTransition(DossierStatus.ACCEPTED, DossierStatus.ARCHIVED);
      });
    });

    it('allows return transition SUBMITTED_TO_ARCHIVE -> READY_FOR_ARCHIVE (Archivist Return for Revisions)', () => {
      assert.doesNotThrow(() => {
        assertTransition(DossierStatus.SUBMITTED_TO_ARCHIVE, DossierStatus.READY_FOR_ARCHIVE);
      });
    });

    it('prohibits modifying ARCHIVED dossier (Terminal Immutable State)', () => {
      assert.throws(
        () => assertTransition(DossierStatus.ARCHIVED, DossierStatus.ACCEPTED),
        (err: any) => {
          assert.ok(err instanceof InvalidTransitionError);
          return true;
        }
      );

      assert.throws(
        () => assertDossierNotImmutable(DossierStatus.ARCHIVED, 'chỉnh sửa nội dung'),
        (err: any) => {
          assert.ok(err instanceof InvalidTransitionError);
          assert.ok(err.message.includes('ARCHIVED'));
          return true;
        }
      );
    });
  });
});
