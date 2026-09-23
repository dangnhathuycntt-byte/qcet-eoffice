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
  writeQuarantineReport,
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
      const rawAssignments = [
        {
          id: 'pos_faculty',
          userId: 'user-1',
          unitId: 'unit_faculty',
          effectiveFrom: new Date('2025-01-01'),
          positionDefinition: { isLeadership: true },
        },
        {
          id: 'pos_admin',
          userId: 'user-1',
          unitId: 'unit_admin',
          effectiveFrom: new Date('2026-01-01'),
          positionDefinition: { isLeadership: true },
        },
      ];

      const mockDb: any = {
        positionAssignment: {
          findMany: async () => rawAssignments,
        },
      };

      const resolved = await resolveDeterministicPositionAssignment(mockDb, 'user-1', 'unit_faculty');
      assert.strictEqual(resolved?.id, 'pos_faculty');
    });

    it('orders by leadership DESC, effectiveFrom DESC, id ASC as tie-breaker when no unit match', async () => {
      const rawAssignments = [
        {
          id: 'pos_b',
          userId: 'user-1',
          unitId: 'unit_other',
          effectiveFrom: new Date('2026-06-01'),
          positionDefinition: { isLeadership: false },
        },
        {
          id: 'pos_a',
          userId: 'user-1',
          unitId: 'unit_main',
          effectiveFrom: new Date('2025-01-01'),
          positionDefinition: { isLeadership: true },
        },
      ];

      const mockDb: any = {
        positionAssignment: {
          findMany: async () => rawAssignments,
        },
      };

      const resolved = await resolveDeterministicPositionAssignment(mockDb, 'user-1');
      assert.strictEqual(resolved?.id, 'pos_a'); // Leadership position wins
    });

    it('returns userId from the resolved assignment', async () => {
      const rawAssignments = [
        {
          id: 'pos_x',
          userId: 'user-xyz',
          unitId: 'unit_x',
          effectiveFrom: new Date('2026-01-01'),
          positionDefinition: { isLeadership: true },
        },
      ];

      const mockDb: any = {
        positionAssignment: {
          findMany: async () => rawAssignments,
        },
      };

      const resolved = await resolveDeterministicPositionAssignment(mockDb, 'user-xyz');
      assert.strictEqual(resolved?.userId, 'user-xyz');
    });

    it('returns null when no active assignments exist', async () => {
      const mockDb: any = {
        positionAssignment: {
          findMany: async () => [],
        },
      };

      const resolved = await resolveDeterministicPositionAssignment(mockDb, 'user-nobody');
      assert.strictEqual(resolved, null);
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
    it('creates DelegationGrant with reason field when statutory criteria and positions are valid', async () => {
      const createdGrants: any[] = [];
      const startDate = new Date('2026-09-01T08:00:00Z');
      const expiresAt = new Date('2026-12-31T17:00:00Z');

      const mockDb: any = {
        positionAssignment: {
          findMany: async ({ where }: any) => [
            {
              id: `pos_${where.userId}`,
              userId: where.userId,
              unitId: 'unit-1',
              effectiveFrom: new Date(),
              positionDefinition: { isLeadership: true },
            },
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
      // FIX 2: reason field, not notes
      assert.ok(createdGrants[0].reason, 'reason field must be set');
      assert.match(createdGrants[0].reason, /dacum-1/);
      assert.strictEqual(createdGrants[0].notes, undefined);
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

    it('returns existing grant without creating duplicate (idempotency)', async () => {
      const startDate = new Date('2026-09-01T08:00:00Z');
      const expiresAt = new Date('2026-12-31T17:00:00Z');

      const mockDb: any = {
        positionAssignment: {
          findMany: async ({ where }: any) => [
            {
              id: `pos_${where.userId}`,
              userId: where.userId,
              unitId: 'unit-1',
              effectiveFrom: new Date(),
              positionDefinition: { isLeadership: false },
            },
          ],
        },
        delegationGrant: {
          findFirst: async () => ({ id: 'grant-existing' }),
        },
      };

      const result = await syncDacumToDelegationGrant(mockDb, {
        grantorId: 'user-a',
        delegateId: 'user-b',
        authorityScope: 'task.approve',
        documentRef: 'QD-001',
        startDate,
        expiresAt,
        isActive: true,
      });

      assert.strictEqual(result.created, false);
      assert.strictEqual(result.grantId, 'grant-existing');
    });
  });

  describe('5. Parity Verification & Quarantine Tracking', () => {
    it('confirms 100% parity when all dacum delegations have valid statutory data and matching grants', async () => {
      const startDate = new Date('2026-09-01');
      const expiresAt = new Date('2026-12-31');

      const mockDacum = [
        {
          id: 'dac-1',
          grantorId: 'u1',
          delegateId: 'u2',
          departmentId: null,
          authorityScope: 'task.approve',
          documentRef: 'REF-1',
          startDate,
          expiresAt,
          isActive: true,
        },
      ];

      const mockDb: any = {
        dacumDelegation: {
          findMany: async () => mockDacum,
        },
        delegationGrant: {
          findFirst: async () => ({
            id: 'grant-found',
            validFrom: startDate,
            validUntil: expiresAt,
            grantorAssignment: { userId: 'u1' },
            granteeAssignment: { userId: 'u2' },
          }),
        },
      };

      const report = await verifyDelegationGrantParity(mockDb);
      assert.strictEqual(report.isParityMatched, true);
      assert.strictEqual(report.totalDacumDelegations, 1);
      assert.strictEqual(report.matchedGrants, 1);
      assert.strictEqual(report.fullyMatchedGrants, 1);
      assert.strictEqual(report.partialMatchGrants, 0);
      assert.strictEqual(report.quarantinedRecords.length, 0);
    });

    it('classifies grant as partial match when grantor userId mismatches', async () => {
      const startDate = new Date('2026-09-01');
      const expiresAt = new Date('2026-12-31');

      const mockDacum = [
        {
          id: 'dac-partial',
          grantorId: 'u1',
          delegateId: 'u2',
          departmentId: null,
          authorityScope: 'task.approve',
          documentRef: 'REF-PARTIAL',
          startDate,
          expiresAt,
          isActive: true,
        },
      ];

      const mockDb: any = {
        dacumDelegation: {
          findMany: async () => mockDacum,
        },
        delegationGrant: {
          findFirst: async () => ({
            id: 'grant-partial',
            validFrom: startDate,
            validUntil: expiresAt,
            grantorAssignment: { userId: 'u-wrong' }, // Mismatch
            granteeAssignment: { userId: 'u2' },
          }),
        },
      };

      const report = await verifyDelegationGrantParity(mockDb);
      assert.strictEqual(report.matchedGrants, 1);
      assert.strictEqual(report.fullyMatchedGrants, 0);
      assert.strictEqual(report.partialMatchGrants, 1);
    });

    it('classifies grant as partial match when date range is out of tolerance', async () => {
      const startDate = new Date('2026-09-01');
      const expiresAt = new Date('2026-12-31');
      // 3 days off — exceeds 1-day tolerance
      const grantValidFrom = new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000);

      const mockDacum = [
        {
          id: 'dac-date-mismatch',
          grantorId: 'u1',
          delegateId: 'u2',
          departmentId: null,
          authorityScope: 'task.approve',
          documentRef: 'REF-DATE',
          startDate,
          expiresAt,
          isActive: true,
        },
      ];

      const mockDb: any = {
        dacumDelegation: {
          findMany: async () => mockDacum,
        },
        delegationGrant: {
          findFirst: async () => ({
            id: 'grant-date-off',
            validFrom: grantValidFrom,
            validUntil: expiresAt,
            grantorAssignment: { userId: 'u1' },
            granteeAssignment: { userId: 'u2' },
          }),
        },
      };

      const report = await verifyDelegationGrantParity(mockDb);
      assert.strictEqual(report.partialMatchGrants, 1);
      assert.strictEqual(report.fullyMatchedGrants, 0);
    });

    it('quarantines ambiguous records lacking statutory requisites', async () => {
      const mockDacum = [
        {
          id: 'dac-ambiguous',
          grantorId: 'u1',
          delegateId: 'u2',
          departmentId: null,
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

  describe('6. Quarantine Report Export (writeQuarantineReport)', () => {
    it('returns valid JSON string with totalQuarantined and records', () => {
      const records = [
        {
          dacumId: 'dac-x',
          reason: 'Missing authorityScope: Cannot migrate without explicit delegable action',
          payload: {
            grantorId: 'u1',
            delegateId: 'u2',
            authorityScope: null,
            documentRef: null,
            startDate: null,
            expiresAt: null,
          },
        },
      ];

      const output = writeQuarantineReport(records);
      const parsed = JSON.parse(output);

      assert.strictEqual(parsed.totalQuarantined, 1);
      assert.strictEqual(parsed.records.length, 1);
      assert.strictEqual(parsed.records[0].dacumId, 'dac-x');
      assert.ok(parsed.generatedAt, 'generatedAt must be present');
    });

    it('returns empty records array when no quarantined delegations', () => {
      const output = writeQuarantineReport([]);
      const parsed = JSON.parse(output);
      assert.strictEqual(parsed.totalQuarantined, 0);
      assert.deepStrictEqual(parsed.records, []);
    });
  });
});
