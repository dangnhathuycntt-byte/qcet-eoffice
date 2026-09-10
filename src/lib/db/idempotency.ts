import { Prisma, type PrismaClient, type IdempotencyRecord } from "@prisma/client";
import { prisma as defaultPrisma } from "../prisma";

/**
 * Supported database client types: standard PrismaClient or an interactive transaction client.
 */
export type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Valid execution states for an IdempotencyRecord.
 */
export type IdempotencyStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface IdempotencyConflictErrorParams {
  userId: string;
  operation: string;
  key: string;
  message?: string;
}

/**
 * Error thrown when a concurrent request with the same idempotency key is already in flight (PENDING).
 * Corresponds to HTTP 409 Conflict.
 */
export class IdempotencyConflictError extends Error {
  readonly status: number = 409;
  readonly statusCode: number = 409;
  readonly code: "IDEMPOTENCY_CONFLICT" = "IDEMPOTENCY_CONFLICT";
  readonly userId: string;
  readonly operation: string;
  readonly key: string;

  constructor(
    userIdOrParams: string | IdempotencyConflictErrorParams,
    operation?: string,
    key?: string,
    customMessage?: string
  ) {
    let uId: string;
    let op: string;
    let k: string;
    let msg: string | undefined;

    if (typeof userIdOrParams === "object" && userIdOrParams !== null) {
      uId = userIdOrParams.userId;
      op = userIdOrParams.operation;
      k = userIdOrParams.key;
      msg = userIdOrParams.message;
    } else {
      uId = (typeof userIdOrParams === "string" ? userIdOrParams : "") ?? "";
      op = operation ?? "";
      k = key ?? "";
      msg = customMessage;
    }

    const defaultMsg = `An operation '${op}' with idempotency key '${k}' is currently pending execution for user '${uId}'.`;
    super(msg || defaultMsg);
    this.name = "IdempotencyConflictError";
    this.userId = uId;
    this.operation = op;
    this.key = k;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, IdempotencyConflictError);
    }
  }
}

export interface IdempotencyOptions {
  userId: string;
  operation: string;
  key: string;
  ttlMinutes?: number;
  lockTimeoutMs?: number;
  pollIntervalMs?: number;
}

/**
 * Serializes arbitrary response values into JSON-compatible format for Prisma JSON storage.
 */
function serializeResponse<T>(result: T): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (result === undefined || result === null) {
    return Prisma.DbNull;
  }
  try {
    return JSON.parse(JSON.stringify(result));
  } catch {
    return result as any;
  }
}

/**
 * Canonical idempotency wrapper for operations requiring at-most-once execution semantics
 * (such as task creation, deliverable submission, and workflow approvals on mobile/PWA).
 *
 * Behavior:
 * 1. Checks for an existing record matching (userId, operation, key).
 * 2. If an active COMPLETED record exists and has not expired, returns cached response without executing fn().
 * 3. If an unexpired PENDING record exists (concurrent execution):
 *    - If lockTimeoutMs > 0, waits/polls for completion or failure.
 *    - Otherwise, throws typed IdempotencyConflictError (HTTP 409).
 * 4. If record is expired or FAILED, overwrites/resets to PENDING and permits re-execution.
 * 5. On initial execution, creates record with status PENDING.
 * 6. On successful completion of fn(), updates record with status COMPLETED and caches response.
 * 7. On error during fn(), marks record as FAILED so user can retry, and rethrows original error.
 */
export async function withIdempotency<T>(
  client: DbClient,
  options: IdempotencyOptions,
  fn: () => Promise<T>
): Promise<T>;
export async function withIdempotency<T>(
  options: IdempotencyOptions,
  fn: () => Promise<T>
): Promise<T>;
export async function withIdempotency<T>(
  clientOrOptions: DbClient | IdempotencyOptions,
  optionsOrFn: IdempotencyOptions | (() => Promise<T>),
  fnMaybe?: () => Promise<T>
): Promise<T> {
  let client: DbClient;
  let options: IdempotencyOptions;
  let fn: () => Promise<T>;

  if (typeof optionsOrFn === "function") {
    client = defaultPrisma;
    options = clientOrOptions as IdempotencyOptions;
    fn = optionsOrFn;
  } else {
    client = clientOrOptions as DbClient;
    options = optionsOrFn as IdempotencyOptions;
    fn = fnMaybe as () => Promise<T>;
  }

  const { userId, operation, key } = options;
  if (!userId || !operation || !key) {
    throw new Error("userId, operation, and key are required for withIdempotency");
  }

  const ttlMinutes = options.ttlMinutes ?? 60;
  const lockTimeoutMs = options.lockTimeoutMs ?? 0;
  const pollIntervalMs = options.pollIntervalMs ?? 50;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  // Step 1: Check existing idempotency record
  let existing = await client.idempotencyRecord.findUnique({
    where: {
      userId_operation_key: {
        userId,
        operation,
        key,
      },
    },
  });

  // Step 2: Handle existing unexpired records
  if (existing && existing.expiresAt > now) {
    if (existing.status === "COMPLETED") {
      return existing.response as T;
    }

    if (existing.status === "PENDING") {
      if (lockTimeoutMs > 0) {
        const startTime = Date.now();
        while (Date.now() - startTime < lockTimeoutMs) {
          await new Promise((r) => setTimeout(r, pollIntervalMs));
          const polled = await client.idempotencyRecord.findUnique({
            where: {
              userId_operation_key: { userId, operation, key },
            },
          });

          if (!polled) {
            existing = null;
            break;
          }

          if (polled.expiresAt <= new Date()) {
            existing = polled;
            break;
          }

          if (polled.status === "COMPLETED") {
            return polled.response as T;
          }

          if (polled.status === "FAILED") {
            existing = polled;
            break;
          }
        }
      }

      // If still PENDING and unexpired after polling timeout, throw conflict
      if (existing && existing.status === "PENDING" && existing.expiresAt > new Date()) {
        throw new IdempotencyConflictError(userId, operation, key);
      }
    }
  }

  // Step 3: Acquire execution lock (PENDING state)
  let recordId: string;

  if (existing) {
    // Overwrite expired or failed record
    const updated = await client.idempotencyRecord.update({
      where: { id: existing.id },
      data: {
        status: "PENDING",
        response: Prisma.DbNull,
        expiresAt,
        createdAt: new Date(),
      },
    });
    recordId = updated.id;
  } else {
    try {
      const created = await client.idempotencyRecord.create({
        data: {
          userId,
          operation,
          key,
          status: "PENDING",
          expiresAt,
        },
      });
      recordId = created.id;
    } catch (createErr: any) {
      if (createErr?.code === "P2002") {
        // Concurrent insert won the race; inspect winning record
        const concurrent = await client.idempotencyRecord.findUnique({
          where: {
            userId_operation_key: { userId, operation, key },
          },
        });

        if (concurrent) {
          if (concurrent.status === "COMPLETED" && concurrent.expiresAt > new Date()) {
            return concurrent.response as T;
          }

          if (concurrent.status === "PENDING" && concurrent.expiresAt > new Date()) {
            if (lockTimeoutMs > 0) {
              const startTime = Date.now();
              while (Date.now() - startTime < lockTimeoutMs) {
                await new Promise((r) => setTimeout(r, pollIntervalMs));
                const polled = await client.idempotencyRecord.findUnique({
                  where: { userId_operation_key: { userId, operation, key } },
                });

                if (!polled) break;
                if (polled.status === "COMPLETED" && polled.expiresAt > new Date()) {
                  return polled.response as T;
                }
                if (polled.status === "FAILED") break;
              }
            }
            throw new IdempotencyConflictError(userId, operation, key);
          }
        }
      }
      throw createErr;
    }
  }

  // Step 4: Execute target function
  let result: T;
  try {
    result = await fn();
  } catch (fnError) {
    // Mark as FAILED to allow subsequent retries
    try {
      await client.idempotencyRecord.update({
        where: { id: recordId },
        data: {
          status: "FAILED",
          response: Prisma.DbNull,
        },
      });
    } catch {
      // Retain original execution error
    }
    throw fnError;
  }

  // Step 5: Mark as COMPLETED and cache response
  try {
    const serialized = serializeResponse(result);
    await client.idempotencyRecord.update({
      where: { id: recordId },
      data: {
        status: "COMPLETED",
        response: serialized,
      },
    });
  } catch (updateErr) {
    console.error("Failed to commit idempotency record COMPLETED status:", updateErr);
  }

  return result;
}

/**
 * Retrieves an existing idempotency record by compound key.
 */
export async function getIdempotencyRecord(
  client: DbClient,
  options: { userId: string; operation: string; key: string }
): Promise<IdempotencyRecord | null> {
  return client.idempotencyRecord.findUnique({
    where: {
      userId_operation_key: {
        userId: options.userId,
        operation: options.operation,
        key: options.key,
      },
    },
  });
}

/**
 * Removes an idempotency record manually if an eviction is needed.
 */
export async function clearIdempotencyRecord(
  client: DbClient,
  options: { userId: string; operation: string; key: string }
): Promise<boolean> {
  try {
    await client.idempotencyRecord.delete({
      where: {
        userId_operation_key: {
          userId: options.userId,
          operation: options.operation,
          key: options.key,
        },
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Prunes expired idempotency records from the database.
 */
export async function cleanupExpiredIdempotencyRecords(
  client: DbClient = defaultPrisma,
  before: Date = new Date()
): Promise<number> {
  const result = await client.idempotencyRecord.deleteMany({
    where: {
      expiresAt: {
        lte: before,
      },
    },
  });
  return result.count;
}
