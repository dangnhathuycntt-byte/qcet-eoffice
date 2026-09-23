/**
 * QCET E-Office: Canonical Atomic Transaction Boundaries
 *
 * Implements hardened database transaction boundaries for core multi-table business workflows:
 * 1. createTaskAtomic: Task creation + assignees + atomic sequence generation + audit recording
 * 2. submitDeliverableAtomic: Deliverable creation + task status transition + audit recording
 * 3. approveTaskAtomic: Task completion + resolution/review record + audit recording
 * 4. createDocumentDirectiveAtomic: Directive creation + document touch/status + audit recording
 *
 * ARCHITECTURAL INVARIANTS:
 * - Server Truth Wins: PostgreSQL interactive transactions (tx) are the ultimate authority.
 * - Atomicity: All state mutations execute inside prisma.$transaction(async (tx) => { ... }).
 * - Clean Rollback: If any step fails (e.g. invalid foreign key, resolution error, or audit failure),
 *   the entire transaction rolls back cleanly with zero partial writes committed.
 * - External Isolation: Never call external non-transactional systems (HTTP push dispatch, emails,
 *   3rd party APIs, or external storage) inside the DB transaction. External actions must be executed
 *   strictly after transaction commit (via afterCommit hooks) or queued to the Transactional Outbox.
 */

import {
  Prisma,
  PrismaClient,
  Task,
  TaskActor,
  TaskActorRole,
  TaskDeliverable,
  ExecutiveResolution,
  Document,
  DocumentDirective,
  TaskScope,
  TaskStatus,
  TaskPriority,
  DeliverableReviewStatus,
  ResolutionType,
  DocumentStatus,
} from "@prisma/client";
import { prisma as defaultPrisma } from "../prisma";
import { generateTaskCodeAtomic, type TaskCodeOptions } from "../task-code-generator";
import { getAcademicYear, getAcademicMonthInfo } from "../academic-calendar";
import { updateTaskWithOCC, updateDocumentWithOCC, type DbClient } from "./occ";
import { logAuditEvent } from "./audit";

/**
 * Options for configuring interactive transactions.
 */
export interface TransactionOptions {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

/**
 * Audit context information captured during transactional workflows.
 */
export interface TransactionAuditContext {
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  metadata?: Record<string, any> | null;
  requestId?: string | null;
}

/**
 * Signature for audit event recorder callbacks running within the transaction.
 */
export type AuditRecorder = (
  tx: Prisma.TransactionClient,
  info: TransactionAuditContext
) => Promise<void>;

/**
 * Standard audit parameters passed into atomic workflow payloads.
 */
export interface TransactionAuditPayload {
  actorId?: string;
  action?: string;
  metadata?: Record<string, any> | null;
  requestId?: string | null;
  /**
   * For testing and failure simulation: forces the audit recording step to throw.
   */
  failSimulate?: boolean;
}

/**
 * Generic interactive transaction runner.
 * Automatically wraps logic in client.$transaction if available,
 * or reuses an existing Prisma.TransactionClient context.
 */
export async function runInTransaction<T>(
  client: DbClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: TransactionOptions
): Promise<T> {
  if (typeof (client as any).$transaction === "function") {
    return (client as PrismaClient).$transaction(fn, options);
  }
  return fn(client as Prisma.TransactionClient);
}

/**
 * Internal helper to record an audit entry atomically within the active transaction.
 */
async function recordTransactionAudit(
  tx: Prisma.TransactionClient,
  info: TransactionAuditContext,
  auditRecorder?: AuditRecorder,
  auditPayload?: TransactionAuditPayload
): Promise<void> {
  if (auditPayload?.failSimulate) {
    throw new Error(
      `[TransactionAudit] Simulated audit failure for ${info.entityType} [${info.entityId}]`
    );
  }

  if (typeof auditRecorder === "function") {
    await auditRecorder(tx, info);
    return;
  }

  // Record into audit_events table via canonical logAuditEvent (Task 9)
  await logAuditEvent(tx, {
    actorId: info.actorId,
    action: info.action,
    entityType: info.entityType,
    entityId: info.entityId,
    requestId: info.requestId ?? null,
    metadata: info.metadata ?? null,
  });
}

// ============================================================================
// 1. CREATE TASK ATOMIC WORKFLOW
// ============================================================================

export interface TaskAssigneeInput {
  userId: string;
  /** 'PRIMARY_OWNER' | 'COLLABORATOR' — mapped to TaskActor.role after Phase 9 */
  roleInTask?: 'PRIMARY_OWNER' | 'COLLABORATOR';
}

export interface CreateTaskAtomicPayload {
  title: string;
  dueDate: Date | string;
  createdById: string;
  code?: string;
  academicMonth?: number;
  academicYear?: string;
  scope?: TaskScope;
  status?: TaskStatus;
  priority?: TaskPriority;
  progressPercent?: number;
  departmentId?: string | null;
  description?: string | null;
  startDate?: Date | string;
  parentTaskId?: string | null;
  dacumTaskDefId?: string | null;
  assignees?: TaskAssigneeInput[];
  primaryOwnerId?: string | null;
  collaboratorIds?: string[];
  codeOptions?: Partial<TaskCodeOptions>;
  audit?: TransactionAuditPayload;
  auditRecorder?: AuditRecorder;
  failAtStep?: "beforeCreate" | "afterTaskCreate" | "audit";
  afterCommit?: (result: CreateTaskAtomicResult) => Promise<void> | void;
}

export interface CreateTaskAtomicResult {
  task: Task & { actors: TaskActor[] };
  actors: TaskActor[];
  code: string;
}

/**
 * Creates a task atomically with unique sequential code, actors, and audit entry.
 *
 * Sequence of operations in tx:
 * 1. Atomic sequence number allocation (generateTaskCodeAtomic).
 * 2. Academic month & year derivation if omitted.
 * 3. Task record creation + TaskActor records (Phase 9: TaskAssignee table dropped).
 * 4. Audit trail persistence within the same transaction.
 */
export async function createTaskAtomic(
  client: DbClient = defaultPrisma,
  payload: CreateTaskAtomicPayload,
  options?: TransactionOptions
): Promise<CreateTaskAtomicResult> {
  const result = await runInTransaction(
    client,
    async (tx) => {
      if (payload.failAtStep === "beforeCreate") {
        throw new Error("[createTaskAtomic] Simulated failure before task creation");
      }

      const due = new Date(payload.dueDate);
      const derivedMonthInfo = getAcademicMonthInfo(due);
      const academicMonth = payload.academicMonth ?? derivedMonthInfo.monthNumber;
      const academicYear = payload.academicYear ?? getAcademicYear(due);

      const taskScope = payload.scope ?? TaskScope.SCHOOL;
      const effectiveDepartment = payload.departmentId ?? "ALL";

      // 1. Generate atomic code if not explicitly passed
      const taskCode =
        payload.code ||
        (await generateTaskCodeAtomic(tx, {
          year: due.getFullYear(),
          month: academicMonth,
          scope: taskScope,
          departmentCode: effectiveDepartment,
          ...payload.codeOptions,
        }));

      // 2. Normalize and deduplicate actors
      const actorsToCreate: { userId: string; role: TaskActorRole; isPrimaryDRI: boolean }[] = [];
      const seen = new Set<string>();

      if (Array.isArray(payload.assignees)) {
        for (const a of payload.assignees) {
          if (a?.userId && a.userId.trim()) {
            const role = a.roleInTask ?? 'PRIMARY_OWNER';
            const key = `${a.userId.trim()}_${role}`;
            if (!seen.has(key)) {
              seen.add(key);
              actorsToCreate.push({
                userId: a.userId.trim(),
                role: role === 'PRIMARY_OWNER' ? TaskActorRole.DRI : TaskActorRole.COLLABORATOR,
                isPrimaryDRI: role === 'PRIMARY_OWNER',
              });
            }
          }
        }
      }

      if (payload.primaryOwnerId && payload.primaryOwnerId.trim()) {
        const uId = payload.primaryOwnerId.trim();
        const key = `${uId}_PRIMARY_OWNER`;
        if (!seen.has(key)) {
          seen.add(key);
          actorsToCreate.push({ userId: uId, role: TaskActorRole.DRI, isPrimaryDRI: true });
        }
      }

      if (Array.isArray(payload.collaboratorIds)) {
        for (const cId of payload.collaboratorIds) {
          if (cId && cId.trim()) {
            const trimmed = cId.trim();
            const key = `${trimmed}_COLLABORATOR`;
            if (!seen.has(key)) {
              seen.add(key);
              actorsToCreate.push({ userId: trimmed, role: TaskActorRole.COLLABORATOR, isPrimaryDRI: false });
            }
          }
        }
      }

      // 3. Create task atomically
      const task = await tx.task.create({
        data: {
          code: taskCode,
          title: payload.title,
          description: payload.description ?? null,
          scope: taskScope,
          status: payload.status ?? TaskStatus.NOT_STARTED,
          priority: payload.priority ?? TaskPriority.NORMAL,
          progressPercent: payload.progressPercent ?? 0,
          academicMonth,
          academicYear,
          startDate: payload.startDate ? new Date(payload.startDate) : new Date(),
          dueDate: due,
          leadUnitId: (payload as any).leadUnitId ?? (payload as any).departmentId ?? null,
          createdById: payload.createdById,
          parentTaskId: payload.parentTaskId ?? null,
          dacumTaskDefId: payload.dacumTaskDefId ?? null,
          ...(actorsToCreate.length > 0
            ? {
                actors: {
                  create: actorsToCreate,
                },
              }
            : {}),
        },
        include: {
          actors: true,
        },
      });

      if (payload.failAtStep === "afterTaskCreate") {
        throw new Error("[createTaskAtomic] Simulated failure after task creation");
      }

      // 4. Record audit entry
      await recordTransactionAudit(
        tx,
        {
          entityType: "Task",
          entityId: task.id,
          action: payload.audit?.action ?? "TASK_CREATED",
          actorId: payload.audit?.actorId ?? payload.createdById,
          metadata: {
            code: task.code,
            title: task.title,
            scope: task.scope,
            actorCount: task.actors.length,
            ...(payload.audit?.metadata ?? {}),
          },
          requestId: payload.audit?.requestId,
        },
        payload.auditRecorder,
        payload.audit
      );

      if (payload.failAtStep === "audit") {
        throw new Error("[createTaskAtomic] Simulated failure at audit step");
      }

      return {
        task,
        actors: task.actors,
        code: task.code,
      };
    },
    options
  );

  // Execute post-commit hook if specified (never inside tx)
  if (typeof payload.afterCommit === "function") {
    try {
      await payload.afterCommit(result);
    } catch (err) {
      console.error("[createTaskAtomic] Error in afterCommit hook:", err);
    }
  }

  return result;
}

// ============================================================================
// 2. SUBMIT DELIVERABLE ATOMIC WORKFLOW
// ============================================================================

export interface SubmitDeliverableAtomicPayload {
  taskId: string;
  title: string;
  fileUrl: string;
  uploadedById: string;
  fileType?: string | null;
  fileSize?: number | null;
  targetStatus?: TaskStatus;
  expectedTaskVersion?: number;
  audit?: TransactionAuditPayload;
  auditRecorder?: AuditRecorder;
  failAtStep?: "beforeCreate" | "afterDeliverableCreate" | "afterTaskStatus" | "audit";
  afterCommit?: (result: SubmitDeliverableAtomicResult) => Promise<void> | void;
}

export interface SubmitDeliverableAtomicResult {
  deliverable: TaskDeliverable;
  task: Task;
}

/**
 * Submits a task deliverable and updates task status atomically.
 *
 * Sequence of operations in tx:
 * 1. TaskDeliverable creation (reviewStatus: PENDING).
 * 2. Task status transition (defaults to WAITING_APPROVAL, optionally checked with OCC).
 * 3. Audit trail entry.
 */
export async function submitDeliverableAtomic(
  client: DbClient = defaultPrisma,
  payload: SubmitDeliverableAtomicPayload,
  options?: TransactionOptions
): Promise<SubmitDeliverableAtomicResult> {
  const result = await runInTransaction(
    client,
    async (tx) => {
      if (payload.failAtStep === "beforeCreate") {
        throw new Error("[submitDeliverableAtomic] Simulated failure before deliverable creation");
      }

      // 1. Create deliverable
      const deliverable = await tx.taskDeliverable.create({
        data: {
          taskId: payload.taskId,
          title: payload.title,
          fileUrl: payload.fileUrl,
          fileType: payload.fileType ?? "LINK",
          fileSize: typeof payload.fileSize === "number" ? payload.fileSize : null,
          uploadedById: payload.uploadedById,
          reviewStatus: DeliverableReviewStatus.PENDING,
        },
      });

      if (payload.failAtStep === "afterDeliverableCreate") {
        throw new Error("[submitDeliverableAtomic] Simulated failure after deliverable creation");
      }

      // 2. Update task status (default WAITING_APPROVAL)
      const targetStatus = payload.targetStatus ?? TaskStatus.WAITING_APPROVAL;
      let updatedTask: Task;

      if (payload.expectedTaskVersion !== undefined) {
        updatedTask = (await updateTaskWithOCC(
          tx,
          payload.taskId,
          payload.expectedTaskVersion,
          { status: targetStatus }
        )) as Task;
      } else {
        updatedTask = await tx.task.update({
          where: { id: payload.taskId },
          data: { status: targetStatus },
        });
      }

      if (payload.failAtStep === "afterTaskStatus") {
        throw new Error("[submitDeliverableAtomic] Simulated failure after task status update");
      }

      // 3. Record audit entry
      await recordTransactionAudit(
        tx,
        {
          entityType: "TaskDeliverable",
          entityId: deliverable.id,
          action: payload.audit?.action ?? "TASK_DELIVERABLE_SUBMITTED",
          actorId: payload.audit?.actorId ?? payload.uploadedById,
          metadata: {
            taskId: payload.taskId,
            title: payload.title,
            fileUrl: payload.fileUrl,
            previousStatus: (updatedTask as any).status,
            newStatus: targetStatus,
            ...(payload.audit?.metadata ?? {}),
          },
          requestId: payload.audit?.requestId,
        },
        payload.auditRecorder,
        payload.audit
      );

      if (payload.failAtStep === "audit") {
        throw new Error("[submitDeliverableAtomic] Simulated failure at audit step");
      }

      return { deliverable, task: updatedTask };
    },
    options
  );

  if (typeof payload.afterCommit === "function") {
    try {
      await payload.afterCommit(result);
    } catch (err) {
      console.error("[submitDeliverableAtomic] Error in afterCommit hook:", err);
    }
  }

  return result;
}

// ============================================================================
// 3. APPROVE TASK ATOMIC WORKFLOW
// ============================================================================

export interface TaskResolutionPayload {
  resolutionType?: ResolutionType;
  directiveNote?: string | null;
  grantedDays?: number | null;
  previousDueDate?: Date | string | null;
  newDueDate?: Date | string | null;
  previousOwnerId?: string | null;
  newOwnerId?: string | null;
}

export interface DeliverableReviewPayload {
  deliverableId?: string;
  reviewStatus?: DeliverableReviewStatus;
  reviewNote?: string | null;
}

export interface ApproveTaskAtomicPayload {
  taskId: string;
  approverId: string;
  progressPercent?: number;
  completedAt?: Date | string | null;
  resolution?: TaskResolutionPayload;
  deliverableReview?: DeliverableReviewPayload;
  approveAllDeliverables?: boolean;
  expectedTaskVersion?: number;
  audit?: TransactionAuditPayload;
  auditRecorder?: AuditRecorder;
  failAtStep?:
    | "beforeUpdate"
    | "afterTaskUpdate"
    | "afterResolution"
    | "afterDeliverableReview"
    | "audit";
  afterCommit?: (result: ApproveTaskAtomicResult) => Promise<void> | void;
}

export interface ApproveTaskAtomicResult {
  task: Task;
  resolution?: ExecutiveResolution | null;
  deliverables?: TaskDeliverable[];
}

/**
 * Approves and completes a task atomically with resolution/review records and audit log.
 *
 * Sequence of operations in tx:
 * 1. Task status update to COMPLETED (progressPercent: 100, completedAt: now), optionally with OCC.
 * 2. Optional ExecutiveResolution creation if resolution details are provided.
 * 3. Optional TaskDeliverable review updates (single or all pending deliverables).
 * 4. Audit trail entry.
 */
export async function approveTaskAtomic(
  client: DbClient = defaultPrisma,
  payload: ApproveTaskAtomicPayload,
  options?: TransactionOptions
): Promise<ApproveTaskAtomicResult> {
  const result = await runInTransaction(
    client,
    async (tx) => {
      if (payload.failAtStep === "beforeUpdate") {
        throw new Error("[approveTaskAtomic] Simulated failure before task update");
      }

      // 1. Update task to COMPLETED
      const completedAtDate = payload.completedAt
        ? new Date(payload.completedAt)
        : new Date();
      // COMPLETED is a canonical terminal state: callers cannot persist a
      // contradictory progress value through the generic payload.
      const progressPercent = 100;

      let updatedTask: Task;
      if (payload.expectedTaskVersion !== undefined) {
        updatedTask = (await updateTaskWithOCC(
          tx,
          payload.taskId,
          payload.expectedTaskVersion,
          {
            status: TaskStatus.COMPLETED,
            progressPercent,
            completedAt: completedAtDate,
          }
        )) as Task;
      } else {
        updatedTask = await tx.task.update({
          where: { id: payload.taskId },
          data: {
            status: TaskStatus.COMPLETED,
            progressPercent,
            completedAt: completedAtDate,
          },
        });
      }

      if (payload.failAtStep === "afterTaskUpdate") {
        throw new Error("[approveTaskAtomic] Simulated failure after task update");
      }

      // 2. Create resolution record if requested
      let resolutionRecord: ExecutiveResolution | null = null;
      if (payload.resolution) {
        resolutionRecord = await tx.executiveResolution.create({
          data: {
            taskId: payload.taskId,
            actorId: payload.approverId,
            resolutionType:
              payload.resolution.resolutionType ?? ResolutionType.DIRECTIVE_NOTE,
            directiveNote: payload.resolution.directiveNote ?? null,
            grantedDays: payload.resolution.grantedDays ?? null,
            previousDueDate: payload.resolution.previousDueDate
              ? new Date(payload.resolution.previousDueDate)
              : null,
            newDueDate: payload.resolution.newDueDate
              ? new Date(payload.resolution.newDueDate)
              : null,
            previousOwnerId: payload.resolution.previousOwnerId ?? null,
            newOwnerId: payload.resolution.newOwnerId ?? null,
          },
        });
      }

      if (payload.failAtStep === "afterResolution") {
        throw new Error("[approveTaskAtomic] Simulated failure after resolution creation");
      }

      // 3. Review deliverable(s)
      const reviewedDeliverables: TaskDeliverable[] = [];

      if (payload.deliverableReview?.deliverableId) {
        const d = await tx.taskDeliverable.update({
          where: { id: payload.deliverableReview.deliverableId },
          data: {
            reviewStatus:
              payload.deliverableReview.reviewStatus ?? DeliverableReviewStatus.APPROVED,
            reviewerId: payload.approverId,
            reviewedAt: new Date(),
            reviewNote: payload.deliverableReview.reviewNote ?? null,
          },
        });
        reviewedDeliverables.push(d);
      } else if (payload.approveAllDeliverables) {
        await tx.taskDeliverable.updateMany({
          where: {
            taskId: payload.taskId,
            reviewStatus: DeliverableReviewStatus.PENDING,
          },
          data: {
            reviewStatus: DeliverableReviewStatus.APPROVED,
            reviewerId: payload.approverId,
            reviewedAt: new Date(),
            reviewNote: payload.deliverableReview?.reviewNote ?? "Nghiệm thu đồng bộ hoàn thành nhiệm vụ",
          },
        });

        const allApproved = await tx.taskDeliverable.findMany({
          where: { taskId: payload.taskId },
        });
        reviewedDeliverables.push(...allApproved);
      }

      if (payload.failAtStep === "afterDeliverableReview") {
        throw new Error("[approveTaskAtomic] Simulated failure after deliverable review");
      }

      // 4. Record audit entry
      await recordTransactionAudit(
        tx,
        {
          entityType: "Task",
          entityId: payload.taskId,
          action: payload.audit?.action ?? "TASK_APPROVED",
          actorId: payload.audit?.actorId ?? payload.approverId,
          metadata: {
            hasResolution: Boolean(resolutionRecord),
            resolutionType: resolutionRecord?.resolutionType ?? null,
            reviewedDeliverablesCount: reviewedDeliverables.length,
            ...(payload.audit?.metadata ?? {}),
          },
          requestId: payload.audit?.requestId,
        },
        payload.auditRecorder,
        payload.audit
      );

      if (payload.failAtStep === "audit") {
        throw new Error("[approveTaskAtomic] Simulated failure at audit step");
      }

      return {
        task: updatedTask,
        resolution: resolutionRecord,
        deliverables: reviewedDeliverables,
      };
    },
    options
  );

  if (typeof payload.afterCommit === "function") {
    try {
      await payload.afterCommit(result);
    } catch (err) {
      console.error("[approveTaskAtomic] Error in afterCommit hook:", err);
    }
  }

  return result;
}

// ============================================================================
// 4. CREATE DOCUMENT DIRECTIVE ATOMIC WORKFLOW
// ============================================================================

export interface CreateDocumentDirectiveAtomicPayload {
  documentId: string;
  leaderId: string;
  instruction: string;
  /**
   * Đơn vị chủ trì nhận chỉ đạo — canonical `OrganizationalUnit.id`.
   * Phase 9: không ghi vào `DocumentDirective` (cột `assignedDeptId` đã bị drop);
   * đơn vị được thể hiện qua `Task.leadUnitId` của nhiệm vụ sinh ra.
   */
  leadUnitId: string;
  deadline?: Date | string | null;
  collaboratorIds?: string | string[] | null;
  isTaskGenerated?: boolean;
  targetDocumentStatus?: DocumentStatus;
  linkedTaskId?: string | null;
  expectedDocumentVersion?: number;
  audit?: TransactionAuditPayload;
  auditRecorder?: AuditRecorder;
  failAtStep?: "beforeCreate" | "afterDirectiveCreate" | "afterDocumentTouch" | "audit";
  afterCommit?: (result: CreateDocumentDirectiveAtomicResult) => Promise<void> | void;
}

export interface CreateDocumentDirectiveAtomicResult {
  directive: DocumentDirective;
  document: Document;
}

/**
 * Creates a document leadership directive and updates/touches the document atomically.
 *
 * Sequence of operations in tx:
 * 1. DocumentDirective record creation.
 * 2. Document status update (defaults to DANG_XU_LY, optional linkedTaskId)
 *    optionally validated with OCC.
 * 3. Audit trail entry.
 */
export async function createDocumentDirectiveAtomic(
  client: DbClient = defaultPrisma,
  payload: CreateDocumentDirectiveAtomicPayload,
  options?: TransactionOptions
): Promise<CreateDocumentDirectiveAtomicResult> {
  const result = await runInTransaction(
    client,
    async (tx) => {
      if (payload.failAtStep === "beforeCreate") {
        throw new Error("[createDocumentDirectiveAtomic] Simulated failure before directive creation");
      }

      let serializedCollaborators: string | null = null;
      if (Array.isArray(payload.collaboratorIds)) {
        serializedCollaborators = JSON.stringify(payload.collaboratorIds);
      } else if (typeof payload.collaboratorIds === "string") {
        serializedCollaborators = payload.collaboratorIds.trim() || null;
      }

      // 1. Create DocumentDirective
      const directive = await tx.documentDirective.create({
        data: {
          documentId: payload.documentId,
          leaderId: payload.leaderId,
          instruction: payload.instruction,
          deadline: payload.deadline ? new Date(payload.deadline) : null,
          collaboratorIds: serializedCollaborators,
          isTaskGenerated: payload.isTaskGenerated ?? false,
        },
      });

      if (payload.failAtStep === "afterDirectiveCreate") {
        throw new Error("[createDocumentDirectiveAtomic] Simulated failure after directive creation");
      }

      // 2. Touch & update Document record
      const targetStatus = payload.targetDocumentStatus ?? DocumentStatus.DANG_XU_LY;
      // Phase 9: `Document.leadDepartmentId` was dropped — unit ownership is
      // canonical `OrganizationalUnit` and only exists once the directive's task
      // is created (`Task.leadUnitId`).
      const docUpdateData: any = {
        status: targetStatus,
      };
      if (payload.linkedTaskId !== undefined) {
        docUpdateData.linkedTaskId = payload.linkedTaskId;
      }

      let updatedDocument: Document;
      if (payload.expectedDocumentVersion !== undefined) {
        updatedDocument = (await updateDocumentWithOCC(
          tx,
          payload.documentId,
          payload.expectedDocumentVersion,
          docUpdateData
        )) as Document;
      } else {
        updatedDocument = await tx.document.update({
          where: { id: payload.documentId },
          data: docUpdateData,
        });
      }

      if (payload.failAtStep === "afterDocumentTouch") {
        throw new Error("[createDocumentDirectiveAtomic] Simulated failure after document update");
      }

      // 3. Record audit entry
      await recordTransactionAudit(
        tx,
        {
          entityType: "DocumentDirective",
          entityId: directive.id,
          action: payload.audit?.action ?? "DOCUMENT_DIRECTIVE_CREATED",
          actorId: payload.audit?.actorId ?? payload.leaderId,
          metadata: {
            documentId: payload.documentId,
            leadUnitId: payload.leadUnitId,
            isTaskGenerated: directive.isTaskGenerated,
            newDocumentStatus: targetStatus,
            ...(payload.audit?.metadata ?? {}),
          },
          requestId: payload.audit?.requestId,
        },
        payload.auditRecorder,
        payload.audit
      );

      if (payload.failAtStep === "audit") {
        throw new Error("[createDocumentDirectiveAtomic] Simulated failure at audit step");
      }

      return {
        directive,
        document: updatedDocument,
      };
    },
    options
  );

  if (typeof payload.afterCommit === "function") {
    try {
      await payload.afterCommit(result);
    } catch (err) {
      console.error("[createDocumentDirectiveAtomic] Error in afterCommit hook:", err);
    }
  }

  return result;
}
