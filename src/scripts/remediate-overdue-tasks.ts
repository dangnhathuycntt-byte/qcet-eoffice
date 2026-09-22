/**
 * OVERDUE Task Lifecycle Remediation Script
 *
 * Operational script for WI-4.3 / Issue #65 under ADR-003 ACCEPTED:
 * - Hard Invariants:
 *   1. Lifecycle != Attention
 *   2. STRICTLY FORBIDDEN: Blind batch update (UPDATE tasks SET status='IN_PROGRESS' WHERE status='OVERDUE')
 *   3. Every OVERDUE task must be analyzed and safely classified into a recoverable lifecycle state
 *      (IN_PROGRESS, NOT_STARTED, WAITING_APPROVAL, or MANUAL_REMEDIATION) with isOverdue=true.
 *
 * Capabilities:
 * - Dry-run mode by default (safety first)
 * - Execute mode with atomic transaction updates
 * - Rollback Journal creation for 100% reversible operations
 * - Manual Queue export for ambiguous/corrupted records
 * - Offline / JSON fixture mode for air-gapped testing and CI
 *
 * CLI Usage:
 *   npx tsx src/scripts/remediate-overdue-tasks.ts [--dry-run]
 *   npx tsx src/scripts/remediate-overdue-tasks.ts --execute
 *   npx tsx src/scripts/remediate-overdue-tasks.ts --rollback=<journal-file>
 *   npx tsx src/scripts/remediate-overdue-tasks.ts --input=<fixture.json> [--dry-run|--execute]
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  classifyOverdueTask,
  isAutoRecoverableLifecycle,
  type TargetLifecycleStatus,
  type OverdueTaskInput,
} from '../domain/tasks/remediation/overdue-classifier';

export interface RemediationOptions {
  dryRun?: boolean;
  execute?: boolean;
  rollbackPath?: string;
  outputDir?: string;
  inputFile?: string;
  prismaClient?: any;
}

export interface RemediationJournalEntry {
  taskId: string;
  code?: string;
  title?: string;
  previousStatus: string;
  targetLifecycle: TargetLifecycleStatus;
  isOverdue: true;
  reason: string;
}

export interface ManualQueueEntry {
  taskId: string;
  code?: string;
  title?: string;
  status: string;
  reason: string;
  taskData: Record<string, unknown>;
}

export interface RemediationJournal {
  journalId: string;
  executedAt: string;
  mode: 'dry-run' | 'execute';
  totalScanned: number;
  remediatedCount: number;
  countsByLifecycle: {
    NOT_STARTED: number;
    IN_PROGRESS: number;
    WAITING_APPROVAL: number;
    MANUAL_REMEDIATION: number;
  };
  entries: RemediationJournalEntry[];
  manualQueue: ManualQueueEntry[];
}

export interface RemediationResult {
  success: boolean;
  mode: 'dry-run' | 'execute';
  totalScanned: number;
  remediatedCount: number;
  countsByLifecycle: {
    NOT_STARTED: number;
    IN_PROGRESS: number;
    WAITING_APPROVAL: number;
    MANUAL_REMEDIATION: number;
  };
  journalPath?: string;
  manualQueuePath?: string;
  entries: RemediationJournalEntry[];
  manualQueue: ManualQueueEntry[];
}

export interface RollbackResult {
  success: boolean;
  journalId: string;
  restoredCount: number;
  failedCount: number;
  errors: Array<{ taskId: string; error: string }>;
}

/**
 * Loads tasks to remediate either from an input file (fixture mode) or via Prisma DB query.
 */
async function loadOverdueTasks(
  options: RemediationOptions
): Promise<Array<Record<string, any>>> {
  if (options.inputFile) {
    const rawContent = fs.readFileSync(path.resolve(options.inputFile), 'utf8');
    const parsed = JSON.parse(rawContent);
    return Array.isArray(parsed) ? parsed : (parsed.tasks ?? []);
  }

  // Database load
  let prisma = options.prismaClient;
  if (!prisma) {
    try {
      const prismaModule = await import('../lib/prisma');
      prisma = prismaModule.prisma || prismaModule.default;
    } catch (err) {
      throw new Error(
        `Failed to initialize Prisma client. If running offline, provide --input=<file.json>. Details: ${err}`
      );
    }
  }

  if (!prisma?.task) {
    throw new Error('Prisma client task delegate is not available');
  }

  const tasks = await prisma.task.findMany({
    where: {
      status: 'OVERDUE',
    },
    include: {
      deliverables: true,
      taskResults: true,
      approvalProcesses: true,
    },
  });

  return tasks;
}

/**
 * Normalizes raw task data from DB or JSON into standard OverdueTaskInput.
 */
function normalizeTaskInput(rawTask: Record<string, any>): OverdueTaskInput {
  const deliverables = Array.isArray(rawTask.deliverables)
    ? rawTask.deliverables.length
    : typeof rawTask.deliverablesCount === 'number'
      ? rawTask.deliverablesCount
      : 0;

  const resultsCount = Array.isArray(rawTask.taskResults)
    ? rawTask.taskResults.length
    : 0;
  const approvalsCount = Array.isArray(rawTask.approvalProcesses)
    ? rawTask.approvalProcesses.length
    : 0;

  const isSubmittedForApproval =
    rawTask.isSubmittedForApproval === true ||
    resultsCount > 0 ||
    approvalsCount > 0;

  const progress =
    typeof rawTask.progressPercent === 'number'
      ? rawTask.progressPercent
      : typeof rawTask.progress === 'number'
        ? rawTask.progress
        : undefined;

  let hasActivityLog = rawTask.hasActivityLog;
  if (hasActivityLog === undefined && rawTask.createdAt && rawTask.updatedAt) {
    const createdTime = new Date(rawTask.createdAt).getTime();
    const updatedTime = new Date(rawTask.updatedAt).getTime();
    if (!Number.isNaN(createdTime) && !Number.isNaN(updatedTime)) {
      hasActivityLog = updatedTime - createdTime > 1000;
    }
  }

  return {
    ...rawTask,
    id: rawTask.id,
    code: rawTask.code,
    title: rawTask.title,
    status: rawTask.status,
    progress,
    deliverablesCount: deliverables,
    hasActivityLog: Boolean(hasActivityLog),
    isSubmittedForApproval,
  };
}

/**
 * Executes the overdue tasks remediation algorithm.
 */
export async function remediateOverdueTasks(
  options: RemediationOptions = {}
): Promise<RemediationResult> {
  const isExecute = Boolean(options.execute && !options.dryRun);
  const mode = isExecute ? 'execute' : 'dry-run';
  const outputDir = path.resolve(options.outputDir || 'reports/remediation');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const rawTasks = await loadOverdueTasks(options);

  const entries: RemediationJournalEntry[] = [];
  const manualQueue: ManualQueueEntry[] = [];

  const counts = {
    NOT_STARTED: 0,
    IN_PROGRESS: 0,
    WAITING_APPROVAL: 0,
    MANUAL_REMEDIATION: 0,
  };

  for (const rawTask of rawTasks) {
    const taskInput = normalizeTaskInput(rawTask);
    const classification = classifyOverdueTask(taskInput);

    counts[classification.targetLifecycle]++;

    if (isAutoRecoverableLifecycle(classification.targetLifecycle)) {
      entries.push({
        taskId: String(rawTask.id || taskInput.id),
        code: rawTask.code ? String(rawTask.code) : undefined,
        title: rawTask.title ? String(rawTask.title) : undefined,
        previousStatus: String(rawTask.status),
        targetLifecycle: classification.targetLifecycle,
        isOverdue: true,
        reason: classification.reason,
      });
    } else {
      manualQueue.push({
        taskId: String(rawTask.id || taskInput.id),
        code: rawTask.code ? String(rawTask.code) : undefined,
        title: rawTask.title ? String(rawTask.title) : undefined,
        status: String(rawTask.status),
        reason: classification.reason,
        taskData: rawTask,
      });
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const journalId = `remediation-journal-${timestamp}`;
  const journalPath = path.join(outputDir, `${journalId}.json`);
  const manualQueuePath = path.join(
    outputDir,
    `manual-remediation-queue-${timestamp}.json`
  );

  const journal: RemediationJournal = {
    journalId,
    executedAt: new Date().toISOString(),
    mode,
    totalScanned: rawTasks.length,
    remediatedCount: entries.length,
    countsByLifecycle: counts,
    entries,
    manualQueue,
  };

  // Write Rollback Journal
  fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2), 'utf8');

  // Write Manual Queue export if items exist
  if (manualQueue.length > 0) {
    fs.writeFileSync(
      manualQueuePath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          totalManualQueue: manualQueue.length,
          instructions:
            'These tasks contain ambiguous or conflicting indicators. Review and update manually.',
          tasks: manualQueue,
        },
        null,
        2
      ),
      'utf8'
    );
  }

  // Execute database updates if mode === 'execute'
  if (isExecute && entries.length > 0) {
    let prisma = options.prismaClient;
    if (!prisma) {
      const prismaModule = await import('../lib/prisma');
      prisma = prismaModule.prisma || prismaModule.default;
    }

    if (prisma?.task && prisma.$transaction) {
      await prisma.$transaction(async (tx: any) => {
        for (const entry of entries) {
          await tx.task.update({
            where: { id: entry.taskId },
            data: {
              status: entry.targetLifecycle,
            },
          });
        }
      });
    } else if (prisma?.task?.update) {
      for (const entry of entries) {
        await prisma.task.update({
          where: { id: entry.taskId },
          data: {
            status: entry.targetLifecycle,
          },
        });
      }
    }
  }

  return {
    success: true,
    mode,
    totalScanned: rawTasks.length,
    remediatedCount: entries.length,
    countsByLifecycle: counts,
    journalPath,
    manualQueuePath: manualQueue.length > 0 ? manualQueuePath : undefined,
    entries,
    manualQueue,
  };
}

/**
 * Rolls back an executed remediation using a saved rollback journal.
 */
export async function rollbackFromJournal(
  journalPath: string,
  prismaClient?: any
): Promise<RollbackResult> {
  const fullPath = path.resolve(journalPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Rollback journal not found at path: ${fullPath}`);
  }

  const raw = fs.readFileSync(fullPath, 'utf8');
  const journal: RemediationJournal = JSON.parse(raw);

  if (!journal.entries || !Array.isArray(journal.entries)) {
    throw new Error('Invalid rollback journal format: missing entries array');
  }

  let prisma = prismaClient;
  if (!prisma) {
    try {
      const prismaModule = await import('../lib/prisma');
      prisma = prismaModule.prisma || prismaModule.default;
    } catch (err) {
      throw new Error(`Failed to load Prisma client for rollback: ${err}`);
    }
  }

  let restoredCount = 0;
  let failedCount = 0;
  const errors: Array<{ taskId: string; error: string }> = [];

  for (const entry of journal.entries) {
    try {
      if (prisma?.task?.update) {
        await prisma.task.update({
          where: { id: entry.taskId },
          data: {
            status: entry.previousStatus,
          },
        });
      }
      restoredCount++;
    } catch (err: any) {
      failedCount++;
      errors.push({ taskId: entry.taskId, error: err?.message || String(err) });
    }
  }

  return {
    success: failedCount === 0,
    journalId: journal.journalId,
    restoredCount,
    failedCount,
    errors,
  };
}

/**
 * CLI Entry point
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const isHelp = args.includes('--help') || args.includes('-h');
  if (isHelp) {
    console.log(`
OVERDUE Task Remediation CLI under ADR-003
Usage:
  npx tsx src/scripts/remediate-overdue-tasks.ts [options]

Options:
  --dry-run             Run classification and generate journal/manual queue without updating DB (default)
  --execute             Execute database updates in transactions and persist rollback journal
  --rollback=<path>     Rollback previously remediated tasks using specified journal JSON file
  --input=<path>        Load tasks from JSON fixture file instead of live DB
  --output-dir=<dir>    Directory for journal and manual queue output (default: reports/remediation)
`);
    return;
  }

  const rollbackArg = args.find((a) => a.startsWith('--rollback='));
  if (rollbackArg) {
    const journalPath = rollbackArg.split('=')[1];
    console.log(`Executing rollback from journal: ${journalPath}...`);
    const result = await rollbackFromJournal(journalPath);
    console.log(`Rollback completed. Restored: ${result.restoredCount}, Failed: ${result.failedCount}`);
    if (result.errors.length > 0) {
      console.error('Errors encountered during rollback:', result.errors);
      process.exit(1);
    }
    return;
  }

  const execute = args.includes('--execute');
  const dryRun = args.includes('--dry-run') || !execute;
  const inputArg = args.find((a) => a.startsWith('--input='));
  const inputFile = inputArg ? inputArg.split('=')[1] : undefined;
  const outputDirArg = args.find((a) => a.startsWith('--output-dir='));
  const outputDir = outputDirArg ? outputDirArg.split('=')[1] : undefined;

  console.log('---------------------------------------------------------');
  console.log('WI-4.3 OVERDUE Task Lifecycle Remediation under ADR-003');
  console.log(`Mode: ${execute ? 'EXECUTE (DATABASE UPDATE)' : 'DRY-RUN (SAFETY SIMULATION)'}`);
  if (inputFile) console.log(`Input Fixture: ${inputFile}`);
  console.log('---------------------------------------------------------');

  try {
    const result = await remediateOverdueTasks({
      dryRun,
      execute,
      inputFile,
      outputDir,
    });

    console.log('\nRemediation Summary:');
    console.log(`- Total OVERDUE tasks scanned : ${result.totalScanned}`);
    console.log(`- Auto-remediated total        : ${result.remediatedCount}`);
    console.log(`  * -> WAITING_APPROVAL       : ${result.countsByLifecycle.WAITING_APPROVAL}`);
    console.log(`  * -> IN_PROGRESS            : ${result.countsByLifecycle.IN_PROGRESS}`);
    console.log(`  * -> NOT_STARTED            : ${result.countsByLifecycle.NOT_STARTED}`);
    console.log(`- Manual Remediation Queue     : ${result.countsByLifecycle.MANUAL_REMEDIATION}`);
    console.log(`\nArtifacts Generated:`);
    console.log(`- Rollback Journal            : ${result.journalPath}`);
    if (result.manualQueuePath) {
      console.log(`- Manual Queue Export         : ${result.manualQueuePath}`);
    }
    console.log('---------------------------------------------------------');
  } catch (err) {
    console.error('Remediation process failed:', err);
    process.exit(1);
  }
}

// Auto-run if executed directly via CLI
if (
  process.argv[1] &&
  (process.argv[1].endsWith('remediate-overdue-tasks.ts') ||
    process.argv[1].endsWith('remediate-overdue-tasks.js'))
) {
  main();
}
