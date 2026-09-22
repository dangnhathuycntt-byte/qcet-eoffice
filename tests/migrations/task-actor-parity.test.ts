/**
 * Test Suite: TaskAssignee to TaskActor Migration Track (WI-8.1 / RFC-01 / ADR-005)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AssigneeRole, TaskActorRole } from '@prisma/client';
import {
  mapAssigneeRoleToActorRole,
  syncAssigneeToActor,
  backfillTaskAssigneesToActors,
  verifyTaskAssigneeParity,
} from '@/domain/tasks/migration';

describe('WI-8.1: TaskAssignee to TaskActor Migration Track', () => {
  describe('1. Role Mapping Canonical Logic (Fail Closed)', () => {
    it('maps PRIMARY_OWNER to DRI with isPrimaryDRI=true', () => {
      const result = mapAssigneeRoleToActorRole(AssigneeRole.PRIMARY_OWNER);
      assert.strictEqual(result.role, TaskActorRole.DRI);
      assert.strictEqual(result.isPrimaryDRI, true);
    });

    it('maps COLLABORATOR to COLLABORATOR with isPrimaryDRI=false', () => {
      const result = mapAssigneeRoleToActorRole(AssigneeRole.COLLABORATOR);
      assert.strictEqual(result.role, TaskActorRole.COLLABORATOR);
      assert.strictEqual(result.isPrimaryDRI, false);
    });

    it('maps SUPERVISOR to OBSERVER with isPrimaryDRI=false', () => {
      const result = mapAssigneeRoleToActorRole(AssigneeRole.SUPERVISOR);
      assert.strictEqual(result.role, TaskActorRole.OBSERVER);
      assert.strictEqual(result.isPrimaryDRI, false);
    });

    it('FAILS CLOSED (throws error) on unknown or unsupported AssigneeRole', () => {
      assert.throws(
        () => mapAssigneeRoleToActorRole('UNKNOWN_ROLE'),
        /Unknown AssigneeRole: 'UNKNOWN_ROLE'. Migration must fail closed/
      );
      assert.throws(
        () => mapAssigneeRoleToActorRole(''),
        /Invalid AssigneeRole: role must be a non-empty string/
      );
      assert.throws(
        () => mapAssigneeRoleToActorRole(null as any),
        /Invalid AssigneeRole: role must be a non-empty string/
      );
    });
  });

  describe('2. Dual-Write Sync Functionality (syncAssigneeToActor)', () => {
    it('creates TaskActor record when non-existent and preserves timestamps', async () => {
      const createdRecords: any[] = [];
      const assignedAt = new Date('2026-09-01T10:00:00Z');
      const mockDb: any = {
        taskActor: {
          findFirst: async () => null,
          create: async ({ data }: any) => {
            const record = { id: 'actor-1', ...data };
            createdRecords.push(record);
            return record;
          },
        },
      };

      const result = await syncAssigneeToActor(mockDb, {
        id: 'assignee-1',
        taskId: 'task-100',
        userId: 'user-200',
        roleInTask: AssigneeRole.PRIMARY_OWNER,
        assignedAt,
      });

      assert.strictEqual(result.created, true);
      assert.strictEqual(result.actorId, 'actor-1');
      assert.strictEqual(createdRecords.length, 1);
      assert.strictEqual(createdRecords[0].role, TaskActorRole.DRI);
      assert.strictEqual(createdRecords[0].isPrimaryDRI, true);
      assert.deepStrictEqual(createdRecords[0].appointedAt, assignedAt);
    });

    it('preserves Single Primary DRI: does not set second user as primary DRI if task already has one', async () => {
      const createdRecords: any[] = [];
      const mockDb: any = {
        taskActor: {
          findFirst: async ({ where }: any) => {
            if (where.isPrimaryDRI) {
              return { id: 'actor-existing-dri', userId: 'user-first' };
            }
            return null;
          },
          create: async ({ data }: any) => {
            const record = { id: 'actor-second', ...data };
            createdRecords.push(record);
            return record;
          },
        },
      };

      const result = await syncAssigneeToActor(mockDb, {
        taskId: 'task-100',
        userId: 'user-second',
        roleInTask: AssigneeRole.PRIMARY_OWNER,
      });

      assert.strictEqual(result.created, true);
      assert.strictEqual(createdRecords[0].isPrimaryDRI, false); // Demoted to preserve single primary DRI
    });

    it('returns existing TaskActor without duplicate creation (idempotent)', async () => {
      const mockDb: any = {
        taskActor: {
          findFirst: async () => ({
            id: 'actor-existing',
            taskId: 'task-100',
            userId: 'user-200',
            role: TaskActorRole.DRI,
            isPrimaryDRI: true,
          }),
        },
      };

      const result = await syncAssigneeToActor(mockDb, {
        taskId: 'task-100',
        userId: 'user-200',
        roleInTask: AssigneeRole.PRIMARY_OWNER,
      });

      assert.strictEqual(result.created, false);
      assert.strictEqual(result.actorId, 'actor-existing');
    });
  });

  describe('3. Batch Backfill Execution (backfillTaskAssigneesToActors)', () => {
    it('dryRun scans records without writing to TaskActor', async () => {
      const mockAssignees = [
        { id: 'asg-1', taskId: 'task-1', userId: 'user-1', roleInTask: AssigneeRole.PRIMARY_OWNER },
        { id: 'asg-2', taskId: 'task-1', userId: 'user-2', roleInTask: AssigneeRole.COLLABORATOR },
      ];

      let writeAttempted = false;
      const mockDb: any = {
        taskAssignee: {
          findMany: async () => mockAssignees,
        },
        taskActor: {
          findFirst: async () => null,
          create: async () => {
            writeAttempted = true;
          },
        },
      };

      const stats = await backfillTaskAssigneesToActors(mockDb, { dryRun: true });
      assert.strictEqual(writeAttempted, false);
      assert.strictEqual(stats.totalProcessed, 2);
      assert.strictEqual(stats.created, 2);
      assert.strictEqual(stats.skipped, 0);
    });

    it('fails closed and records error when encountering corrupt role data', async () => {
      const mockAssignees = [
        { id: 'asg-corrupt', taskId: 'task-1', userId: 'user-1', roleInTask: 'INVALID_ROLE' as any },
      ];

      const mockDb: any = {
        taskAssignee: {
          findMany: async () => mockAssignees,
        },
        taskActor: {
          findFirst: async () => null,
        },
      };

      const stats = await backfillTaskAssigneesToActors(mockDb, { dryRun: false });
      assert.strictEqual(stats.totalProcessed, 1);
      assert.strictEqual(stats.created, 0);
      assert.strictEqual(stats.errors, 1);
      assert.strictEqual(stats.errorDetails[0].assigneeId, 'asg-corrupt');
    });
  });

  describe('4. Parity Verification (verifyTaskAssigneeParity)', () => {
    it('confirms 100% parity when all assignees have matching actors and single DRI is preserved', async () => {
      const mockAssignees = [
        { id: 'asg-1', taskId: 'task-1', userId: 'user-1', roleInTask: AssigneeRole.PRIMARY_OWNER },
        { id: 'asg-2', taskId: 'task-1', userId: 'user-2', roleInTask: AssigneeRole.COLLABORATOR },
      ];

      const mockDb: any = {
        taskAssignee: {
          findMany: async () => mockAssignees,
        },
        taskActor: {
          findFirst: async () => ({ id: 'actor-matched' }),
          groupBy: async () => [], // No tasks with multiple DRIs
        },
      };

      const parity = await verifyTaskAssigneeParity(mockDb);
      assert.strictEqual(parity.isParityMatched, true);
      assert.strictEqual(parity.totalAssignees, 2);
      assert.strictEqual(parity.totalMatchedActors, 2);
      assert.strictEqual(parity.unmatchedAssigneeIds.length, 0);
      assert.strictEqual(parity.tasksWithMultipleDRIs.length, 0);
    });

    it('detects multiple DRIs on a single task as disparity', async () => {
      const mockAssignees = [
        { id: 'asg-1', taskId: 'task-1', userId: 'user-1', roleInTask: AssigneeRole.PRIMARY_OWNER },
      ];

      const mockDb: any = {
        taskAssignee: {
          findMany: async () => mockAssignees,
        },
        taskActor: {
          findFirst: async () => ({ id: 'actor-1' }),
          groupBy: async () => [{ taskId: 'task-1' }], // Multiple DRIs on task-1!
        },
      };

      const parity = await verifyTaskAssigneeParity(mockDb);
      assert.strictEqual(parity.isParityMatched, false);
      assert.deepStrictEqual(parity.tasksWithMultipleDRIs, ['task-1']);
    });
  });
});
