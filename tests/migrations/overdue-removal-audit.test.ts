/**
 * Test Suite: OVERDUE Enum Removal Pre-flight Audit & Verification (WI-8.4 / ADR-003)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  auditTaskStatusOverdue,
  assertZeroActiveOverdueTasks,
  verifyStatusNormalizersAttentionSeparation,
} from '@/domain/tasks/remediation';

describe('WI-8.4: OVERDUE Enum Removal Pre-flight Audit', () => {
  describe('1. verifyStatusNormalizersAttentionSeparation', () => {
    it('confirms canonical normalizers separate lifecycle from attention', () => {
      const verification = verifyStatusNormalizersAttentionSeparation();
      assert.strictEqual(verification.canonicalNormalizerPasses, true);
      // ADR-003: mapDbStatusToLifecycle('OVERDUE') returns 'OVERDUE' (passthrough) → stateMachineNormalizerPasses = false
      assert.strictEqual(verification.stateMachineNormalizerPasses, false);
    });
  });

  describe('2. auditTaskStatusOverdue', () => {
    it('returns isSafeForEnumRemoval=true when 0 tasks have status OVERDUE', async () => {
      const mockDb: any = {
        task: {
          findMany: async () => [], // No overdue tasks
        },
      };

      const audit = await auditTaskStatusOverdue(mockDb);
      assert.strictEqual(audit.isSafeForEnumRemoval, true);
      assert.strictEqual(audit.totalTasksWithOverdueStatus, 0);
      assert.strictEqual(audit.tasksToRemediate.length, 0);
    });

    it('returns isSafeForEnumRemoval=false and classifies tasks when OVERDUE tasks exist', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          code: 'NV-001',
          title: 'Nhiệm vụ đang dở',
          status: 'OVERDUE',
          progressPercent: 40,
          version: 2,
          deliverables: [],
        },
        {
          id: 'task-2',
          code: 'NV-002',
          title: 'Nhiệm vụ chưa bắt đầu',
          status: 'OVERDUE',
          progressPercent: 0,
          version: 1,
          deliverables: [],
        },
      ];

      const mockDb: any = {
        task: {
          findMany: async () => mockTasks,
        },
      };

      const audit = await auditTaskStatusOverdue(mockDb);
      assert.strictEqual(audit.isSafeForEnumRemoval, false);
      assert.strictEqual(audit.totalTasksWithOverdueStatus, 2);
      assert.strictEqual(audit.tasksToRemediate.length, 2);

      // Task 1 with progress 40% -> IN_PROGRESS
      assert.strictEqual(audit.tasksToRemediate[0].recommendation.targetLifecycle, 'IN_PROGRESS');
      assert.strictEqual(audit.tasksToRemediate[0].recommendation.isOverdue, true);

      // Task 2 with progress 0% -> NOT_STARTED
      assert.strictEqual(audit.tasksToRemediate[1].recommendation.targetLifecycle, 'NOT_STARTED');
      assert.strictEqual(audit.tasksToRemediate[1].recommendation.isOverdue, true);
    });
  });

  describe('3. assertZeroActiveOverdueTasks', () => {
    it('throws error when active OVERDUE tasks are found', async () => {
      const mockDb: any = {
        task: {
          findMany: async () => [{ id: 'task-1', status: 'OVERDUE', progressPercent: 10, version: 2, deliverables: [] }],
        },
      };

      await assert.rejects(
        () => assertZeroActiveOverdueTasks(mockDb),
        /Cannot remove OVERDUE from TaskStatus enum: 1 tasks still have status='OVERDUE'/
      );
    });

    it('does not throw when zero OVERDUE tasks exist', async () => {
      const mockDb: any = {
        task: {
          findMany: async () => [],
        },
      };

      await assert.doesNotThrow(() => assertZeroActiveOverdueTasks(mockDb));
    });
  });
});
