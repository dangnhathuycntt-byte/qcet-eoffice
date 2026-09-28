import { test, describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  UserRole,
  DocumentType,
  DocumentUrgency,
  DocumentSecurityLevel,
  IncomingDocumentStatus,
  DossierStatus,
  TaskStatus,
  UnitType,
  JobCatalogGroup,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  registerIncomingDocument,
  presentDocument,
  directDocument,
  assignUnitWork,
  resolveDocument,
  fileDocument,
  getIncomingDocument,
  listIncomingWorkflows,
} from "../src/lib/services/incoming-document-service";
import { AuthorizationError, ValidationError } from "../src/server/api/errors";
import { signSessionToken } from "../src/lib/jwt-session";
import { POST as incomingRegisterRoute } from "../src/app/api/documents/incoming/route";
import { POST as presentRoute } from "../src/app/api/documents/[id]/actions/present/route";
import { POST as directRoute } from "../src/app/api/documents/[id]/actions/direct/route";
import { POST as assignUnitRoute } from "../src/app/api/documents/[id]/actions/assign-unit/route";
import { POST as resolveRoute } from "../src/app/api/documents/[id]/actions/resolve/route";
import { POST as fileRoute } from "../src/app/api/documents/[id]/actions/file/route";

describe("Phase 5: Incoming Documents V2 Domain & Workflow (Nghị định 30/2020/NĐ-CP)", () => {
  const testRunId = `inc_v2_${Date.now()}`;

  async function seedArchiveCheckedDossier(
    documentId: string,
    owningUnitId: string,
    responsiblePersonId: string,
    taskId?: string
  ) {
    const retentionRule = await prisma.retentionRule.upsert({
      where: { code: `RET-${testRunId}` },
      update: {},
      create: {
        code: `RET-${testRunId}`,
        name: `Thời hạn bảo quản kiểm thử ${testRunId}`,
        durationYears: 5,
      },
    });
    const document = await prisma.document.findUniqueOrThrow({
      where: { id: documentId },
      select: { summary: true, originalNumber: true, issuedDate: true },
    });
    const dossier = await prisma.workDossier.create({
      data: {
        code: `HS-${testRunId}-${documentId.slice(-6)}`,
        title: `Hồ sơ xử lý ${document.summary}`,
        owningUnitId,
        responsiblePersonId,
        retentionRuleId: retentionRule.id,
        status: DossierStatus.READY_FOR_ARCHIVE,
        items: {
          create: [
            {
              itemType: "DOCUMENT",
              itemId: documentId,
              title: document.summary,
              documentNumber: document.originalNumber,
              documentDate: document.issuedDate,
              addedById: responsiblePersonId,
            },
            {
              itemType: "RESULT",
              itemId: `result-${documentId}`,
              title: `Báo cáo kết quả ${document.summary}`,
              addedById: responsiblePersonId,
            },
            ...(taskId
              ? [{
                  itemType: "TASK" as const,
                  itemId: taskId,
                  title: `Nhiệm vụ xử lý ${document.summary}`,
                  addedById: responsiblePersonId,
                }]
              : []),
          ],
        },
      },
    });
    await prisma.documentIncomingWorkflow.update({
      where: { documentId },
      data: { dossierId: dossier.id },
    });
    return dossier;
  }

  let deptLeadId: string;
  let deptCoordId: string;
  let deptUnrelatedId: string;

  let clerkUser: any;
  let rectorUser: any;
  let unitHeadLead: any;
  let unitHeadUnrelated: any;
  let specialistDri: any;
  let specialistCollab: any;
  let unprivilegedStaff: any;
  const positionAssignmentIds: string[] = [];
  const createdPositionDefinitionIds: string[] = [];

  before(async () => {
    // 1. Create or retrieve test organizational units & departments
    const d1 = await prisma.organizationalUnit.create({
      data: {
        id: `dept-lead-${testRunId}`,
        code: `QLDT_${testRunId.slice(-4)}`,
        name: `Phòng Quản lý Đào tạo ${testRunId}`,
        type: UnitType.DEPARTMENT,
      },
    });
    deptLeadId = d1.id;

    const d2 = await prisma.organizationalUnit.create({
      data: {
        id: `dept-coord-${testRunId}`,
        code: `KHTC_${testRunId.slice(-4)}`,
        name: `Phòng Kế hoạch Tài chính ${testRunId}`,
        type: UnitType.DEPARTMENT,
      },
    });
    deptCoordId = d2.id;

    const d3 = await prisma.organizationalUnit.create({
      data: {
        id: `dept-unrelated-${testRunId}`,
        code: `CNTT_${testRunId.slice(-4)}`,
        name: `Khoa Công nghệ Thông tin ${testRunId}`,
        type: UnitType.FACULTY,
      },
    });
    deptUnrelatedId = d3.id;

    // 2. Create canonical position definitions and position assignments for authorization
    const positionResults = await Promise.all([
      ['HIEU_TRUONG', 'Hiệu trưởng', true],
      ['TRUONG_PHONG', 'Trưởng phòng', true],
      ['GIANG_VIEN', 'Giảng viên', false],
      ['VAN_THU', 'Văn thư', false],
    ].map(async ([code, title, isLeadership]) => {
      const existing = await prisma.positionDefinition.findUnique({
        where: { code: code as string },
      });
      if (existing) return { position: existing, created: false };

      const position = await prisma.positionDefinition.create({
        data: {
          code: code as string,
          title: title as string,
          group: isLeadership ? JobCatalogGroup.LDPU : JobCatalogGroup.VCMN,
          isLeadership: isLeadership as boolean,
        },
      });
      return { position, created: true };
    }));
    createdPositionDefinitionIds.push(
      ...positionResults.filter((result) => result.created).map((result) => result.position.id)
    );
    const positionByCode = new Map(
      positionResults.map(({ position }) => [position.code, position])
    );

    // 3. Create test users with authentic roles & titles
    clerkUser = await prisma.user.create({
      data: {
        id: `user-clerk-${testRunId}`,
        email: `clerk.${testRunId}@qcet.edu.vn`,
        name: "Văn thư Test",
        role: UserRole.VAN_THU,
        title: "Văn thư viên",

      },
    });

    rectorUser = await prisma.user.create({
      data: {
        id: `user-rector-${testRunId}`,
        email: `rector.${testRunId}@qcet.edu.vn`,
        name: "Hiệu trưởng Test",
        role: UserRole.BAN_GIAM_HIEU,
        title: "Hiệu trưởng",

      },
    });

    unitHeadLead = await prisma.user.create({
      data: {
        id: `user-head-lead-${testRunId}`,
        email: `head.lead.${testRunId}@qcet.edu.vn`,
        name: "Trưởng phòng Đào tạo Test",
        role: UserRole.TRUONG_PHONG,
        title: "Trưởng phòng",

      },
    });

    unitHeadUnrelated = await prisma.user.create({
      data: {
        id: `user-head-unrelated-${testRunId}`,
        email: `head.unrelated.${testRunId}@qcet.edu.vn`,
        name: "Trưởng khoa CNTT Test",
        role: UserRole.TRUONG_PHONG,
        title: "Trưởng khoa",

      },
    });

    specialistDri = await prisma.user.create({
      data: {
        id: `user-dri-${testRunId}`,
        email: `dri.${testRunId}@qcet.edu.vn`,
        name: "Chuyên viên Phụ trách Chính",
        role: UserRole.CHUYEN_VIEN,
        title: "Chuyên viên",

      },
    });

    specialistCollab = await prisma.user.create({
      data: {
        id: `user-collab-${testRunId}`,
        email: `collab.${testRunId}@qcet.edu.vn`,
        name: "Chuyên viên Phối hợp",
        role: UserRole.CHUYEN_VIEN,
        title: "Chuyên viên",

      },
    });

    unprivilegedStaff = await prisma.user.create({
      data: {
        id: `user-unprivileged-${testRunId}`,
        email: `unprivileged.${testRunId}@qcet.edu.vn`,
        name: "Nhân viên Không thẩm quyền",
        role: UserRole.CHUYEN_VIEN,
        title: "Nhân viên",

      },
    });

    const assignmentInputs = [
      [clerkUser.id, 'VAN_THU', `dept-lead-${testRunId}`],
      [rectorUser.id, 'HIEU_TRUONG', deptLeadId],
      [unitHeadLead.id, 'TRUONG_PHONG', deptLeadId],
      [unitHeadUnrelated.id, 'TRUONG_PHONG', deptUnrelatedId],
      [specialistDri.id, 'GIANG_VIEN', deptLeadId],
      [specialistCollab.id, 'GIANG_VIEN', deptLeadId],
      [unprivilegedStaff.id, 'GIANG_VIEN', deptUnrelatedId],
    ] as const;
    for (const [userId, positionCode, unitId] of assignmentInputs) {
      const assignment = await prisma.positionAssignment.create({
        data: {
          userId,
          positionDefinitionId: positionByCode.get(positionCode)!.id,
          unitId,
          type: 'PRIMARY',
          status: 'ACTIVE',
        },
      });
      positionAssignmentIds.push(assignment.id);
    }
  });

  after(async () => {
    // Clean up created records
    try {
      await prisma.unitWorkAssignment.deleteMany({
        where: {
          OR: [
            { driUserId: { in: [specialistDri.id, specialistCollab.id] } },
            { assignedById: unitHeadLead.id },
          ],
        },
      });

      await prisma.documentDirective.deleteMany({
        where: {
          document: { summary: { contains: testRunId } },
        },
      });

      await prisma.workDossier.deleteMany({
        where: { code: { startsWith: `HS-${testRunId}-` } },
      });
      await prisma.retentionRule.deleteMany({ where: { code: `RET-${testRunId}` } });

      if (positionAssignmentIds.length > 0) {
        await prisma.positionAssignment.deleteMany({
          where: { id: { in: positionAssignmentIds } },
        });
      }

      await prisma.documentIncomingWorkflow.deleteMany({
        where: {
          document: {
            OR: [
              { registeredById: clerkUser.id },
              { summary: { contains: testRunId } },
            ],
          },
        },
      });

      await prisma.taskActor.deleteMany({
        where: {
          userId: { in: [specialistDri.id, specialistCollab.id] },
        },
      });

      await prisma.task.deleteMany({
        where: {
          createdById: unitHeadLead.id,
        },
      });

      await prisma.document.deleteMany({
        where: {
          OR: [
            { registeredById: clerkUser.id },
            { summary: { contains: testRunId } },
          ],
        },
      });

      if (createdPositionDefinitionIds.length > 0) {
        await prisma.positionDefinition.deleteMany({
          where: { id: { in: createdPositionDefinitionIds } },
        });
      }

      await prisma.user.deleteMany({
        where: {
          id: {
            in: [
              clerkUser.id,
              rectorUser.id,
              unitHeadLead.id,
              unitHeadUnrelated.id,
              specialistDri.id,
              specialistCollab.id,
              unprivilegedStaff.id,
            ],
          },
        },
      });

      await prisma.organizationalUnit.deleteMany({
        where: {
          id: { in: [deptLeadId, deptCoordId, deptUnrelatedId] },
        },
      });

    } catch (err) {
      console.error("Cleanup error:", err);
    }
  });

  // =========================================================================
  // 1. Stage 1: Registration
  // =========================================================================
  describe("1. Registration (Tiếp nhận & Vào sổ Văn thư)", () => {
    it("successfully registers an incoming document by Clerk and initialises workflow", async () => {
      const docInput = {
        title: `Công văn hướng dẫn tuyển sinh năm 2026 - ${testRunId}`,
        documentNumber: `CV-${testRunId.slice(-6)}/SGDĐT`,
        issuingAuthority: "Sở Giáo dục và Đào tạo ",
        documentType: DocumentType.CONG_VAN,
        urgency: DocumentUrgency.KHAN,
        securityLevel: DocumentSecurityLevel.NORMAL,
        arrivalDate: new Date(),
        summary: "V/v hướng dẫn công tác tuyển sinh và đào tạo nghề năm 2026",
      };

      const result = await registerIncomingDocument(
        docInput,
        clerkUser,
        `req-reg-${testRunId}`
      );

      assert.ok(result.document);
      assert.ok(result.workflow);
      assert.equal(result.workflow.status, IncomingDocumentStatus.REGISTERED);
      assert.equal(result.document.registeredById, clerkUser.id);
      assert.ok(result.document.registrationNumber > 0);

      // Verify Audit Event
      const audit = await prisma.auditEvent.findFirst({
        where: {
          entityId: result.document.id,
          action: { in: ["DOCUMENT_CREATED", "DOCUMENT_REGISTERED"] },
        },
      });
      assert.ok(audit, "AuditEvent for DOCUMENT_REGISTERED must exist");
      assert.equal(audit.actorId, clerkUser.id);

      // Verify Outbox Event
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: result.document.id,
          eventType: { in: ["DOCUMENT_ISSUED_NOTIFICATION", "DOCUMENT_REGISTERED"] },
        },
      });
      assert.ok(outbox, "OutboxEvent entry must exist");
    });

    it("rejects document registration by unprivileged staff", async () => {
      const docInput = {
        title: `Văn bản không hợp lệ - ${testRunId}`,
        documentNumber: `CV-INVALID-${testRunId}`,
        issuingAuthority: "Đối tác Ngoài",
        documentType: DocumentType.CONG_VAN,
      };

      await assert.rejects(
        async () => {
          await registerIncomingDocument(
            docInput,
            unprivilegedStaff,
            `req-unauth-reg-${testRunId}`
          );
        },
        (err: any) => {
          assert.ok(
            err instanceof AuthorizationError ||
              err.name === "HybridAuthorizationError" ||
              err.constructor?.name?.includes("Authorization")
          );
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 2. Stage 2: Presentation to Leadership
  // =========================================================================
  describe("2. Presentation (Trình Ban Giám hiệu)", () => {
    let docId: string;

    before(async () => {
      const reg = await registerIncomingDocument(
        {
          title: `Tờ trình xem xét kinh phí dự án - ${testRunId}`,
          documentNumber: `TT-${testRunId.slice(-6)}`,
          issuingAuthority: "UBND Tỉnh ",
          documentType: DocumentType.TO_TRINH,
        },
        clerkUser,
        `req-prep-${testRunId}`
      );
      docId = reg.document.id;
    });

    it("successfully presents registered document to leadership", async () => {
      const result = await presentDocument(
        {
          documentId: docId,
          presenterNotes: "Kính trình Hiệu trưởng xem xét và cho ý kiến chỉ đạo xử lý.",
          suggestedLeaderId: rectorUser.id,
        },
        clerkUser,
        `req-pres-${testRunId}`
      );

      assert.equal(result.workflow.status, IncomingDocumentStatus.PRESENTED);
      assert.ok(result.workflow.presentedAt);

      // Verify Audit Event
      const audit = await prisma.auditEvent.findFirst({
        where: {
          entityId: docId,
          action: "DOCUMENT_PRESENTED",
        },
      });
      assert.ok(audit, "AuditEvent for DOCUMENT_PRESENTED must exist");
    });

    it("rejects presentation by unprivileged staff", async () => {
      const reg = await registerIncomingDocument(
        {
          title: `Tờ trình chưa phê duyệt - ${testRunId}`,
          documentNumber: `TT-UNAUTH-${testRunId.slice(-6)}`,
          issuingAuthority: "Sở LĐ-TB&XH",
          documentType: DocumentType.TO_TRINH,
        },
        clerkUser,
        `req-pres-unauth-prep-${testRunId}`
      );

      await assert.rejects(
        async () => {
          await presentDocument(
            { documentId: reg.document.id },
            unprivilegedStaff,
            `req-pres-unauth-${testRunId}`
          );
        },
        (err: any) => {
          assert.ok(
            err instanceof AuthorizationError ||
              err.name === "HybridAuthorizationError" ||
              err.constructor?.name?.includes("Authorization")
          );
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 3. Stage 3: Tier 1 Leadership Directive
  // =========================================================================
  describe("3. Tier 1 Directive (Ban Giám hiệu chỉ đạo phân công đơn vị)", () => {
    let docId: string;

    before(async () => {
      const reg = await registerIncomingDocument(
        {
          title: `Kế hoạch thanh tra chuyên đề kiểm định chất lượng - ${testRunId}`,
          documentNumber: `KH-TT-${testRunId.slice(-6)}`,
          issuingAuthority: "Tổng cục Giáo dục nghề nghiệp",
          documentType: DocumentType.KE_HOACH,
        },
        clerkUser,
        `req-dir-prep-${testRunId}`
      );
      docId = reg.document.id;

      await presentDocument(
        { documentId: docId, presenterNotes: "Kính trình BGH" },
        clerkUser,
        `req-dir-prep-pres-${testRunId}`
      );
    });

    it("allows Rector to issue Tier 1 directive assigning lead & coordinating units", async () => {
      const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const result = await directDocument(
        {
          documentId: docId,
          leadUnitId: deptLeadId,
          coordinatingUnitIds: [deptCoordId],
          leadershipInstruction: "Giao Phòng Đào tạo chủ trì, phối hợp KHTC lập đề cương báo cáo trước ngày hẹn.",
          deadline,
        },
        rectorUser,
        `req-direct-${testRunId}`
      );

      assert.equal(result.workflow.status, IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT);
      assert.equal(result.workflow.leadUnitId, deptLeadId);
      assert.deepEqual(result.workflow.coordinatingUnitIds, [deptCoordId]);
      assert.equal(result.directive, null);
      assert.equal(result.document.status, "CHO_PHAN_CONG");
      const directedDocument = await prisma.document.findUnique({
        where: { id: docId },
        select: { linkedTaskId: true },
      });
      assert.equal(directedDocument?.linkedTaskId, null, "Tier-1 direction must not create or link a Task");

      const workflowRecord = await prisma.documentIncomingWorkflow.findUnique({
        where: { documentId: docId },
      });
      assert.equal(workflowRecord?.leadUnitId, deptLeadId);
      assert.equal(workflowRecord?.leaderId, rectorUser.id);

      // Verify Audit Event
      const audit = await prisma.auditEvent.findFirst({
        where: {
          entityId: docId,
          action: "DOCUMENT_DIRECTED",
        },
      });
      assert.ok(audit, "AuditEvent for DOCUMENT_DIRECTED must exist");

      // Verify Outbox Event
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: docId,
          eventType: {
            in: ["DOCUMENT_DIRECTIVE_ISSUED", "DOCUMENT_DIRECTIVE_NOTIFICATION"],
          },
        },
      });
      assert.ok(outbox, "OutboxEvent for DOCUMENT_DIRECTIVE_ISSUED must exist");
    });

    it("rejects directive attempt from regular unit head without school-wide leadership authority", async () => {
      const reg = await registerIncomingDocument(
        {
          title: `Văn bản thử nghiệm thẩm quyền chỉ đạo - ${testRunId}`,
          documentNumber: `CV-DIR-UNAUTH-${testRunId.slice(-6)}`,
          issuingAuthority: "Bộ LĐTBXH",
          documentType: DocumentType.CONG_VAN,
        },
        clerkUser,
        `req-dir-unauth-prep-${testRunId}`
      );
      await presentDocument(
        { documentId: reg.document.id },
        clerkUser,
        `req-dir-unauth-pres-${testRunId}`
      );

      await assert.rejects(
        async () => {
          await directDocument(
            {
              documentId: reg.document.id,
              leadUnitId: deptLeadId,
              leadershipInstruction: "Chỉ đạo trái thẩm quyền",
            },
            unitHeadLead,
            `req-direct-unauth-${testRunId}`
          );
        },
        (err: any) => {
          assert.ok(
            err instanceof AuthorizationError ||
              err.name === "HybridAuthorizationError" ||
              err.constructor?.name?.includes("Authorization")
          );
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 4. Stage 4: Tier 2 Unit Work Assignment (DRI & Collaborators)
  // =========================================================================
  describe("4. Tier 2 Unit Assignment (Trưởng đơn vị phân công Chuyên viên thụ lý)", () => {
    let docId: string;

    before(async () => {
      const reg = await registerIncomingDocument(
        {
          title: `Chỉ thị thực hiện quy chế đào tạo mới - ${testRunId}`,
          documentNumber: `CT-${testRunId.slice(-6)}`,
          issuingAuthority: "Bộ Lao động - Thương binh và Xã hội",
          documentType: DocumentType.QUYET_DINH,
        },
        clerkUser,
        `req-assign-prep-${testRunId}`
      );
      docId = reg.document.id;

      await presentDocument({ documentId: docId }, clerkUser, `req-assign-pres-${testRunId}`);

      await directDocument(
        {
          documentId: docId,
          leadUnitId: deptLeadId,
          coordinatingUnitIds: [deptCoordId],
          leadershipInstruction: "Giao Phòng Đào tạo chủ trì triển khai.",
        },
        rectorUser,
        `req-assign-dir-${testRunId}`
      );
    });

    it("allows Lead Unit Head to assign specific DRI and collaborator, creating linked Task", async () => {
      const result = await assignUnitWork(
        {
          documentId: docId,
          driUserId: specialistDri.id,
          collaboratorUserIds: [specialistCollab.id],
          instruction: "Đồng chí phụ trách rà soát chương trình đào tạo hiện hành và đối chiếu quy chế.",
          deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          createTask: true,
          taskTitle: `Triển khai chỉ thị đào tạo mới (${testRunId})`,
        },
        unitHeadLead,
        `req-assign-unit-${testRunId}`
      );

      assert.equal(result.workflow.status, IncomingDocumentStatus.IN_PROGRESS);
      assert.equal(result.workflow.driUserId, specialistDri.id);
      assert.deepEqual(result.workflow.collaboratorUserIds, [specialistCollab.id]);
      assert.ok(result.assignment);
      assert.equal(result.assignment.driUserId, specialistDri.id);
      assert.equal(result.assignment.assignedById, unitHeadLead.id);
      assert.ok(result.assignment.createdTaskId);

      // Verify linked task was created
      const task = await prisma.task.findUnique({
        where: { id: result.assignment.createdTaskId! },
        include: { actors: true },
      });
      assert.ok(task);
      assert.equal(task.leadUnitId, deptLeadId);
      assert.ok(task.actors.some((a) => a.userId === specialistDri.id));
      assert.equal(result.assignment.taskId, task.id);
      const linkedDocument = await prisma.document.findUnique({
        where: { id: docId },
        select: { linkedTaskId: true },
      });
      assert.equal(linkedDocument?.linkedTaskId, task.id);

      // Verify Audit Event
      const audit = await prisma.auditEvent.findFirst({
        where: {
          entityId: docId,
          action: { in: ["UNIT_WORK_ASSIGNED", "DOCUMENT_UNIT_ASSIGNED"] },
        },
      });
      assert.ok(audit, "AuditEvent for UNIT_WORK_ASSIGNED must exist");
    });

    it("creates at most one Task and backlink when concurrent unit assignments race", async () => {
      const reg = await registerIncomingDocument(
        {
          title: `Văn bản kiểm thử giao việc đồng thời ${testRunId}`,
          documentNumber: `RACE-${testRunId.slice(-6)}`,
          issuingAuthority: "Sở Giáo dục và Đào tạo",
        },
        clerkUser,
        `req-assign-race-register-${testRunId}`
      );
      await presentDocument(
        { documentId: reg.document.id },
        clerkUser,
        `req-assign-race-present-${testRunId}`
      );
      await directDocument(
        {
          documentId: reg.document.id,
          leadUnitId: deptLeadId,
          leadershipInstruction: "Phân tuyến để kiểm tra chống giao việc đồng thời.",
        },
        rectorUser,
        `req-assign-race-direct-${testRunId}`
      );

      const outcomes = await Promise.allSettled(
        [`a`, `b`].map((suffix) =>
          assignUnitWork(
            {
              documentId: reg.document.id,
              driUserId: specialistDri.id,
              createTask: true,
              taskTitle: `Task race ${testRunId}`,
            },
            unitHeadLead,
            `req-assign-race-${suffix}-${testRunId}`
          )
        )
      );
      const successes = outcomes.filter((outcome) => outcome.status === "fulfilled");
      assert.equal(successes.length, 1, "exactly one concurrent command must claim the workflow");

      const workflow = await prisma.documentIncomingWorkflow.findUnique({
        where: { documentId: reg.document.id },
      });
      const document = await prisma.document.findUnique({
        where: { id: reg.document.id },
        select: { linkedTaskId: true },
      });
      const assignments = await prisma.unitWorkAssignment.findMany({
        where: { workflowId: workflow!.id },
      });
      assert.equal(assignments.length, 1);
      assert.ok(assignments[0].taskId);
      assert.equal(document?.linkedTaskId, assignments[0].taskId);
    });

    it("rejects unit assignment when attempted by head of an unrelated department", async () => {
      await assert.rejects(
        async () => {
          await assignUnitWork(
            {
              documentId: docId,
              driUserId: specialistDri.id,
              instruction: "Phân công từ trưởng đơn vị khác",
            },
            unitHeadUnrelated,
            `req-assign-cross-dept-${testRunId}`
          );
        },
        (err: any) => {
          assert.ok(
            err instanceof AuthorizationError ||
              err.name === "HybridAuthorizationError" ||
              err.constructor?.name?.includes("Authorization")
          );
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 5. Stage 5: Resolution & Archival Filing
  // =========================================================================
  describe("5. Resolution & Archival Filing (Giải quyết & Lưu trữ hồ sơ)", () => {
    let docId: string;
    let dossierId: string;

    before(async () => {
      const reg = await registerIncomingDocument(
        {
          title: `Thông báo triệu tập hội nghị tập huấn - ${testRunId}`,
          documentNumber: `TB-${testRunId.slice(-6)}`,
          issuingAuthority: "Ban Tuyên giáo Tỉnh ủy",
          documentType: DocumentType.THONG_BAO,
        },
        clerkUser,
        `req-res-prep-${testRunId}`
      );
      docId = reg.document.id;

      await presentDocument({ documentId: docId }, clerkUser, `req-res-pres-${testRunId}`);

      await directDocument(
        {
          documentId: docId,
          leadUnitId: deptLeadId,
          leadershipInstruction: "Phòng Đào tạo cử cán bộ tham dự và báo cáo kết quả.",
        },
        rectorUser,
        `req-res-dir-${testRunId}`
      );

      const assignment = await assignUnitWork(
        {
          documentId: docId,
          driUserId: specialistDri.id,
          instruction: "Đ/c tham gia và chuẩn bị nội dung.",
          createTask: true,
        },
        unitHeadLead,
        `req-res-assign-${testRunId}`
      );
      const dossier = await seedArchiveCheckedDossier(
        docId,
        deptLeadId,
        specialistDri.id,
        assignment.assignment.taskId || undefined
      );
      dossierId = dossier.id;
    });

    it("keeps the document in progress until its linked task is complete", async () => {
      const document = await prisma.document.findUniqueOrThrow({
        where: { id: docId },
        select: { linkedTaskId: true, incomingWorkflow: { select: { status: true } } },
      });
      assert.ok(document.linkedTaskId);

      await assert.rejects(
        resolveDocument(
          {
            documentId: docId,
            resolutionSummary: "Báo cáo thử khi nhiệm vụ còn mở.",
            resolutionDocUrl: "https://eoffice.qcet.edu.vn/files/bao-cao-thu-hoach.pdf",
          },
          specialistDri,
          `req-res-incomplete-${testRunId}`
        ),
        (error: any) => error?.code === "INCOMING_DOCUMENT_TASKS_INCOMPLETE"
      );

      const afterRejectedResolution = await prisma.documentIncomingWorkflow.findUniqueOrThrow({
        where: { documentId: docId },
        select: { status: true },
      });
      assert.equal(afterRejectedResolution.status, IncomingDocumentStatus.IN_PROGRESS);

      await prisma.task.update({
        where: { id: document.linkedTaskId },
        data: {
          status: TaskStatus.COMPLETED,
          progressPercent: 100,
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });

      const afterTaskCompletion = await prisma.documentIncomingWorkflow.findUniqueOrThrow({
        where: { documentId: docId },
        select: { status: true },
      });
      assert.equal(
        afterTaskCompletion.status,
        IncomingDocumentStatus.IN_PROGRESS,
        "Task completion must not implicitly resolve the incoming document"
      );
    });

    it("allows appointed DRI to resolve document with resolution summary", async () => {
      const result = await resolveDocument(
        {
          documentId: docId,
          resolutionSummary: "Đã hoàn thành tham gia tập huấn và nộp báo cáo thu hoạch.",
          resolutionDocUrl: "https://eoffice.qcet.edu.vn/files/bao-cao-thu-hoach.pdf",
        },
        specialistDri,
        `req-res-solve-${testRunId}`
      );

      assert.equal(result.workflow.status, IncomingDocumentStatus.RESOLVED);
      assert.ok(result.workflow.resolvedAt);
      assert.equal(result.workflow.resolutionSummary, "Đã hoàn thành tham gia tập huấn và nộp báo cáo thu hoạch.");

      // Verify Audit Event
      const audit = await prisma.auditEvent.findFirst({
        where: {
          entityId: docId,
          action: "DOCUMENT_RESOLVED",
        },
      });
      assert.ok(audit, "AuditEvent for DOCUMENT_RESOLVED must exist");
    });

    it("allows Clerk to file a resolved document without archiving it directly", async () => {
      const result = await fileDocument(
        {
          documentId: docId,
          dossierId,
          filingNotes: "Hồ sơ lưu trữ định kỳ năm 2026",
        },
        clerkUser,
        `req-res-file-${testRunId}`
      );

      assert.equal(result.workflow.status, IncomingDocumentStatus.FILED);
      assert.ok(result.workflow.filedAt);
      assert.equal(result.workflow.dossierId, dossierId);
      assert.equal(result.workflow.archivedAt, null);
      const filedDocument = await prisma.document.findUniqueOrThrow({ where: { id: docId } });
      assert.equal(filedDocument.archivedAt, null);
      assert.equal(filedDocument.archivedById, null);

      // Verify Audit Event
      const audit = await prisma.auditEvent.findFirst({
        where: {
          entityId: docId,
          action: "DOCUMENT_FILED",
        },
      });
      assert.ok(audit, "AuditEvent for DOCUMENT_FILED must exist");

      // Verify Outbox Event
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: docId,
          eventType: { in: ["DOCUMENT_FILED", "DOCUMENT_FILED_NOTIFICATION"] },
        },
      });
      assert.ok(outbox, "OutboxEvent for DOCUMENT_FILED must exist");
    });
  });

  // =========================================================================
  // 6. Workflow Querying & State Machine Invariants
  // =========================================================================
  describe("6. Workflow Querying & State Machine Invariants", () => {
    it("lists incoming workflows with filtering by lead unit", async () => {
      const list = await listIncomingWorkflows({
        leadUnitId: deptLeadId,
        limit: 10,
      });

      assert.ok(Array.isArray(list.items));
      assert.ok(list.total >= 1);
      assert.ok(list.items.every((item) => item.leadUnitId === deptLeadId));
    });

    it("retrieves full workflow state with directives and assignments", async () => {
      const doc = await prisma.document.findFirst({
        where: { summary: { contains: testRunId } },
      });
      assert.ok(doc);

      const workflowDetails = await getIncomingDocument(doc.id, clerkUser);
      assert.ok(workflowDetails);
      assert.ok(workflowDetails.document);
      assert.ok(Array.isArray(workflowDetails.directives));
      assert.ok(Array.isArray(workflowDetails.unitAssignments));
    });
  });

  // =========================================================================
  // 7. Command API Route Handlers (HTTP Layer Verification)
  // =========================================================================
  describe("7. Command API Route Handlers (HTTP Layer Verification)", () => {
    let apiDocId: string;
    let clerkToken: string;
    let rectorToken: string;
    let unitHeadToken: string;
    let driToken: string;
    let apiDossierId: string;

    before(() => {
      clerkToken = signSessionToken({
        id: clerkUser.id,
        email: clerkUser.email,
        name: clerkUser.name,
        role: clerkUser.role,

      });

      rectorToken = signSessionToken({
        id: rectorUser.id,
        email: rectorUser.email,
        name: rectorUser.name,
        role: rectorUser.role,

      });

      unitHeadToken = signSessionToken({
        id: unitHeadLead.id,
        email: unitHeadLead.email,
        name: unitHeadLead.name,
        role: unitHeadLead.role,

      });

      driToken = signSessionToken({
        id: specialistDri.id,
        email: specialistDri.email,
        name: specialistDri.name,
        role: specialistDri.role,

      });
    });

    it("POST /api/documents/incoming registers document successfully", async () => {
      const req = new NextRequest("http://localhost:3000/api/documents/incoming", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${clerkToken}`,
        },
        body: JSON.stringify({
          title: `Văn bản API Route Test - ${testRunId}`,
          documentNumber: `CV-API-${testRunId.slice(-6)}`,
          issuingAuthority: "Bộ Thông tin và Truyền thông",
          documentType: DocumentType.CONG_VAN,
          urgency: DocumentUrgency.THUONG,
          securityLevel: DocumentSecurityLevel.THUONG,
        }),
      });

      const res = await incomingRegisterRoute(req);
      assert.equal(res.status, 201);
      const json = await res.json();
      assert.ok(json.document?.id);
      assert.equal(json.workflow?.status, IncomingDocumentStatus.REGISTERED);
      apiDocId = json.document.id;
    });

    it("POST /api/documents/[id]/actions/present presents document to leadership", async () => {
      const req = new NextRequest(`http://localhost:3000/api/documents/${apiDocId}/actions/present`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${clerkToken}`,
        },
        body: JSON.stringify({
          clerkNotes: "Kính trình Ban Giám hiệu xem xét chỉ đạo qua API",
        }),
      });

      const res = await presentRoute(req, { params: Promise.resolve({ id: apiDocId }) });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.workflow?.status, IncomingDocumentStatus.PRESENTED);
    });

    it("POST /api/documents/[id]/actions/direct allows Rector to issue directive", async () => {
      const req = new NextRequest(`http://localhost:3000/api/documents/${apiDocId}/actions/direct`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${rectorToken}`,
        },
        body: JSON.stringify({
          leadUnitId: deptLeadId,
          coordinatingUnitIds: [deptCoordId],
          leadershipInstruction: "Giao Phòng Đào tạo chủ trì thực hiện theo chỉ đạo API",
        }),
      });

      const res = await directRoute(req, { params: Promise.resolve({ id: apiDocId }) });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.workflow?.status, IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT);
      assert.equal(json.workflow?.leadUnitId, deptLeadId);
      const document = await prisma.document.findUnique({
        where: { id: apiDocId },
        select: { linkedTaskId: true },
      });
      assert.equal(document?.linkedTaskId, null, "bút phê/phân tuyến does not create a Task");
    });

    it("POST /api/documents/[id]/actions/assign-unit creates one idempotent Task for the DRI", async () => {
      const url = `http://localhost:3000/api/documents/${apiDocId}/actions/assign-unit`;
      const idempotencyKey = `assign-unit-${testRunId}`;
      const makeRequest = () => new NextRequest(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${unitHeadToken}`,
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          driUserId: specialistDri.id,
          instruction: "Đồng chí triển khai theo chỉ đạo Ban Giám hiệu",
          createTask: true,
        }),
      });

      const res = await assignUnitRoute(makeRequest(), { params: Promise.resolve({ id: apiDocId }) });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.workflow?.status, IncomingDocumentStatus.IN_PROGRESS);
      assert.equal(json.workflow?.driUserId, specialistDri.id);
      assert.ok(json.assignment?.taskId);

      const retry = await assignUnitRoute(makeRequest(), { params: Promise.resolve({ id: apiDocId }) });
      assert.equal(retry.status, 200);
      const retryJson = await retry.json();
      assert.equal(retryJson.assignment.taskId, json.assignment.taskId);
      const document = await prisma.document.findUnique({
        where: { id: apiDocId },
        select: { linkedTaskId: true },
      });
      assert.equal(document?.linkedTaskId, json.assignment.taskId);
    });

    it("POST /api/documents/[id]/actions/resolve allows DRI to resolve document", async () => {
      const document = await prisma.document.findUniqueOrThrow({
        where: { id: apiDocId },
        select: { linkedTaskId: true },
      });
      assert.ok(document.linkedTaskId);
      await prisma.task.update({
        where: { id: document.linkedTaskId },
        data: {
          status: TaskStatus.COMPLETED,
          progressPercent: 100,
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });
      const dossier = await seedArchiveCheckedDossier(
        apiDocId,
        deptLeadId,
        specialistDri.id,
        document.linkedTaskId
      );
      apiDossierId = dossier.id;

      const url = `http://localhost:3000/api/documents/${apiDocId}/actions/resolve`;
      const idempotencyKey = `resolve-${testRunId}`;
      const makeRequest = () => new NextRequest(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${driToken}`,
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          resolutionSummary: "Đã hoàn thành xử lý nội dung qua API",
          resolutionDocUrl: "https://eoffice.qcet.edu.vn/files/bao-cao-api.pdf",
        }),
      });

      const res = await resolveRoute(makeRequest(), { params: Promise.resolve({ id: apiDocId }) });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.workflow?.status, IncomingDocumentStatus.RESOLVED);

      const retry = await resolveRoute(makeRequest(), { params: Promise.resolve({ id: apiDocId }) });
      assert.equal(retry.status, 200);
      const retryJson = await retry.json();
      assert.equal(retryJson.workflow?.id, json.workflow?.id);
      assert.equal(retryJson.workflow?.status, IncomingDocumentStatus.RESOLVED);
    });

    it("POST /api/documents/[id]/actions/file rejects archiveNow and files only", async () => {
      const bypassReq = new NextRequest(`http://localhost:3000/api/documents/${apiDocId}/actions/file`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${clerkToken}`,
        },
        body: JSON.stringify({
          dossierId: apiDossierId,
          filingNotes: "Lưu trữ định kỳ",
          archiveNow: true,
        }),
      });
      const bypassRes = await fileRoute(bypassReq, { params: Promise.resolve({ id: apiDocId }) });
      assert.equal(bypassRes.status, 400);

      const req = new NextRequest(`http://localhost:3000/api/documents/${apiDocId}/actions/file`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${clerkToken}`,
        },
        body: JSON.stringify({
          dossierId: apiDossierId,
          filingNotes: "Lưu trữ định kỳ",
        }),
      });

      const res = await fileRoute(req, { params: Promise.resolve({ id: apiDocId }) });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.workflow?.status, IncomingDocumentStatus.FILED);
    });
  });
});
