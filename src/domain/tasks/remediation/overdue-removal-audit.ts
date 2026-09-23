/**
 * QCET E-Office: OVERDUE Enum Removal Pre-flight Audit & Verification (WI-8.4 / ADR-003)
 *
 * Provides pre-flight audit functions ensuring zero active tasks remain in OVERDUE status
 * and verifying that status normalizers adhere to the Lifecycle != Attention invariant.
 *
 * CANONICAL LIFECYCLE INVARIANT:
 * - Target Canonical Lifecycle statuses: NOT_STARTED, IN_PROGRESS, WAITING_APPROVAL, COMPLETED, CANCELLED.
 * - OVERDUE is STRICTLY an attention signal (due-date projection / isOverdue flag), NEVER a target canonical lifecycle.
 * - Real-data audit must reach exactly 0 legacy OVERDUE rows before Phase 9 schema contract executes.
 */

import { type PrismaClient, type Prisma } from '@prisma/client';
import { classifyOverdueTask, type OverdueClassificationResult, type TargetLifecycleStatus } from './overdue-classifier';
import { normalizeDisplayStatus, mapDbStatusToLifecycle } from '../canonical-semantics';

export type DbClient = PrismaClient | Prisma.TransactionClient;

export const CANONICAL_TASK_LIFECYCLES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'WAITING_APPROVAL',
  'COMPLETED',
  'CANCELLED',
] as const;

export interface OverdueTaskAuditItem {
  id: string;
  code?: string;
  title: string;
  recommendation: OverdueClassificationResult;
}

export interface OverdueRemovalAuditReport {
  isSafeForEnumRemoval: boolean;
  totalTasksWithOverdueStatus: number;
  tasksToRemediate: OverdueTaskAuditItem[];
  normalizerVerification: {
    canonicalNormalizerPasses: boolean;
    stateMachineNormalizerPasses: boolean;
    attentionSeparationPasses: boolean;
  };
}

/**
 * Runs an audit query against the database checking for any tasks with status = 'OVERDUE'
 */
export async function auditTaskStatusOverdue(
  db: DbClient
): Promise<OverdueRemovalAuditReport> {
  // Query tasks with status OVERDUE
  const overdueTasks = await (db as any).task.findMany({
    where: {
      status: 'OVERDUE',
    },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      progressPercent: true,
      version: true,
      deliverables: { select: { id: true } },
    },
  });

  const tasksToRemediate: OverdueTaskAuditItem[] = [];

  for (const task of overdueTasks) {
    const recommendation = classifyOverdueTask({
      status: task.status,
      progress: task.progressPercent,
      deliverablesCount: task.deliverables?.length ?? 0,
      hasActivityLog: task.version > 1,
    });

    tasksToRemediate.push({
      id: task.id,
      code: task.code,
      title: task.title,
      recommendation,
    });
  }

  // Verify normalizers
  const normalizerVerification = verifyStatusNormalizersAttentionSeparation();

  return {
    isSafeForEnumRemoval: overdueTasks.length === 0 && normalizerVerification.attentionSeparationPasses,
    totalTasksWithOverdueStatus: overdueTasks.length,
    tasksToRemediate,
    normalizerVerification,
  };
}

/**
 * Asserts that zero tasks have status = 'OVERDUE', throwing an error if any exist
 */
export async function assertZeroActiveOverdueTasks(db: DbClient): Promise<void> {
  const audit = await auditTaskStatusOverdue(db);
  if (!audit.isSafeForEnumRemoval) {
    throw new Error(
      `Cannot remove OVERDUE from TaskStatus enum: ${audit.totalTasksWithOverdueStatus} tasks still have status='OVERDUE'. Run remediation script before Phase 9 contract.`
    );
  }
}

/**
 * Verifies that canonical normalizers treat OVERDUE as derived attention rather than lifecycle:
 * 1. normalizeDisplayStatus maps raw OVERDUE to IN_PROGRESS (collapsing technical OVERDUE into active work).
 * 2. All target remediation lifecycles belong to canonical lifecycles (NOT_STARTED, IN_PROGRESS, WAITING_APPROVAL).
 * 3. OVERDUE is NEVER preserved as a target canonical lifecycle state.
 */
export function verifyStatusNormalizersAttentionSeparation(): {
  canonicalNormalizerPasses: boolean;
  stateMachineNormalizerPasses: boolean;
  attentionSeparationPasses: boolean;
} {
  // 1. normalizeDisplayStatus maps OVERDUE to IN_PROGRESS
  const displayResult = normalizeDisplayStatus('OVERDUE');
  const canonicalNormalizerPasses = displayResult === 'IN_PROGRESS';

  // 2. mapDbStatusToLifecycle must NOT preserve OVERDUE as target lifecycle (ADR-003)
  const dbStatusResult = mapDbStatusToLifecycle('OVERDUE');
  const stateMachineNormalizerPasses = dbStatusResult !== 'OVERDUE';

  // 3. Verify remediation recommendations never target OVERDUE as lifecycle
  const sampleClassification = classifyOverdueTask({ status: 'OVERDUE', progress: 20 });
  const attentionSeparationPasses =
    sampleClassification.targetLifecycle !== ('OVERDUE' as any) &&
    sampleClassification.isOverdue === true &&
    canonicalNormalizerPasses;

  return {
    canonicalNormalizerPasses,
    stateMachineNormalizerPasses,
    attentionSeparationPasses,
  };
}
