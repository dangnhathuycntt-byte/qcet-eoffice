/**
 * CANONICAL AUTHORIZATION AUDIT TRAIL FOR QCET E-OFFICE
 *
 * Implements Sprint 2 Task 11: Audit Authorization Decisions.
 *
 * Invariants:
 * 1. Authority-sensitive operations record immutable audit records upon authorization.
 * 2. Successful mutations ('ALLOW') record an immutable AuditEvent in the database.
 * 3. Denied mutations ('DENY') emit structured security log events to avoid database spam,
 *    with optional database logging when requested.
 * 4. Immutability: AuditEvent records are strictly append-only (WORM).
 */

import type { DbClient } from '@/lib/db/audit';
import { logAuditEvent } from '@/lib/db/audit';
import { logger } from '@/server/observability/logger';
import type { AuthorizationContext } from './authorization-context';
import type { AuthorizationResult, RejectionCode, AuditRecord } from './resource';

export type AuthorizationDecision =
  | AuthorizationResult
  | {
      allowed?: boolean;
      granted?: boolean;
      reason?: string;
      rejectionCode?: RejectionCode | string;
      statusCode?: RejectionCode | 'GRANTED' | string;
      delegationUsed?: string;
      actingPositionId?: string;
      auditRecord?: AuditRecord | { decision?: 'ALLOW' | 'DENY'; [key: string]: any };
      delegationContext?: {
        isDelegated?: boolean;
        delegationGrantId?: string;
        sourceDocument?: string;
        grantorId?: string;
      };
      [key: string]: any;
    };

export interface AuthorizationAuditRecord {
  actorUserId: string;
  actingPositionAssignmentId?: string | null;
  delegationGrantId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  requestId?: string | null;
  result: 'ALLOW' | 'DENY';
  reason?: string | null;
  rejectionCode?: string | null;
}

export interface RecordAuthorizationDecisionOptions {
  recordDenyInDb?: boolean;
}

function isAuditRecord(obj: any): obj is AuthorizationAuditRecord {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.actorUserId === 'string' &&
    typeof obj.action === 'string' &&
    typeof obj.resourceType === 'string' &&
    (obj.result === 'ALLOW' || obj.result === 'DENY')
  );
}

/**
 * Extracts a normalized AuthorizationAuditRecord from an authorization decision and context.
 */
export function extractAuditFromDecision(
  decision: AuthorizationDecision,
  context: AuthorizationContext,
  action: string,
  resourceType: string,
  resourceId: string,
  requestId?: string | null
): AuthorizationAuditRecord {
  const isAllow =
    decision.allowed === true ||
    decision.granted === true ||
    decision.auditRecord?.decision === 'ALLOW';

  const delegationGrantId =
    decision.delegationUsed ??
    decision.delegationContext?.delegationGrantId ??
    null;

  const actingPositionAssignmentId =
    decision.actingPositionId ??
    context.positions?.find((p) => p.isActing)?.id ??
    context.positions?.[0]?.id ??
    null;

  const rejectionCode =
    decision.rejectionCode ??
    (!isAllow && decision.statusCode && decision.statusCode !== 'GRANTED'
      ? (decision.statusCode as string)
      : null);

  return {
    actorUserId: context.userId,
    actingPositionAssignmentId: actingPositionAssignmentId ?? null,
    delegationGrantId: delegationGrantId ?? null,
    action,
    resourceType,
    resourceId,
    requestId: requestId ?? null,
    result: isAllow ? 'ALLOW' : 'DENY',
    reason: decision.reason ?? null,
    rejectionCode: rejectionCode ?? null,
  };
}

/**
 * Records an authorization decision.
 * When result is 'ALLOW', records an immutable AuditEvent in the DB.
 * When result is 'DENY', logs a structured security event (via structured logger)
 * without spamming the database with high-volume denial events, unless recordDenyInDb is explicitly enabled.
 */
export async function recordAuthorizationDecision(
  client: DbClient,
  record: AuthorizationAuditRecord,
  options?: RecordAuthorizationDecisionOptions
): Promise<void>;
export async function recordAuthorizationDecision(
  record: AuthorizationAuditRecord,
  options?: RecordAuthorizationDecisionOptions
): Promise<void>;
export async function recordAuthorizationDecision(
  clientOrRecord: DbClient | AuthorizationAuditRecord,
  recordOrOptions?: AuthorizationAuditRecord | RecordAuthorizationDecisionOptions,
  maybeOptions?: RecordAuthorizationDecisionOptions
): Promise<void> {
  let client: DbClient | undefined;
  let record: AuthorizationAuditRecord;
  let options: RecordAuthorizationDecisionOptions | undefined;

  if (isAuditRecord(clientOrRecord)) {
    record = clientOrRecord;
    options = recordOrOptions as RecordAuthorizationDecisionOptions | undefined;
  } else {
    client = clientOrRecord as DbClient;
    record = recordOrOptions as AuthorizationAuditRecord;
    options = maybeOptions;
  }

  if (record.result === 'ALLOW') {
    const metadata: Record<string, any> = {
      actingPositionAssignmentId: record.actingPositionAssignmentId ?? null,
      delegationGrantId: record.delegationGrantId ?? null,
      result: 'ALLOW',
      reason: record.reason ?? null,
    };
    if (record.rejectionCode) {
      metadata.rejectionCode = record.rejectionCode;
    }

    const payload = {
      actorId: record.actorUserId,
      action: record.action,
      entityType: record.resourceType,
      entityId: record.resourceId,
      requestId: record.requestId ?? null,
      metadata,
    };

    if (client) {
      await logAuditEvent(client, payload);
    } else {
      await logAuditEvent(payload);
    }
  } else {
    // Structured security event for DENY
    const denyMetadata: Record<string, any> = {
      actorUserId: record.actorUserId,
      actingPositionAssignmentId: record.actingPositionAssignmentId ?? null,
      delegationGrantId: record.delegationGrantId ?? null,
      action: record.action,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      requestId: record.requestId ?? null,
      result: 'DENY',
      reason: record.reason ?? null,
      rejectionCode: record.rejectionCode ?? null,
    };

    logger.warn('security.authorization.denied', {
      action: record.action,
      resourceId: record.resourceId,
      requestId: record.requestId ?? null,
      metadata: denyMetadata,
      ...denyMetadata,
    });

    if (options?.recordDenyInDb) {
      const metadata: Record<string, any> = {
        actingPositionAssignmentId: record.actingPositionAssignmentId ?? null,
        delegationGrantId: record.delegationGrantId ?? null,
        result: 'DENY',
        reason: record.reason ?? null,
        rejectionCode: record.rejectionCode ?? null,
      };

      const payload = {
        actorId: record.actorUserId,
        action: record.action,
        entityType: record.resourceType,
        entityId: record.resourceId,
        requestId: record.requestId ?? null,
        metadata,
      };

      if (client) {
        await logAuditEvent(client, payload);
      } else {
        await logAuditEvent(payload);
      }
    }
  }
}
