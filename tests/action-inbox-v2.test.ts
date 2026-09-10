import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import {
  UserRole,
  UnitType,
  JobCatalogGroup,
  AssignmentType,
  AssignmentStatus,
  TaskStatus,
  TaskActorRole,
  TaskPriority,
  IncomingDocumentStatus,
  OutgoingDocumentStatus,
  DocumentType,
  DocumentSecurityLevel,
  DossierStatus,
  DataClassification,
} from '@prisma/client';
import { ActionInboxService } from '../src/server/services/action-inbox-service';

describe('Sprint 8: Action Inbox V2 Capability-Driven Isolation Suite', () => {
  test('Action Inbox correctly isolates items based on roles and authorities without leakage', async () => {
    const runId = Date.now().toString();

    // 1. Setup Organizations: School & 2 Units
    const schoolUnit = await prisma.organizationalUnit.create({
      data: {
        code: `BGH_INBOX_${runId}`,
        name: `BGH Inbox ${runId}`,
        type: UnitType.SCHOOL,
      },
    });

    const unitA = await prisma.organizationalUnit.create({
      data: {
        code: `UNIT_A_${runId}`,
        name: `Phòng Ban A ${runId}`,
        type: UnitType.DEPARTMENT,
        parentId: schoolUnit.id,
      },
    });

    const unitB = await prisma.organizationalUnit.create({
      data: {
        code: `UNIT_B_${runId}`,
        name: `Phòng Ban B ${runId}`,
        type: UnitType.DEPARTMENT,
        parentId: schoolUnit.id,
      },
    });

    // 2. Setup Positions
    const posPrincipal = await prisma.positionDefinition.create({
      data: {
        code: `PRINCIPAL_${runId}`,
        title: `Hiệu trưởng ${runId}`,
        group: JobCatalogGroup.LDPU,
      },
    });

    const posHeadA = await prisma.positionDefinition.create({
      data: {
        code: `HEAD_UNIT_A_${runId}`,
        title: `Trưởng phòng A ${runId}`,
        group: JobCatalogGroup.LDPU,
      },
    });

    const posHeadB = await prisma.positionDefinition.create({
      data: {
        code: `HEAD_UNIT_B_${runId}`,
        title: `Trưởng phòng B ${runId}`,
        group: JobCatalogGroup.LDPU,
      },
    });

    const posSpecialistA = await prisma.positionDefinition.create({
      data: {
        code: `SPEC_A_${runId}`,
        title: `Chuyên viên A ${runId}`,
        group: JobCatalogGroup.VCDC,
      },
    });

    const posClerk = await prisma.positionDefinition.create({
      data: {
        code: `CLERICAL_OFFICER_${runId}`,
        title: `Văn thư ${runId}`,
        group: JobCatalogGroup.VCDC,
      },
    });

    // 3. Setup Users
    const principalUser = await prisma.user.create({
      data: {
        email: `principal_${runId}@qcet.edu.vn`,
        name: `Hiệu trưởng ${runId}`,
        role: UserRole.BAN_GIAM_HIEU,
      },
    });

    const headAUser = await prisma.user.create({
      data: {
        email: `head_a_${runId}@qcet.edu.vn`,
        name: `Trưởng phòng A ${runId}`,
        role: UserRole.TRUONG_PHONG,
      },
    });

    const headBUser = await prisma.user.create({
      data: {
        email: `head_b_${runId}@qcet.edu.vn`,
        name: `Trưởng phòng B ${runId}`,
        role: UserRole.TRUONG_PHONG,
      },
    });

    const specialistAUser = await prisma.user.create({
      data: {
        email: `spec_a_${runId}@qcet.edu.vn`,
        name: `Chuyên viên A ${runId}`,
        role: UserRole.CHUYEN_VIEN,
      },
    });

    const clerkUser = await prisma.user.create({
      data: {
        email: `clerk_${runId}@qcet.edu.vn`,
        name: `Văn thư ${runId}`,
        role: UserRole.VAN_THU,
      },
    });

    // 4. Assign positions
    await prisma.positionAssignment.createMany({
      data: [
        {
          userId: principalUser.id,
          positionDefinitionId: posPrincipal.id,
          unitId: schoolUnit.id,
          type: AssignmentType.PRIMARY,
          status: AssignmentStatus.ACTIVE,
        },
        {
          userId: headAUser.id,
          positionDefinitionId: posHeadA.id,
          unitId: unitA.id,
          type: AssignmentType.PRIMARY,
          status: AssignmentStatus.ACTIVE,
        },
        {
          userId: headBUser.id,
          positionDefinitionId: posHeadB.id,
          unitId: unitB.id,
          type: AssignmentType.PRIMARY,
          status: AssignmentStatus.ACTIVE,
        },
        {
          userId: specialistAUser.id,
          positionDefinitionId: posSpecialistA.id,
          unitId: unitA.id,
          type: AssignmentType.PRIMARY,
          status: AssignmentStatus.ACTIVE,
        },
        {
          userId: clerkUser.id,
          positionDefinitionId: posClerk.id,
          unitId: schoolUnit.id,
          type: AssignmentType.PRIMARY,
          status: AssignmentStatus.ACTIVE,
        },
      ],
    });

    // 5. Create Test Items
    // 5a. Task assigned to Specialist A as DRI
    const taskA = await prisma.task.create({
      data: {
        code: `TASK_A_${runId}`,
        title: `Nhiệm vụ chuyên viên A ${runId}`,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        leadUnitId: unitA.id,
        createdById: headAUser.id,
        academicMonth: 9,
        academicYear: '2026-2027',
        dueDate: new Date(Date.now() + 5 * 86400000),
        actors: {
          create: [
            {
              userId: specialistAUser.id,
              role: TaskActorRole.DRI,
            },
          ],
        },
      },
    });

    // 5b. Incoming Document Assigned to Unit A (for Head A)
    const docIncomingUnitA = await prisma.document.create({
      data: {
        type: DocumentType.VAN_BAN_DEN,
        registrationNumber: Math.floor(Math.random() * 1000000) + 1,
        documentYear: 2026,
        originalNumber: `CV-UNIT-A-${runId}`,
        issuedDate: new Date(),
        issuingAuthority: 'UBND Tỉnh',
        category: 'Công văn',
        summary: `Văn bản giao đơn vị A ${runId}`,
        securityLevel: DocumentSecurityLevel.THUONG,
        registeredById: clerkUser.id,
      },
    });

    await prisma.documentIncomingWorkflow.create({
      data: {
        documentId: docIncomingUnitA.id,
        status: IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT,
        leadUnitId: unitA.id,
      },
    });

    // 5c. Outgoing Document format check (for Clerk)
    const docOutgoingClerk = await prisma.document.create({
      data: {
        type: DocumentType.VAN_BAN_DI,
        registrationNumber: Math.floor(Math.random() * 1000000) + 1,
        documentYear: 2026,
        originalNumber: `CV-OUT-${runId}`,
        issuedDate: new Date(),
        issuingAuthority: 'Trường QCET',
        category: 'Quyết định',
        summary: `Dự thảo quyết định chờ thể thức ${runId}`,
        securityLevel: DocumentSecurityLevel.THUONG,
        registeredById: headAUser.id,
      },
    });

    await prisma.documentOutgoingWorkflow.create({
      data: {
        documentId: docOutgoingClerk.id,
        status: OutgoingDocumentStatus.FORMAT_CHECK,
      },
    });

    // 6. Test Specialist A Inbox
    const inboxSpecA = await ActionInboxService.getActionInbox(specialistAUser.id);
    const specTaskItem = inboxSpecA.items.find((i) => i.resourceId === taskA.id);
    assert.ok(specTaskItem, 'Specialist A must have taskA as DRI in inbox');
    assert.equal(specTaskItem?.linkUrl, `/tasks/${taskA.id}`);
    assert.ok(!specTaskItem?.linkUrl.includes('zone='), 'No legacy zone query in link');

    // Make sure Specialist A does NOT see Unit A head incoming document
    const specLeakDoc = inboxSpecA.items.find((i) => i.resourceId === docIncomingUnitA.id);
    assert.equal(specLeakDoc, undefined, 'Specialist A must not see unit head document');

    // Make sure Specialist A does NOT see Clerk format check document
    const specLeakClerk = inboxSpecA.items.find((i) => i.resourceId === docOutgoingClerk.id);
    assert.equal(specLeakClerk, undefined, 'Specialist A must not see clerk document');

    // 7. Test Head A Inbox vs Head B Inbox
    const inboxHeadA = await ActionInboxService.getActionInbox(headAUser.id);
    const headADoc = inboxHeadA.items.find((i) => i.resourceId === docIncomingUnitA.id);
    assert.ok(headADoc, 'Head A must have docIncomingUnitA in inbox');

    const inboxHeadB = await ActionInboxService.getActionInbox(headBUser.id);
    const headBDoc = inboxHeadB.items.find((i) => i.resourceId === docIncomingUnitA.id);
    assert.equal(headBDoc, undefined, 'Head B must NOT see doc assigned to Unit A');

    // 8. Test Clerk Inbox
    const inboxClerk = await ActionInboxService.getActionInbox(clerkUser.id);
    const clerkItem = inboxClerk.items.find((i) => i.resourceId === docOutgoingClerk.id);
    assert.ok(clerkItem, 'Clerk must have format check document in inbox');
    assert.equal(clerkItem?.requiredAction, 'Kiểm tra thể thức văn bản đi');
  });
});
