import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';
import { taskCommandService } from '@/server/tasks/task-command-service';
import {
  TaskStatus,
  TaskPriority,
  TaskScope,
  TaskActorRole,
  DocumentStatus,
  IncomingDocumentStatus,
  DocumentType,
  DocumentSecurityLevel,
  DocumentUrgency,
  UserRole,
  UnitType,
  UnitStatus,
} from '@prisma/client';

describe('Task <-> Document Bidirectional Status Synchronization', { concurrency: 1 }, () => {
  let testDept: any;
  let adminUser: any;
  let creatorUser: any;
  let staffUser: any;

  const createdTaskIds: string[] = [];
  const createdDocIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdAssignmentIds: string[] = [];

  before(async () => {
    const timestamp = Date.now();
    const deptId = `dept_sync_${timestamp}_${Math.random().toString(36).slice(2, 6)}`;

    testDept = await prisma.organizationalUnit.create({
      data: {
        id: deptId,
        code: deptId,
        name: 'Phòng Hành chính Tổng hợp (Test Sync)',
        type: UnitType.DEPARTMENT,
        status: UnitStatus.ACTIVE,
      },
    });

    let posExecDef = await prisma.positionDefinition.findUnique({
      where: { code: 'HIEU_TRUONG' },
    });
    if (!posExecDef) {
      posExecDef = await prisma.positionDefinition.create({
        data: {
          code: 'HIEU_TRUONG',
          title: 'Hiệu trưởng',
          group: 'LDPU',
          isLeadership: true,
        },
      });
    }

    let posDeptHeadDef = await prisma.positionDefinition.findUnique({
      where: { code: 'TRUONG_PHONG' },
    });
    if (!posDeptHeadDef) {
      posDeptHeadDef = await prisma.positionDefinition.create({
        data: {
          code: 'TRUONG_PHONG',
          title: 'Trưởng phòng',
          group: 'LDPU',
          isLeadership: true,
        },
      });
    }

    adminUser = await prisma.user.create({
      data: {
        email: `admin_sync_${timestamp}@qcet.edu.vn`,
        name: 'Lãnh đạo Sync Test',
        role: UserRole.BAN_GIAM_HIEU,
      },
    });
    createdUserIds.push(adminUser.id);

    const assignAdmin = await prisma.positionAssignment.create({
      data: {
        userId: adminUser.id,
        positionDefinitionId: posExecDef.id,
        unitId: testDept.id,
        status: 'ACTIVE',
      },
    });
    createdAssignmentIds.push(assignAdmin.id);

    creatorUser = await prisma.user.create({
      data: {
        email: `creator_sync_${timestamp}@qcet.edu.vn`,
        name: 'Người giao việc Sync Test',
        role: UserRole.TRUONG_PHONG,
      },
    });
    createdUserIds.push(creatorUser.id);

    const assignCreator = await prisma.positionAssignment.create({
      data: {
        userId: creatorUser.id,
        positionDefinitionId: posDeptHeadDef.id,
        unitId: testDept.id,
        status: 'ACTIVE',
      },
    });
    createdAssignmentIds.push(assignCreator.id);

    staffUser = await prisma.user.create({
      data: {
        email: `staff_sync_${timestamp}@qcet.edu.vn`,
        name: 'Chuyên viên Sync Test',
        role: UserRole.CHUYEN_VIEN,
      },
    });
    createdUserIds.push(staffUser.id);
  });

  after(async () => {
    // Cleanup created documents and workflows
    if (createdDocIds.length > 0) {
      await prisma.documentIncomingWorkflow.deleteMany({
        where: { documentId: { in: createdDocIds } },
      });
      await prisma.document.deleteMany({
        where: { id: { in: createdDocIds } },
      });
    }

    // Cleanup created tasks
    if (createdTaskIds.length > 0) {
      await prisma.taskActor.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.taskDeliverable.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.task.deleteMany({
        where: { id: { in: createdTaskIds } },
      });
    }

    // Cleanup position assignments
    if (createdAssignmentIds.length > 0) {
      await prisma.positionAssignment.deleteMany({
        where: { id: { in: createdAssignmentIds } },
      });
    }

    // Cleanup users and department
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }

    if (testDept?.id) {
      await prisma.organizationalUnit.deleteMany({
        where: { id: testDept.id },
      });
    }
  });

  async function createFixture(options?: {
    taskStatus?: TaskStatus;
    docStatus?: DocumentStatus;
    workflowStatus?: IncomingDocumentStatus;
    withDocument?: boolean;
  }) {
    const timestamp = Date.now() + Math.floor(Math.random() * 100000);
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const status = options?.taskStatus ?? TaskStatus.WAITING_APPROVAL;
    const isCompleted = status === TaskStatus.COMPLETED;
    const isWaiting = status === TaskStatus.WAITING_APPROVAL;

    const task = await prisma.task.create({
      data: {
        code: `NV-SYNC-${timestamp}`,
        title: `Nhiệm vụ kiểm thử Sync ${timestamp}`,
        priority: TaskPriority.HIGH,
        scope: TaskScope.DEPARTMENT,
        createdById: creatorUser.id,
        leadUnitId: testDept.id,
        dueDate,
        academicMonth: 9,
        academicYear: '2026-2027',
        status,
        progressPercent: isCompleted || isWaiting ? 100 : 0,
        completedAt: isCompleted ? new Date() : null,
        version: 1,
        actors: {
          create: [
            {
              userId: staffUser.id,
              role: TaskActorRole.DRI,
              isPrimaryDRI: true,
              appointedAt: new Date(),
            },
          ],
        },
      },
    });
    createdTaskIds.push(task.id);

    let document: any = null;

    if (options?.withDocument !== false) {
      document = await prisma.document.create({
        data: {
          registrationNumber: Math.floor(Math.random() * 900000) + 10000,
          originalNumber: `ORIG-${timestamp}`,
          issuedDate: new Date(),
          issuingAuthority: 'Sở GD&ĐT',
          category: 'QUYET_DINH',
          summary: `Trích yếu văn bản đến kiểm thử Sync ${timestamp}`,
          type: DocumentType.VAN_BAN_DEN,
          documentYear: 2026,
          registeredDate: new Date(),
          securityLevel: DocumentSecurityLevel.THUONG,
          urgency: DocumentUrgency.THUONG,
          status: options?.docStatus ?? DocumentStatus.DANG_XU_LY,
          registeredById: creatorUser.id,
          linkedTaskId: task.id,
          incomingWorkflow: {
            create: {
              status: options?.workflowStatus ?? IncomingDocumentStatus.IN_PROGRESS,
            },
          },
        },
        include: {
          incomingWorkflow: true,
        },
      });
      createdDocIds.push(document.id);
    }

    return { task, document };
  }

  test('1. updateTask COMPLETED khi linkedDoc có incomingWorkflow IN_PROGRESS -> doc.status === DA_HOAN_THANH, workflow.status === RESOLVED', async () => {
    const { task, document } = await createFixture({
      taskStatus: TaskStatus.WAITING_APPROVAL,
      docStatus: DocumentStatus.DANG_XU_LY,
      workflowStatus: IncomingDocumentStatus.IN_PROGRESS,
    });

    const context = {
      user: {
        id: adminUser.id,
        role: adminUser.role,
        email: adminUser.email,
        name: adminUser.name,
      },
    };

    await taskCommandService.updateTask(context as any, task.id, {
      status: TaskStatus.COMPLETED,
      progressPercent: 100,
    });

    const updatedDoc = await prisma.document.findUnique({
      where: { id: document.id },
      include: { incomingWorkflow: true },
    });

    assert.equal(updatedDoc?.status, DocumentStatus.DA_HOAN_THANH);
    assert.equal(updatedDoc?.incomingWorkflow?.status, IncomingDocumentStatus.RESOLVED);
    assert.ok(updatedDoc?.incomingWorkflow?.resolvedAt);
    assert.equal(updatedDoc?.incomingWorkflow?.resolvedById, adminUser.id);
  });

  test('2. updateTask COMPLETED khi linkedDoc đã RESOLVED -> không thay đổi (idempotent)', async () => {
    const { task, document } = await createFixture({
      taskStatus: TaskStatus.WAITING_APPROVAL,
      docStatus: DocumentStatus.DA_HOAN_THANH,
      workflowStatus: IncomingDocumentStatus.RESOLVED,
    });

    const context = {
      user: {
        id: adminUser.id,
        role: adminUser.role,
        email: adminUser.email,
        name: adminUser.name,
      },
    };

    await taskCommandService.updateTask(context as any, task.id, {
      status: TaskStatus.COMPLETED,
      progressPercent: 100,
    });

    const updatedDoc = await prisma.document.findUnique({
      where: { id: document.id },
      include: { incomingWorkflow: true },
    });

    assert.equal(updatedDoc?.status, DocumentStatus.DA_HOAN_THANH);
    assert.equal(updatedDoc?.incomingWorkflow?.status, IncomingDocumentStatus.RESOLVED);
  });

  test('3. updateTask COMPLETED khi không có linkedDoc -> hoàn thành thành công không lỗi', async () => {
    const { task } = await createFixture({
      taskStatus: TaskStatus.WAITING_APPROVAL,
      withDocument: false,
    });

    const context = {
      user: {
        id: adminUser.id,
        role: adminUser.role,
        email: adminUser.email,
        name: adminUser.name,
      },
    };

    const updatedTask = await taskCommandService.updateTask(context as any, task.id, {
      status: TaskStatus.COMPLETED,
      progressPercent: 100,
    });

    assert.equal(updatedTask.status, TaskStatus.COMPLETED);
    assert.equal(updatedTask.progressPercent, 100);
  });

  test('4. deleteTask khi linkedDoc.status === DANG_XU_LY -> reset doc.status = CHO_PHAN_CONG, linkedTaskId = null, workflow.status = DIRECTED', async () => {
    const { task, document } = await createFixture({
      taskStatus: TaskStatus.IN_PROGRESS,
      docStatus: DocumentStatus.DANG_XU_LY,
      workflowStatus: IncomingDocumentStatus.IN_PROGRESS,
    });

    const context = {
      user: {
        id: adminUser.id,
        role: adminUser.role,
        email: adminUser.email,
        name: adminUser.name,
      },
    };

    const deleteResult = await taskCommandService.deleteTask(context as any, task.id);
    assert.equal(deleteResult.success, true);

    const updatedDoc = await prisma.document.findUnique({
      where: { id: document.id },
      include: { incomingWorkflow: true },
    });

    assert.equal(updatedDoc?.status, DocumentStatus.CHO_PHAN_CONG);
    assert.equal(updatedDoc?.linkedTaskId, null);
    assert.equal(updatedDoc?.incomingWorkflow?.status, IncomingDocumentStatus.DIRECTED);
  });

  test('5. deleteTask khi linkedDoc.status === DA_HOAN_THANH -> chỉ nullify linkedTaskId mà không reset status', async () => {
    const { task, document } = await createFixture({
      taskStatus: TaskStatus.COMPLETED,
      docStatus: DocumentStatus.DA_HOAN_THANH,
      workflowStatus: IncomingDocumentStatus.RESOLVED,
    });

    const context = {
      user: {
        id: adminUser.id,
        role: adminUser.role,
        email: adminUser.email,
        name: adminUser.name,
      },
    };

    const deleteResult = await taskCommandService.deleteTask(context as any, task.id);
    assert.equal(deleteResult.success, true);

    const updatedDoc = await prisma.document.findUnique({
      where: { id: document.id },
      include: { incomingWorkflow: true },
    });

    assert.equal(updatedDoc?.status, DocumentStatus.DA_HOAN_THANH);
    assert.equal(updatedDoc?.linkedTaskId, null);
    assert.equal(updatedDoc?.incomingWorkflow?.status, IncomingDocumentStatus.RESOLVED);
  });

  test('6. deleteTask khi không có linkedDoc -> xóa nhiệm vụ thành công không lỗi', async () => {
    const { task } = await createFixture({
      taskStatus: TaskStatus.IN_PROGRESS,
      withDocument: false,
    });

    const context = {
      user: {
        id: adminUser.id,
        role: adminUser.role,
        email: adminUser.email,
        name: adminUser.name,
      },
    };

    const deleteResult = await taskCommandService.deleteTask(context as any, task.id);
    assert.equal(deleteResult.success, true);

    const deletedTask = await prisma.task.findUnique({
      where: { id: task.id },
    });
    assert.equal(deletedTask, null);
  });
});
