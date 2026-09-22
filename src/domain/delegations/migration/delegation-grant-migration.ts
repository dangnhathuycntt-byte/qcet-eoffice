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
 *    by unit alignment, leadership role, latest appointedAt, and stable primary key order.
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
 * 2. Leadership positions first (isLeadership DESC).
 * 3. Most recently appointed assignment (appointedAt DESC).
 * 4. Stable tie-breaker on primary key (id ASC).
 */
export async function resolveDeterministicPositionAssignment(
  db: DbClient,
  userId: string,
  preferredUnitId?: string | null
): Promise<{ id: string; unitId: string | null } | null> {
  const assignments: Array<{
    id: string;
    unitId: string | null;
    isLeadership: boolean;
    appointedAt: Date;
  }> = await (db as any).positionAssignment.findMany({
    where: {
      userId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      unitId: true,
      isLeadership: true,
      appointedAt: true,
    },
    orderBy: [
      { isLeadership: 'desc' },
      { appointedAt: 'desc' },
      { id: 'asc' },
    ],
  });

  if (assignments.length === 0) {
    return null;
  }

  // If unit alignment is requested and available, prefer the matched assignment
  if (preferredUnitId) {
    const unitMatch = assignments.find((a) => a.unitId === preferredUnitId);
    if (unitMatch) {
      return { id: unitMatch.id, unitId: unitMatch.unitId };
    }
  }

  // Return the highest-priority deterministic assignment
  return { id: assignments[0].id, unitId: assignments[0].unitId };
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
      notes: input.id
        ? `Synced from DacumDelegation [${input.id}]`
        : 'Dual-write from DacumDelegation',
    },
  });

  return { grantId: grant.id, created: true };
}

/**
 * Verifies parity between DacumDelegation and DelegationGrant tables.
 * Quarantines any invalid/ambiguous legacy records without silent conversion.
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
      select: { id: true },
    });

    if (grant) {
      matchedGrants++;
    } else {
      unmatchedDacumIds.push(dacum.id);
    }
  }

  return {
    isParityMatched:
      unmatchedDacumIds.length === 0 && quarantinedRecords.length === 0,
    totalDacumDelegations: dacumDelegations.length,
    matchedGrants,
    unmatchedDacumIds,
    quarantinedRecords,
  };
}
