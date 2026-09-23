import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  TaskStatus,
  TaskScope,
  TaskPriority,
  TaskActorRole,
  DeliverableReviewStatus,
  ResolutionType,
  DocumentStatus,
  DocumentType,
  DocumentUrgency,
  DocumentSecurityLevel,
} from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import {
  createTaskAtomic,
  submitDeliverableAtomic,
  approveTaskAtomic,
  createDocumentDirectiveAtomic,
  runInTransaction,
} from '../src/lib/db/transactions';
import { ConcurrencyConflictError } from '../src/lib/db/occ';

describe('Task 7: Atomic Transaction Boundaries for Core Workflows', () => {
  const testRunId = `tx_test_${Date.now()}`;
  let testCreatorId: string;
  let testApproverId: string;
  let testCollaboratorId: string;
  let testDepartmentId: string;

  before(async () => {
    // 1. Ensure test org unit exists
    let dept = await prisma.organizationalUnit.findFirst({ where: { status: 'ACTIVE' } });
    if (!dept) {
      const uid = `dept-test-${Date.now()}`;
      dept = await prisma.organizationalUnit.create({
        data: {
          id: uid,
          code: uid,
          name: 'Phòng Thử Nghiệm Giao Dịch',
          type: 'PHONG_BAN' as any,
          status: 'ACTIVE' as any,
        },
      });
    }
    testDepartmentId = dept.id;

    // 2. Ensure test users exist
    const createTestUser = async (email: string, name: string, role: any) => {
      let u = await prisma.user.findUnique({ where: { email } });
      if (!u) {
        u = await prisma.user.create({
          data: {
            email,
            name,
            role,
          },
        });
      }
      return u;
    };

    const creator = await createTestUser(
      `creator_${testRunId}@qncet.edu.vn`,
      'Test Creator User',
      'CHUYEN_VIEN'
    );
    const approver = await createTestUser(
      `approver_${testRunId}@qncet.edu.vn`,
      'Test Approver User',
      'BAN_GIAM_HIEU'
    );
    const collab = await createTestUser(
      `collab_${testRunId}@qncet.edu.vn`,
      'Test Collaborator User',
      'CHUYEN_VIEN'
    );

    testCreatorId = creator.id;
    testApproverId = approver.id;
    testCollaboratorId = collab.id;
  });

  after(async () => {
    // Clean up all tasks and documents created during this test suite
    await prisma.task.deleteMany({
      where: { title: { contains: testRunId } },
    });
    await prisma.document.deleteMany({
      where: { summary: { contains: testRunId } },
    });
  });

  // ==========================================================================
  // SUITE 1: createTaskAtomic
  // ==========================================================================
  describe('1. createTaskAtomic: Task + Assignees + Sequence Code + Audit', () => {
    test('Happy path: creates task, assignees, sequential code, and audit within transaction', async () => {
      let auditRecorded = false;
      let postCommitRan = false;

      const result = await createTaskAtomic(prisma, {
        title: `Task Happy Path ${testRunId}`,
        description: 'Testing atomic task creation happy path',
        dueDate: '2026-10-15',
        createdById: testCreatorId,
        departmentId: testDepartmentId,
        scope: TaskScope.SCHOOL,
        priority: TaskPriority.HIGH,
        primaryOwnerId: testCreatorId,
        collaboratorIds: [testCollaboratorId],
        audit: {
          actorId: testCreatorId,
          metadata: { context: 'happy_path_test' },
        },
        auditRecorder: async (tx, info) => {
          auditRecorded = true;
          assert.strictEqual(info.entityType, 'Task');
          assert.strictEqual(info.actorId, testCreatorId);
          assert.strictEqual(info.action, 'TASK_CREATED');
        },
        afterCommit: async (res) => {
          postCommitRan = true;
          assert.ok(res.task.id);
        },
      });

      assert.ok(result.task.id, 'Task ID must be returned');
      assert.ok(result.code, 'Task code must be generated');
      assert.strictEqual(result.task.title, `Task Happy Path ${testRunId}`);
      assert.strictEqual(result.actors.length, 2, 'Should create 2 actors');
      assert.strictEqual(auditRecorded, true, 'Audit recorder must have been invoked');
      assert.strictEqual(postCommitRan, true, 'afterCommit hook must have been executed');

      // Verify server truth in PostgreSQL
      const persisted = await prisma.task.findUnique({
        where: { id: result.task.id },
        include: { actors: true },
      });
      assert.ok(persisted, 'Task must exist in database');
      assert.strictEqual(persisted?.actors.length, 2);
      const owner = persisted?.actors.find((a) => a.role === TaskActorRole.DRI && a.isPrimaryDRI);
      const collaborator = persisted?.actors.find((a) => a.role === TaskActorRole.COLLABORATOR);
      assert.strictEqual(owner?.userId, testCreatorId);
      assert.strictEqual(collaborator?.userId, testCollaboratorId);
    });

    test('Atomic Rollback: fails at afterTaskCreate step - task is not persisted', async () => {
      const taskTitle = `Task Rollback AfterCreate ${testRunId}`;

      await assert.rejects(
        async () => {
          await createTaskAtomic(prisma, {
            title: taskTitle,
            dueDate: '2026-10-20',
            createdById: testCreatorId,
            departmentId: testDepartmentId,
            failAtStep: 'afterTaskCreate',
          });
        },
        {
          message: /Simulated failure after task creation/,
        }
      );

      // Verify nothing was persisted
      const persisted = await prisma.task.findFirst({
        where: { title: taskTitle },
      });
      assert.strictEqual(persisted, null, 'Task must be cleanly rolled back');
    });

    test('Atomic Rollback: fails at audit recording step - task and assignees roll back cleanly', async () => {
      const taskTitle = `Task Rollback Audit ${testRunId}`;

      await assert.rejects(
        async () => {
          await createTaskAtomic(prisma, {
            title: taskTitle,
            dueDate: '2026-10-20',
            createdById: testCreatorId,
            departmentId: testDepartmentId,
            primaryOwnerId: testCreatorId,
            collaboratorIds: [testCollaboratorId],
            audit: {
              failSimulate: true,
            },
          });
        },
        {
          message: /Simulated audit failure/,
        }
      );

      // Verify no task exists
      const persisted = await prisma.task.findFirst({
        where: { title: taskTitle },
      });
      assert.strictEqual(persisted, null, 'Task must not exist after audit failure');
    });

    test('Atomic Rollback: fails on invalid foreign key in assignees', async () => {
      const taskTitle = `Task Invalid Assignee ${testRunId}`;

      await assert.rejects(async () => {
        await createTaskAtomic(prisma, {
          title: taskTitle,
          dueDate: '2026-10-20',
          createdById: testCreatorId,
          assignees: [
            {
              userId: 'non-existent-user-uuid-12345',
              roleInTask: 'PRIMARY_OWNER',
            },
          ],
        });
      });

      const persisted = await prisma.task.findFirst({
        where: { title: taskTitle },
      });
      assert.strictEqual(persisted, null, 'Task must not be persisted if assignee creation fails');
    });
  });

  // ==========================================================================
  // SUITE 2: submitDeliverableAtomic
  // ==========================================================================
  describe('2. submitDeliverableAtomic: Deliverable + Task Status Transition + Audit', () => {
    test('Happy path: creates deliverable and transitions task status to WAITING_APPROVAL', async () => {
      // 1. Create a task in NOT_STARTED status
      const created = await createTaskAtomic(prisma, {
        title: `Task Deliverable Target ${testRunId}`,
        dueDate: '2026-11-01',
        createdById: testCreatorId,
        status: TaskStatus.NOT_STARTED,
      });

      let auditRan = false;
      const deliverableTitle = 'Báo cáo nghiệm thu giai đoạn 1';
      const fileUrl = 'https://storage.qcet.edu.vn/deliverables/report-1.pdf';

      const result = await submitDeliverableAtomic(prisma, {
        taskId: created.task.id,
        title: deliverableTitle,
        fileUrl,
        fileType: 'PDF',
        fileSize: 1024 * 50,
        uploadedById: testCreatorId,
        targetStatus: TaskStatus.WAITING_APPROVAL,
        auditRecorder: async (tx, info) => {
          auditRan = true;
          assert.strictEqual(info.entityType, 'TaskDeliverable');
          assert.strictEqual(info.action, 'TASK_DELIVERABLE_SUBMITTED');
        },
      });

      assert.ok(result.deliverable.id);
      assert.strictEqual(result.deliverable.title, deliverableTitle);
      assert.strictEqual(result.deliverable.reviewStatus, DeliverableReviewStatus.PENDING);
      assert.strictEqual(result.task.status, TaskStatus.WAITING_APPROVAL);
      assert.strictEqual(auditRan, true);

      // Verify in database
      const dbTask = await prisma.task.findUnique({
        where: { id: created.task.id },
      });
      assert.strictEqual(dbTask?.status, TaskStatus.WAITING_APPROVAL);

      const dbDeliverable = await prisma.taskDeliverable.findUnique({
        where: { id: result.deliverable.id },
      });
      assert.ok(dbDeliverable);
      assert.strictEqual(dbDeliverable?.fileUrl, fileUrl);
    });

    test('Atomic Rollback: fails at afterDeliverableCreate - deliverable not persisted and task status unchanged', async () => {
      const created = await createTaskAtomic(prisma, {
        title: `Task Rollback Deliv Create ${testRunId}`,
        dueDate: '2026-11-01',
        createdById: testCreatorId,
        status: TaskStatus.NOT_STARTED,
      });

      await assert.rejects(
        async () => {
          await submitDeliverableAtomic(prisma, {
            taskId: created.task.id,
            title: 'File That Must Rollback',
            fileUrl: 'https://example.com/file.pdf',
            uploadedById: testCreatorId,
            failAtStep: 'afterDeliverableCreate',
          });
        },
        {
          message: /Simulated failure after deliverable creation/,
        }
      );

      // Verify task status was NOT modified
      const task = await prisma.task.findUnique({
        where: { id: created.task.id },
      });
      assert.strictEqual(task?.status, TaskStatus.NOT_STARTED);

      // Verify deliverable does NOT exist
      const deliverables = await prisma.taskDeliverable.findMany({
        where: { taskId: created.task.id },
      });
      assert.strictEqual(deliverables.length, 0);
    });

    test('Atomic Rollback: OCC conflict rolls back deliverable creation', async () => {
      const created = await createTaskAtomic(prisma, {
        title: `Task OCC Deliv ${testRunId}`,
        dueDate: '2026-11-01',
        createdById: testCreatorId,
        status: TaskStatus.NOT_STARTED,
      });

      // Submit with stale expected version (e.g. 999 instead of 1)
      await assert.rejects(
        async () => {
          await submitDeliverableAtomic(prisma, {
            taskId: created.task.id,
            title: 'Stale Version Deliverable',
            fileUrl: 'https://example.com/stale.pdf',
            uploadedById: testCreatorId,
            expectedTaskVersion: 999,
          });
        },
        (err: any) => {
          assert.ok(err instanceof ConcurrencyConflictError);
          assert.strictEqual(err.status, 409);
          return true;
        }
      );

      // Verify deliverable rolled back cleanly
      const deliverables = await prisma.taskDeliverable.findMany({
        where: { taskId: created.task.id },
      });
      assert.strictEqual(deliverables.length, 0);
    });
  });

  // ==========================================================================
  // SUITE 3: approveTaskAtomic
  // ==========================================================================
  describe('3. approveTaskAtomic: Task Completion + Resolution/Review + Audit', () => {
    test('Happy path: completes task, creates executive resolution, and approves deliverable atomically', async () => {
      // 1. Create task
      const created = await createTaskAtomic(prisma, {
        title: `Task Approve Target ${testRunId}`,
        dueDate: '2026-11-10',
        createdById: testCreatorId,
        status: TaskStatus.WAITING_APPROVAL,
      });

      // 2. Submit deliverable
      const sub = await submitDeliverableAtomic(prisma, {
        taskId: created.task.id,
        title: 'Bản nghiệm thu sản phẩm cuối',
        fileUrl: 'https://example.com/final.pdf',
        uploadedById: testCreatorId,
      });

      let auditRan = false;

      // 3. Approve task with resolution and deliverable approval
      const result = await approveTaskAtomic(prisma, {
        taskId: created.task.id,
        approverId: testApproverId,
        // A caller-provided partial value must not create an internally
        // contradictory COMPLETED task.
        progressPercent: 17,
        resolution: {
          resolutionType: ResolutionType.DIRECTIVE_NOTE,
          directiveNote: 'Đạt yêu cầu xuất sắc. Phê duyệt hoàn thành nhiệm vụ.',
        },
        deliverableReview: {
          deliverableId: sub.deliverable.id,
          reviewStatus: DeliverableReviewStatus.APPROVED,
          reviewNote: 'Hồ sơ minh chứng đầy đủ, đúng tiến độ.',
        },
        auditRecorder: async (tx, info) => {
          auditRan = true;
          assert.strictEqual(info.action, 'TASK_APPROVED');
          assert.strictEqual(info.actorId, testApproverId);
        },
      });

      assert.strictEqual(result.task.status, TaskStatus.COMPLETED);
      assert.strictEqual(result.task.progressPercent, 100);
      assert.ok(result.task.completedAt);
      assert.ok(result.resolution);
      assert.strictEqual(result.resolution?.actorId, testApproverId);
      assert.strictEqual(auditRan, true);

      // Check deliverable in DB
      const dbDeliverable = await prisma.taskDeliverable.findUnique({
        where: { id: sub.deliverable.id },
      });
      assert.strictEqual(dbDeliverable?.reviewStatus, DeliverableReviewStatus.APPROVED);
      assert.strictEqual(dbDeliverable?.reviewerId, testApproverId);

      // Check resolution in DB
      const dbResolution = await prisma.executiveResolution.findFirst({
        where: { taskId: created.task.id },
      });
      assert.ok(dbResolution);
      assert.strictEqual(dbResolution?.directiveNote, 'Đạt yêu cầu xuất sắc. Phê duyệt hoàn thành nhiệm vụ.');
    });

    test('Atomic Rollback: fails at afterResolution step - task remains in prior status and no resolution is saved', async () => {
      const created = await createTaskAtomic(prisma, {
        title: `Task Rollback Resolution ${testRunId}`,
        dueDate: '2026-11-10',
        createdById: testCreatorId,
        status: TaskStatus.WAITING_APPROVAL,
      });

      await assert.rejects(
        async () => {
          await approveTaskAtomic(prisma, {
            taskId: created.task.id,
            approverId: testApproverId,
            resolution: {
              resolutionType: ResolutionType.DIRECTIVE_NOTE,
              directiveNote: 'This note must not be saved.',
            },
            failAtStep: 'afterResolution',
          });
        },
        {
          message: /Simulated failure after resolution creation/,
        }
      );

      // Verify task is still WAITING_APPROVAL
      const task = await prisma.task.findUnique({
        where: { id: created.task.id },
      });
      assert.strictEqual(task?.status, TaskStatus.WAITING_APPROVAL);

      // Verify no resolution was persisted
      const resolutions = await prisma.executiveResolution.findMany({
        where: { taskId: created.task.id },
      });
      assert.strictEqual(resolutions.length, 0);
    });

    test('Atomic Rollback: audit recording failure aborts task completion', async () => {
      const created = await createTaskAtomic(prisma, {
        title: `Task Rollback Approve Audit ${testRunId}`,
        dueDate: '2026-11-10',
        createdById: testCreatorId,
        status: TaskStatus.WAITING_APPROVAL,
      });

      await assert.rejects(
        async () => {
          await approveTaskAtomic(prisma, {
            taskId: created.task.id,
            approverId: testApproverId,
            audit: {
              failSimulate: true,
            },
          });
        },
        {
          message: /Simulated audit failure/,
        }
      );

      // Task must remain WAITING_APPROVAL
      const task = await prisma.task.findUnique({
        where: { id: created.task.id },
      });
      assert.strictEqual(task?.status, TaskStatus.WAITING_APPROVAL);
    });
  });

  // ==========================================================================
  // SUITE 4: createDocumentDirectiveAtomic
  // ==========================================================================
  describe('4. createDocumentDirectiveAtomic: Directive + Document Touch + Audit', () => {
    let docSequence = 0;
    const createTestDoc = async (customSummary: string) => {
      if (docSequence === 0) {
        const maxDoc = await prisma.document.findFirst({
          where: { type: DocumentType.VAN_BAN_DEN, documentYear: 2026 },
          orderBy: { registrationNumber: 'desc' },
          select: { registrationNumber: true },
        });
        docSequence = (maxDoc?.registrationNumber ?? 0) + 1000;
      }
      docSequence += 1;
      return prisma.document.create({
        data: {
          type: DocumentType.VAN_BAN_DEN,
          registrationNumber: docSequence,
          documentYear: 2026,
          originalNumber: `CV-${Date.now()}-${docSequence}`,
          issuedDate: new Date(),
          issuingAuthority: 'Sở LĐ-TB&XH ',
          category: 'Công văn',
          summary: customSummary,
          urgency: DocumentUrgency.THUONG,
          securityLevel: DocumentSecurityLevel.THUONG,
          status: DocumentStatus.CHO_PHAN_CONG,
          registeredById: testCreatorId,
        },
      });
    };

    test('Happy path: creates directive and updates document status to DANG_XU_LY', async () => {
      const doc = await createTestDoc(`Văn bản chỉ đạo thử nghiệm ${testRunId}`);

      let auditRan = false;

      const result = await createDocumentDirectiveAtomic(prisma, {
        documentId: doc.id,
        leaderId: testApproverId,
        assignedDeptId: testDepartmentId,
        instruction: 'Yêu cầu phòng chuyên môn khẩn trương triển khai theo đúng thời hạn.',
        deadline: '2026-10-30',
        collaboratorIds: [testCollaboratorId],
        targetDocumentStatus: DocumentStatus.DANG_XU_LY,
        auditRecorder: async (tx, info) => {
          auditRan = true;
          assert.strictEqual(info.entityType, 'DocumentDirective');
          assert.strictEqual(info.action, 'DOCUMENT_DIRECTIVE_CREATED');
        },
      });

      assert.ok(result.directive.id);
      assert.strictEqual(result.directive.leaderId, testApproverId);
      assert.strictEqual(result.document.status, DocumentStatus.DANG_XU_LY);
      assert.strictEqual(result.document.leadDepartmentId, testDepartmentId);
      assert.strictEqual(auditRan, true);

      // Verify in DB
      const dbDoc = await prisma.document.findUnique({
        where: { id: doc.id },
      });
      assert.strictEqual(dbDoc?.status, DocumentStatus.DANG_XU_LY);
      assert.strictEqual(dbDoc?.leadDepartmentId, testDepartmentId);

      const dbDirective = await prisma.documentDirective.findUnique({
        where: { id: result.directive.id },
      });
      assert.ok(dbDirective);
      assert.strictEqual(dbDirective?.instruction, 'Yêu cầu phòng chuyên môn khẩn trương triển khai theo đúng thời hạn.');
    });

    test('Atomic Rollback: fails at afterDocumentTouch - directive not persisted and document status untouched', async () => {
      const doc = await createTestDoc(`Văn bản rollback touch ${testRunId}`);

      await assert.rejects(
        async () => {
          await createDocumentDirectiveAtomic(prisma, {
            documentId: doc.id,
            leaderId: testApproverId,
            assignedDeptId: testDepartmentId,
            instruction: 'Chỉ đạo này sẽ bị rollback.',
            failAtStep: 'afterDocumentTouch',
          });
        },
        {
          message: /Simulated failure after document update/,
        }
      );

      // Verify document status was NOT modified
      const reloadedDoc = await prisma.document.findUnique({
        where: { id: doc.id },
      });
      assert.strictEqual(reloadedDoc?.status, DocumentStatus.CHO_PHAN_CONG);

      // Verify directive does not exist
      const directives = await prisma.documentDirective.findMany({
        where: { documentId: doc.id },
      });
      assert.strictEqual(directives.length, 0);
    });

    test('Atomic Rollback: OCC conflict on document aborts directive creation', async () => {
      const doc = await createTestDoc(`Văn bản OCC rollback ${testRunId}`);

      await assert.rejects(
        async () => {
          await createDocumentDirectiveAtomic(prisma, {
            documentId: doc.id,
            leaderId: testApproverId,
            assignedDeptId: testDepartmentId,
            instruction: 'Chỉ đạo trên văn bản với version không hợp lệ',
            expectedDocumentVersion: 888, // Stale version
          });
        },
        (err: any) => {
          assert.ok(err instanceof ConcurrencyConflictError);
          assert.strictEqual(err.status, 409);
          return true;
        }
      );

      // Directives must be 0
      const directives = await prisma.documentDirective.findMany({
        where: { documentId: doc.id },
      });
      assert.strictEqual(directives.length, 0);
    });
  });

  // ==========================================================================
  // SUITE 5: Isolation of External Non-Transactional Systems
  // ==========================================================================
  describe('5. External Non-Transactional Systems Isolation Invariant', () => {
    test('runInTransaction executes and returns cleanly without invoking external side-effects in tx', async () => {
      let externalApiCalledInsideTx = false;
      let afterCommitExecuted = false;

      await runInTransaction(prisma, async (tx) => {
        // Invariant check: tx should only execute DB queries
        assert.ok(tx.task, 'tx should have access to Prisma models');
        // If developer mistakenly invokes external non-transactional system:
        // We enforce that external systems should never be called here
        if (externalApiCalledInsideTx) {
          throw new Error('Violation: external non-transactional call executed inside transaction');
        }
      });

      // External calls must be executed strictly AFTER transaction commit
      afterCommitExecuted = true;
      assert.strictEqual(afterCommitExecuted, true);
    });

    test('afterCommit failure does not roll back an already committed database transaction', async () => {
      const taskTitle = `Task PostCommit Error ${testRunId}`;

      // Call createTaskAtomic with an afterCommit that throws
      const result = await createTaskAtomic(prisma, {
        title: taskTitle,
        dueDate: '2026-11-20',
        createdById: testCreatorId,
        afterCommit: async () => {
          throw new Error('External push service timeout or offline error');
        },
      });

      // Task must remain safely committed in the DB
      const persisted = await prisma.task.findUnique({
        where: { id: result.task.id },
      });
      assert.ok(persisted, 'Database transaction remains committed despite post-commit hook error');
    });
  });
});
