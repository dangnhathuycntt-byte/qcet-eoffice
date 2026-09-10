import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import {
  ConcurrencyConflictError,
  updateWithOCC,
  updateTaskWithOCC,
  updateDocumentWithOCC,
  updateDacumDelegationWithOCC,
  updateDocumentDirectiveWithOCC,
} from '../src/lib/db/occ';

describe('Task 6: Optimistic Concurrency Control (OCC)', () => {
  const testPrefix = 'TEST-OCC-' + Date.now();
  let testUserId: string;

  before(async () => {
    // Find or create test user for task creation
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: `occ_test_user_${Date.now()}@qncet.edu.vn`,
          name: 'OCC Test User',
          role: 'CHUYEN_VIEN',
        },
      });
    }
    testUserId = user.id;
  });

  after(async () => {
    // Clean up all tasks created during this test run
    await prisma.task.deleteMany({
      where: { code: { startsWith: testPrefix } },
    });
  });

  describe('1. Schema Verification: Version Field on Core Entities', () => {
    const modelsToCheck = ['Task', 'Document', 'DacumDelegation', 'DocumentDirective'];

    for (const modelName of modelsToCheck) {
      test(`model ${modelName} contains version Int field with default 1 and mapped to "version"`, () => {
        const model = Prisma.dmmf.datamodel.models.find((m) => m.name === modelName);
        assert.ok(model, `Prisma DMMF should contain model ${modelName}`);

        const versionField = model.fields.find((f) => f.name === 'version');
        assert.ok(versionField, `Model ${modelName} must have a "version" field`);
        assert.strictEqual(versionField.type, 'Int', `Model ${modelName}.version must be of type Int`);
        assert.strictEqual(versionField.isRequired, true, `Model ${modelName}.version must be required`);
        assert.strictEqual(versionField.hasDefaultValue, true, `Model ${modelName}.version must have default value`);
        assert.strictEqual(versionField.default, 1, `Model ${modelName}.version default must be 1`);
        assert.strictEqual(versionField.dbName, 'version', `Model ${modelName}.version dbName must be mapped to "version"`);
      });
    }
  });

  describe('2. ConcurrencyConflictError Specification', () => {
    test('instantiates with 409 status and CONCURRENCY_CONFLICT code via parameter object', () => {
      const err = new ConcurrencyConflictError({
        entity: 'Task',
        id: 'task-123',
        expectedVersion: 1,
        actualVersion: 2,
      });

      assert.ok(err instanceof Error);
      assert.ok(err instanceof ConcurrencyConflictError);
      assert.strictEqual(err.status, 409);
      assert.strictEqual(err.statusCode, 409);
      assert.strictEqual(err.code, 'CONCURRENCY_CONFLICT');
      assert.strictEqual(err.entity, 'Task');
      assert.strictEqual(err.entityId, 'task-123');
      assert.strictEqual(err.id, 'task-123');
      assert.strictEqual(err.expectedVersion, 1);
      assert.strictEqual(err.actualVersion, 2);
      assert.match(err.message, /Concurrency conflict on Task/);
      assert.match(err.message, /expected version 1/);
      assert.match(err.message, /found version 2/);
    });

    test('instantiates with positional arguments and handles null actualVersion', () => {
      const err = new ConcurrencyConflictError('Document', 'doc-456', 3, null);

      assert.strictEqual(err.status, 409);
      assert.strictEqual(err.code, 'CONCURRENCY_CONFLICT');
      assert.strictEqual(err.entity, 'Document');
      assert.strictEqual(err.entityId, 'doc-456');
      assert.strictEqual(err.expectedVersion, 3);
      assert.strictEqual(err.actualVersion, null);
      assert.match(err.message, /record was not found or has been modified/);
    });
  });

  describe('3. Functional OCC Updates on Task', () => {
    test('succeeds when version matches expectedVersion and increments version token', async () => {
      const task = await prisma.task.create({
        data: {
          code: `${testPrefix}-01`,
          title: 'Initial Title',
          academicMonth: 9,
          academicYear: '2026-2027',
          dueDate: new Date(),
          createdById: testUserId,
        },
      });

      assert.strictEqual(task.version, 1, 'Newly created task must start with version = 1');

      // Update with matching version 1 -> 2
      const updated = await updateWithOCC(prisma, 'Task', task.id, 1, {
        title: 'Updated Title V2',
      });

      assert.strictEqual(updated.title, 'Updated Title V2');
      assert.strictEqual(updated.version, 2, 'Version must be incremented to 2');

      // Verify in database
      const reloaded = await prisma.task.findUnique({ where: { id: task.id } });
      assert.strictEqual(reloaded?.version, 2);
      assert.strictEqual(reloaded?.title, 'Updated Title V2');
    });

    test('throws ConcurrencyConflictError (HTTP 409) when attempting update with stale version', async () => {
      const task = await prisma.task.create({
        data: {
          code: `${testPrefix}-02`,
          title: 'Stale Check Title',
          academicMonth: 9,
          academicYear: '2026-2027',
          dueDate: new Date(),
          createdById: testUserId,
        },
      });

      // Update 1: version goes from 1 -> 2
      await updateWithOCC(prisma, 'Task', task.id, 1, {
        title: 'First Valid Update',
      });

      // Attempt stale update with expectedVersion = 1 (current is 2)
      await assert.rejects(
        async () => {
          await updateWithOCC(prisma, 'Task', task.id, 1, {
            title: 'Stale Overwrite Attempt',
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ConcurrencyConflictError, 'Must throw ConcurrencyConflictError');
          assert.strictEqual(err.status, 409);
          assert.strictEqual(err.code, 'CONCURRENCY_CONFLICT');
          assert.strictEqual(err.entity, 'Task');
          assert.strictEqual(err.entityId, task.id);
          assert.strictEqual(err.expectedVersion, 1);
          assert.strictEqual(err.actualVersion, 2);
          return true;
        }
      );

      // Verify task in database was NOT changed by the rejected stale update
      const unmodified = await prisma.task.findUnique({ where: { id: task.id } });
      assert.strictEqual(unmodified?.title, 'First Valid Update');
      assert.strictEqual(unmodified?.version, 2);
    });

    test('updateTaskWithOCC helper operates identically with type safety', async () => {
      const task = await prisma.task.create({
        data: {
          code: `${testPrefix}-03`,
          title: 'Typed Helper Title',
          academicMonth: 9,
          academicYear: '2026-2027',
          dueDate: new Date(),
          createdById: testUserId,
        },
      });

      // Success with helper
      const updated = await updateTaskWithOCC(prisma, task.id, 1, {
        title: 'Helper Updated Title',
      });

      assert.strictEqual(updated.version, 2);
      assert.strictEqual(updated.title, 'Helper Updated Title');

      // Stale attempt with helper
      await assert.rejects(
        async () => {
          await updateTaskWithOCC(prisma, task.id, 1, {
            title: 'Helper Stale Title',
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ConcurrencyConflictError);
          assert.strictEqual(err.status, 409);
          assert.strictEqual(err.expectedVersion, 1);
          assert.strictEqual(err.actualVersion, 2);
          return true;
        }
      );
    });

    test('updateWithOCC supports options object syntax', async () => {
      const task = await prisma.task.create({
        data: {
          code: `${testPrefix}-04`,
          title: 'Options Object Title',
          academicMonth: 9,
          academicYear: '2026-2027',
          dueDate: new Date(),
          createdById: testUserId,
        },
      });

      const updated = await updateWithOCC({
        client: prisma,
        model: 'Task',
        id: task.id,
        expectedVersion: 1,
        data: { title: 'Updated via Options' },
      });

      assert.strictEqual(updated.version, 2);
      assert.strictEqual(updated.title, 'Updated via Options');
    });

    test('rejects update for non-existent record with ConcurrencyConflictError', async () => {
      const nonExistentId = 'non-existent-task-id-9999';

      await assert.rejects(
        async () => {
          await updateWithOCC(prisma, 'Task', nonExistentId, 1, {
            title: 'Ghost Update',
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ConcurrencyConflictError);
          assert.strictEqual(err.status, 409);
          assert.strictEqual(err.entityId, nonExistentId);
          assert.strictEqual(err.actualVersion, null);
          return true;
        }
      );
    });
  });

  describe('4. Interactive Transaction (tx) Integration', () => {
    test('executes OCC update within an interactive transaction', async () => {
      const task = await prisma.task.create({
        data: {
          code: `${testPrefix}-05`,
          title: 'Tx Title',
          academicMonth: 9,
          academicYear: '2026-2027',
          dueDate: new Date(),
          createdById: testUserId,
        },
      });

      // Execute within prisma.$transaction
      const result = await prisma.$transaction(async (tx) => {
        return updateWithOCC(tx, 'Task', task.id, 1, {
          title: 'Committed in Transaction',
        });
      });

      assert.strictEqual(result.version, 2);
      assert.strictEqual(result.title, 'Committed in Transaction');

      const reloaded = await prisma.task.findUnique({ where: { id: task.id } });
      assert.strictEqual(reloaded?.version, 2);
      assert.strictEqual(reloaded?.title, 'Committed in Transaction');
    });

    test('rolls back OCC increment if transaction throws an error', async () => {
      const task = await prisma.task.create({
        data: {
          code: `${testPrefix}-06`,
          title: 'Rollback Test Title',
          academicMonth: 9,
          academicYear: '2026-2027',
          dueDate: new Date(),
          createdById: testUserId,
        },
      });

      await assert.rejects(async () => {
        await prisma.$transaction(async (tx) => {
          await updateWithOCC(tx, 'Task', task.id, 1, {
            title: 'Should Roll Back',
          });
          throw new Error('Simulated transaction failure');
        });
      });

      // Confirm version remained 1 and title was not updated
      const current = await prisma.task.findUnique({ where: { id: task.id } });
      assert.strictEqual(current?.version, 1);
      assert.strictEqual(current?.title, 'Rollback Test Title');
    });
  });

  describe('5. Concurrent Update Race Condition Defense', () => {
    test('when two operations concurrently attempt to update version 1, exactly ONE wins and the other receives 409', async () => {
      const task = await prisma.task.create({
        data: {
          code: `${testPrefix}-07`,
          title: 'Race Condition Test',
          academicMonth: 9,
          academicYear: '2026-2027',
          dueDate: new Date(),
          createdById: testUserId,
        },
      });

      assert.strictEqual(task.version, 1);

      // Launch two concurrent updates targeting expectedVersion = 1 simultaneously
      const promiseA = updateWithOCC(prisma, 'Task', task.id, 1, { title: 'Update From Worker A' });
      const promiseB = updateWithOCC(prisma, 'Task', task.id, 1, { title: 'Update From Worker B' });

      const results = await Promise.allSettled([promiseA, promiseB]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent update must succeed');
      assert.strictEqual(rejected.length, 1, 'Exactly one concurrent update must fail with conflict');

      const failedReason = (rejected[0] as PromiseRejectedResult).reason;
      assert.ok(
        failedReason instanceof ConcurrencyConflictError,
        'Rejected error must be ConcurrencyConflictError'
      );
      assert.strictEqual(failedReason.status, 409);
      assert.strictEqual(failedReason.code, 'CONCURRENCY_CONFLICT');
      assert.strictEqual(failedReason.expectedVersion, 1);
      assert.strictEqual(failedReason.actualVersion, 2);

      // Verify final database record is at version 2 with winner title
      const finalRecord = await prisma.task.findUnique({ where: { id: task.id } });
      assert.strictEqual(finalRecord?.version, 2);
      const winner = (fulfilled[0] as PromiseFulfilledResult<any>).value;
      assert.strictEqual(finalRecord?.title, winner.title);
    });

    test('multiple parallel updates: only first succeeds, all others reject', async () => {
      const task = await prisma.task.create({
        data: {
          code: `${testPrefix}-08`,
          title: 'Multi-Race Condition Test',
          academicMonth: 9,
          academicYear: '2026-2027',
          dueDate: new Date(),
          createdById: testUserId,
        },
      });

      const workerCount = 5;
      const promises = Array.from({ length: workerCount }, (_, i) =>
        updateWithOCC(prisma, 'Task', task.id, 1, { title: `Worker ${i} Attempt` })
      );

      const results = await Promise.allSettled(promises);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.strictEqual(fulfilled.length, 1, 'Only one worker should succeed');
      assert.strictEqual(rejected.length, workerCount - 1, 'All other workers must be rejected with 409');

      for (const rej of rejected) {
        const reason = (rej as PromiseRejectedResult).reason;
        assert.ok(reason instanceof ConcurrencyConflictError);
        assert.strictEqual(reason.status, 409);
      }
    });
  });

  describe('6. Document, DacumDelegation, and DocumentDirective Typed Helpers', () => {
    test('helpers are callable and export correct function signatures', () => {
      assert.strictEqual(typeof updateTaskWithOCC, 'function');
      assert.strictEqual(typeof updateDocumentWithOCC, 'function');
      assert.strictEqual(typeof updateDacumDelegationWithOCC, 'function');
      assert.strictEqual(typeof updateDocumentDirectiveWithOCC, 'function');
    });

    test('updateDocumentWithOCC performs OCC updates on Document entity', async () => {
      const doc = await prisma.document.create({
        data: {
          type: 'VAN_BAN_DEN',
          registrationNumber: 99998,
          documentYear: 2026,
          originalNumber: `${testPrefix}/DOC-01`,
          issuedDate: new Date(),
          issuingAuthority: 'QCET Test Office',
          category: 'Công văn',
          summary: 'Original Summary',
          registeredById: testUserId,
        },
      });

      assert.strictEqual(doc.version, 1);

      // Valid update
      const updatedDoc = await updateDocumentWithOCC(prisma, doc.id, 1, {
        summary: 'Updated Document Summary',
      });
      assert.strictEqual(updatedDoc.version, 2);
      assert.strictEqual(updatedDoc.summary, 'Updated Document Summary');

      // Stale update rejection
      await assert.rejects(
        async () => {
          await updateDocumentWithOCC(prisma, doc.id, 1, {
            summary: 'Stale Overwrite Attempt',
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ConcurrencyConflictError);
          assert.strictEqual(err.status, 409);
          assert.strictEqual(err.entity, 'Document');
          assert.strictEqual(err.entityId, doc.id);
          assert.strictEqual(err.expectedVersion, 1);
          assert.strictEqual(err.actualVersion, 2);
          return true;
        }
      );

      // Cleanup
      await prisma.document.delete({ where: { id: doc.id } });
    });
  });
});
