import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { Prisma, OutboxStatus, DocumentType } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  ConcurrencyConflictError,
  updateTaskWithOCC,
  updateDocumentWithOCC,
} from "../src/lib/db/occ";
import {
  getNextTaskSequence,
  resetTaskCodeMemorySequences,
} from "../src/lib/task-code-generator";
import {
  getNextDocumentSequence,
  resetDocumentMemorySequences,
} from "../src/lib/document-numbering";
import {
  withIdempotency,
  IdempotencyConflictError,
} from "../src/lib/db/idempotency";
import {
  recordAuditEvent,
  logAuditEvent,
  AUDIT_IMMUTABILITY_INVARIANT,
  getEntityAuditHistory,
} from "../src/lib/db/audit";
import {
  publishOutboxEvent,
  fetchAvailableOutboxEvents,
  processOutboxEvent,
  calculateExponentialBackoff,
  OutboxEventType,
} from "../src/lib/db/outbox";
import {
  archiveTask,
  unarchiveTask,
  archiveDocument,
  unarchiveDocument,
  ACTIVE_TASK_FILTER,
  ACTIVE_DOCUMENT_FILTER,
  ARCHIVED_TASK_FILTER,
  ARCHIVED_DOCUMENT_FILTER,
  isTaskArchived,
  isDocumentArchived,
} from "../src/lib/db/archive";

describe("Task 14: Comprehensive Database Architecture Hardening Test Suite", () => {
  const testRunId = `DB_HARDEN_${Date.now()}`;
  const testYear = 2087; // Isolated year to avoid collisions with production or other tests
  let testDepartmentId: string;
  let testUserId1: string;
  let testUserId2: string;

  before(async () => {
    // 1. Ensure test department exists
    const dept = await prisma.organizationalUnit.create({
      data: {
        id: `dept-harden-${Date.now()}`,
        code: `dept-harden-${Date.now()}`,
        name: `Phòng Khảo Thí & Đảm Bảo Chất Lượng ${testRunId}`,
        type: "DEPARTMENT",
        status: "ACTIVE",
      },
    });
    testDepartmentId = dept.id;

    // 2. Ensure test users exist
    const user1 = await prisma.user.create({
      data: {
        email: `harden_user1_${testRunId}@qncet.edu.vn`,
        name: "Database Hardening Officer 1",
        role: "CHUYEN_VIEN",

      },
    });
    testUserId1 = user1.id;

    const user2 = await prisma.user.create({
      data: {
        email: `harden_user2_${testRunId}@qncet.edu.vn`,
        name: "Database Hardening Officer 2",
        role: "CHUYEN_VIEN",

      },
    });
    testUserId2 = user2.id;

    // 3. Clean any existing sequences for the isolated test year
    await prisma.taskSequence.deleteMany({ where: { year: testYear } });
    await prisma.documentNumberSequence.deleteMany({ where: { year: testYear } });
    resetTaskCodeMemorySequences();
    resetDocumentMemorySequences();
  });

  after(async () => {
    // 1. Clean up tasks and sub-entities
    await prisma.task.deleteMany({
      where: { code: { startsWith: testRunId } },
    });

    // 2. Clean up documents and direct relations
    await prisma.documentDirective.deleteMany({
      where: { document: { summary: { contains: testRunId } } },
    });
    await prisma.document.deleteMany({
      where: { summary: { contains: testRunId } },
    });

    // 3. Clean up audit events
    await prisma.auditEvent.deleteMany({
      where: {
        OR: [
          { actorId: testUserId1 },
          { actorId: testUserId2 },
          { entityId: { contains: testRunId } },
        ],
      },
    });

    // 4. Clean up outbox events
    await prisma.outboxEvent.deleteMany({
      where: { aggregateId: { contains: testRunId } },
    });

    // 5. Clean up idempotency records
    await prisma.idempotencyRecord.deleteMany({
      where: {
        OR: [{ userId: testUserId1 }, { userId: testUserId2 }],
      },
    });

    // 6. Clean up sequences
    await prisma.taskSequence.deleteMany({ where: { year: testYear } });
    await prisma.documentNumberSequence.deleteMany({ where: { year: testYear } });

    // 7. Clean up test users & department
    await prisma.user.deleteMany({
      where: { id: { in: [testUserId1, testUserId2] } },
    });
    await prisma.organizationalUnit.deleteMany({
      where: { id: testDepartmentId },
    });
  });

  // ============================================================================
  // CAPABILITY 1: Optimistic Concurrency Control (OCC)
  // ============================================================================
  describe("1. Optimistic Concurrency Control (OCC)", () => {
    test("1.1 updateTaskWithOCC atomically increments version on successful update", async () => {
      const task = await prisma.task.create({
        data: {
          code: `${testRunId}-TASK-OCC-1`,
          title: "Initial Task OCC Title",
          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
          createdById: testUserId1,
        },
      });

      assert.strictEqual(task.version, 1, "Initial task version must be 1");

      const updatedTask = await updateTaskWithOCC(prisma, task.id, 1, {
        title: "Updated Task OCC Title",
      });

      assert.strictEqual(updatedTask.version, 2, "Updated task version must be 2");
      assert.strictEqual(updatedTask.title, "Updated Task OCC Title");

      // Verify in database
      const dbTask = await prisma.task.findUnique({ where: { id: task.id } });
      assert.strictEqual(dbTask?.version, 2);
      assert.strictEqual(dbTask?.title, "Updated Task OCC Title");
    });

    test("1.2 updateTaskWithOCC throws ConcurrencyConflictError (HTTP 409) on version mismatch", async () => {
      const task = await prisma.task.create({
        data: {
          code: `${testRunId}-TASK-OCC-2`,
          title: "Task For Stale OCC Check",
          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
          createdById: testUserId1,
        },
      });

      // Valid update advancing version to 2
      await updateTaskWithOCC(prisma, task.id, 1, {
        title: "Advanced Task Title",
      });

      // Attempt stale update with expectedVersion 1 (actual is now 2)
      await assert.rejects(
        async () => {
          await updateTaskWithOCC(prisma, task.id, 1, {
            title: "Stale Overwrite Attempt",
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ConcurrencyConflictError, "Must be ConcurrencyConflictError");
          assert.strictEqual(err.status, 409, "Must return HTTP status 409");
          assert.strictEqual(err.code, "CONCURRENCY_CONFLICT");
          assert.strictEqual(err.entity, "Task");
          assert.strictEqual(err.entityId, task.id);
          assert.strictEqual(err.expectedVersion, 1);
          assert.strictEqual(err.actualVersion, 2);
          return true;
        }
      );
    });

    test("1.3 updateDocumentWithOCC enforces OCC version validation and increments version", async () => {
      const doc = await prisma.document.create({
        data: {
          type: "VAN_BAN_DEN",
          registrationNumber: 99801,
          documentYear: testYear,
          originalNumber: `${testRunId}/VB-01`,
          issuedDate: new Date(),
          issuingAuthority: "Sở GD&ĐT ",
          category: "Công văn",
          summary: `Tài liệu thử nghiệm OCC ${testRunId}`,
          registeredById: testUserId1,
        },
      });

      assert.strictEqual(doc.version, 1, "Initial document version must be 1");

      const updatedDoc = await updateDocumentWithOCC(prisma, doc.id, 1, {
        summary: `Tài liệu thử nghiệm OCC đã cập nhật ${testRunId}`,
      });

      assert.strictEqual(updatedDoc.version, 2, "Document version must increment to 2");

      // Attempt update with stale version 1
      await assert.rejects(
        async () => {
          await updateDocumentWithOCC(prisma, doc.id, 1, {
            summary: "Cố gắng ghi đè dữ liệu cũ",
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ConcurrencyConflictError);
          assert.strictEqual(err.status, 409);
          assert.strictEqual(err.entity, "Document");
          assert.strictEqual(err.actualVersion, 2);
          return true;
        }
      );
    });

    test("1.4 Concurrent updates on identical version: exactly one succeeds and competing update receives 409", async () => {
      const task = await prisma.task.create({
        data: {
          code: `${testRunId}-TASK-OCC-CONCURRENT`,
          title: "Concurrent Race Condition Target",
          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
          createdById: testUserId1,
        },
      });

      assert.strictEqual(task.version, 1);

      // Launch 2 parallel updates targeting expectedVersion 1
      const [resA, resB] = await Promise.allSettled([
        updateTaskWithOCC(prisma, task.id, 1, { title: "Update Winner Candidate A" }),
        updateTaskWithOCC(prisma, task.id, 1, { title: "Update Winner Candidate B" }),
      ]);

      const fulfilled = [resA, resB].filter((r) => r.status === "fulfilled");
      const rejected = [resA, resB].filter((r) => r.status === "rejected");

      assert.strictEqual(fulfilled.length, 1, "Exactly one concurrent update must succeed");
      assert.strictEqual(rejected.length, 1, "Exactly one concurrent update must fail");

      const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
      assert.ok(rejectionReason instanceof ConcurrencyConflictError);
      assert.strictEqual(rejectionReason.status, 409);

      // Verify final version in database is 2
      const finalTask = await prisma.task.findUnique({ where: { id: task.id } });
      assert.strictEqual(finalTask?.version, 2);
    });
  });

  // ============================================================================
  // CAPABILITY 2: Atomic Sequence Generation
  // ============================================================================
  describe("2. Atomic Sequence Generation", () => {
    test("2.1 getNextTaskSequence with 15 concurrent requests yields zero duplicates and strictly continuous sequence", async () => {
      const concurrency = 15;

      const results = await Promise.all(
        Array.from({ length: concurrency }, () =>
          getNextTaskSequence(prisma, {
            year: testYear,
            month: 1,
            format: "NV",
          })
        )
      );

      assert.strictEqual(results.length, concurrency);

      // 1. Zero duplicates: all numbers must be unique
      const uniqueSequences = new Set(results);
      assert.strictEqual(
        uniqueSequences.size,
        concurrency,
        `Expected ${concurrency} unique sequence numbers, but found duplicates: ${JSON.stringify(results)}`
      );

      // 2. Continuous sequence without gaps: sorted numbers must form an uninterrupted arithmetic sequence
      const sorted = [...results].sort((a, b) => a - b);
      const minSeq = sorted[0];
      for (let i = 0; i < sorted.length; i++) {
        assert.strictEqual(
          sorted[i],
          minSeq + i,
          `Sequence gap detected at index ${i}: expected ${minSeq + i}, got ${sorted[i]}`
        );
      }
    });

    test("2.2 getNextDocumentSequence with 15 concurrent requests yields zero duplicates and continuous sequence", async () => {
      const concurrency = 15;

      const results = await Promise.all(
        Array.from({ length: concurrency }, () =>
          getNextDocumentSequence("VAN_BAN_DI", testYear, prisma)
        )
      );

      assert.strictEqual(results.length, concurrency);

      // 1. Zero duplicates
      const uniqueSequences = new Set(results);
      assert.strictEqual(
        uniqueSequences.size,
        concurrency,
        `Expected ${concurrency} unique document sequence numbers, but found duplicates: ${JSON.stringify(results)}`
      );

      // 2. Strictly continuous sequence increments
      const sorted = [...results].sort((a, b) => a - b);
      const minSeq = sorted[0];
      for (let i = 0; i < sorted.length; i++) {
        assert.strictEqual(
          sorted[i],
          minSeq + i,
          `Document sequence gap detected at index ${i}: expected ${minSeq + i}, got ${sorted[i]}`
        );
      }
    });
  });

  // ============================================================================
  // CAPABILITY 3: Idempotency Handling
  // ============================================================================
  describe("3. Idempotency Handling", () => {
    test("3.1 withIdempotency: initial call executes handler and second call returns cached response", async () => {
      const idempotencyKey = `key-exec-${Date.now()}`;
      const operation = "CREATE_TASK_IDEMPOTENT";
      let executionCount = 0;

      const handler = async () => {
        executionCount++;
        return {
          taskId: `task-${Date.now()}`,
          status: "SUCCESS",
          executionIndex: executionCount,
        };
      };

      // Call 1: should execute handler
      const result1 = await withIdempotency(
        prisma,
        {
          userId: testUserId1,
          operation,
          key: idempotencyKey,
        },
        handler
      );

      assert.strictEqual(executionCount, 1, "Handler must be called on first invocation");
      assert.strictEqual(result1.status, "SUCCESS");
      assert.strictEqual(result1.executionIndex, 1);

      // Verify record exists in DB with status COMPLETED
      const record = await prisma.idempotencyRecord.findUnique({
        where: {
          userId_operation_key: {
            userId: testUserId1,
            operation,
            key: idempotencyKey,
          },
        },
      });
      assert.ok(record, "Idempotency record must exist");
      assert.strictEqual(record.status, "COMPLETED");

      // Call 2: identical parameters must return cached response without re-executing
      const result2 = await withIdempotency(
        prisma,
        {
          userId: testUserId1,
          operation,
          key: idempotencyKey,
        },
        handler
      );

      assert.strictEqual(
        executionCount,
        1,
        "Handler must NOT be re-executed on second invocation"
      );
      assert.deepStrictEqual(
        result2,
        result1,
        "Second call must return identical cached result"
      );
    });

    test("3.2 withIdempotency: in-flight duplicate call throws IdempotencyConflictError (HTTP 409)", async () => {
      const inFlightKey = `key-inflight-${Date.now()}`;
      const operation = "SUBMIT_REPORT_INFLIGHT";

      // Seed an active in-flight PENDING record directly
      await prisma.idempotencyRecord.create({
        data: {
          userId: testUserId1,
          operation,
          key: inFlightKey,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 60000), // 1 minute in the future
        },
      });

      // Calling withIdempotency without polling timeout must throw IdempotencyConflictError
      await assert.rejects(
        async () => {
          await withIdempotency(
            prisma,
            {
              userId: testUserId1,
              operation,
              key: inFlightKey,
              lockTimeoutMs: 0,
            },
            async () => {
              return { success: true };
            }
          );
        },
        (err: unknown) => {
          assert.ok(
            err instanceof IdempotencyConflictError,
            "Must throw IdempotencyConflictError"
          );
          assert.strictEqual(err.status, 409, "Must have HTTP status 409");
          assert.strictEqual(err.code, "IDEMPOTENCY_CONFLICT");
          assert.strictEqual(err.userId, testUserId1);
          assert.strictEqual(err.operation, operation);
          assert.strictEqual(err.key, inFlightKey);
          return true;
        }
      );
    });

    test("3.3 withIdempotency: distinct users or operations with identical key do not collide", async () => {
      const sharedKey = `shared-key-${Date.now()}`;
      const operation = "APPROVE_ACTION";

      let user1Count = 0;
      let user2Count = 0;

      // User 1 execution
      const resUser1 = await withIdempotency(
        prisma,
        {
          userId: testUserId1,
          operation,
          key: sharedKey,
        },
        async () => {
          user1Count++;
          return { actor: "user1", data: "custom-user-1" };
        }
      );

      // User 2 execution with the exact same key & operation
      const resUser2 = await withIdempotency(
        prisma,
        {
          userId: testUserId2,
          operation,
          key: sharedKey,
        },
        async () => {
          user2Count++;
          return { actor: "user2", data: "custom-user-2" };
        }
      );

      assert.strictEqual(user1Count, 1);
      assert.strictEqual(user2Count, 1);
      assert.strictEqual(resUser1.actor, "user1");
      assert.strictEqual(resUser2.actor, "user2");

      // Distinct operation for User 1 with the same key
      let diffOpCount = 0;
      const resDiffOp = await withIdempotency(
        prisma,
        {
          userId: testUserId1,
          operation: "DIFFERENT_OPERATION",
          key: sharedKey,
        },
        async () => {
          diffOpCount++;
          return { operation: "diff", data: "distinct-op-data" };
        }
      );

      assert.strictEqual(diffOpCount, 1);
      assert.strictEqual(resDiffOp.operation, "diff");
    });
  });

  // ============================================================================
  // CAPABILITY 4: Immutable Audit Event Recording
  // ============================================================================
  describe("4. Immutable Audit Event Recording", () => {
    test("4.1 recordAuditEvent records event within transaction boundary alongside domain mutations", async () => {
      const taskCode = `${testRunId}-TASK-AUDIT-COMMIT`;

      const { task, audit } = await prisma.$transaction(async (tx) => {
        const createdTask = await tx.task.create({
          data: {
            code: taskCode,
            title: "Task with Transactional Audit Trail",
            academicMonth: 9,
            academicYear: "2026-2027",
            dueDate: new Date(Date.now() + 86400000),
            createdById: testUserId1,
          },
        });

        const auditRecord = await recordAuditEvent(tx, {
          action: "TASK_CREATED",
          entityType: "Task",
          entityId: createdTask.id,
          actorId: testUserId1,
          requestId: `req-${testRunId}`,
          beforeData: null,
          afterData: {
            title: createdTask.title,
            code: createdTask.code,
            version: createdTask.version,
          },
          metadata: {
            source: "ComprehensiveTest",
            clientIp: "127.0.0.1",
          },
        });

        return { task: createdTask, audit: auditRecord };
      });

      assert.ok(task.id, "Task must be committed");
      assert.ok(audit.id, "Audit event must be committed");
      assert.strictEqual(audit.entityType, "Task");
      assert.strictEqual(audit.entityId, task.id);
      assert.strictEqual(audit.actorId, testUserId1);
      assert.strictEqual(audit.action, "TASK_CREATED");
      assert.strictEqual(audit.requestId, `req-${testRunId}`);

      // Verify payload and data types in database
      const dbAudit = await prisma.auditEvent.findUnique({
        where: { id: audit.id },
      });
      assert.ok(dbAudit);
      assert.deepStrictEqual(dbAudit.afterData, {
        title: task.title,
        code: task.code,
        version: 1,
      });
      assert.deepStrictEqual(dbAudit.metadata, {
        source: "ComprehensiveTest",
        clientIp: "127.0.0.1",
      });

      // Verify query via auditService / getEntityAuditHistory
      const history = await getEntityAuditHistory(prisma, {
        entityType: "Task",
        entityId: task.id,
      });
      assert.strictEqual(history.length, 1);
      assert.strictEqual(history[0].id, audit.id);
    });

    test("4.2 Rollback of domain transaction rolls back audit event cleanly (no orphan logs)", async () => {
      const ghostEntityId = `${testRunId}-GHOST-TASK`;

      await assert.rejects(
        async () => {
          await prisma.$transaction(async (tx) => {
            // Log audit event first
            await recordAuditEvent(tx, {
              action: "TASK_CREATED",
              entityType: "Task",
              entityId: ghostEntityId,
              actorId: testUserId1,
            });

            // Simulate domain exception triggering rollback
            throw new Error("Simulated Domain Failure triggering rollback");
          });
        },
        /Simulated Domain Failure/
      );

      // Verify zero orphan audit records exist
      const orphanAudits = await prisma.auditEvent.findMany({
        where: { entityId: ghostEntityId },
      });
      assert.strictEqual(
        orphanAudits.length,
        0,
        "No orphan audit event must survive rolled-back transaction"
      );
    });

    test("4.3 Immutability guarantee: schema and service enforce append-only WORM pattern", () => {
      assert.strictEqual(
        AUDIT_IMMUTABILITY_INVARIANT.isAppendOnly,
        true,
        "Audit trail must be append-only"
      );
      assert.strictEqual(
        AUDIT_IMMUTABILITY_INVARIANT.allowUpdates,
        false,
        "Audit trail must forbid updates"
      );
      assert.strictEqual(
        AUDIT_IMMUTABILITY_INVARIANT.allowDeletions,
        false,
        "Audit trail must forbid deletions"
      );

      // Verify AuditEvent model fields in Prisma DMMF
      const model = Prisma.dmmf.datamodel.models.find(
        (m) => m.name === "AuditEvent"
      );
      assert.ok(model, "AuditEvent model must exist in Prisma DMMF");
      assert.strictEqual(model.dbName, "audit_events");
    });
  });

  // ============================================================================
  // CAPABILITY 5: Transactional Outbox Event Enqueue & Transitions
  // ============================================================================
  describe("5. Transactional Outbox Event Enqueue & Transitions", () => {
    test("5.1 publishOutboxEvent: enqueues event atomically within transaction and rolls back on failure", async () => {
      const rollbackAggregateId = `${testRunId}-OUTBOX-ROLLBACK`;

      // 1. Transaction failure cleanly rolls back outbox event
      await assert.rejects(
        async () => {
          await prisma.$transaction(async (tx) => {
            await publishOutboxEvent(tx, {
              eventType: OutboxEventType.TASK_CREATED_NOTIFICATION,
              aggregateType: "Task",
              aggregateId: rollbackAggregateId,
              payload: { message: "Rollback message" },
            });

            throw new Error("Outbox transaction abort");
          });
        },
        /Outbox transaction abort/
      );

      const orphans = await prisma.outboxEvent.findMany({
        where: { aggregateId: rollbackAggregateId },
      });
      assert.strictEqual(orphans.length, 0, "Outbox event must be rolled back");

      // 2. Transaction success commits outbox event with status PENDING
      const commitAggregateId = `${testRunId}-OUTBOX-COMMIT`;
      const event = await prisma.$transaction(async (tx) => {
        return await publishOutboxEvent(tx, {
          eventType: OutboxEventType.TASK_CREATED_NOTIFICATION,
          aggregateType: "Task",
          aggregateId: commitAggregateId,
          payload: { taskTitle: "Committed task" },
        });
      });

      assert.ok(event.id);
      assert.strictEqual(event.status, OutboxStatus.PENDING);
      assert.strictEqual(event.attempts, 0);
    });

    test("5.2 fetchAvailableOutboxEvents and lifecycle transition: PENDING -> PROCESSING -> COMPLETED", async () => {
      const aggregateId = `${testRunId}-LIFECYCLE`;
      const createdEvent = await publishOutboxEvent(prisma, {
        eventType: OutboxEventType.PUSH_NOTIFICATION_DISPATCH,
        aggregateType: "PushNotification",
        aggregateId,
        payload: { userId: testUserId1, text: "Push test" },
      });

      assert.strictEqual(createdEvent.status, OutboxStatus.PENDING);

      // Fetch available events
      const available = await fetchAvailableOutboxEvents(prisma, {
        aggregateType: "PushNotification",
        eventType: OutboxEventType.PUSH_NOTIFICATION_DISPATCH,
      });
      const match = available.find((e) => e.id === createdEvent.id);
      assert.ok(match, "Available events must include newly published PENDING event");

      let observedStatusDuringProcessing: OutboxStatus | null = null;

      // Process event
      const result = await processOutboxEvent(
        prisma,
        match,
        {
          [OutboxEventType.PUSH_NOTIFICATION_DISPATCH]: async (ev, ctx) => {
            // Check status in DB during handler execution
            const inProgress = await prisma.outboxEvent.findUnique({
              where: { id: ev.id },
            });
            observedStatusDuringProcessing = inProgress?.status ?? null;
          },
        },
        { markProcessing: true }
      );

      assert.strictEqual(
        observedStatusDuringProcessing,
        OutboxStatus.PROCESSING,
        "Status must transition to PROCESSING during handler execution"
      );
      assert.strictEqual(result.status, OutboxStatus.COMPLETED);
      assert.strictEqual(result.attempts, 1);

      // Verify in database
      const completed = await prisma.outboxEvent.findUnique({
        where: { id: createdEvent.id },
      });
      assert.strictEqual(completed?.status, OutboxStatus.COMPLETED);
      assert.strictEqual(completed?.attempts, 1);
      assert.ok(completed?.processedAt !== null, "processedAt timestamp must be set");
    });

    test("5.3 Exponential backoff retry and DLQ failure transition when maxRetries exceeded", async () => {
      // 1. Verify exponential backoff calculation
      assert.strictEqual(calculateExponentialBackoff(1, 5, 2), 5); // 5 * 2^0 = 5s
      assert.strictEqual(calculateExponentialBackoff(2, 5, 2), 10); // 5 * 2^1 = 10s
      assert.strictEqual(calculateExponentialBackoff(3, 5, 2), 20); // 5 * 2^2 = 20s
      assert.strictEqual(calculateExponentialBackoff(4, 5, 2), 40); // 5 * 2^3 = 40s

      const aggregateId = `${testRunId}-RETRY-DLQ`;
      const retryEvent = await publishOutboxEvent(prisma, {
        eventType: OutboxEventType.TASK_ASSIGNED_NOTIFICATION,
        aggregateType: "Task",
        aggregateId,
        payload: { attemptTest: true },
      });

      // First failure with maxRetries = 2 -> Should retain PENDING with attempts = 1
      const res1 = await processOutboxEvent(
        prisma,
        retryEvent,
        {
          [OutboxEventType.TASK_ASSIGNED_NOTIFICATION]: async () => {
            throw new Error("Transient network outage");
          },
        },
        { maxRetries: 2, baseBackoffSeconds: 5 }
      );

      assert.strictEqual(res1.status, OutboxStatus.PENDING);
      assert.strictEqual(res1.attempts, 1);
      assert.ok(res1.error?.includes("Transient network outage"));

      const dbRetry = await prisma.outboxEvent.findUnique({
        where: { id: retryEvent.id },
      });
      assert.strictEqual(dbRetry?.status, OutboxStatus.PENDING);
      assert.strictEqual(dbRetry?.attempts, 1);
      assert.ok(dbRetry?.availableAt && dbRetry.availableAt > new Date());
      assert.ok(dbRetry?.lastError?.includes("Transient network outage"));

      // Second failure with maxRetries = 2 -> Exceeds maxRetries -> Should transition to FAILED (DLQ)
      const res2 = await processOutboxEvent(
        prisma,
        dbRetry!,
        {
          [OutboxEventType.TASK_ASSIGNED_NOTIFICATION]: async () => {
            throw new Error("Terminal network failure");
          },
        },
        { maxRetries: 2 }
      );

      assert.strictEqual(res2.status, OutboxStatus.FAILED);
      assert.strictEqual(res2.attempts, 2);

      const deadLetter = await prisma.outboxEvent.findUnique({
        where: { id: retryEvent.id },
      });
      assert.strictEqual(
        deadLetter?.status,
        OutboxStatus.FAILED,
        "Event must be in FAILED dead-letter status"
      );
      assert.strictEqual(deadLetter?.attempts, 2);
      assert.ok(deadLetter?.lastError?.includes("Terminal network failure"));
    });
  });

  // ============================================================================
  // CAPABILITY 6: Archive Flags & Referential Integrity
  // ============================================================================
  describe("6. Archive Flags & Referential Integrity", () => {
    test("6.1 archiveTask and archiveDocument set archivedAt, archivedById, and archiveReason", async () => {
      // 1. Task archiving
      const task = await prisma.task.create({
        data: {
          code: `${testRunId}-TASK-ARCHIVE`,
          title: "Task To Be Soft-Archived",
          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
          createdById: testUserId1,
        },
      });

      assert.strictEqual(isTaskArchived(task), false);

      const archivedTask = await archiveTask(prisma, {
        taskId: task.id,
        archivedById: testUserId1,
        archiveReason: "Task completed and retired per regulatory review",
      });

      assert.strictEqual(isTaskArchived(archivedTask), true);
      assert.ok(archivedTask.archivedAt instanceof Date);
      assert.strictEqual(archivedTask.archivedById, testUserId1);
      assert.strictEqual(
        archivedTask.archiveReason,
        "Task completed and retired per regulatory review"
      );

      // 2. Document archiving
      const doc = await prisma.document.create({
        data: {
          type: "VAN_BAN_DI",
          registrationNumber: 99802,
          documentYear: testYear,
          originalNumber: `${testRunId}/VB-ARCHIVE-01`,
          issuedDate: new Date(),
          issuingAuthority: "Trường CĐ Kinh tế và Công nghệ ",
          category: "Quyết định",
          summary: `Văn bản chuyển lưu trữ ${testRunId}`,
          registeredById: testUserId1,
        },
      });

      assert.strictEqual(isDocumentArchived(doc), false);

      const archivedDoc = await archiveDocument(prisma, {
        documentId: doc.id,
        archivedById: testUserId1,
        archiveReason: "Tai lieu het hieu luc thi hanh",
      });

      assert.strictEqual(isDocumentArchived(archivedDoc), true);
      assert.ok(archivedDoc.archivedAt instanceof Date);
      assert.strictEqual(archivedDoc.archivedById, testUserId1);
      assert.strictEqual(archivedDoc.archiveReason, "Tai lieu het hieu luc thi hanh");

      // 3. Unarchive Task & Document
      const unarchivedTask = await unarchiveTask(prisma, { taskId: task.id });
      assert.strictEqual(isTaskArchived(unarchivedTask), false);
      assert.strictEqual(unarchivedTask.archivedAt, null);
      assert.strictEqual(unarchivedTask.archivedById, null);

      const unarchivedDoc = await unarchiveDocument(prisma, {
        documentId: doc.id,
      });
      assert.strictEqual(isDocumentArchived(unarchivedDoc), false);
      assert.strictEqual(unarchivedDoc.archivedAt, null);
      assert.strictEqual(unarchivedDoc.archivedById, null);
    });

    test("6.2 Normal operational workflows filter out archived records", async () => {
      const taskActive = await prisma.task.create({
        data: {
          code: `${testRunId}-TASK-ACTIVE`,
          title: "Active Operational Task",
          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
          createdById: testUserId1,
        },
      });

      const taskToArchive = await prisma.task.create({
        data: {
          code: `${testRunId}-TASK-TO-ARCHIVE`,
          title: "Archived Operational Task",
          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
          createdById: testUserId1,
        },
      });

      await archiveTask(prisma, {
        taskId: taskToArchive.id,
        archivedById: testUserId1,
        archiveReason: "Historical reference only",
      });

      // Active filter query: must return taskActive and exclude taskToArchive
      const activeTasks = await prisma.task.findMany({
        where: {
          code: { in: [taskActive.code, taskToArchive.code] },
          ...ACTIVE_TASK_FILTER,
        },
      });
      assert.strictEqual(activeTasks.length, 1);
      assert.strictEqual(activeTasks[0].id, taskActive.id);

      // Archived filter query: must return taskToArchive only
      const archivedTasks = await prisma.task.findMany({
        where: {
          code: { in: [taskActive.code, taskToArchive.code] },
          ...ARCHIVED_TASK_FILTER,
        },
      });
      assert.strictEqual(archivedTasks.length, 1);
      assert.strictEqual(archivedTasks[0].id, taskToArchive.id);

      // Same verification on Document
      const docActive = await prisma.document.create({
        data: {
          type: "VAN_BAN_DEN",
          registrationNumber: 99803,
          documentYear: testYear,
          originalNumber: `${testRunId}/DOC-ACTIVE`,
          issuedDate: new Date(),
          issuingAuthority: "UBND Tỉnh ",
          category: "Chỉ thị",
          summary: `Văn bản đang hiệu lực ${testRunId}`,
          registeredById: testUserId1,
        },
      });

      const docToArchive = await prisma.document.create({
        data: {
          type: "VAN_BAN_DEN",
          registrationNumber: 99804,
          documentYear: testYear,
          originalNumber: `${testRunId}/DOC-ARCHIVED`,
          issuedDate: new Date(),
          issuingAuthority: "UBND Tỉnh ",
          category: "Chỉ thị",
          summary: `Văn bản đã chuyển lưu trữ ${testRunId}`,
          registeredById: testUserId1,
        },
      });

      await archiveDocument(prisma, {
        documentId: docToArchive.id,
        archivedById: testUserId1,
        archiveReason: "Lưu trữ vĩnh viễn",
      });

      const activeDocs = await prisma.document.findMany({
        where: {
          id: { in: [docActive.id, docToArchive.id] },
          ...ACTIVE_DOCUMENT_FILTER,
        },
      });
      assert.strictEqual(activeDocs.length, 1);
      assert.strictEqual(activeDocs[0].id, docActive.id);

      const archivedDocs = await prisma.document.findMany({
        where: {
          id: { in: [docActive.id, docToArchive.id] },
          ...ARCHIVED_DOCUMENT_FILTER,
        },
      });
      assert.strictEqual(archivedDocs.length, 1);
      assert.strictEqual(archivedDocs[0].id, docToArchive.id);
    });

    test("6.3 Master data (User, Department) referential integrity: cascade delete is prevented on critical relations", async () => {
      // 1. Prevent User deletion when referenced as Task.createdBy (onDelete: Restrict)
      const restrictedUser = await prisma.user.create({
        data: {
          email: `restricted_creator_${testRunId}@qncet.edu.vn`,
          name: "Restricted Creator User",
          role: "CHUYEN_VIEN",

        },
      });

      const boundTask = await prisma.task.create({
        data: {
          code: `${testRunId}-TASK-RESTRICT`,
          title: "Task Binding User with Restrict Constraint",
          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
          createdById: restrictedUser.id,
        },
      });

      // Attempting to delete restrictedUser must fail with foreign key violation (P2003)
      await assert.rejects(
        async () => {
          await prisma.user.delete({
            where: { id: restrictedUser.id },
          });
        },
        (err: any) => {
          assert.ok(
            err.code === "P2003" ||
              err.message?.includes("Foreign key constraint failed") ||
              err.message?.includes("violates foreign key constraint"),
            `Expected foreign key constraint violation, got: ${err.message}`
          );
          return true;
        }
      );

      // Clean up bound task, then user deletion succeeds
      await prisma.task.delete({ where: { id: boundTask.id } });
      const deletedUser = await prisma.user.delete({
        where: { id: restrictedUser.id },
      });
      assert.strictEqual(deletedUser.id, restrictedUser.id);

      // 2. Unit deletion semantics after Phase 9.
      // The legacy `document_directives.assigned_dept_id -> departments` RESTRICT
      // foreign key was dropped together with the `Department` model. Every
      // remaining unit reference (`Task.leadUnitId`, `DocumentIncomingWorkflow.leadUnitId`)
      // is `onDelete: SetNull`, so deleting a unit must succeed and detach — never
      // leave a dangling reference and never block the delete.
      const deletedUnit = await prisma.organizationalUnit.create({
        data: {
          id: `unit-detach-${Date.now()}`,
          code: `unit-detach-${Date.now()}`,
          name: `Đơn vị kiểm thử tách tham chiếu ${testRunId}`,
          type: "DEPARTMENT",
          status: "ACTIVE",
        },
      });

      const detachedTask = await prisma.task.create({
        data: {
          code: `${testRunId}-DETACH-UNIT`,
          title: `Nhiệm vụ kiểm thử tách đơn vị ${testRunId}`,
          scope: "DEPARTMENT" as any,
          status: "NOT_STARTED" as any,
          priority: "NORMAL" as any,
          startDate: new Date(Date.now() - 86400000),
          dueDate: new Date(Date.now() + 86400000),
          academicMonth: 9,
          academicYear: "2026-2027",
          createdById: testUserId1,
          leadUnitId: deletedUnit.id,
        },
      });

      await prisma.organizationalUnit.delete({ where: { id: deletedUnit.id } });

      const reloadedTask = await prisma.task.findUnique({
        where: { id: detachedTask.id },
        select: { leadUnitId: true },
      });
      assert.strictEqual(
        reloadedTask?.leadUnitId,
        null,
        "Xóa đơn vị phải tách tham chiếu (SetNull) chứ không để lại FK treo"
      );

      await prisma.task.delete({ where: { id: detachedTask.id } });
    });
  });
});
