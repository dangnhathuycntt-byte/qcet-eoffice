import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../prisma";

/**
 * Supported database client types: standard PrismaClient or an interactive transaction client.
 */
export type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Models that support Optimistic Concurrency Control with a version token.
 */
export type OCCSupportedModel =
  | "Task"
  | "Document"
  | "DacumDelegation"
  | "DocumentDirective"
  | "task"
  | "document"
  | "dacumDelegation"
  | "documentDirective";

export interface ConcurrencyConflictErrorParams {
  entity: string;
  id: string;
  expectedVersion: number;
  actualVersion?: number | null;
  message?: string;
}

/**
 * Error thrown when an optimistic concurrency update fails due to a version mismatch
 * or non-existent record during a version-checked update.
 * Corresponds to HTTP 409 Conflict.
 */
export class ConcurrencyConflictError extends Error {
  readonly status: number = 409;
  readonly statusCode: number = 409;
  readonly code: "CONCURRENCY_CONFLICT" = "CONCURRENCY_CONFLICT";
  readonly entity: string;
  readonly entityId: string;
  readonly id: string;
  readonly expectedVersion: number;
  readonly actualVersion: number | null;

  constructor(
    entityOrParams: string | ConcurrencyConflictErrorParams,
    id?: string,
    expectedVersion?: number,
    actualVersion?: number | null
  ) {
    let entity: string;
    let entityId: string;
    let expVersion: number;
    let actVersion: number | null = null;
    let customMessage: string | undefined;

    if (typeof entityOrParams === "object" && entityOrParams !== null) {
      entity = entityOrParams.entity;
      entityId = entityOrParams.id;
      expVersion = entityOrParams.expectedVersion;
      actVersion = entityOrParams.actualVersion ?? null;
      customMessage = entityOrParams.message;
    } else {
      entity = typeof entityOrParams === "string" ? entityOrParams : String(entityOrParams);
      entityId = id ?? "";
      expVersion = expectedVersion ?? 0;
      actVersion = actualVersion ?? null;
    }

    const defaultMessage =
      actVersion !== null && actVersion !== undefined
        ? `Concurrency conflict on ${entity} [${entityId}]: expected version ${expVersion}, but found version ${actVersion}. The record has been modified by another concurrent transaction.`
        : `Concurrency conflict on ${entity} [${entityId}]: expected version ${expVersion}, but the record was not found or has been modified.`;

    super(customMessage || defaultMessage);
    this.name = "ConcurrencyConflictError";
    this.entity = entity;
    this.entityId = entityId;
    this.id = entityId;
    this.expectedVersion = expVersion;
    this.actualVersion = actVersion;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConcurrencyConflictError);
    }
  }
}

export interface UpdateWithOCCOptions<TData = any> {
  client?: DbClient;
  model: OCCSupportedModel;
  id: string;
  expectedVersion: number;
  data: TData;
  select?: any;
  include?: any;
  returnRecord?: boolean;
}

function resolveDelegate(client: DbClient, model: string): { delegate: any; entityName: string } {
  const lower = model.toLowerCase();
  if (lower === "task") {
    return { delegate: (client as any).task, entityName: "Task" };
  }
  if (lower === "document") {
    return { delegate: (client as any).document, entityName: "Document" };
  }
  if (lower === "dacumdelegation") {
    return { delegate: (client as any).dacumDelegation, entityName: "DacumDelegation" };
  }
  if (lower === "documentdirective") {
    return { delegate: (client as any).documentDirective, entityName: "DocumentDirective" };
  }

  // Check case-sensitive or exact match on client
  const clientAny = client as any;
  const propName = model.charAt(0).toLowerCase() + model.slice(1);
  if (clientAny[propName]) {
    return { delegate: clientAny[propName], entityName: model };
  }
  if (clientAny[model]) {
    return { delegate: clientAny[model], entityName: model };
  }

  throw new Error(`Unsupported model for OCC update: ${model}`);
}

/**
 * Executes an atomic update with Optimistic Concurrency Control (OCC).
 * Enforces `WHERE id = ? AND version = expectedVersion` and `SET version = version + 1`.
 *
 * If the record has changed or does not match expectedVersion, throws a ConcurrencyConflictError (HTTP 409).
 */
export async function updateWithOCC<T = any>(
  options: UpdateWithOCCOptions
): Promise<T>;
export async function updateWithOCC<T = any>(
  client: DbClient,
  model: OCCSupportedModel,
  id: string,
  expectedVersion: number,
  data: any,
  options?: { select?: any; include?: any; returnRecord?: boolean }
): Promise<T>;
export async function updateWithOCC<T = any>(
  clientOrOptions: DbClient | UpdateWithOCCOptions,
  modelArg?: OCCSupportedModel,
  idArg?: string,
  expectedVersionArg?: number,
  dataArg?: any,
  additionalOptions?: { select?: any; include?: any; returnRecord?: boolean }
): Promise<T> {
  let client: DbClient;
  let model: OCCSupportedModel;
  let id: string;
  let expectedVersion: number;
  let data: any;
  let select: any = undefined;
  let include: any = undefined;
  let returnRecord: boolean = true;

  if (
    typeof clientOrOptions === "object" &&
    clientOrOptions !== null &&
    !("$queryRaw" in clientOrOptions) &&
    !("task" in clientOrOptions)
  ) {
    const opts = clientOrOptions as UpdateWithOCCOptions;
    client = opts.client ?? defaultPrisma;
    model = opts.model;
    id = opts.id;
    expectedVersion = opts.expectedVersion;
    data = opts.data;
    select = opts.select;
    include = opts.include;
    returnRecord = opts.returnRecord ?? true;
  } else {
    client = (clientOrOptions as DbClient) ?? defaultPrisma;
    model = modelArg!;
    id = idArg!;
    expectedVersion = expectedVersionArg!;
    data = dataArg;
    select = additionalOptions?.select;
    include = additionalOptions?.include;
    returnRecord = additionalOptions?.returnRecord ?? true;
  }

  const { delegate, entityName } = resolveDelegate(client, model);

  if (!delegate || typeof delegate.updateMany !== "function") {
    throw new Error(`Prisma delegate for model "${model}" does not support updateMany.`);
  }

  // Strip id and version from update data so version increment cannot be bypassed or tampered with
  const { id: _ignoredId, version: _ignoredVersion, ...cleanData } = data || {};

  const result = await delegate.updateMany({
    where: {
      id,
      version: expectedVersion,
    },
    data: {
      ...cleanData,
      version: { increment: 1 },
    },
  });

  if (result.count === 0) {
    // Determine actual version if record exists to provide rich conflict diagnostic
    let actualVersion: number | null = null;
    try {
      const currentRecord = await delegate.findUnique({
        where: { id },
        select: { version: true },
      });
      if (currentRecord) {
        actualVersion = currentRecord.version ?? null;
      }
    } catch {
      // Best-effort lookup for conflict diagnostic
    }

    throw new ConcurrencyConflictError({
      entity: entityName,
      id,
      expectedVersion,
      actualVersion,
    });
  }

  // If caller requested no record return, return count & next version metadata
  if (!returnRecord) {
    return { count: result.count, version: expectedVersion + 1 } as unknown as T;
  }

  // Retrieve the updated record
  const queryArgs: any = { where: { id } };
  if (select) {
    queryArgs.select = select;
  } else if (include) {
    queryArgs.include = include;
  }

  const updatedRecord = await delegate.findUnique(queryArgs);
  return updatedRecord as T;
}

/**
 * Model-specific typed OCC update helpers
 */
export async function updateTaskWithOCC<T = any>(
  client: DbClient,
  id: string,
  expectedVersion: number,
  data: Prisma.TaskUpdateInput | Record<string, any>,
  options?: { select?: Prisma.TaskSelect; include?: Prisma.TaskInclude; returnRecord?: boolean }
): Promise<T> {
  return updateWithOCC(client, "Task", id, expectedVersion, data, options);
}

export async function updateDocumentWithOCC<T = any>(
  client: DbClient,
  id: string,
  expectedVersion: number,
  data: Prisma.DocumentUpdateInput | Record<string, any>,
  options?: { select?: Prisma.DocumentSelect; include?: Prisma.DocumentInclude; returnRecord?: boolean }
): Promise<T> {
  return updateWithOCC(client, "Document", id, expectedVersion, data, options);
}

export async function updateDacumDelegationWithOCC<T = any>(
  client: DbClient,
  id: string,
  expectedVersion: number,
  data: Prisma.DacumDelegationUpdateInput | Record<string, any>,
  options?: { select?: Prisma.DacumDelegationSelect; include?: Prisma.DacumDelegationInclude; returnRecord?: boolean }
): Promise<T> {
  return updateWithOCC(client, "DacumDelegation", id, expectedVersion, data, options);
}

export async function updateDocumentDirectiveWithOCC<T = any>(
  client: DbClient,
  id: string,
  expectedVersion: number,
  data: Prisma.DocumentDirectiveUpdateInput | Record<string, any>,
  options?: { select?: Prisma.DocumentDirectiveSelect; include?: Prisma.DocumentDirectiveInclude; returnRecord?: boolean }
): Promise<T> {
  return updateWithOCC(client, "DocumentDirective", id, expectedVersion, data, options);
}
