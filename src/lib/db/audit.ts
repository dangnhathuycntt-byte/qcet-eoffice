import { Prisma, type PrismaClient, type AuditEvent } from "@prisma/client";
import { prisma as defaultPrisma } from "../prisma";

/**
 * Supported database client types: standard PrismaClient or an interactive transaction client.
 */
export type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Standard business audit event actions across QCET E-Office.
 * Upholds institutional traceability and compliance requirements.
 */
export const AuditAction = {
  // Task lifecycle actions
  TASK_CREATED: "TASK_CREATED",
  TASK_ASSIGNED: "TASK_ASSIGNED",
  TASK_STATUS_CHANGED: "TASK_STATUS_CHANGED",
  TASK_DEADLINE_CHANGED: "TASK_DEADLINE_CHANGED",
  TASK_APPROVED: "TASK_APPROVED",
  TASK_REJECTED: "TASK_REJECTED",

  // Deliverable review actions
  DELIVERABLE_SUBMITTED: "DELIVERABLE_SUBMITTED",
  DELIVERABLE_REVIEWED: "DELIVERABLE_REVIEWED",

  // Official document actions
  DOCUMENT_CREATED: "DOCUMENT_CREATED",
  DOCUMENT_DIRECTIVE_CREATED: "DOCUMENT_DIRECTIVE_CREATED",

  // Organization, roles & delegation actions
  USER_ROLE_CHANGED: "USER_ROLE_CHANGED",
  DELEGATION_CREATED: "DELEGATION_CREATED",
  DELEGATION_REVOKED: "DELEGATION_REVOKED",
} as const;

export type AuditActionType =
  | (typeof AuditAction)[keyof typeof AuditAction]
  | (string & {});

// Named constant exports for convenient direct imports
export const TASK_CREATED = AuditAction.TASK_CREATED;
export const TASK_ASSIGNED = AuditAction.TASK_ASSIGNED;
export const TASK_STATUS_CHANGED = AuditAction.TASK_STATUS_CHANGED;
export const TASK_DEADLINE_CHANGED = AuditAction.TASK_DEADLINE_CHANGED;
export const TASK_APPROVED = AuditAction.TASK_APPROVED;
export const TASK_REJECTED = AuditAction.TASK_REJECTED;
export const DELIVERABLE_SUBMITTED = AuditAction.DELIVERABLE_SUBMITTED;
export const DELIVERABLE_REVIEWED = AuditAction.DELIVERABLE_REVIEWED;
export const DOCUMENT_CREATED = AuditAction.DOCUMENT_CREATED;
export const DOCUMENT_DIRECTIVE_CREATED = AuditAction.DOCUMENT_DIRECTIVE_CREATED;
export const USER_ROLE_CHANGED = AuditAction.USER_ROLE_CHANGED;
export const DELEGATION_CREATED = AuditAction.DELEGATION_CREATED;
export const DELEGATION_REVOKED = AuditAction.DELEGATION_REVOKED;

/**
 * Common entity type constants for standard indexing and querying.
 */
export const AuditEntityType = {
  TASK: "Task",
  DOCUMENT: "Document",
  TASK_DELIVERABLE: "TaskDeliverable",
  DOCUMENT_DIRECTIVE: "DocumentDirective",
  USER: "User",
  DELEGATION_GRANT: "DelegationGrant",
} as const;

export type AuditEntityTypeValue =
  | (typeof AuditEntityType)[keyof typeof AuditEntityType]
  | (string & {});

/**
 * Payload for logging an audit event.
 */
export interface LogAuditEventInput {
  actorId?: string | null;
  action: AuditActionType;
  entityType: string;
  entityId: string;
  requestId?: string | null;
  beforeData?: Record<string, any> | Prisma.InputJsonValue | null;
  afterData?: Record<string, any> | Prisma.InputJsonValue | null;
  metadata?: Record<string, any> | Prisma.InputJsonValue | null;
}

/**
 * Query options for entity audit history.
 */
export interface GetEntityAuditHistoryOptions {
  entityType: string;
  entityId: string;
  limit?: number;
  cursor?: string;
}

/**
 * Query options for actor audit history.
 */
export interface GetActorAuditHistoryOptions {
  actorId: string;
  limit?: number;
  cursor?: string;
}

/**
 * Query options for request-scoped audit history.
 */
export interface GetRequestAuditEventsOptions {
  requestId: string;
  limit?: number;
}

/**
 * Serializes arbitrary input into JSON-compatible values for Prisma Json fields.
 */
function serializeJson(
  val: any
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (val === undefined || val === null) {
    return Prisma.DbNull;
  }
  try {
    return JSON.parse(JSON.stringify(val));
  } catch {
    return val as any;
  }
}

/**
 * Appends an immutable audit event to the institutional audit log.
 * Accepts either a top-level PrismaClient or an active Prisma.TransactionClient.
 *
 * IMMUTABILITY INVARIANT:
 * AuditEvent records are strictly append-only (WORM).
 * Once created, audit events can NEVER be updated or deleted.
 */
export async function logAuditEvent(
  client: DbClient,
  event: LogAuditEventInput
): Promise<AuditEvent>;
export async function logAuditEvent(
  event: LogAuditEventInput
): Promise<AuditEvent>;
export async function logAuditEvent(
  clientOrEvent: DbClient | LogAuditEventInput,
  eventMaybe?: LogAuditEventInput
): Promise<AuditEvent> {
  let client: DbClient;
  let event: LogAuditEventInput;

  if (eventMaybe !== undefined) {
    client = clientOrEvent as DbClient;
    event = eventMaybe;
  } else {
    client = defaultPrisma;
    event = clientOrEvent as LogAuditEventInput;
  }

  if (!event.action) {
    throw new Error("Audit action is required for logAuditEvent");
  }
  if (!event.entityType) {
    throw new Error("Audit entityType is required for logAuditEvent");
  }
  if (!event.entityId) {
    throw new Error("Audit entityId is required for logAuditEvent");
  }

  return await client.auditEvent.create({
    data: {
      actorId: event.actorId ?? null,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      requestId: event.requestId ?? null,
      beforeData: serializeJson(event.beforeData),
      afterData: serializeJson(event.afterData),
      metadata: serializeJson(event.metadata),
    },
  });
}

/**
 * Retrieves audit history for a specific business entity, ordered newest first.
 * Optimized via compound index: @@index([entityType, entityId, createdAt(sort: Desc)])
 */
export async function getEntityAuditHistory(
  client: DbClient,
  options: GetEntityAuditHistoryOptions
): Promise<AuditEvent[]>;
export async function getEntityAuditHistory(
  options: GetEntityAuditHistoryOptions
): Promise<AuditEvent[]>;
export async function getEntityAuditHistory(
  clientOrOptions: DbClient | GetEntityAuditHistoryOptions,
  optionsMaybe?: GetEntityAuditHistoryOptions
): Promise<AuditEvent[]> {
  let client: DbClient;
  let options: GetEntityAuditHistoryOptions;

  if (optionsMaybe !== undefined) {
    client = clientOrOptions as DbClient;
    options = optionsMaybe;
  } else {
    client = defaultPrisma;
    options = clientOrOptions as GetEntityAuditHistoryOptions;
  }

  const { entityType, entityId, limit = 50, cursor } = options;

  return await client.auditEvent.findMany({
    where: {
      entityType,
      entityId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    ...(cursor
      ? {
          skip: 1,
          cursor: { id: cursor },
        }
      : {}),
  });
}

/**
 * Retrieves audit history for an individual actor, ordered newest first.
 * Optimized via index: @@index([actorId, createdAt(sort: Desc)])
 */
export async function getActorAuditHistory(
  client: DbClient,
  options: GetActorAuditHistoryOptions
): Promise<AuditEvent[]>;
export async function getActorAuditHistory(
  options: GetActorAuditHistoryOptions
): Promise<AuditEvent[]>;
export async function getActorAuditHistory(
  clientOrOptions: DbClient | GetActorAuditHistoryOptions,
  optionsMaybe?: GetActorAuditHistoryOptions
): Promise<AuditEvent[]> {
  let client: DbClient;
  let options: GetActorAuditHistoryOptions;

  if (optionsMaybe !== undefined) {
    client = clientOrOptions as DbClient;
    options = optionsMaybe;
  } else {
    client = defaultPrisma;
    options = clientOrOptions as GetActorAuditHistoryOptions;
  }

  const { actorId, limit = 50, cursor } = options;

  return await client.auditEvent.findMany({
    where: {
      actorId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    ...(cursor
      ? {
          skip: 1,
          cursor: { id: cursor },
        }
      : {}),
  });
}

/**
 * Retrieves all audit events correlated by a specific HTTP/Distributed Request ID.
 * Optimized via index: @@index([requestId])
 */
export async function getRequestAuditEvents(
  client: DbClient,
  options: GetRequestAuditEventsOptions
): Promise<AuditEvent[]>;
export async function getRequestAuditEvents(
  options: GetRequestAuditEventsOptions
): Promise<AuditEvent[]>;
export async function getRequestAuditEvents(
  clientOrOptions: DbClient | GetRequestAuditEventsOptions,
  optionsMaybe?: GetRequestAuditEventsOptions
): Promise<AuditEvent[]> {
  let client: DbClient;
  let options: GetRequestAuditEventsOptions;

  if (optionsMaybe !== undefined) {
    client = clientOrOptions as DbClient;
    options = optionsMaybe;
  } else {
    client = defaultPrisma;
    options = clientOrOptions as GetRequestAuditEventsOptions;
  }

  const { requestId, limit = 100 } = options;

  return await client.auditEvent.findMany({
    where: {
      requestId,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: limit,
  });
}

/**
 * Counts total audit events for an entity (read-only calculation).
 */
export async function countEntityAuditEvents(
  client: DbClient,
  entityType: string,
  entityId: string
): Promise<number>;
export async function countEntityAuditEvents(
  entityType: string,
  entityId: string
): Promise<number>;
export async function countEntityAuditEvents(
  clientOrEntityType: DbClient | string,
  entityTypeOrId?: string,
  entityIdMaybe?: string
): Promise<number> {
  let client: DbClient;
  let entityType: string;
  let entityId: string;

  if (entityIdMaybe !== undefined) {
    client = clientOrEntityType as DbClient;
    entityType = entityTypeOrId as string;
    entityId = entityIdMaybe;
  } else {
    client = defaultPrisma;
    entityType = clientOrEntityType as string;
    entityId = entityTypeOrId as string;
  }

  return await client.auditEvent.count({
    where: {
      entityType,
      entityId,
    },
  });
}

/**
 * IMMUTABILITY GUARANTEE & ARCHITECTURAL INVARIANT:
 *
 * 1. AuditEvent is strictly append-only (WORM - Write Once, Read Many).
 * 2. There are NO exported functions for update, patch, delete, or truncate operations.
 * 3. Any attempt to modify or erase audit history violates QCET compliance rules.
 */
export const AUDIT_IMMUTABILITY_INVARIANT = Object.freeze({
  isAppendOnly: true,
  allowUpdates: false,
  allowDeletions: false,
  modelName: "AuditEvent",
  tableName: "audit_events",
});
