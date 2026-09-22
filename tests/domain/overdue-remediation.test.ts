/**
 * Test Suite: OVERDUE Lifecycle Remediation Strategy (WI-4.3)
 *
 * Verifies compliance with ADR-003 ACCEPTED:
 * 1. Hard Invariant: Lifecycle != Attention.
 * 2. STRICTLY FORBIDDEN: Blind batch update (UPDATE tasks SET status='IN_PROGRESS' WHERE status='OVERDUE').
 * 3. 100% precision across all 4 classification branches:
 *    - Rule 1: WAITING_APPROVAL (submitted or deliverables > 0)
 *    - Rule 2: IN_PROGRESS (progress > 0 or has activity)
 *    - Rule 3: NOT_STARTED (progress == 0 and no activity or deliverables)
 *    - Rule 4: MANUAL_REMEDIATION (ambiguous / conflicting / corrupted)
 * 4. Zero data loss, rollback journal integrity, and recovery mechanism.
 */

import * as nodeTest from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const describe: any = (globalThis as any).describe || nodeTest.describe;
const it: any = (globalThis as any).it || (globalThis as any).test || nodeTest.it;

import {
  classifyOverdueTask,
  isAutoRecoverableLifecycle,
} from '../../src/domain/tasks/remediation/overdue-classifier';

import {
  remediateOverdueTasks,
  rollbackFromJournal,
} from '../../src/scripts/remediate-overdue-tasks';

describe('WI-4.3 / ADR-003: OVERDUE Classification Precision Across All 4 Branches', () => {
  // Branch 1: WAITING_APPROVAL
  describe('Rule 1: Deliverables or Approval Submission -> WAITING_APPROVAL', () => {
    it('classifies task with isSubmittedForApproval=true as WAITING_APPROVAL', () => {
      const result = classifyOverdueTask({
        status: 'OVERDUE',
        progress: 100,
        isSubmittedForApproval: true,
        deliverablesCount: 0,
        hasActivityLog: true,
      });

      assert.equal(result.targetLifecycle, 'WAITING_APPROVAL');
      assert.equal(result.isOverdue, true);
      assert.match(result.reason, /Rule 1/);
    });

    it('classifies task with deliverablesCount > 0 as WAITING_APPROVAL even if progress=0', () => {
      const result = classifyOverdueTask({
        status: 'OVERDUE',
        progress: 0,
        deliverablesCount: 2,
        hasActivityLog: false,
        isSubmittedForApproval: false,
      });

      assert.equal(result.targetLifecycle, 'WAITING_APPROVAL');
      assert.equal(result.isOverdue, true);
      assert.match(result.reason, /Rule 1/);
    });

    it('classifies task with both deliverables and submission as WAITING_APPROVAL', () => {
      const result = classifyOverdueTask({
        status: 'OVERDUE',
        progress: 95,
        deliverablesCount: 3,
        isSubmittedForApproval: true,
      });

      assert.equal(result.targetLifecycle, 'WAITING_APPROVAL');
      assert.equal(result.isOverdue, true);
    });
  });

  // Branch 2: IN_PROGRESS
  describe('Rule 2: Progress > 0 or Activity Log -> IN_PROGRESS', () => {
    it('classifies task with progress > 0 and no deliverables as IN_PROGRESS', () => {
      const result = classifyOverdueTask({
        status: 'OVERDUE',
        progress: 45,
        deliverablesCount: 0,
        hasActivityLog: false,
        isSubmittedForApproval: false,
      });

      assert.equal(result.targetLifecycle, 'IN_PROGRESS');
      assert.equal(result.isOverdue, true);
      assert.match(result.reason, /Rule 2/);
    });

    it('classifies task with progress=0 but hasActivityLog=true as IN_PROGRESS', () => {
      const result = classifyOverdueTask({
        status: 'OVERDUE',
        progress: 0,
        deliverablesCount: 0,
        hasActivityLog: true,
        isSubmittedForApproval: false,
      });

      assert.equal(result.targetLifecycle, 'IN_PROGRESS');
      assert.equal(result.isOverdue, true);
      assert.match(result.reason, /Rule 2/);
    });

    it('classifies task with progress > 0 and hasActivityLog=true as IN_PROGRESS', () => {
      const result = classifyOverdueTask({
        status: 'OVERDUE',
        progress: 80,
        hasActivityLog: true,
        deliverablesCount: 0,
        isSubmittedForApproval: false,
      });

      assert.equal(result.targetLifecycle, 'IN_PROGRESS');
      assert.equal(result.isOverdue, true);
    });
  });

  // Branch 3: NOT_STARTED
  describe('Rule 3: Zero Progress, No Activity, No Deliverables -> NOT_STARTED', () => {
    it('classifies unstarted task as NOT_STARTED', () => {
      const result = classifyOverdueTask({
        status: 'OVERDUE',
        progress: 0,
        deliverablesCount: 0,
        hasActivityLog: false,
        isSubmittedForApproval: false,
      });

      assert.equal(result.targetLifecycle, 'NOT_STARTED');
      assert.equal(result.isOverdue, true);
      assert.match(result.reason, /Rule 3/);
    });

    it('classifies unstarted task with default values as NOT_STARTED', () => {
      const result = classifyOverdueTask({
        status: 'OVERDUE',
        progress: 0,
      });

      assert.equal(result.targetLifecycle, 'NOT_STARTED');
      assert.equal(result.isOverdue, true);
      assert.match(result.reason, /Rule 3/);
    });
  });

  // Branch 4: MANUAL_REMEDIATION (Ambiguous / Conflicting / Anomalies)
  describe('Rule 4: Ambiguous and Conflicting States -> MANUAL_REMEDIATION', () => {
    it('flags task with missing all signals as MANUAL_REMEDIATION', () => {
      const result = classifyOverdueTask({
        status: 'OVERDUE',
      });

      assert.equal(result.targetLifecycle, 'MANUAL_REMEDIATION');
      assert.equal(result.isOverdue, true);
      assert.match(result.reason, /Rule 4/);
      assert.match(result.reason, /insufficient data signals/i);
    });

    it('flags task with negative progress as MANUAL_REMEDIATION', () => {
      const result = classifyOverdueTask({
        status: 'OVERDUE',
        progress: -20,
      });

      assert.equal(result.targetLifecycle, 'MANUAL_REMEDIATION');
      assert.equal(result.isOverdue, true);
      assert.match(result.reason, /out of range/i);
    });

    it('flags task with progress > 100 as MANUAL_REMEDIATION', () => {
      const result = classifyOverdueTask({
        status: 'OVERDUE',
        progress: 150,
      });

      assert.equal(result.targetLifecycle, 'MANUAL_REMEDIATION');
      assert.equal(result.isOverdue, true);
      assert.match(result.reason, /out of range/i);
    });

    it('flags task with NaN progress as MANUAL_REMEDIATION', () => {
      const result = classifyOverdueTask({
        status: 'OVERDUE',
        progress: Number.NaN,
      });

      assert.equal(result.targetLifecycle, 'MANUAL_REMEDIATION');
      assert.equal(result.isOverdue, true);
      assert.match(result.reason, /NaN/i);
    });

    it('flags task with negative deliverablesCount as MANUAL_REMEDIATION', () => {
      const result = classifyOverdueTask({
        status: 'OVERDUE',
        deliverablesCount: -1,
      });

      assert.equal(result.targetLifecycle, 'MANUAL_REMEDIATION');
      assert.equal(result.isOverdue, true);
      assert.match(result.reason, /deliverablesCount/i);
    });

    it('flags non-OVERDUE status as MANUAL_REMEDIATION', () => {
      const result = classifyOverdueTask({
        status: 'COMPLETED',
        progress: 100,
      });

      assert.equal(result.targetLifecycle, 'MANUAL_REMEDIATION');
      assert.equal(result.isOverdue, true);
      assert.match(result.reason, /not OVERDUE/i);
    });

    it('flags task with explicit conflict indicator as MANUAL_REMEDIATION', () => {
      const result = classifyOverdueTask({
        status: 'OVERDUE',
        progress: 50,
        hasConflict: true,
      });

      assert.equal(result.targetLifecycle, 'MANUAL_REMEDIATION');
      assert.equal(result.isOverdue, true);
      assert.match(result.reason, /conflict/i);
    });

    it('flags task with conflicting termination flag as MANUAL_REMEDIATION', () => {
      const result = classifyOverdueTask({
        status: 'OVERDUE',
        progress: 50,
        isCompleted: true,
      });

      assert.equal(result.targetLifecycle, 'MANUAL_REMEDIATION');
      assert.equal(result.isOverdue, true);
      assert.match(result.reason, /Conflicting termination state/i);
    });
  });
});

describe('WI-4.3 / ADR-003: Recoverable Remediation Workflow and Invariants', () => {
  it('correctly identifies auto-recoverable lifecycles vs manual queue', () => {
    assert.equal(isAutoRecoverableLifecycle('NOT_STARTED'), true);
    assert.equal(isAutoRecoverableLifecycle('IN_PROGRESS'), true);
    assert.equal(isAutoRecoverableLifecycle('WAITING_APPROVAL'), true);
    assert.equal(isAutoRecoverableLifecycle('MANUAL_REMEDIATION'), false);
  });

  it('guarantees isOverdue=true across all classification results (Lifecycle != Attention)', () => {
    const testCases = [
      { status: 'OVERDUE', progress: 0 },
      { status: 'OVERDUE', progress: 50 },
      { status: 'OVERDUE', isSubmittedForApproval: true },
      { status: 'OVERDUE', hasConflict: true },
      { status: 'UNKNOWN' },
    ];

    for (const testCase of testCases) {
      const result = classifyOverdueTask(testCase);
      assert.equal(
        result.isOverdue,
        true,
        `Task with input ${JSON.stringify(testCase)} must preserve derived isOverdue=true`
      );
    }
  });
});

describe('WI-4.3 / ADR-003: Remediation Script Execution, Journal, and Rollback', () => {
  const tmpDir = path.join(os.tmpdir(), `qcet-remediation-test-${Date.now()}`);

  const sampleTasks = [
    {
      id: 'task-1',
      code: 'TASK-001',
      title: 'Xây dựng kế hoạch tuyển sinh',
      status: 'OVERDUE',
      progressPercent: 0,
      deliverables: [],
      taskResults: [],
      hasActivityLog: false,
    },
    {
      id: 'task-2',
      code: 'TASK-002',
      title: 'Biên soạn đề cương chi tiết',
      status: 'OVERDUE',
      progressPercent: 60,
      deliverables: [],
      taskResults: [],
      hasActivityLog: true,
    },
    {
      id: 'task-3',
      code: 'TASK-003',
      title: 'Báo cáo tổng kết quý III',
      status: 'OVERDUE',
      progressPercent: 100,
      deliverables: [{ id: 'd1' }],
      taskResults: [{ id: 'r1' }],
    },
    {
      id: 'task-4',
      code: 'TASK-004',
      title: 'Nhiệm vụ mâu thuẫn dữ liệu',
      status: 'OVERDUE',
      hasConflict: true,
      progressPercent: 50,
    },
  ];

  const fixturePath = path.join(tmpDir, 'overdue-tasks.json');

  it('sets up test fixture directory', () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(fixturePath, JSON.stringify(sampleTasks, null, 2), 'utf8');
    assert.equal(fs.existsSync(fixturePath), true);
  });

  it('runs dry-run remediation without updating data and generates journal + manual queue', async () => {
    const outputDir = path.join(tmpDir, 'reports-dry-run');

    const result = await remediateOverdueTasks({
      dryRun: true,
      inputFile: fixturePath,
      outputDir,
    });

    assert.equal(result.success, true);
    assert.equal(result.mode, 'dry-run');
    assert.equal(result.totalScanned, 4);
    assert.equal(result.remediatedCount, 3);
    assert.equal(result.countsByLifecycle.NOT_STARTED, 1);
    assert.equal(result.countsByLifecycle.IN_PROGRESS, 1);
    assert.equal(result.countsByLifecycle.WAITING_APPROVAL, 1);
    assert.equal(result.countsByLifecycle.MANUAL_REMEDIATION, 1);

    // Verify journal file exists and has correct contents
    assert.ok(result.journalPath);
    assert.equal(fs.existsSync(result.journalPath), true);
    const journalContent = JSON.parse(fs.readFileSync(result.journalPath, 'utf8'));
    assert.equal(journalContent.totalScanned, 4);
    assert.equal(journalContent.entries.length, 3);
    assert.equal(journalContent.manualQueue.length, 1);

    // Verify manual queue file exists
    assert.ok(result.manualQueuePath);
    assert.equal(fs.existsSync(result.manualQueuePath), true);
    const manualQueueContent = JSON.parse(fs.readFileSync(result.manualQueuePath, 'utf8'));
    assert.equal(manualQueueContent.totalManualQueue, 1);
    assert.equal(manualQueueContent.tasks[0].taskId, 'task-4');
  });

  it('executes remediation with mock prisma client and performs rollback cleanly', async () => {
    const outputDir = path.join(tmpDir, 'reports-execute');

    // In-memory mock database state
    const dbState = new Map<string, string>();
    for (const t of sampleTasks) {
      dbState.set(t.id, t.status);
    }

    const mockPrisma = {
      task: {
        findMany: async () => sampleTasks,
        update: async ({ where, data }: { where: { id: string }; data: { status: string } }) => {
          dbState.set(where.id, data.status);
          return { id: where.id, ...data };
        },
      },
      $transaction: async (fn: any) => {
        return fn(mockPrisma);
      },
    };

    // Step 1: Execute Remediation
    const executeResult = await remediateOverdueTasks({
      execute: true,
      dryRun: false,
      inputFile: fixturePath,
      outputDir,
      prismaClient: mockPrisma,
    });

    assert.equal(executeResult.success, true);
    assert.equal(executeResult.mode, 'execute');
    assert.equal(executeResult.remediatedCount, 3);

    // Verify DB state updated for auto-recoverable tasks
    assert.equal(dbState.get('task-1'), 'NOT_STARTED');
    assert.equal(dbState.get('task-2'), 'IN_PROGRESS');
    assert.equal(dbState.get('task-3'), 'WAITING_APPROVAL');

    // Verify ambiguous task-4 was NOT touched in DB
    assert.equal(dbState.get('task-4'), 'OVERDUE');

    // Step 2: Rollback using the generated Rollback Journal
    assert.ok(executeResult.journalPath);
    const rollbackResult = await rollbackFromJournal(
      executeResult.journalPath,
      mockPrisma
    );

    assert.equal(rollbackResult.success, true);
    assert.equal(rollbackResult.restoredCount, 3);
    assert.equal(rollbackResult.failedCount, 0);

    // Verify all tasks restored back to 'OVERDUE'
    assert.equal(dbState.get('task-1'), 'OVERDUE');
    assert.equal(dbState.get('task-2'), 'OVERDUE');
    assert.equal(dbState.get('task-3'), 'OVERDUE');
    assert.equal(dbState.get('task-4'), 'OVERDUE');
  });

  it('cleans up test directory', () => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    assert.equal(fs.existsSync(tmpDir), false);
  });
});
