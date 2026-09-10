/**
 * QCET E-Office: Canonical Transactional Outbox Pattern & Dispatcher
 *
 * Implements an institutional-grade Transactional Outbox pattern to decouple
 * non-transactional side-effects (Web Push notifications, email alerts, webhook dispatches,
 * and external integrations) from primary PostgreSQL database transactions.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. Atomicity & Server Truth:
 *    Outbox events are committed inside the exact same Prisma interactive transaction ($transaction)
 *    as the primary domain state mutation (Task, Document, Deliverable, etc.). If the transaction aborts,
 *    the outbox event is rolled back automatically. Zero ghost notifications or orphan side-effects.
 * 2. External Isolation:
 *    External networks (VAPID push endpoints, SMTP servers, external webhooks) are NEVER invoked
 *    inside the interactive database transaction. They are handled asynchronously during outbox processing.
 * 3. At-Least-Once Delivery:
 *    Events remain PENDING until successfully dispatched to COMPLETED. If an external service is unavailable,
 *    events undergo deterministic exponential backoff (e.g. 5s, 10s, 20s...) until maxRetries.
 * 4. Dead-Letter Quarantine:
 *    Events exceeding maxRetries transition to FAILED status with the terminal error recorded in lastError,
 *    preventing endless poison-pill retry loops while preserving auditability.
 */

import {
  Prisma,
  OutboxStatus,
  type PrismaClient,
  type OutboxEvent,
} from "@prisma/client";
import { prisma as defaultPrisma } from "../prisma";

/**
 * Supported database client types: standard PrismaClient or an interactive transaction client.
 */
export type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Standard outbox event types across QCET E-Office subsystems.
 */
export const OutboxEventType = {
  // Push Notification Dispatch
  PUSH_NOTIFICATION_DISPATCH: "PUSH_NOTIFICATION_DISPATCH",

  // Task Lifecycle Events
  TASK_CREATED_NOTIFICATION: "TASK_CREATED_NOTIFICATION",
  TASK_ASSIGNED_NOTIFICATION: "TASK_ASSIGNED_NOTIFICATION",
  TASK_STATUS_NOTIFICATION: "TASK_STATUS_NOTIFICATION",
  TASK_APPROVED_NOTIFICATION: "TASK_APPROVED_NOTIFICATION",
  TASK_REJECTED_NOTIFICATION: "TASK_REJECTED_NOTIFICATION",
  TASK_OVERDUE_NOTIFICATION: "TASK_OVERDUE_NOTIFICATION",
  TASK_REMINDER_NOTIFICATION: "TASK_REMINDER_NOTIFICATION",

  // Deliverable & Review Events
  DELIVERABLE_SUBMITTED_NOTIFICATION: "DELIVERABLE_SUBMITTED_NOTIFICATION",
  DELIVERABLE_REVIEWED_NOTIFICATION: "DELIVERABLE_REVIEWED_NOTIFICATION",

  // Document & Directive Events
  DOCUMENT_ISSUED_NOTIFICATION: "DOCUMENT_ISSUED_NOTIFICATION",
  DOCUMENT_DIRECTIVE_NOTIFICATION: "DOCUMENT_DIRECTIVE_NOTIFICATION",
  DOCUMENT_PRESENTED_NOTIFICATION: "DOCUMENT_PRESENTED_NOTIFICATION",
  DOCUMENT_ASSIGNED_NOTIFICATION: "DOCUMENT_ASSIGNED_NOTIFICATION",
  DOCUMENT_RESOLVED_NOTIFICATION: "DOCUMENT_RESOLVED_NOTIFICATION",
  DOCUMENT_FILED_NOTIFICATION: "DOCUMENT_FILED_NOTIFICATION",

  // External Webhook & Sync Events
  WEBHOOK_DISPATCH: "WEBHOOK_DISPATCH",
  ACADEMIC_SYNC_DISPATCH: "ACADEMIC_SYNC_DISPATCH",

  // Work Dossier & Archival Events
  DOSSIER_CREATED_NOTIFICATION: "DOSSIER_CREATED_NOTIFICATION",
  DOSSIER_CLOSED_NOTIFICATION: "DOSSIER_CLOSED_NOTIFICATION",
  DOSSIER_SUBMITTED_ARCHIVE_NOTIFICATION: "DOSSIER_SUBMITTED_ARCHIVE_NOTIFICATION",
  DOSSIER_ACCEPTED_ARCHIVE_NOTIFICATION: "DOSSIER_ACCEPTED_ARCHIVE_NOTIFICATION",
} as const;

export type OutboxEventTypeValue =
  | (typeof OutboxEventType)[keyof typeof OutboxEventType]
  | (string & {});

/**
 * Standard aggregate types corresponding to core QCET domain entities.
 */
export const OutboxAggregateType = {
  TASK: "Task",
  DOCUMENT: "Document",
  DOCUMENT_WORKFLOW: "DocumentIncomingWorkflow",
  UNIT_WORK_ASSIGNMENT: "UnitWorkAssignment",
  TASK_DELIVERABLE: "TaskDeliverable",
  DOCUMENT_DIRECTIVE: "DocumentDirective",
  PUSH_SUBSCRIPTION: "PushSubscription",
  USER: "User",
  DEPARTMENT: "Department",
  WORK_DOSSIER: "WorkDossier",
  DOSSIER_ITEM: "DossierItem",
} as const;

export type OutboxAggregateTypeValue =
  | (typeof OutboxAggregateType)[keyof typeof OutboxAggregateType]
  | (string & {});

/**
 * Input for publishing a single outbox event.
 */
export interface PublishOutboxEventInput {
  id?: string;
  eventType: OutboxEventTypeValue;
  aggregateType: OutboxAggregateTypeValue;
  aggregateId: string;
  payload: Record<string, any> | Prisma.InputJsonValue;
  availableAt?: Date;
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
  if (typeof val === "object") {
    return JSON.parse(JSON.stringify(val));
  }
  return val;
}

/**
 * Calculates exponential backoff delay in seconds.
 * Default: 5s * 2^(attempts - 1), capped at maxBackoffSeconds.
 * Attempt 1 -> 5s
 * Attempt 2 -> 10s
 * Attempt 3 -> 20s
 * Attempt 4 -> 40s
 */
export function calculateExponentialBackoff(
  attempts: number,
  baseSeconds: number = 5,
  exponentialBase: number = 2,
  maxBackoffSeconds: number = 86400
): number {
  const safeAttempts = Math.max(1, attempts);
  const backoff = baseSeconds * Math.pow(exponentialBase, safeAttempts - 1);
  return Math.min(backoff, maxBackoffSeconds);
}

/**
 * Publishes an outbox event inside the current database client or transaction.
 *
 * @param client Database client or interactive transaction ($transaction tx)
 * @param event Outbox event input data
 * @returns The persisted OutboxEvent
 */
export async function publishOutboxEvent(
  client: DbClient,
  event: PublishOutboxEventInput
): Promise<OutboxEvent> {
  const db = client ?? defaultPrisma;

  return db.outboxEvent.create({
    data: {
      ...(event.id ? { id: event.id } : {}),
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: serializeJson(event.payload) as Prisma.InputJsonValue,
      status: OutboxStatus.PENDING,
      attempts: 0,
      availableAt: event.availableAt ?? new Date(),
    },
  });
}

/**
 * Publishes multiple outbox events in batch.
 *
 * @param client Database client or interactive transaction
 * @param events Array of outbox event input data
 * @returns Array of persisted OutboxEvents
 */
export async function publishOutboxEvents(
  client: DbClient,
  events: PublishOutboxEventInput[]
): Promise<OutboxEvent[]> {
  const results: OutboxEvent[] = [];
  for (const event of events) {
    const published = await publishOutboxEvent(client, event);
    results.push(published);
  }
  return results;
}

/**
 * Options for querying available outbox events.
 */
export interface FetchAvailableOutboxEventsOptions {
  limit?: number;
  now?: Date;
  aggregateType?: string;
  aggregateTypes?: string[];
  eventType?: string;
  eventTypes?: string[];
  ids?: string[];
}

/**
 * Fetches events eligible for processing:
 * - status: PENDING
 * - availableAt <= now (reference time, defaults to current system date)
 * - Ordered by availableAt ASC, then createdAt ASC (FIFO discipline)
 *
 * @param client Database client
 * @param options Query filters and pagination limit
 * @returns Array of eligible OutboxEvent records
 */
export async function fetchAvailableOutboxEvents(
  client: DbClient,
  options: FetchAvailableOutboxEventsOptions = {}
): Promise<OutboxEvent[]> {
  const db = client ?? defaultPrisma;
  const referenceNow = options.now ?? new Date();

  const where: Prisma.OutboxEventWhereInput = {
    status: OutboxStatus.PENDING,
    availableAt: { lte: referenceNow },
    ...(options.ids?.length ? { id: { in: options.ids } } : {}),
    ...(options.aggregateType ? { aggregateType: options.aggregateType } : {}),
    ...(options.aggregateTypes?.length ? { aggregateType: { in: options.aggregateTypes } } : {}),
    ...(options.eventType ? { eventType: options.eventType } : {}),
    ...(options.eventTypes?.length ? { eventType: { in: options.eventTypes } } : {}),
  };

  return db.outboxEvent.findMany({
    where,
    orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
    take: options.limit ?? 50,
  });
}

/**
 * Context passed to outbox event handlers during dispatch execution.
 */
export interface OutboxHandlerContext {
  client: DbClient;
  attempt: number;
  now: Date;
}

/**
 * Handler function signature for an outbox event.
 */
export type OutboxEventHandler = (
  event: OutboxEvent,
  context: OutboxHandlerContext
) => Promise<any> | any;

/**
 * Map of handlers indexed by eventType or aggregateType.
 * Supports wildcard '*' or 'default' fallback handler.
 */
export type OutboxHandlerMap = Record<string, OutboxEventHandler>;

/**
 * Options for outbox batch processing.
 */
export interface ProcessOutboxBatchOptions {
  limit?: number;
  maxRetries?: number;
  baseBackoffSeconds?: number;
  exponentialBase?: number;
  maxBackoffSeconds?: number;
  markProcessing?: boolean;
  now?: Date;
  stopOnError?: boolean;
  aggregateType?: string;
  aggregateTypes?: string[];
  eventType?: string;
  eventTypes?: string[];
  ids?: string[];
  onSuccess?: (event: OutboxEvent) => Promise<void> | void;
  onError?: (
    event: OutboxEvent,
    error: Error,
    isDeadLetter: boolean
  ) => Promise<void> | void;
  backoffCalculator?: (attempts: number, baseSeconds: number) => number;
}

/**
 * Summary result of processing an outbox batch.
 */
export interface ProcessOutboxBatchResult {
  totalProcessed: number;
  succeeded: number;
  failed: number;
  retried: number;
  deadLettered: number;
  events: Array<{
    id: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    status: OutboxStatus;
    attempts: number;
    error?: string;
  }>;
}

/**
 * Resolves the appropriate handler for a given outbox event.
 * Resolution precedence:
 * 1. Exact match on eventType
 * 2. Match on aggregateType
 * 3. Wildcard handler '*' or 'default'
 */
function resolveHandler(
  handlers: OutboxHandlerMap | OutboxEventHandler,
  event: OutboxEvent
): OutboxEventHandler | undefined {
  if (typeof handlers === "function") {
    return handlers;
  }

  return (
    handlers[event.eventType] ??
    handlers[event.aggregateType] ??
    handlers["*"] ??
    handlers["default"]
  );
}

/**
 * Processes a single outbox event with lifecycle status updates and error handling.
 *
 * @param client Database client
 * @param event The OutboxEvent record to process
 * @param handlers Handler map or single handler function
 * @param options Processing configuration options
 * @returns Result status, attempts, and optional error message
 */
export async function processOutboxEvent(
  client: DbClient,
  event: OutboxEvent,
  handlers: OutboxHandlerMap | OutboxEventHandler,
  options: ProcessOutboxBatchOptions = {}
): Promise<{
  status: OutboxStatus;
  attempts: number;
  error?: string;
}> {
  const db = client ?? defaultPrisma;
  const currentNow = options.now ?? new Date();
  const maxRetries = options.maxRetries ?? 3;
  const baseBackoff = options.baseBackoffSeconds ?? 5;
  const exponentialBase = options.exponentialBase ?? 2;
  const maxBackoff = options.maxBackoffSeconds ?? 86400;
  const shouldMarkProcessing = options.markProcessing ?? true;

  // 1. Transition status to PROCESSING if enabled (atomic claim to prevent duplicate worker execution)
  if (shouldMarkProcessing) {
    const claimResult = await db.outboxEvent.updateMany({
      where: { id: event.id, status: OutboxStatus.PENDING },
      data: { status: OutboxStatus.PROCESSING },
    });
    if (claimResult.count === 0) {
      return { status: OutboxStatus.PROCESSING, attempts: event.attempts };
    }
  }

  // 2. Resolve matching handler
  const handler = resolveHandler(handlers, event);
  const context: OutboxHandlerContext = {
    client: db,
    attempt: event.attempts + 1,
    now: currentNow,
  };

  try {
    if (!handler) {
      throw new Error(
        `No outbox handler registered for eventType "${event.eventType}" or aggregateType "${event.aggregateType}"`
      );
    }

    // 3. Execute external side-effect (e.g. Web Push, HTTP, Notification dispatch)
    await handler(event, context);

    // 4. On success: mark COMPLETED with processedAt timestamp
    const updated = await db.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: OutboxStatus.COMPLETED,
        attempts: event.attempts + 1,
        processedAt: currentNow,
        lastError: null,
      },
    });

    if (options.onSuccess) {
      await options.onSuccess(updated);
    }

    return {
      status: OutboxStatus.COMPLETED,
      attempts: updated.attempts,
    };
  } catch (err: any) {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    const errorMessage = errorObj.message || "Unknown error";
    const nextAttempts = event.attempts + 1;
    const isDeadLetter = nextAttempts >= maxRetries;

    if (isDeadLetter) {
      // 5a. Exceeded maxRetries -> Transition to FAILED (Dead Letter Queue)
      const updated = await db.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: OutboxStatus.FAILED,
          attempts: nextAttempts,
          lastError: errorMessage,
          processedAt: currentNow,
        },
      });

      if (options.onError) {
        await options.onError(updated, errorObj, true);
      }

      return {
        status: OutboxStatus.FAILED,
        attempts: nextAttempts,
        error: errorMessage,
      };
    } else {
      // 5b. Retries remaining -> Back off exponentially and return to PENDING
      const backoffSeconds = options.backoffCalculator
        ? options.backoffCalculator(nextAttempts, baseBackoff)
        : calculateExponentialBackoff(
            nextAttempts,
            baseBackoff,
            exponentialBase,
            maxBackoff
          );

      const nextAvailableAt = new Date(
        currentNow.getTime() + backoffSeconds * 1000
      );

      const updated = await db.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: OutboxStatus.PENDING,
          attempts: nextAttempts,
          lastError: errorMessage,
          availableAt: nextAvailableAt,
        },
      });

      if (options.onError) {
        await options.onError(updated, errorObj, false);
      }

      return {
        status: OutboxStatus.PENDING,
        attempts: nextAttempts,
        error: errorMessage,
      };
    }
  }
}

/**
 * Fetches available outbox events and processes them as a batch.
 *
 * @param client Database client
 * @param handlers Handler map or single handler function
 * @param options Batch processing configuration options
 * @returns Summary result of the batch execution
 */
export async function processOutboxBatch(
  client: DbClient,
  handlers: OutboxHandlerMap | OutboxEventHandler,
  options: ProcessOutboxBatchOptions = {}
): Promise<ProcessOutboxBatchResult> {
  const db = client ?? defaultPrisma;
  const referenceNow = options.now ?? new Date();

  // If specific filters are not provided and handlers is a map without wildcards,
  // filter to only the eventTypes / aggregateTypes known to the handler map
  // to avoid failing events belonging to other workers.
  let orCondition: Prisma.OutboxEventWhereInput[] | undefined = undefined;
  if (
    !options.eventType &&
    !options.eventTypes?.length &&
    !options.aggregateType &&
    !options.aggregateTypes?.length &&
    !options.ids?.length &&
    typeof handlers === "object" &&
    handlers !== null &&
    !handlers["*"] &&
    !handlers["default"]
  ) {
    const handlerKeys = Object.keys(handlers);
    if (handlerKeys.length > 0) {
      orCondition = [
        { eventType: { in: handlerKeys } },
        { aggregateType: { in: handlerKeys } },
      ];
    }
  }

  const where: Prisma.OutboxEventWhereInput = {
    status: OutboxStatus.PENDING,
    availableAt: { lte: referenceNow },
    ...(options.ids?.length ? { id: { in: options.ids } } : {}),
    ...(options.aggregateType ? { aggregateType: options.aggregateType } : {}),
    ...(options.aggregateTypes?.length ? { aggregateType: { in: options.aggregateTypes } } : {}),
    ...(options.eventType ? { eventType: options.eventType } : {}),
    ...(options.eventTypes?.length ? { eventType: { in: options.eventTypes } } : {}),
    ...(orCondition ? { OR: orCondition } : {}),
  };

  const events = await db.outboxEvent.findMany({
    where,
    orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
    take: options.limit ?? 50,
  });

  const result: ProcessOutboxBatchResult = {
    totalProcessed: 0,
    succeeded: 0,
    failed: 0,
    retried: 0,
    deadLettered: 0,
    events: [],
  };

  for (const event of events) {
    const itemResult = await processOutboxEvent(db, event, handlers, options);
    result.totalProcessed++;

    if (itemResult.status === OutboxStatus.COMPLETED) {
      result.succeeded++;
    } else if (itemResult.status === OutboxStatus.FAILED) {
      result.failed++;
      result.deadLettered++;
    } else if (itemResult.status === OutboxStatus.PENDING) {
      result.failed++;
      result.retried++;
    }

    result.events.push({
      id: event.id,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      status: itemResult.status,
      attempts: itemResult.attempts,
      error: itemResult.error,
    });

    if (options.stopOnError && itemResult.status !== OutboxStatus.COMPLETED) {
      break;
    }
  }

  return result;
}

/**
 * Returns operational metrics of outbox events by status.
 */
export async function getOutboxMetrics(
  client: DbClient
): Promise<Record<OutboxStatus, number>> {
  const db = client ?? defaultPrisma;

  const counts = await db.outboxEvent.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const metrics: Record<OutboxStatus, number> = {
    [OutboxStatus.PENDING]: 0,
    [OutboxStatus.PROCESSING]: 0,
    [OutboxStatus.COMPLETED]: 0,
    [OutboxStatus.FAILED]: 0,
  };

  for (const c of counts) {
    metrics[c.status] = c._count._all;
  }

  return metrics;
}

/**
 * Re-queues failed (dead-lettered) outbox events back to PENDING.
 *
 * @param client Database client
 * @param options Options including specific event IDs and whether to reset attempt counters
 * @returns Count of re-queued events
 */
export async function retryFailedOutboxEvents(
  client: DbClient,
  options: { ids?: string[]; resetAttempts?: boolean; now?: Date } = {}
): Promise<{ updatedCount: number }> {
  const db = client ?? defaultPrisma;
  const referenceNow = options.now ?? new Date();

  const whereClause: Prisma.OutboxEventWhereInput = {
    status: OutboxStatus.FAILED,
    ...(options.ids && options.ids.length > 0 ? { id: { in: options.ids } } : {}),
  };

  const updateResult = await db.outboxEvent.updateMany({
    where: whereClause,
    data: {
      status: OutboxStatus.PENDING,
      availableAt: referenceNow,
      ...(options.resetAttempts ? { attempts: 0 } : {}),
      lastError: null,
    },
  });

  return { updatedCount: updateResult.count };
}

/**
 * Cleans up old COMPLETED outbox events according to retention policy.
 *
 * @param client Database client
 * @param olderThanDays Retention threshold in days (default: 30 days)
 * @returns Count of purged events
 */
export async function cleanupCompletedOutboxEvents(
  client: DbClient,
  olderThanDays: number = 30
): Promise<{ deletedCount: number }> {
  const db = client ?? defaultPrisma;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const deleteResult = await db.outboxEvent.deleteMany({
    where: {
      status: OutboxStatus.COMPLETED,
      processedAt: { lte: cutoffDate },
    },
  });

  return { deletedCount: deleteResult.count };
}
