import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma, TaskStatus, TaskScope, TaskPriority, DeliverableReviewStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import {
  logAuditEvent,
  getEntityAuditHistory,
  getActorAuditHistory,
  getRequestAuditEvents,
  countEntityAuditEvents,
  AuditAction,
  TASK_CREATED,
  TASK_STATUS_CHANGED,
  TASK_APPROVED,
  DELIVERABLE_SUBMITTED,
  AUDIT_IMMUTABILITY_INVARIANT,
} from '../src/lib/db/audit';
import * as auditModule from '../src/lib/db/audit';
import {
  createTaskAtomic,
  submitDeliverableAtomic,
  approveTaskAtomic,
} from '../src/lib/db/transactions';

describe('Task 9: Immutable AuditEvent Model & Service', () => {
  const testRunId = `audit_test_${Date.now()}`;
  const testActorId = `actor_${testRunId}`;
  const testRequestId = `req_${testRunId}`;
  let testDepartmentId: string;
  let testUserId: string;

  before(async () => {
    // 1. Ensure test department exists
    let dept = await prisma.department.findFirst();
    if (!dept) {
      dept = await prisma.department.create({
        data: {
          id: `dept-audit-${Date.now()}`,
          name: 'Phòng Kiểm Thử Kiểm Toán',
          shortName: 'PKTKT',
        },
      });
    }
    testDepartmentId = dept.id;

    // 2. Ensure test user exists
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: `audit_user_${testRunId}@qncet.edu.vn`,
          name: 'Audit Test User',
          role: 'CHUYEN_VIEN',
          departmentId: testDepartmentId,
        },
      });
    }
    testUserId = user.id;
  });

  after(async () => {
    // Clean up all audit events created during this test run
    await prisma.auditEvent.deleteMany({
      where: {
        OR: [
          { actorId: testActorId },
          { requestId: testRequestId },
          { entityId: { contains: testRunId } },
        ],
      },
    });

    // Clean up any test tasks created in integration tests
    await prisma.task.deleteMany({
      where: { title: { contains: testRunId } },
    });
  });

  // ==========================================================================
  // SUITE 1: Prisma Schema & DMMF Verification
  // ==========================================================================
  describe('1. Prisma Schema & DMMF Verification', () => {
    test('AuditEvent model is registered in Prisma DMMF', () => {
      const model = Prisma.dmmf.datamodel.models.find((m) => m.name === 'AuditEvent');
      assert.ok(model, 'AuditEvent model must exist in Prisma DMMF');
      assert.strictEqual(model.dbName, 'audit_events', 'Model must map to table audit_events');

      const expectedFields: Record<string, { type: string; isRequired: boolean; dbName?: string }> = {
        id: { type: 'String', isRequired: true },
        actorId: { type: 'String', isRequired: false, dbName: 'actor_id' },
        action: { type: 'String', isRequired: true, dbName: 'action' },
        entityType: { type: 'String', isRequired: true, dbName: 'entity_type' },
        entityId: { type: 'String', isRequired: true, dbName: 'entity_id' },
        requestId: { type: 'String', isRequired: false, dbName: 'request_id' },
        beforeData: { type: 'Json', isRequired: false, dbName: 'before_data' },
        afterData: { type: 'Json', isRequired: false, dbName: 'after_data' },
        metadata: { type: 'Json', isRequired: false, dbName: 'metadata' },
        createdAt: { type: 'DateTime', isRequired: true, dbName: 'created_at' },
      };

      for (const [fieldName, expectations] of Object.entries(expectedFields)) {
        const foundField: (typeof model.fields)[number] | undefined = model.fields.find(
          (f) => f.name === fieldName
        );
        assert.ok(foundField, `Field ${fieldName} must exist on AuditEvent`);
        assert.strictEqual(foundField.type, expectations.type, `Field ${fieldName} type mismatch`);
        assert.strictEqual(
          foundField.isRequired,
          expectations.isRequired,
          `Field ${fieldName} isRequired mismatch`
        );
        if (expectations.dbName) {
          assert.strictEqual(
            foundField.dbName,
            expectations.dbName,
            `Field ${fieldName} dbName mapping mismatch`
          );
        }
      }
    });

    test('AuditEvent indexes are properly configured in PostgreSQL', async () => {
      const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
        SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'audit_events';
      `;
      assert.ok(indexes.length >= 4, 'Must have at least 4 indexes on audit_events');

      // 1. Primary key index on id
      const pkey = indexes.find((i) => i.indexname === 'audit_events_pkey');
      assert.ok(pkey, 'Primary key index audit_events_pkey must exist');

      // 2. Compound index on entityType, entityId, createdAt DESC
      const entityIdx = indexes.find(
        (i) =>
          i.indexdef.includes('entity_type') &&
          i.indexdef.includes('entity_id') &&
          i.indexdef.includes('created_at DESC')
      );
      assert.ok(entityIdx, 'Compound index on (entity_type, entity_id, created_at DESC) must exist');

      // 3. Compound index on actorId, createdAt DESC
      const actorIdx = indexes.find(
        (i) =>
          i.indexdef.includes('actor_id') &&
          i.indexdef.includes('created_at DESC')
      );
      assert.ok(actorIdx, 'Compound index on (actor_id, created_at DESC) must exist');

      // 4. Index on requestId
      const reqIdx = indexes.find((i) => i.indexdef.includes('request_id'));
      assert.ok(reqIdx, 'Index on (request_id) must exist');
    });
  });

  // ==========================================================================
  // SUITE 2: Core logAuditEvent Functionality
  // ==========================================================================
  describe('2. Core logAuditEvent Functionality', () => {
    test('Logs an audit event using default Prisma client with full metadata', async () => {
      const entityId = `task_entity_1_${testRunId}`;
      const event = await logAuditEvent({
        actorId: testActorId,
        action: AuditAction.TASK_CREATED,
        entityType: 'Task',
        entityId,
        requestId: testRequestId,
        beforeData: null,
        afterData: { title: 'Lập báo cáo Q3', status: 'TODO' },
        metadata: { clientIp: '127.0.0.1', userAgent: 'QCET-Agent/1.0' },
      });

      assert.ok(event.id, 'Created audit event must have a valid UUID id');
      assert.strictEqual(event.actorId, testActorId);
      assert.strictEqual(event.action, AuditAction.TASK_CREATED);
      assert.strictEqual(event.entityType, 'Task');
      assert.strictEqual(event.entityId, entityId);
      assert.strictEqual(event.requestId, testRequestId);
      assert.deepStrictEqual(event.afterData, { title: 'Lập báo cáo Q3', status: 'TODO' });
      assert.ok(event.createdAt instanceof Date);
    });

    test('Logs an audit event inside an interactive Prisma transaction', async () => {
      const entityId = `task_entity_tx_${testRunId}`;

      const createdEvent = await prisma.$transaction(async (tx) => {
        const ev = await logAuditEvent(tx, {
          actorId: testActorId,
          action: AuditAction.TASK_STATUS_CHANGED,
          entityType: 'Task',
          entityId,
          requestId: testRequestId,
          beforeData: { status: 'TODO' },
          afterData: { status: 'IN_PROGRESS' },
          metadata: { trigger: 'user_action' },
        });
        return ev;
      });

      assert.ok(createdEvent.id);
      assert.strictEqual(createdEvent.action, AuditAction.TASK_STATUS_CHANGED);

      // Verify event is readable from database after transaction commit
      const persisted = await prisma.auditEvent.findUnique({
        where: { id: createdEvent.id },
      });
      assert.ok(persisted);
      assert.strictEqual(persisted.entityId, entityId);
    });

    test('Rolls back audit event if transaction throws', async () => {
      const entityId = `task_entity_rollback_${testRunId}`;
      let createdEventId: string | undefined;

      await assert.rejects(
        async () => {
          await prisma.$transaction(async (tx) => {
            const ev = await logAuditEvent(tx, {
              actorId: testActorId,
              action: AuditAction.TASK_CREATED,
              entityType: 'Task',
              entityId,
              requestId: testRequestId,
            });
            createdEventId = ev.id;
            throw new Error('Simulated transaction abortion');
          });
        },
        /Simulated transaction abortion/
      );

      assert.ok(createdEventId, 'Event id was assigned in tx before rollback');
      const persisted = await prisma.auditEvent.findUnique({
        where: { id: createdEventId },
      });
      assert.strictEqual(persisted, null, 'Audit event must NOT exist after tx rollback');
    });

    test('Supports system/unauthenticated events with null actorId and null requestId', async () => {
      const entityId = `system_task_${testRunId}`;
      const ev = await logAuditEvent({
        action: AuditAction.TASK_DEADLINE_CHANGED,
        entityType: 'Task',
        entityId,
        beforeData: { dueDate: '2026-09-10' },
        afterData: { dueDate: '2026-09-15' },
      });

      assert.strictEqual(ev.actorId, null);
      assert.strictEqual(ev.requestId, null);
      assert.strictEqual(ev.action, AuditAction.TASK_DEADLINE_CHANGED);
    });

    test('Validates required fields and throws descriptive errors on omission', async () => {
      await assert.rejects(
        async () => {
          await logAuditEvent({
            action: '',
            entityType: 'Task',
            entityId: 'e1',
          } as any);
        },
        /Audit action is required/
      );

      await assert.rejects(
        async () => {
          await logAuditEvent({
            action: TASK_CREATED,
            entityType: '',
            entityId: 'e1',
          } as any);
        },
        /Audit entityType is required/
      );

      await assert.rejects(
        async () => {
          await logAuditEvent({
            action: TASK_CREATED,
            entityType: 'Task',
            entityId: '',
          } as any);
        },
        /Audit entityId is required/
      );
    });
  });

  // ==========================================================================
  // SUITE 3: Querying & Pagination Capabilities
  // ==========================================================================
  describe('3. Querying & Pagination Capabilities', () => {
    const queryEntityId = `task_query_${testRunId}`;

    before(async () => {
      // Create a sequence of 5 events for the query entity
      for (let i = 1; i <= 5; i++) {
        await logAuditEvent({
          actorId: testActorId,
          action: `ACTION_STEP_${i}`,
          entityType: 'Task',
          entityId: queryEntityId,
          requestId: testRequestId,
          metadata: { stepIndex: i },
        });
        // Small delay to ensure strictly distinct createdAt timestamps
        await new Promise((r) => setTimeout(r, 15));
      }
    });

    test('getEntityAuditHistory returns events in descending chronological order (newest first)', async () => {
      const history = await getEntityAuditHistory({
        entityType: 'Task',
        entityId: queryEntityId,
      });

      assert.ok(history.length >= 5);
      // Verify newest first
      for (let i = 0; i < history.length - 1; i++) {
        assert.ok(
          history[i].createdAt.getTime() >= history[i + 1].createdAt.getTime(),
          'History must be ordered descending by createdAt'
        );
      }
      assert.strictEqual(history[0].action, 'ACTION_STEP_5');
    });

    test('getEntityAuditHistory limits results according to limit option', async () => {
      const history = await getEntityAuditHistory({
        entityType: 'Task',
        entityId: queryEntityId,
        limit: 2,
      });

      assert.strictEqual(history.length, 2);
      assert.strictEqual(history[0].action, 'ACTION_STEP_5');
      assert.strictEqual(history[1].action, 'ACTION_STEP_4');
    });

    test('getEntityAuditHistory supports cursor-based pagination', async () => {
      const page1 = await getEntityAuditHistory({
        entityType: 'Task',
        entityId: queryEntityId,
        limit: 2,
      });
      assert.strictEqual(page1.length, 2);

      const page2 = await getEntityAuditHistory({
        entityType: 'Task',
        entityId: queryEntityId,
        limit: 2,
        cursor: page1[1].id,
      });
      assert.strictEqual(page2.length, 2);
      assert.strictEqual(page2[0].action, 'ACTION_STEP_3');
      assert.strictEqual(page2[1].action, 'ACTION_STEP_2');
    });

    test('getActorAuditHistory retrieves actor events newest first', async () => {
      const actorEvents = await getActorAuditHistory({
        actorId: testActorId,
        limit: 10,
      });

      assert.ok(actorEvents.length > 0);
      assert.ok(actorEvents.every((e) => e.actorId === testActorId));
      for (let i = 0; i < actorEvents.length - 1; i++) {
        assert.ok(
          actorEvents[i].createdAt.getTime() >= actorEvents[i + 1].createdAt.getTime(),
          'Actor events must be sorted descending'
        );
      }
    });

    test('getRequestAuditEvents correlates events by requestId in chronological order', async () => {
      const reqEvents = await getRequestAuditEvents({
        requestId: testRequestId,
      });

      assert.ok(reqEvents.length >= 5);
      assert.ok(reqEvents.every((e) => e.requestId === testRequestId));
      // Chronological ascending check
      for (let i = 0; i < reqEvents.length - 1; i++) {
        assert.ok(
          reqEvents[i].createdAt.getTime() <= reqEvents[i + 1].createdAt.getTime(),
          'Request events must be sorted ascending'
        );
      }
    });

    test('countEntityAuditEvents accurately counts total records', async () => {
      const count = await countEntityAuditEvents('Task', queryEntityId);
      assert.strictEqual(count, 5);
    });
  });

  // ==========================================================================
  // SUITE 4: Immutability Invariant Verification
  // ==========================================================================
  describe('4. Immutability Invariant Verification', () => {
    test('AUDIT_IMMUTABILITY_INVARIANT guarantees append-only contract', () => {
      assert.strictEqual(AUDIT_IMMUTABILITY_INVARIANT.isAppendOnly, true);
      assert.strictEqual(AUDIT_IMMUTABILITY_INVARIANT.allowUpdates, false);
      assert.strictEqual(AUDIT_IMMUTABILITY_INVARIANT.allowDeletions, false);
      assert.strictEqual(AUDIT_IMMUTABILITY_INVARIANT.tableName, 'audit_events');
    });

    test('Audit service module exposes zero mutation/deletion functions', () => {
      const exportedKeys = Object.keys(auditModule);
      const forbiddenPrefixes = [
        'update',
        'delete',
        'remove',
        'patch',
        'modify',
        'drop',
        'truncate',
      ];

      for (const key of exportedKeys) {
        for (const prefix of forbiddenPrefixes) {
          assert.ok(
            !key.toLowerCase().startsWith(prefix),
            `Module must not export mutation function '${key}' for AuditEvent`
          );
        }
      }
    });
  });

  // ==========================================================================
  // SUITE 5: Integration with Transaction Handlers (Task 7)
  // ==========================================================================
  describe('5. Integration with Task 7 Transaction Handlers', () => {
    test('createTaskAtomic automatically records TASK_CREATED in audit_events', async () => {
      const title = `Task Audit Integration ${testRunId}`;
      const result = await createTaskAtomic(prisma, {
        createdById: testUserId,
        departmentId: testDepartmentId,
        title,
        dueDate: '2026-10-15',
        scope: TaskScope.DEPARTMENT,
        priority: TaskPriority.NORMAL,
        primaryOwnerId: testUserId,
      });

      const auditHistory = await getEntityAuditHistory({
        entityType: 'Task',
        entityId: result.task.id,
      });

      assert.ok(auditHistory.length >= 1, 'AuditEvent must be created during createTaskAtomic');
      const createdEvent = auditHistory.find((e) => e.action === TASK_CREATED);
      assert.ok(createdEvent, 'Must find TASK_CREATED action');
      assert.strictEqual(createdEvent?.entityId, result.task.id);
      assert.strictEqual(createdEvent?.actorId, testUserId);
    });

    test('submitDeliverableAtomic automatically records TASK_DELIVERABLE_SUBMITTED in audit_events', async () => {
      const created = await createTaskAtomic(prisma, {
        createdById: testUserId,
        departmentId: testDepartmentId,
        title: `Task for Deliverable ${testRunId}`,
        dueDate: '2026-10-15',
        scope: TaskScope.DEPARTMENT,
        priority: TaskPriority.NORMAL,
        primaryOwnerId: testUserId,
      });

      const result = await submitDeliverableAtomic(prisma, {
        taskId: created.task.id,
        uploadedById: testUserId,
        title: 'Báo cáo thử nghiệm hoàn thành',
        fileUrl: 'https://example.com/deliv.pdf',
      });

      const auditHistory = await getEntityAuditHistory({
        entityType: 'TaskDeliverable',
        entityId: result.deliverable.id,
      });

      assert.ok(auditHistory.length >= 1);
      const submittedEvent = auditHistory.find(
        (e) => e.action === 'TASK_DELIVERABLE_SUBMITTED' || e.action === DELIVERABLE_SUBMITTED
      );
      assert.ok(submittedEvent);
      assert.strictEqual(submittedEvent?.entityId, result.deliverable.id);
      assert.strictEqual(submittedEvent?.actorId, testUserId);
    });

    test('approveTaskAtomic automatically records TASK_APPROVED in audit_events', async () => {
      const created = await createTaskAtomic(prisma, {
        createdById: testUserId,
        departmentId: testDepartmentId,
        title: `Task for Approval ${testRunId}`,
        dueDate: '2026-10-15',
        scope: TaskScope.DEPARTMENT,
        priority: TaskPriority.NORMAL,
        primaryOwnerId: testUserId,
      });

      const sub = await submitDeliverableAtomic(prisma, {
        taskId: created.task.id,
        uploadedById: testUserId,
        title: 'Báo cáo cần phê duyệt',
        fileUrl: 'https://example.com/deliv.pdf',
      });

      const result = await approveTaskAtomic(prisma, {
        taskId: created.task.id,
        approverId: testUserId,
        deliverableReview: {
          deliverableId: sub.deliverable.id,
          reviewStatus: DeliverableReviewStatus.APPROVED,
          reviewNote: 'Đạt yêu cầu xuất sắc',
        },
      });

      assert.strictEqual(result.task.status, TaskStatus.COMPLETED);

      const auditHistory = await getEntityAuditHistory({
        entityType: 'Task',
        entityId: created.task.id,
      });

      const approvedEvent = auditHistory.find((e) => e.action === TASK_APPROVED);
      assert.ok(approvedEvent, 'TASK_APPROVED audit event must be recorded');
      assert.strictEqual(approvedEvent?.actorId, testUserId);
    });

    test('Atomic rollback preserves audit clean state when transaction fails', async () => {
      const fakeTaskId = `non_existent_task_${testRunId}`;

      await assert.rejects(async () => {
        await submitDeliverableAtomic(prisma, {
          taskId: fakeTaskId,
          uploadedById: testUserId,
          title: 'Sản phẩm giao nộp lỗi',
          fileUrl: 'https://example.com/err.pdf',
        });
      });

      // Verify no orphan audit event was created for the non-existent task
      const audits = await prisma.auditEvent.findMany({
        where: { entityId: fakeTaskId },
      });
      assert.strictEqual(audits.length, 0, 'No audit events should exist for failed transactions');
    });
  });
});
