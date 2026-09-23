/**
 * QCET Stage B Remediation: Classify legacy OVERDUE tasks into canonical lifecycle statuses.
 *
 * WI-8.4b / ADR-003 ACCEPTED
 *
 * Run ONCE on staging, verify via auditTaskStatusOverdue() → 0, then run on production.
 * Safe to re-run (idempotent — skips tasks already remediated by a previous run).
 *
 * Usage:
 *   npx tsx prisma/data-migrations/remediate-overdue-tasks.ts
 *
 * NOTE: Tasks classified as MANUAL_REMEDIATION are skipped and logged for human review.
 * Do NOT set them to IN_PROGRESS blindly — that violates ADR-003 Hard Invariant 2.
 */
import { PrismaClient, type TaskStatus } from '@prisma/client';
import { classifyOverdueTask, isAutoRecoverableLifecycle } from '../../src/domain/tasks/remediation/overdue-classifier';

const db = new PrismaClient();

async function remediateOverdueTasks() {
  const overdueTasks = await db.task.findMany({
    where: { status: 'OVERDUE' },
    select: {
      id: true,
      code: true,
      title: true,
      progressPercent: true,
      version: true,
      deliverables: { select: { id: true } },
    },
  });

  console.log(`\n=== QCET WI-8.4b: OVERDUE Stage B Remediation ===`);
  console.log(`Found ${overdueTasks.length} OVERDUE tasks to process.\n`);

  if (overdueTasks.length === 0) {
    console.log('Nothing to do. Zero OVERDUE rows. Safe to proceed to Phase 9 (schema enum removal).');
    await db.$disconnect();
    return;
  }

  let remediated = 0;
  const manualQueue: Array<{ code?: string; id: string; reason: string }> = [];

  for (const task of overdueTasks) {
    const classification = classifyOverdueTask({
      status: 'OVERDUE',
      // progress field maps to progressPercent column in DB (ADR-003 field mapping)
      progress: task.progressPercent ?? undefined,
      deliverablesCount: task.deliverables.length,
      hasActivityLog: task.version > 1,
    });

    if (!isAutoRecoverableLifecycle(classification.targetLifecycle)) {
      // MANUAL_REMEDIATION — do not write; queue for human review
      manualQueue.push({
        id: task.id,
        code: task.code ?? undefined,
        reason: classification.reason,
      });
      console.log(
        `[SKIP MANUAL] ${task.code ?? task.id} — ${classification.reason}`
      );
      continue;
    }

    await db.task.update({
      where: { id: task.id },
      data: {
        status: classification.targetLifecycle as TaskStatus,
        version: { increment: 1 },
      },
    });

    console.log(
      `[OK] ${task.code ?? task.id}: OVERDUE → ${classification.targetLifecycle} (${classification.reason})`
    );
    remediated++;
  }

  console.log(`\n--- Summary ---`);
  console.log(`Auto-remediated : ${remediated}/${overdueTasks.length}`);
  console.log(`Manual review   : ${manualQueue.length}/${overdueTasks.length}`);

  if (manualQueue.length > 0) {
    console.log(`\n[ACTION REQUIRED] Tasks requiring manual lifecycle review:`);
    for (const item of manualQueue) {
      console.log(`  - ${item.code ?? item.id}: ${item.reason}`);
    }
    console.log(
      `\nFor each manual item: determine correct lifecycle (NOT_STARTED / IN_PROGRESS / WAITING_APPROVAL), then UPDATE manually.`
    );
    console.log(
      `After all OVERDUE rows are resolved, verify with auditTaskStatusOverdue() from overdue-removal-audit.ts.`
    );
  } else {
    console.log(`\nAll OVERDUE tasks auto-remediated. Run auditTaskStatusOverdue() to confirm isSafeForEnumRemoval=true.`);
  }

  await db.$disconnect();
}

remediateOverdueTasks().catch((err) => {
  console.error('Remediation failed:', err);
  process.exit(1);
});
