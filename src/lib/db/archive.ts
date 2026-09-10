import { Prisma, type PrismaClient, type Task, type Document } from "@prisma/client";
import { prisma as defaultPrisma } from "../prisma";
import { updateTaskWithOCC, updateDocumentWithOCC } from "./occ";

export type DbClient = PrismaClient | Prisma.TransactionClient;

export interface ArchiveTaskOptions {
  taskId: string;
  archivedById?: string | null;
  archiveReason?: string | null;
  expectedVersion?: number;
  archivedAt?: Date;
}

export interface UnarchiveTaskOptions {
  taskId: string;
  expectedVersion?: number;
}

export interface ArchiveDocumentOptions {
  documentId: string;
  archivedById?: string | null;
  archiveReason?: string | null;
  expectedVersion?: number;
  archivedAt?: Date;
}

export interface UnarchiveDocumentOptions {
  documentId: string;
  expectedVersion?: number;
}

/**
 * Standard filter condition to exclude archived tasks from active operational workflows.
 */
export const ACTIVE_TASK_FILTER = Object.freeze({
  archivedAt: null,
});

/**
 * Standard filter condition to exclude archived documents from active operational workflows.
 */
export const ACTIVE_DOCUMENT_FILTER = Object.freeze({
  archivedAt: null,
});

/**
 * Filter condition to query archived tasks for compliance and audit review.
 */
export const ARCHIVED_TASK_FILTER = Object.freeze({
  NOT: { archivedAt: null },
});

/**
 * Filter condition to query archived documents for compliance and audit review.
 */
export const ARCHIVED_DOCUMENT_FILTER = Object.freeze({
  NOT: { archivedAt: null },
});

/**
 * Checks if a task is currently in archived status.
 */
export function isTaskArchived(task: { archivedAt?: Date | null } | null | undefined): boolean {
  return task?.archivedAt != null;
}

/**
 * Checks if a document is currently in archived status.
 */
export function isDocumentArchived(doc: { archivedAt?: Date | null } | null | undefined): boolean {
  return doc?.archivedAt != null;
}

/**
 * Soft-archives a Task by setting archivedAt, archivedById, and archiveReason.
 * Supports Optimistic Concurrency Control (OCC) if expectedVersion is provided.
 */
export async function archiveTask(
  client: DbClient,
  options: ArchiveTaskOptions
): Promise<Task>;
export async function archiveTask(
  options: ArchiveTaskOptions
): Promise<Task>;
export async function archiveTask(
  clientOrOptions: DbClient | ArchiveTaskOptions,
  optionsMaybe?: ArchiveTaskOptions
): Promise<Task> {
  let client: DbClient;
  let options: ArchiveTaskOptions;

  if (optionsMaybe !== undefined) {
    client = clientOrOptions as DbClient;
    options = optionsMaybe;
  } else {
    client = defaultPrisma;
    options = clientOrOptions as ArchiveTaskOptions;
  }

  const { taskId, archivedById = null, archiveReason = null, expectedVersion, archivedAt = new Date() } = options;

  const data = {
    archivedAt,
    archivedById,
    archiveReason,
  };

  if (typeof expectedVersion === "number") {
    return await updateTaskWithOCC(client, taskId, expectedVersion, data);
  }

  return await (client as any).task.update({
    where: { id: taskId },
    data,
  });
}

/**
 * Restores an archived Task to active status.
 */
export async function unarchiveTask(
  client: DbClient,
  options: UnarchiveTaskOptions
): Promise<Task>;
export async function unarchiveTask(
  options: UnarchiveTaskOptions
): Promise<Task>;
export async function unarchiveTask(
  clientOrOptions: DbClient | UnarchiveTaskOptions,
  optionsMaybe?: UnarchiveTaskOptions
): Promise<Task> {
  let client: DbClient;
  let options: UnarchiveTaskOptions;

  if (optionsMaybe !== undefined) {
    client = clientOrOptions as DbClient;
    options = optionsMaybe;
  } else {
    client = defaultPrisma;
    options = clientOrOptions as UnarchiveTaskOptions;
  }

  const { taskId, expectedVersion } = options;

  const data = {
    archivedAt: null,
    archivedById: null,
    archiveReason: null,
  };

  if (typeof expectedVersion === "number") {
    return await updateTaskWithOCC(client, taskId, expectedVersion, data);
  }

  return await (client as any).task.update({
    where: { id: taskId },
    data,
  });
}

/**
 * Soft-archives a Document by setting archivedAt, archivedById, and archiveReason.
 * Supports Optimistic Concurrency Control (OCC) if expectedVersion is provided.
 */
export async function archiveDocument(
  client: DbClient,
  options: ArchiveDocumentOptions
): Promise<Document>;
export async function archiveDocument(
  options: ArchiveDocumentOptions
): Promise<Document>;
export async function archiveDocument(
  clientOrOptions: DbClient | ArchiveDocumentOptions,
  optionsMaybe?: ArchiveDocumentOptions
): Promise<Document> {
  let client: DbClient;
  let options: ArchiveDocumentOptions;

  if (optionsMaybe !== undefined) {
    client = clientOrOptions as DbClient;
    options = optionsMaybe;
  } else {
    client = defaultPrisma;
    options = clientOrOptions as ArchiveDocumentOptions;
  }

  const { documentId, archivedById = null, archiveReason = null, expectedVersion, archivedAt = new Date() } = options;

  const data = {
    archivedAt,
    archivedById,
    archiveReason,
  };

  if (typeof expectedVersion === "number") {
    return await updateDocumentWithOCC(client, documentId, expectedVersion, data);
  }

  return await (client as any).document.update({
    where: { id: documentId },
    data,
  });
}

/**
 * Restores an archived Document to active status.
 */
export async function unarchiveDocument(
  client: DbClient,
  options: UnarchiveDocumentOptions
): Promise<Document>;
export async function unarchiveDocument(
  options: UnarchiveDocumentOptions
): Promise<Document>;
export async function unarchiveDocument(
  clientOrOptions: DbClient | UnarchiveDocumentOptions,
  optionsMaybe?: UnarchiveDocumentOptions
): Promise<Document> {
  let client: DbClient;
  let options: UnarchiveDocumentOptions;

  if (optionsMaybe !== undefined) {
    client = clientOrOptions as DbClient;
    options = optionsMaybe;
  } else {
    client = defaultPrisma;
    options = clientOrOptions as UnarchiveDocumentOptions;
  }

  const { documentId, expectedVersion } = options;

  const data = {
    archivedAt: null,
    archivedById: null,
    archiveReason: null,
  };

  if (typeof expectedVersion === "number") {
    return await updateDocumentWithOCC(client, documentId, expectedVersion, data);
  }

  return await (client as any).document.update({
    where: { id: documentId },
    data,
  });
}
