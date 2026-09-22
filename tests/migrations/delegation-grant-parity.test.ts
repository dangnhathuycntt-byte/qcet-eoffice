/**
 * Test Suite: DacumDelegation to DelegationGrant Migration Track (WI-8.3 / RFC-03)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DelegationStatus } from '@prisma/client';
import {
  resolveDelegationStatus,
  resolveDeterministicPositionAssignment,
  validateDacumDelegationStatutoryRequirements,
  syncDacumToDelegationGrant,
  verifyDelegationGrantParity,
} from '@/domain/delegations/migration';

describe('WI-8.3: DacumDelegation to DelegationGrant Migration Track', () => {
  describe('1. Delegation Status Resolution', () => {
    it('resolves REVOKED when isActive is false', () => {
      const status = resolveDelegationStatus(false, new Date(Date.now() + 10000));
      assert.strictEqual(status, DelegationStatus.REVOKED);
    });

    it('resolves EXPIRED when isActive is true but expiresAt is in the past', () => {
      const pastDate = new Date(Date.now() - 10000);
      const status = resolveDelegationStatus(true, pastDate);
      assert.strictEqual(status, DelegationStatus.EXPIRED);
    });

    it('resolves ACTIVE when isActive is true and expiresAt is in the future', () => {
      const futureDate = new Date(Date.now() + 100000);
      const status = resolveDelegationStatus(true, futureDate);
      assert.strictEqual(status, DelegationStatus.ACTIVE);
    });
  });

  describe('2. Deterministic Position Assignment Resolution', () => {
    it('prefers unit alignment when preferredUnitId matches an active assignment', async () => {
      const assignments = [
        { id: 'pos_faculty', unitId: 'unit_faculty', isLeadership: true, appointedAt: new Date('2025-01-01') },
        { id: 'pos_admin', unitId: 'unit_admin', isLeadership: true, appointedAt: new Date('2026-01-01') },
      ];

      const mockDb: any = {
        positionAssignment: {
          findMany: async () => assignments,
        },
      };

      const resolved = await resolveDeterministicPositionAssignment(mockDb, 'user-1', 'unit_faculty');
      assert.strictEqual(resolved?.id, 'pos_faculty');
    });

    it('orders by leadership DESC, appointedAt DESC, id ASC as tie-breaker when no unit match', async () => {
      const assignments = [
        { id: 'pos_b', unitId: 'unit_other', isLeadership: false, appointedAt: new Date('2026-06-01') },
        { id: 'pos_a', unitId: 'unit_main', isLeadership: true, appointedAt: new Date('2025-01-01') },
      ];

      const mockDb: any = {
        positionAssignment: {
          findMany: async () => [assignments[1], assignments[0]], // Leadership first
        },
      };

      const resolved = await resolveDeterministicPositionAssignment(mockDb, 'user-1');
      assert.strictEqual(resolved?.id, 'pos_a'); // Leadership position wins
    });
  });

  describe('3. Statutory Validation (Zero Authority Invention)', () => {
    it('rejects records missing authorityScope without silent default to task.approve', () => {
      const result = validateDacumDelegationStatutoryRequirements({
        grantorId: 'u1',
        delegateId: 'u2',
        authorityScope: '', // Missing
        documentRef: 'QD-123',
        startDate: new Date(),
        expiresAt: new Date(Date.now() + 10000),
      });
      assert.strictEqual(result.valid, false);
      assert.match((result as any).reason, /Missing authorityScope/);
    });

    it('rejects records missing documentRef without inventing synthetic document numbers', () => {
      const result = validateDacumDelegationStatutoryRequirements({
        grantorId: 'u1',
        delegateId: 'u2',
        authorityScope: 'task.approve',
        documentRef: null, // Missing
        startDate: new Date(),
        expiresAt: new Date(Date.now() + 10000),
      });
      assert.strictEqual(result.valid, false);
      assert.match((result as any).reason, /Missing documentRef/);
    });

    it('rejects records missing expiresAt without inventing synthetic one-year validity', () => {
      const result = validateDacumDelegationStatutoryRequirements({
        grantorId: 'u1',
        delegateId: 'u2',
        authorityScope: 'task.approve',
        documentRef: 'QD-123',
        startDate: new Date(),
        expiresAt: null, // Missing
      });
      assert.strictEqual(result.valid, false);
      assert.match((result as any).reason, /Missing expiresAt/);
    });
  });

  describe('4. Dual-Write Sync Functionality (syncDacumToDelegationGrant)', () => {
    it('creates DelegationGrant when statutory criteria and positions are valid', async () => {
      const createdGrants: any[] = [];
      const startDate = new Date('2026-09-01T08:00:00Z');
      const expiresAt = new Date('2026-12-31T17:00:00Z');

      const mockDb: any = {
        positionAssignment: {
          findMany: async ({ where }: any) => [
            { id: `pos_${where.userId}`, unitId: 'unit-1', isLeadership: true, appointedAt: new Date() },
          ],
        },
        delegationGrant: {
          findFirst: async () => null,
          create: async ({ data }: any) => {
            const record = { id: 'grant-new', ...data };
            createdGrants.push(record);
            return record;
          },
        },
      };

      const result = await syncDacumToDelegationGrant(mockDb, {
        id: 'dacum-1',
        grantorId: 'user-dean',
        delegateId: 'user-vice-dean',
        authorityScope: 'task.approve',
        documentRef: 'QD-420-2026',
        startDate,
        expiresAt,
        isActive: true,
      });

      assert.strictEqual(result.created, true);
      assert.strictEqual(result.grantId, 'grant-new');
      assert.strictEqual(createdGrants[0].action, 'task.approve');
      assert.deepStrictEqual(createdGrants[0].validFrom, startDate);
      assert.deepStrictEqual(createdGrants[0].validUntil, expiresAt);
      assert.strictEqual(createdGrants[0].sourceDocumentNumber, 'QD-420-2026');
    });

    it('fails closed and refuses to sync when statutory requirements are missing', async () => {
      const mockDb: any = {};

      await assert.rejects(
        () =>
          syncDacumToDelegationGrant(mockDb, {
            grantorId: 'user-dean',
            delegateId: 'user-vice-dean',
            // Missing authorityScope & documentRef & dates
          }),
        /Cannot sync delegation: Missing authorityScope/
      );
    });
  });

  describe('5. Parity Verification & Quarantine Tracking', () => {
    it('confirms 100% parity when all dacum delegations have valid statutory data and matching grants', async () => {
      const mockDacum = [
        {
          id: 'dac-1',
          grantorId: 'u1',
          delegateId: 'u2',
          authorityScope: 'task.approve',
          documentRef: 'REF-1',
          startDate: new Date('2026-09-01'),
          expiresAt: new Date('2026-12-31'),
          isActive: true,
        },
      ];

      const mockDb: any = {
        dacumDelegation: {
          findMany: async () => mockDacum,
        },
        delegationGrant: {
          findFirst: async () => ({ id: 'grant-found' }),
        },
      };

      const report = await verifyDelegationGrantParity(mockDb);
      assert.strictEqual(report.isParityMatched, true);
      assert.strictEqual(report.totalDacumDelegations, 1);
      assert.strictEqual(report.matchedGrants, 1);
      assert.strictEqual(report.quarantinedRecords.length, 0);
    });

    it('quarantines ambiguous records lacking statutory requisites', async () => {
      const mockDacum = [
        {
          id: 'dac-ambiguous',
          grantorId: 'u1',
          delegateId: 'u2',
          authorityScope: null, // Ambiguous!
          documentRef: null,
          startDate: null,
          expiresAt: null,
          isActive: true,
        },
      ];

      const mockDb: any = {
        dacumDelegation: {
          findMany: async () => mockDacum,
        },
      };

      const report = await verifyDelegationGrantParity(mockDb);
      assert.strictEqual(report.isParityMatched, false);
      assert.strictEqual(report.quarantinedRecords.length, 1);
      assert.strictEqual(report.quarantinedRecords[0].dacumId, 'dac-ambiguous');
    });
  });
});
