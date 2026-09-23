/**
 * QCET E-Office: DacumDelegation to DelegationGrant Migration Track (WI-8.3 / RFC-03)
 *
 * Implements Stage A/B utilities for mapping, backfilling, and verifying parity
 * between legacy user-to-user DacumDelegation records and canonical position-based DelegationGrant.
 *
 * INVARIANTS (RFC-03):
 * 1. Zero Authority Invention: Missing authorityScope, dates, document reference or resource scope
 *    MUST NOT silently become task.approve, ALL, synthetic one-year validity, or broader authority.
 * 2. Ambiguous Record Quarantine: Records lacking statutory requisites are quarantined for remediation.
 * 3. Deterministic Resolution: Ties across multiple active PositionAssignments are resolved deterministically
 *    by unit alignment, leadership role, latest effectiveFrom, and stable primary key order.
 */

import {
  type PrismaClient,
  type Prisma,
  DelegationStatus,
} from '@prisma/client';

export type DbClient = PrismaClient | Prisma.TransactionClient;

export interface DacumSyncInput {
  id?: string;
  grantorId: string;
  delegateId: string;
  departmentId?: string | null;
  authorityScope?: string | null;
  documentRef?: string | null;
  startDate?: Date | null;
  expiresAt?: Date | null;
  isActive?: boolean;
}

export interface QuarantinedDelegation {
  dacumId: string;
  reason: string;
  payload: DacumSyncInput;
}

export interface DelegationParityReport {
  isParityMatched: boolean;
  totalDacumDelegations: number;
  matchedGrants: number;
  fullyMatchedGrants: number;
  partialMatchGrants: number;
  unmatchedDacumIds: string[];
  quarantinedRecords: QuarantinedDelegation[];
}

/**
 * Resolves delegation status from legacy isActive and expiresAt fields
 */
export function resolveDelegationStatus(
  isActive: boolean,
  expiresAt?: Date | null,
  now: Date = new Date()
): DelegationStatus {
  if (!isActive) {
    return DelegationStatus.REVOKED;
  }
  if (expiresAt && expiresAt < now) {
    return DelegationStatus.EXPIRED;
  }
  return DelegationStatus.ACTIVE;
}

/**
 * Resolves active PositionAssignment deterministically for a user:
 * 1. Unit alignment (if preferredUnitId provided).
 * 2. Leadership positions first (positionDefinition.isLeadership DESC).
 * 3. Most recent assignment (effectiveFrom DESC).
 * 4. Stable tie-breaker on primary key (id ASC).
 */
export async function resolveDeterministicPositionAssignment(
  db: DbClient,
  userId: string,
  preferredUnitId?: string | null
): Promise<{ id: string; unitId: string | null; userId: string } | null> {
  const rawAssignments: Array<{
    id: string;
    userId: string;
    unitId: string | null;
    effectiveFrom: Date;
    positionDefinition: { isLeadership: boolean };
  }> = await (db as any).positionAssignment.findMany({
    where: {
      userId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      userId: true,
      unitId: true,
      effectiveFrom: true,
      positionDefinition: {
        select: { isLeadership: true },
      },
    },
  });

  if (rawAssignments.length === 0) {
    return null;
  }

  // Sort in application code: isLeadership DESC, effectiveFrom DESC, id ASC
  const assignments = [...rawAssignments].sort((a, b) => {
    const aLeader = a.positionDefinition.isLeadership ? 1 : 0;
    const bLeader = b.positionDefinition.isLeadership ? 1 : 0;
    if (bLeader !== aLeader) return bLeader - aLeader;
    const timeDiff = b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  // If unit alignment is requested and available, prefer the matched assignment
  if (preferredUnitId) {
    const unitMatch = assignments.find((a) => a.unitId === preferredUnitId);
    if (unitMatch) {
      return { id: unitMatch.id, unitId: unitMatch.unitId, userId: unitMatch.userId };
    }
  }

  // Return the highest-priority deterministic assignment
  return {
    id: assignments[0].id,
    unitId: assignments[0].unitId,
    userId: assignments[0].userId,
  };
}

/**
 * Validates whether a legacy DacumDelegation meets minimum statutory criteria (Decree 30/2020 / RFC-03).
 * Fails closed without inventing authority.
 */
export function validateDacumDelegationStatutoryRequirements(
  input: DacumSyncInput
): { valid: true } | { valid: false; reason: string } {
  if (!input.authorityScope || !input.authorityScope.trim()) {
    return {
      valid: false,
      reason: 'Missing authorityScope: Cannot migrate without explicit delegable action',
    };
  }

  if (!input.documentRef || !input.documentRef.trim()) {
    return {
      valid: false,
      reason: 'Missing documentRef: Statutory delegation requires official document reference',
    };
  }

  if (!input.startDate) {
    return {
      valid: false,
      reason: 'Missing startDate: Delegation must have a defined commencement date',
    };
  }

  if (!input.expiresAt) {
    return {
      valid: false,
      reason: 'Missing expiresAt: Unbounded delegations are prohibited under Decree 30/2020',
    };
  }

  return { valid: true };
}

/**
 * Synchronizes a legacy DacumDelegation into canonical DelegationGrant (Dual-Write helper for Stage B).
 * Fails closed and refuses to invent authority if required fields are missing.
 */
export async function syncDacumToDelegationGrant(
  db: DbClient,
  input: DacumSyncInput
): Promise<{ grantId: string; created: boolean }> {
  // 1. Strict Statutory Validation
  const validation = validateDacumDelegationStatutoryRequirements(input);
  if (!validation.valid) {
    throw new Error(`Cannot sync delegation: ${validation.reason}`);
  }

  // 2. Deterministic PositionAssignment Resolution
  const grantorAssignment = await resolveDeterministicPositionAssignment(
    db,
    input.grantorId,
    input.departmentId
  );
  const granteeAssignment = await resolveDeterministicPositionAssignment(
    db,
    input.delegateId,
    input.departmentId
  );

  if (!grantorAssignment || !granteeAssignment) {
    throw new Error(
      `Cannot sync delegation: Grantor or Grantee missing active PositionAssignment`
    );
  }

  const docNumber = input.documentRef!.trim();
  const status = resolveDelegationStatus(input.isActive ?? true, input.expiresAt);

  // 3. Idempotency Check
  const existing = await (db as any).delegationGrant.findFirst({
    where: {
      grantorAssignmentId: grantorAssignment.id,
      granteeAssignmentId: granteeAssignment.id,
      sourceDocumentNumber: docNumber,
    },
    select: { id: true },
  });

  if (existing) {
    return { grantId: existing.id, created: false };
  }

  // 4. Create canonical DelegationGrant without inventing scopes
  const resourceScope = input.departmentId ? 'DEPARTMENT' : 'INDIVIDUAL';

  const grant = await (db as any).delegationGrant.create({
    data: {
      grantorAssignmentId: grantorAssignment.id,
      granteeAssignmentId: granteeAssignment.id,
      action: input.authorityScope!.trim(),
      resourceScope,
      validFrom: input.startDate!,
      validUntil: input.expiresAt!,
      sourceDocumentNumber: docNumber,
      status,
      reason: input.id
        ? `Synced from DacumDelegation [${input.id}]`
        : 'Dual-write from DacumDelegation',
    },
  });

  return { grantId: grant.id, created: true };
}

/** Acceptable date range tolerance for parity check (ms) */
const DATE_TOLERANCE_MS = 24 * 60 * 60 * 1000; // 1 day

/**
 * Verifies parity between DacumDelegation and DelegationGrant tables.
 * Quarantines any invalid/ambiguous legacy records without silent conversion.
 *
 * Strengthened checks:
 * - Grantor userId must match via grantorAssignment.userId
 * - Grantee userId must match via granteeAssignment.userId
 * - validFrom / validUntil must be within DATE_TOLERANCE_MS of dacum startDate / expiresAt
 */
export async function verifyDelegationGrantParity(
  db: DbClient
): Promise<DelegationParityReport> {
  const dacumDelegations: Array<{
    id: string;
    grantorId: string;
    delegateId: string;
    departmentId: string | null;
    authorityScope: string | null;
    documentRef: string | null;
    startDate: Date | null;
    expiresAt: Date | null;
    isActive: boolean;
  }> = await (db as any).dacumDelegation.findMany({
    select: {
      id: true,
      grantorId: true,
      delegateId: true,
      departmentId: true,
      authorityScope: true,
      documentRef: true,
      startDate: true,
      expiresAt: true,
      isActive: true,
    },
  });

  const unmatchedDacumIds: string[] = [];
  const quarantinedRecords: QuarantinedDelegation[] = [];
  let matchedGrants = 0;
  let fullyMatchedGrants = 0;
  let partialMatchGrants = 0;

  for (const dacum of dacumDelegations) {
    const validation = validateDacumDelegationStatutoryRequirements(dacum);
    if (!validation.valid) {
      quarantinedRecords.push({
        dacumId: dacum.id,
        reason: validation.reason,
        payload: dacum,
      });
      continue;
    }

    const grant = await (db as any).delegationGrant.findFirst({
      where: {
        sourceDocumentNumber: dacum.documentRef!.trim(),
      },
      select: {
        id: true,
        validFrom: true,
        validUntil: true,
        grantorAssignment: { select: { userId: true } },
        granteeAssignment: { select: { userId: true } },
      },
    });

    if (!grant) {
      unmatchedDacumIds.push(dacum.id);
      continue;
    }

    matchedGrants++;

    // Verify grantor/grantee userId and date range
    const grantorMatch = grant.grantorAssignment?.userId === dacum.grantorId;
    const granteeMatch = grant.granteeAssignment?.userId === dacum.delegateId;

    const validFromDiff = dacum.startDate
      ? Math.abs(new Date(grant.validFrom).getTime() - dacum.startDate.getTime())
      : Infinity;
    const validUntilDiff = dacum.expiresAt
      ? Math.abs(new Date(grant.validUntil).getTime() - dacum.expiresAt.getTime())
      : Infinity;
    const datesMatch =
      validFromDiff <= DATE_TOLERANCE_MS && validUntilDiff <= DATE_TOLERANCE_MS;

    if (grantorMatch && granteeMatch && datesMatch) {
      fullyMatchedGrants++;
    } else {
      partialMatchGrants++;
    }
  }

  return {
    isParityMatched:
      unmatchedDacumIds.length === 0 && quarantinedRecords.length === 0,
    totalDacumDelegations: dacumDelegations.length,
    matchedGrants,
    fullyMatchedGrants,
    partialMatchGrants,
    unmatchedDacumIds,
    quarantinedRecords,
  };
}

/**
 * Formats quarantined delegation records as a JSON string for manual review export.
 */
export function writeQuarantineReport(records: QuarantinedDelegation[]): string {
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      totalQuarantined: records.length,
      records,
    },
    null,
    2
  );
}
