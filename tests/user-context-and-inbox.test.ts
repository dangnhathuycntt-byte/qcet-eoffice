import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import {
  UserRole,
  UnitType,
  JobCatalogGroup,
  AssignmentType,
  AssignmentStatus,
  ResponsibilityCategory,
  DelegationStatus,
  TaskStatus,
  TaskActorRole,
  TaskPriority,
  TaskScope,
  IncomingDocumentStatus,
  OutgoingDocumentStatus,
  DocumentType,
  DocumentSecurityLevel,
  DossierStatus,
  DataClassification,
} from '@prisma/client';
import { UserContextService } from '../src/server/services/user-context-service';
import { ActionInboxService } from '../src/server/services/action-inbox-service';

test('Phase 9: Institutional Context API & Action Inbox Aggregator', async (t) => {
  const runId = Date.now().toString();

  // Setup test environment: Units, Positions, Users
  const bghUnit = await prisma.organizationalUnit.create({
    data: {
      code: `BGH_${runId}`,
      name: `Ban Giám hiệu ${runId}`,
      type: UnitType.SCHOOL,
    },
  });

  const trainingUnit = await prisma.organizationalUnit.create({
    data: {
      code: `DT_${runId}`,
      name: `Phòng Đào tạo ${runId}`,
      type: UnitType.DEPARTMENT,
      parentId: bghUnit.id,
    },
  });

  const principalPosition = await prisma.positionDefinition.create({
    data: {
      code: `PRINCIPAL_${runId}`,
      title: `Hiệu trưởng ${runId}`,
      group: JobCatalogGroup.LDPU,
    },
  });

  const headPosition = await prisma.positionDefinition.create({
    data: {
      code: `HEAD_DT_${runId}`,
      title: `Trưởng phòng Đào tạo ${runId}`,
      group: JobCatalogGroup.LDPU,
    },
  });

  const specialistPosition = await prisma.positionDefinition.create({
    data: {
      code: `SPEC_${runId}`,
      title: `Chuyên viên ${runId}`,
      group: JobCatalogGroup.VCDC,
    },
  });

  const respArea = await prisma.responsibilityArea.create({
    data: {
      code: `TRAINING_${runId}`,
      name: `Quản lý Đào tạo ${runId}`,
      category: ResponsibilityCategory.ACADEMIC,
    },
  });

  // Users
  const bghUser = await prisma.user.create({
    data: {
      email: `bgh_${runId}@qcet.edu.vn`,
      name: `Hiệu trưởng ${runId}`,
      role: UserRole.BAN_GIAM_HIEU,
    },
  });

  const headUser = await prisma.user.create({
    data: {
      email: `head_${runId}@qcet.edu.vn`,
      name: `Trưởng phòng ${runId}`,
      role: UserRole.TRUONG_PHONG,
    },
  });

  const specialistUser = await prisma.user.create({
    data: {
      email: `spec_${runId}@qcet.edu.vn`,
      name: `Chuyên viên ${runId}`,
      role: UserRole.CHUYEN_VIEN,
    },
  });

  // Position Assignments
  const bghAssignment = await prisma.positionAssignment.create({
    data: {
      userId: bghUser.id,
      positionDefinitionId: principalPosition.id,
      unitId: bghUnit.id,
      type: AssignmentType.PRIMARY,
      status: AssignmentStatus.ACTIVE,
    },
  });

  const headAssignment = await prisma.positionAssignment.create({
    data: {
      userId: headUser.id,
      positionDefinitionId: headPosition.id,
      unitId: trainingUnit.id,
      type: AssignmentType.PRIMARY,
      status: AssignmentStatus.ACTIVE,
    },
  });

  const specAssignment = await prisma.positionAssignment.create({
    data: {
      userId: specialistUser.id,
      positionDefinitionId: specialistPosition.id,
      unitId: trainingUnit.id,
      type: AssignmentType.PRIMARY,
      status: AssignmentStatus.ACTIVE,
    },
  });

  // Portfolio Assignment for BGH
  await prisma.portfolioAssignment.create({
    data: {
      positionAssignmentId: bghAssignment.id,
      responsibilityAreaId: respArea.id,
    },
  });

  // Delegation Grant from Head to Specialist
  const validUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
  await prisma.delegationGrant.create({
    data: {
      grantorAssignmentId: headAssignment.id,
      granteeAssignmentId: specAssignment.id,
      responsibilityAreaId: respArea.id,
      action: 'task.review',
      resourceScope: 'UNIT',
      validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
      validUntil,
      sourceDocumentNumber: `QD-UQ-${runId}`,
      reason: 'Ủy quyền phụ trách duyệt báo cáo tiến độ tuần',
      status: DelegationStatus.ACTIVE,
    },
  });

  await t.test('1. UserContextService: Trả về đầy đủ Identity, Assignments, Portfolios, Delegations và Scopes', async () => {
    const context = await UserContextService.getUserContext(bghUser.id);

    assert.equal(context.identity.id, bghUser.id);
    assert.equal(context.identity.name, bghUser.name);
    assert.ok(context.viewScopes.includes('SCHOOL'));
    assert.ok(context.viewScopes.includes('UNIT'));
    assert.ok(context.viewScopes.includes('PERSONAL'));

    assert.equal(context.activeAssignments.length, 1);
    assert.equal(context.activeAssignments[0].position.title, principalPosition.title);
    assert.equal(context.activeAssignments[0].unit.name, bghUnit.name);

    assert.equal(context.responsibilityAreas.length, 1);
    assert.equal(context.responsibilityAreas[0].code, respArea.code);

    // Context for Specialist (Grantee of Delegation)
    const specContext = await UserContextService.getUserContext(specialistUser.id);
    assert.equal(specContext.delegations.length, 1);
    assert.equal(specContext.delegations[0].direction, 'DELEGATED_TO_ME');
    assert.equal(specContext.delegations[0].counterpartName, headUser.name);
    assert.equal(specContext.delegations[0].isExpiringSoon, true); // < 7 days
    assert.ok(specContext.delegations[0].capabilities.includes('task.review'));
  });

  await t.test('2. ActionInboxService: Tổng hợp Tasks cần xử lý cho DRI và Reviewer với lý do reasonWhyMe rõ ràng', async () => {
    // Task 1: Assigned to Specialist as DRI
    const task1 = await prisma.task.create({
      data: {
        code: `TASK-DRI-${runId}`,
        title: `Nhiệm vụ soạn chương trình đào tạo ${runId}`,
        priority: TaskPriority.HIGH,
        scope: TaskScope.DEPARTMENT,
        leadUnitId: trainingUnit.id,
        createdById: headUser.id,
        academicMonth: 9,
        academicYear: '2026-2027',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        status: TaskStatus.IN_PROGRESS,
      },
    });

    await prisma.taskActor.create({
      data: {
        taskId: task1.id,
        userId: specialistUser.id,
        role: TaskActorRole.DRI,
        isPrimaryDRI: true,
      },
    });

    const inbox = await ActionInboxService.getActionInbox(specialistUser.id);
    assert.ok(inbox.total >= 1);
    const driItem = inbox.items.find((i) => i.resourceId === task1.id);
    assert.ok(driItem, 'Phải tìm thấy Task trong Action Inbox của Specialist');
    assert.equal(driItem?.resourceType, 'TASK');
    assert.equal(driItem?.reasonWhyMe, 'Bạn là Cán bộ xử lý chính (DRI) của nhiệm vụ này');
    assert.equal(driItem?.priority, 'HIGH');
  });

  await t.test('3. ActionInboxService: Văn bản đến chờ Lãnh đạo chỉ đạo (PRESENTED) hiển thị trong Action Inbox của BGH', async () => {
    // Tạo incoming document
    const incomingDoc = await prisma.document.create({
      data: {
        type: DocumentType.VAN_BAN_DEN,
        registrationNumber: Math.floor(Math.random() * 100000) + 1,
        documentYear: 2026,
        originalNumber: `CV-DEN-${runId}`,
        issuedDate: new Date(),
        issuingAuthority: 'Bộ Lao động - Thương binh và Xã hội',
        category: 'Công văn',
        summary: `Công văn chỉ đạo năm học mới ${runId}`,
        securityLevel: DocumentSecurityLevel.THUONG,
        registeredById: headUser.id,
      },
    });

    await prisma.documentIncomingWorkflow.create({
      data: {
        documentId: incomingDoc.id,
        status: IncomingDocumentStatus.PRESENTED,
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      },
    });

    const bghInbox = await ActionInboxService.getActionInbox(bghUser.id);
    const presItem = bghInbox.items.find((i) => i.resourceId === incomingDoc.id);
    assert.ok(presItem, 'Văn bản PRESENTED phải xuất hiện trong Action Inbox của BGH');
    assert.equal(presItem?.resourceType, 'INCOMING_DOCUMENT');
    assert.equal(presItem?.priority, 'URGENT');
    assert.equal(presItem?.reasonWhyMe, 'Văn bản đến đang chờ Ban Giám hiệu chỉ đạo xử lý');
  });
});
