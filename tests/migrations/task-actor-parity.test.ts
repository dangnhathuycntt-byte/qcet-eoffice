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
      assert.strictEqual(result.requiresContextResolution, false);
    });

    it('maps COLLABORATOR to COLLABORATOR with isPrimaryDRI=false', () => {
      const result = mapAssigneeRoleToActorRole(AssigneeRole.COLLABORATOR);
      assert.strictEqual(result.role, TaskActorRole.COLLABORATOR);
      assert.strictEqual(result.isPrimaryDRI, false);
      assert.strictEqual(result.requiresContextResolution, false);
    });

    it('maps SUPERVISOR to OBSERVER sentinel with requiresContextResolution=true', () => {
      const result = mapAssigneeRoleToActorRole(AssigneeRole.SUPERVISOR);
      assert.strictEqual(result.role, TaskActorRole.OBSERVER);
      assert.strictEqual(result.isPrimaryDRI, false);
      assert.strictEqual(result.requiresContextResolution, true);
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
        task: {
          findUnique: async () => ({ createdAt: new Date('2026-01-01') }),
        },
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
        // no assignedAt to exercise task.createdAt fallback path
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

    it('FIX 1: SUPERVISOR maps to REVIEWER when task has approvalProcesses', async () => {
      const createdRecords: any[] = [];
      const mockDb: any = {
        task: {
          findUnique: async ({ where }: any) => {
            if (where.id === 'task-100') {
              return {
                approvalProcesses: [{ id: 'ap-1' }],
                deliverables: [],
              };
            }
            return null;
          },
        },
        taskActor: {
          findFirst: async () => null,
          create: async ({ data }: any) => {
            const record = { id: 'actor-supervisor', ...data };
            createdRecords.push(record);
            return record;
          },
        },
      };

      const result = await syncAssigneeToActor(mockDb, {
        id: 'assignee-sup',
        taskId: 'task-100',
        userId: 'user-sup',
        roleInTask: AssigneeRole.SUPERVISOR,
        assignedAt: new Date('2026-09-01T08:00:00Z'),
      });

      assert.strictEqual(result.created, true);
      assert.strictEqual(createdRecords[0].role, TaskActorRole.REVIEWER);
      assert.strictEqual(createdRecords[0].isPrimaryDRI, false);
    });

    it('FIX 1: SUPERVISOR maps to OBSERVER when task has no approvalProcesses or deliverables', async () => {
      const createdRecords: any[] = [];
      const mockDb: any = {
        task: {
          findUnique: async () => ({
            approvalProcesses: [],
            deliverables: [],
          }),
        },
        taskActor: {
          findFirst: async () => null,
          create: async ({ data }: any) => {
            const record = { id: 'actor-observer', ...data };
            createdRecords.push(record);
            return record;
          },
        },
      };

      const result = await syncAssigneeToActor(mockDb, {
        id: 'assignee-sup',
        taskId: 'task-100',
        userId: 'user-sup',
        roleInTask: AssigneeRole.SUPERVISOR,
        assignedAt: new Date('2026-09-01T08:00:00Z'),
      });

      assert.strictEqual(result.created, true);
      assert.strictEqual(createdRecords[0].role, TaskActorRole.OBSERVER);
    });

    it('FIX 1: SUPERVISOR maps to REVIEWER when task has deliverables', async () => {
      const createdRecords: any[] = [];
      const mockDb: any = {
        task: {
          findUnique: async () => ({
            approvalProcesses: [],
            deliverables: [{ id: 'del-1' }],
          }),
        },
        taskActor: {
          findFirst: async () => null,
          create: async ({ data }: any) => {
            const record = { id: 'actor-reviewer', ...data };
            createdRecords.push(record);
            return record;
          },
        },
      };

      await syncAssigneeToActor(mockDb, {
        id: 'assignee-sup',
        taskId: 'task-100',
        userId: 'user-sup',
        roleInTask: AssigneeRole.SUPERVISOR,
        assignedAt: new Date('2026-09-01T08:00:00Z'),
      });

      assert.strictEqual(createdRecords[0].role, TaskActorRole.REVIEWER);
    });

    it('FIX 3: appointedAt falls back to task.createdAt when assignee.assignedAt is null', async () => {
      const taskCreatedAt = new Date('2026-08-01T00:00:00Z');
      const createdRecords: any[] = [];
      const mockDb: any = {
        task: {
          findUnique: async () => ({ createdAt: taskCreatedAt }),
        },
        taskActor: {
          findFirst: async () => null,
          create: async ({ data }: any) => {
            const record = { id: 'actor-fallback', ...data };
            createdRecords.push(record);
            return record;
          },
        },
      };

      await syncAssigneeToActor(mockDb, {
        id: 'assignee-no-date',
        taskId: 'task-100',
        userId: 'user-200',
        roleInTask: AssigneeRole.PRIMARY_OWNER,
        // no assignedAt
      });

      assert.deepStrictEqual(createdRecords[0].appointedAt, taskCreatedAt);
    });
  });

  describe('3. Batch Backfill Execution (backfillTaskAssigneesToActors)', () => {
    it('dryRun scans records without writing to TaskActor', async () => {
      const mockAssignees = [
        { id: 'asg-1', taskId: 'task-1', userId: 'user-1', roleInTask: AssigneeRole.PRIMARY_OWNER, assignedAt: new Date('2026-01-01') },
        { id: 'asg-2', taskId: 'task-1', userId: 'user-2', roleInTask: AssigneeRole.COLLABORATOR, assignedAt: new Date('2026-01-02') },
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
        { id: 'asg-corrupt', taskId: 'task-1', userId: 'user-1', roleInTask: 'INVALID_ROLE' as any, assignedAt: new Date() },
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

    it('FIX 2: most recent PRIMARY_OWNER (latest assignedAt) becomes DRI; earlier ones downgrade to COLLABORATOR', async () => {
      // Ordered by assignedAt ASC from DB; the last one (asg-2) is the designated DRI
      const mockAssignees = [
        { id: 'asg-1', taskId: 'task-1', userId: 'user-1', roleInTask: AssigneeRole.PRIMARY_OWNER, assignedAt: new Date('2026-01-01') },
        { id: 'asg-2', taskId: 'task-1', userId: 'user-2', roleInTask: AssigneeRole.PRIMARY_OWNER, assignedAt: new Date('2026-06-01') },
      ];

      const createdRecords: any[] = [];
      const mockDb: any = {
        taskAssignee: {
          findMany: async () => mockAssignees,
        },
        taskActor: {
          findFirst: async ({ where }: any) => {
            if (where.isPrimaryDRI) {
              // No existing DRI in TaskActor yet
              return null;
            }
            return null;
          },
          create: async ({ data }: any) => {
            const record = { id: `actor-${createdRecords.length}`, ...data };
            createdRecords.push(record);
            return record;
          },
        },
      };

      const stats = await backfillTaskAssigneesToActors(mockDb, { dryRun: false });
      assert.strictEqual(stats.created, 2);
      assert.strictEqual(stats.errors, 0);

      // asg-1 (earlier) should be COLLABORATOR with isPrimaryDRI=false
      const record1 = createdRecords.find((r) => r.userId === 'user-1');
      assert.strictEqual(record1.role, TaskActorRole.COLLABORATOR);
      assert.strictEqual(record1.isPrimaryDRI, false);

      // asg-2 (latest) should be DRI with isPrimaryDRI=true
      const record2 = createdRecords.find((r) => r.userId === 'user-2');
      assert.strictEqual(record2.role, TaskActorRole.DRI);
      assert.strictEqual(record2.isPrimaryDRI, true);
    });

    it('FIX 1: SUPERVISOR in batch maps to REVIEWER when task has approvalProcesses', async () => {
      const mockAssignees = [
        { id: 'asg-sup', taskId: 'task-1', userId: 'user-sup', roleInTask: AssigneeRole.SUPERVISOR, assignedAt: new Date('2026-01-01') },
      ];

      const createdRecords: any[] = [];
      const mockDb: any = {
        task: {
          findUnique: async () => ({
            createdAt: new Date('2025-12-01'),
            approvalProcesses: [{ id: 'ap-1' }],
            deliverables: [],
          }),
        },
        taskAssignee: {
          findMany: async () => mockAssignees,
        },
        taskActor: {
          findFirst: async () => null,
          create: async ({ data }: any) => {
            const record = { id: 'actor-sup', ...data };
            createdRecords.push(record);
            return record;
          },
        },
      };

      const stats = await backfillTaskAssigneesToActors(mockDb, { dryRun: false });
      assert.strictEqual(stats.created, 1);
      assert.strictEqual(createdRecords[0].role, TaskActorRole.REVIEWER);
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
          findMany: async () => [], // No migrated actors to reverse-check
          groupBy: async () => [], // No tasks with multiple DRIs
        },
      };

      const parity = await verifyTaskAssigneeParity(mockDb);
      assert.strictEqual(parity.isParityMatched, true);
      assert.strictEqual(parity.totalAssignees, 2);
      assert.strictEqual(parity.totalMatchedActors, 2);
      assert.strictEqual(parity.unmatchedAssigneeIds.length, 0);
      assert.strictEqual(parity.tasksWithMultipleDRIs.length, 0);
      assert.strictEqual(parity.unmatchedActorIds.length, 0);
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
          findMany: async () => [], // No migrated actors to reverse-check
          groupBy: async () => [{ taskId: 'task-1' }], // Multiple DRIs on task-1!
        },
      };

      const parity = await verifyTaskAssigneeParity(mockDb);
      assert.strictEqual(parity.isParityMatched, false);
      assert.deepStrictEqual(parity.tasksWithMultipleDRIs, ['task-1']);
    });

    it('FIX 4: detects orphaned migrated actor (TaskAssignee was deleted after backfill)', async () => {
      const mockDb: any = {
        taskAssignee: {
          findMany: async () => [], // No assignees remaining
          findFirst: async () => null, // Assignee no longer exists
        },
        taskActor: {
          findFirst: async () => null,
          findMany: async () => [
            {
              id: 'actor-orphan',
              taskId: 'task-1',
              userId: 'user-1',
              role: TaskActorRole.DRI,
              notes: 'Migrated from TaskAssignee [asg-deleted]',
            },
          ],
          groupBy: async () => [],
        },
      };

      const parity = await verifyTaskAssigneeParity(mockDb);
      assert.strictEqual(parity.isParityMatched, false);
      assert.deepStrictEqual(parity.unmatchedActorIds, ['actor-orphan']);
    });

    it('FIX 4: reports no unmatchedActorIds when all migrated actors have corresponding assignees', async () => {
      const mockAssignees = [
        { id: 'asg-1', taskId: 'task-1', userId: 'user-1', roleInTask: AssigneeRole.PRIMARY_OWNER },
      ];

      const mockDb: any = {
        taskAssignee: {
          findMany: async () => mockAssignees,
          findFirst: async ({ where }: any) => {
            if (where.id === 'asg-1') return { id: 'asg-1' };
            return null;
          },
        },
        taskActor: {
          findFirst: async () => ({ id: 'actor-1' }),
          findMany: async () => [
            {
              id: 'actor-1',
              taskId: 'task-1',
              userId: 'user-1',
              role: TaskActorRole.DRI,
              notes: 'Migrated from TaskAssignee [asg-1]',
            },
          ],
          groupBy: async () => [],
        },
      };

      const parity = await verifyTaskAssigneeParity(mockDb);
      assert.strictEqual(parity.isParityMatched, true);
      assert.strictEqual(parity.unmatchedActorIds.length, 0);
    });

    it('FIX 1: SUPERVISOR parity check accepts REVIEWER or OBSERVER as valid match', async () => {
      const mockAssignees = [
        { id: 'asg-sup', taskId: 'task-1', userId: 'user-sup', roleInTask: AssigneeRole.SUPERVISOR },
      ];

      const mockDb: any = {
        taskAssignee: {
          findMany: async () => mockAssignees,
        },
        taskActor: {
          findFirst: async ({ where }: any) => {
            // Matches when role is REVIEWER or OBSERVER
            if (where.role?.in) {
              return { id: 'actor-reviewer' };
            }
            return null;
          },
          findMany: async () => [],
          groupBy: async () => [],
        },
      };

      const parity = await verifyTaskAssigneeParity(mockDb);
      assert.strictEqual(parity.isParityMatched, true);
      assert.strictEqual(parity.totalMatchedActors, 1);
      assert.strictEqual(parity.unmatchedAssigneeIds.length, 0);
    });
  });
});
