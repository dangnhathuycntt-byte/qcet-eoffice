import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  UserRole,
  UnitType,
  DossierStatus,
  DossierItemType,
  DataClassification,
  DocumentType,
  DocumentUrgency,
  DocumentSecurityLevel,
  TaskStatus,
  TaskPriority,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { DossierService } from "../src/lib/services/dossier-service";
import { signSessionToken } from "../src/lib/jwt-session";
import { GET as listDossiersRoute, POST as createDossierRoute } from "../src/app/api/dossiers/route";
import { GET as getDossierDetailRoute } from "../src/app/api/dossiers/[id]/route";
import {
  GET as listItemsRoute,
  POST as addItemRoute,
  DELETE as removeItemRoute,
} from "../src/app/api/dossiers/[id]/items/route";
import { POST as closeDossierRoute } from "../src/app/api/dossiers/[id]/actions/close/route";
import { POST as submitArchiveRoute } from "../src/app/api/dossiers/[id]/actions/submit-archive/route";
import { POST as acceptArchiveRoute } from "../src/app/api/dossiers/[id]/actions/accept-archive/route";

describe("Phase 7: Work Dossier & Institutional Archival Domain (Hồ sơ công việc & Lưu trữ cơ quan)", () => {
  const testRunId = `dos_${Date.now()}`;

  let ouAcadId: string;
  let ouAdminId: string;
  let ouUnrelatedId: string;

  let retentionRuleId: string;
  let sampleDocId: string;
  let sampleTaskId: string;

  let specialistUser: any;
  let unitHeadUser: any;
  let archivistUser: any;
  let unprivilegedUser: any;

  let specialistToken: string;
  let unitHeadToken: string;
  let archivistToken: string;
  let unprivilegedToken: string;

  before(async () => {
    // 1. Create Organizational Units and Departments
    const ouAcad = await prisma.organizationalUnit.create({
      data: {
        id: `ou-acad-${testRunId}`,
        code: `QLDT_${testRunId.slice(-4)}`,
        name: `Phòng Quản lý Đào tạo ${testRunId}`,
        type: UnitType.DEPARTMENT,
      },
    });
    ouAcadId = ouAcad.id;

    await prisma.organizationalUnit.create({
      data: {
        id: `dept-acad-${testRunId}`,
        name: `Phòng Quản lý Đào tạo ${testRunId}`,

      },
    });

    const ouAdmin = await prisma.organizationalUnit.create({
      data: {
        id: `ou-admin-${testRunId}`,
        code: `HCTH_${testRunId.slice(-4)}`,
        name: `Phòng Hành chính - Tổng hợp ${testRunId}`,
        type: UnitType.DEPARTMENT,
      },
    });
    ouAdminId = ouAdmin.id;

    await prisma.organizationalUnit.create({
      data: {
        id: `dept-admin-${testRunId}`,
        name: `Phòng Hành chính - Tổng hợp ${testRunId}`,

      },
    });

    const ouUnrel = await prisma.organizationalUnit.create({
      data: {
        id: `ou-unrel-${testRunId}`,
        code: `CNTT_${testRunId.slice(-4)}`,
        name: `Khoa CNTT ${testRunId}`,
        type: UnitType.FACULTY,
      },
    });
    ouUnrelatedId = ouUnrel.id;

    await prisma.organizationalUnit.create({
      data: {
        id: `dept-unrel-${testRunId}`,
        name: `Khoa CNTT ${testRunId}`,

      },
    });

    // 2. Create Users
    specialistUser = await prisma.user.create({
      data: {
        id: `user-spec-${testRunId}`,
        email: `spec.${testRunId}@qcet.edu.vn`,
        name: "Chuyên viên Quản lý Đào tạo Test",
        role: UserRole.CHUYEN_VIEN,
        title: "Chuyên viên",
}`,
      },
    });

    unitHeadUser = await prisma.user.create({
      data: {
        id: `user-head-${testRunId}`,
        email: `head.${testRunId}@qcet.edu.vn`,
        name: "Trưởng phòng Đào tạo Test",
        role: UserRole.TRUONG_PHONG,
        title: "Trưởng phòng",
}`,
      },
    });

    archivistUser = await prisma.user.create({
      data: {
        id: `user-arch-${testRunId}`,
        email: `arch.${testRunId}@qcet.edu.vn`,
        name: "Lưu trữ viên Cơ quan Test",
        role: UserRole.VAN_THU,
        title: "Lưu trữ viên",
}`,
      },
    });

    unprivilegedUser = await prisma.user.create({
      data: {
        id: `user-unpriv-${testRunId}`,
        email: `unpriv.${testRunId}@qcet.edu.vn`,
        name: "Giảng viên Không thẩm quyền Test",
        role: UserRole.CHUYEN_VIEN,
        title: "Giảng viên",
}`,
      },
    });

    // 3. JWT Tokens
    specialistToken = signSessionToken({
      id: specialistUser.id,
      email: specialistUser.email,
      name: specialistUser.name,
      role: specialistUser.role,

    });

    unitHeadToken = signSessionToken({
      id: unitHeadUser.id,
      email: unitHeadUser.email,
      name: unitHeadUser.name,
      role: unitHeadUser.role,

    });

    archivistToken = signSessionToken({
      id: archivistUser.id,
      email: archivistUser.email,
      name: archivistUser.name,
      role: archivistUser.role,

    });

    unprivilegedToken = signSessionToken({
      id: unprivilegedUser.id,
      email: unprivilegedUser.email,
      name: unprivilegedUser.name,
      role: unprivilegedUser.role,

    });

    // 4. Create Retention Rule
    const rule = await prisma.retentionRule.create({
      data: {
        code: `RET_DT_${testRunId.slice(-4)}`,
        name: `Quy tắc lưu trữ đào tạo ${testRunId}`,
        durationYears: 10,
        legalBasis: "Thông tư 10/2022/TT-BNV",
        description: "Lưu trữ hồ sơ đào tạo và tuyển sinh hệ chính quy",
      },
    });
    retentionRuleId = rule.id;

    // 5. Create Sample Document
    const doc = await prisma.document.create({
      data: {
        registrationNumber: Math.floor(Math.random() * 100000) + 1,
        documentYear: 2026,
        originalNumber: `01/TTr-${testRunId.slice(-4)}`,
        issuingAuthority: "Phòng Quản lý Đào tạo",
        summary: `Tờ trình mở ngành năm học 2026-2027 ${testRunId}`,
        type: DocumentType.TO_TRINH_NOI_BO,
        category: "Hành chính",
        urgency: DocumentUrgency.THUONG,
        securityLevel: DocumentSecurityLevel.THUONG,
        issuedDate: new Date(),
        registeredById: specialistUser.id,
      },
    });
    sampleDocId = doc.id;

    // 6. Create Sample Task
    const task = await prisma.task.create({
      data: {
        code: `TASK_DT_${testRunId.slice(-4)}`,
        title: `Nhiệm vụ rà soát chương trình đào tạo - ${testRunId}`,
        createdBy: { connect: { id: unitHeadUser.id } },
        leadUnitId: ouAcadId,
        academicMonth: 3,
        academicYear: "2025-2026",
        dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        status: TaskStatus.NOT_STARTED,
        priority: TaskPriority.NORMAL,
      },
    });
    sampleTaskId = task.id;
  });

  after(async () => {
    try {
      // Cleanup items, dossiers, retention rules, documents, tasks, users, units
      await prisma.dossierItem.deleteMany({
        where: {
          dossier: {
            code: { contains: testRunId },
          },
        },
      });

      await prisma.workDossier.deleteMany({
        where: {
          code: { contains: testRunId },
        },
      });

      if (retentionRuleId) {
        await prisma.retentionRule.deleteMany({
          where: { id: retentionRuleId },
        });
      }

      if (sampleDocId) {
        await prisma.document.deleteMany({
          where: { id: sampleDocId },
        });
      }

      if (sampleTaskId) {
        await prisma.task.deleteMany({
          where: { id: sampleTaskId },
        });
      }

      await prisma.auditEvent.deleteMany({
        where: {
          actorId: {
            in: [specialistUser.id, unitHeadUser.id, archivistUser.id, unprivilegedUser.id],
          },
        },
      });

      await prisma.outboxEvent.deleteMany({
        where: {
          aggregateType: "WORK_DOSSIER",
        },
      });

      await prisma.user.deleteMany({
        where: {
          id: {
            in: [specialistUser.id, unitHeadUser.id, archivistUser.id, unprivilegedUser.id],
          },
        },
      });

      await prisma.organizationalUnit.deleteMany({
        where: {
          id: {
            in: [`dept-acad-${testRunId}`, `dept-admin-${testRunId}`, `dept-unrel-${testRunId}`],
          },
        },
      });

      await prisma.organizationalUnit.deleteMany({
        where: {
          id: { in: [ouAcadId, ouAdminId, ouUnrelatedId] },
        },
      });
    } catch (err) {
      console.error("Cleanup error in dossier tests:", err);
    }
  });

  // =========================================================================
  // 1. END-TO-END WORK DOSSIER & ARCHIVAL LIFECYCLE
  // =========================================================================
  describe("1. Full Work Dossier Lifecycle: OPEN -> ACTIVE -> CLOSED -> SUBMITTED -> ARCHIVED", () => {
    let dossierId: string;
    let docItemId: string;
    let taskItemId: string;
    let resultItemId: string;
    let minutesItemId: string;

    it("Step 1: Creates an OPEN work dossier", async () => {
      const dossier = await DossierService.createDossier(specialistUser, {
        code: `HS-${testRunId}-01`,
        title: `Hồ sơ mở ngành Đào tạo Logistics và Chuỗi cung ứng ${testRunId}`,
        owningUnitId: ouAcadId,
        responsiblePersonId: specialistUser.id,
        retentionRuleId,
        classification: DataClassification.INTERNAL,
        storageLocation: "Tủ 04, Ngăn B2, Phòng QLĐT",
        notes: "Hồ sơ công việc theo kế hoạch năm học 2026",
      });

      assert.ok(dossier);
      assert.equal(dossier.status, DossierStatus.OPEN);
      assert.equal(dossier.responsiblePersonId, specialistUser.id);
      assert.equal(dossier.owningUnitId, ouAcadId);
      assert.ok(dossier.openedAt);
      dossierId = dossier.id;

      // Verify Audit Event
      const audit = await prisma.auditEvent.findFirst({
        where: {
          entityId: dossier.id,
          action: "DOSSIER_CREATED",
        },
      });
      assert.ok(audit, "Audit event for dossier creation must exist");
      assert.equal(audit.actorId, specialistUser.id);

      // Verify Outbox Event
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: dossier.id,
          eventType: "DOSSIER_CREATED_NOTIFICATION",
        },
      });
      assert.ok(outbox, "Outbox event for dossier creation must exist");
    });

    it("Step 2: Adds multiple types of items (DOCUMENT, TASK, RESULT, MEETING_MINUTES) & auto-activates to ACTIVE", async () => {
      // 2.1 Add DOCUMENT item
      const item1 = await DossierService.addItemToDossier(specialistUser, {
        dossierId,
        itemType: DossierItemType.DOCUMENT,
        title: "Tờ trình phê duyệt Đề án mở ngành",
        documentId: sampleDocId,
        documentNumber: `01/TTr-${testRunId}`,
        documentDate: new Date("2026-03-01"),
        pageCount: 15,
      });
      assert.ok(item1);
      assert.equal(item1.itemType, DossierItemType.DOCUMENT);
      assert.equal(item1.itemId, sampleDocId);
      assert.equal(item1.sequence, 1);
      docItemId = item1.id;

      // Check dossier transitioned from OPEN to ACTIVE
      const updatedDossier = await DossierService.getDossierDetail(specialistUser, dossierId);
      assert.equal(updatedDossier.status, DossierStatus.ACTIVE);

      // 2.2 Add TASK item
      const item2 = await DossierService.addItemToDossier(specialistUser, {
        dossierId,
        itemType: DossierItemType.TASK,
        title: "Nhiệm vụ khảo sát nhu cầu doanh nghiệp",
        taskId: sampleTaskId,
        notes: "Kết quả khảo sát từ 50 doanh nghiệp logistics",
      });
      assert.ok(item2);
      assert.equal(item2.itemType, DossierItemType.TASK);
      assert.equal(item2.itemId, sampleTaskId);
      assert.equal(item2.sequence, 2);
      taskItemId = item2.id;

      // 2.3 Add RESULT item
      const item3 = await DossierService.addItemToDossier(specialistUser, {
        dossierId,
        itemType: DossierItemType.RESULT,
        title: "Báo cáo phân tích tính khả thi và dự toán tài chính",
        fileUrl: "https://storage.qcet.edu.vn/dossiers/logistics-report.pdf",
        fileName: "logistics-report.pdf",
        fileSize: 2048576,
        pageCount: 30,
      });
      assert.ok(item3);
      assert.equal(item3.itemType, DossierItemType.RESULT);
      assert.equal(item3.sequence, 3);
      resultItemId = item3.id;

      // 2.4 Add MEETING_MINUTES item
      const item4 = await DossierService.addItemToDossier(specialistUser, {
        dossierId,
        itemType: DossierItemType.MEETING_MINUTES,
        title: "Biên bản họp Hội đồng Khoa học và Đào tạo thẩm định Đề án",
        documentNumber: `05/BB-HĐKH-${testRunId}`,
        documentDate: new Date("2026-03-15"),
        fileUrl: "https://storage.qcet.edu.vn/dossiers/bien-ban-hdkh.pdf",
        pageCount: 6,
      });
      assert.ok(item4);
      assert.equal(item4.itemType, DossierItemType.MEETING_MINUTES);
      assert.equal(item4.sequence, 4);
      minutesItemId = item4.id;

      // Verify total items count
      const detail = await DossierService.getDossierDetail(specialistUser, dossierId);
      assert.ok(detail.items);
      assert.equal(detail.items.length, 4);
    });

    it("Step 3: Removes an item from the dossier", async () => {
      const res = await DossierService.removeItemFromDossier(specialistUser, {
        dossierId,
        itemId: minutesItemId,
      });
      assert.equal(res.success, true);

      // Verify item is removed
      const detail = await DossierService.getDossierDetail(specialistUser, dossierId);
      assert.ok(detail.items);
      assert.equal(detail.items.length, 3);
      assert.ok(!detail.items.some((i) => i.id === minutesItemId));

      // Verify audit log for removal
      const audit = await prisma.auditEvent.findFirst({
        where: {
          entityId: minutesItemId,
          action: "DOSSIER_ITEM_REMOVED",
        },
      });
      assert.ok(audit, "Audit event for item removal must exist");
    });

    it("Step 4: Closes the work dossier (CLOSED)", async () => {
      const closed = await DossierService.closeDossier(specialistUser, {
        dossierId,
        notes: "Đã hoàn thành toàn bộ hồ sơ mở ngành và nghiệm thu",
      });

      assert.equal(closed.status, DossierStatus.CLOSED);
      assert.ok(closed.closedAt);

      // Verify Audit Event
      const audit = await prisma.auditEvent.findFirst({
        where: {
          entityId: dossierId,
          action: "DOSSIER_CLOSED",
        },
      });
      assert.ok(audit);

      // Verify Outbox Event
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: dossierId,
          eventType: "DOSSIER_CLOSED_NOTIFICATION",
        },
      });
      assert.ok(outbox);
    });

    it("Step 5: Prohibits adding or removing items once CLOSED", async () => {
      // Attempt to add item to CLOSED dossier
      await assert.rejects(
        async () => {
          await DossierService.addItemToDossier(specialistUser, {
            dossierId,
            itemType: DossierItemType.DOCUMENT,
            title: "Tài liệu bổ sung sau khi đóng hồ sơ",
          });
        },
        (err: any) => {
          assert.equal(err.name, "InvalidTransitionError");
          assert.ok(err.message.includes("đã đóng"));
          return true;
        }
      );

      // Attempt to remove item from CLOSED dossier
      await assert.rejects(
        async () => {
          await DossierService.removeItemFromDossier(specialistUser, {
            dossierId,
            itemId: docItemId,
          });
        },
        (err: any) => {
          assert.equal(err.name, "InvalidTransitionError");
          assert.ok(err.message.includes("đã đóng"));
          return true;
        }
      );
    });

    it("Step 6: Submits closed dossier to institutional archives (SUBMITTED_TO_ARCHIVE)", async () => {
      const submitted = await DossierService.submitArchive(specialistUser, {
        dossierId,
        notes: "Kính nộp hồ sơ vào Lưu trữ Trường theo quy định",
      });

      assert.equal(submitted.status, DossierStatus.SUBMITTED_TO_ARCHIVE);
      assert.ok(submitted.submittedArchiveAt);

      // Verify Audit Event
      const audit = await prisma.auditEvent.findFirst({
        where: {
          entityId: dossierId,
          action: "DOSSIER_SUBMITTED_ARCHIVE",
        },
      });
      assert.ok(audit);

      // Verify Outbox Event
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: dossierId,
          eventType: "DOSSIER_SUBMITTED_ARCHIVE_NOTIFICATION",
        },
      });
      assert.ok(outbox);
    });

    it("Step 7: Enforces Separation of Duties (SoD) — Submitter cannot accept own archive", async () => {
      // specialistUser (submitter/responsible person) tries to accept archive
      await assert.rejects(
        async () => {
          await DossierService.acceptArchive(specialistUser, {
            dossierId,
            storageLocation: "Kho lưu trữ trường, Kệ K1",
            notes: "Tự tiếp nhận",
          });
        },
        (err: any) => {
          assert.equal(err.name, "ForbiddenError");
          assert.ok(err.message.includes("SoD") || err.message.includes("Người nộp lưu"));
          return true;
        }
      );
    });

    it("Step 8: Enforces Access Control — Unprivileged user cannot accept archive", async () => {
      // unprivilegedUser (Giảng viên) does not have archivist capability
      await assert.rejects(
        async () => {
          await DossierService.acceptArchive(unprivilegedUser, {
            dossierId,
            storageLocation: "Kho lưu trữ trường, Kệ K1",
            notes: "Giảng viên tiếp nhận trái phép",
          });
        },
        (err: any) => {
          assert.ok(
            err.name === "AuthorizationError" ||
              err.name === "ForbiddenError" ||
              err.message.includes("quyền")
          );
          return true;
        }
      );
    });

    it("Step 9: Accepts dossier into institutional archives by Archivist (ARCHIVED)", async () => {
      const archived = await DossierService.acceptArchive(archivistUser, {
        dossierId,
        storageLocation: "Kho lưu trữ QCET, Giá G03, Hộp H12",
        notes: "Đã kiểm tra đủ thành phần tài liệu theo mục lục và nhập kho lưu trữ lịch sử",
      });

      assert.equal(archived.status, DossierStatus.ARCHIVED);
      assert.ok(archived.archivedAt);
      assert.equal(archived.archivedById, archivistUser.id);
      assert.equal(archived.storageLocation, "Kho lưu trữ QCET, Giá G03, Hộp H12");

      // Verify Audit Event
      const audit = await prisma.auditEvent.findFirst({
        where: {
          entityId: dossierId,
          action: "DOSSIER_ACCEPTED_ARCHIVE",
        },
      });
      assert.ok(audit);

      // Verify Outbox Event
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: dossierId,
          eventType: "DOSSIER_ACCEPTED_ARCHIVE_NOTIFICATION",
        },
      });
      assert.ok(outbox);
    });

    it("Step 10: Invariant check on ARCHIVED dossier — cannot modify", async () => {
      // Cannot add item
      await assert.rejects(
        async () => {
          await DossierService.addItemToDossier(specialistUser, {
            dossierId,
            itemType: DossierItemType.DOCUMENT,
            title: "Cố tình thêm vào hồ sơ đã lưu trữ lịch sử",
          });
        },
        (err: any) => {
          assert.equal(err.name, "InvalidTransitionError");
          return true;
        }
      );

      // Cannot remove item
      await assert.rejects(
        async () => {
          await DossierService.removeItemFromDossier(specialistUser, {
            dossierId,
            itemId: docItemId,
          });
        },
        (err: any) => {
          assert.equal(err.name, "InvalidTransitionError");
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 2. QUERYING, SCOPING, AND FILTERING
  // =========================================================================
  describe("2. List Dossiers: Scoping & Filters", () => {
    it("filters dossiers by status and unit", async () => {
      const list = await DossierService.listDossiers(specialistUser, {
        owningUnitId: ouAcadId,
        status: DossierStatus.ARCHIVED,
      });

      assert.ok(list.items.length >= 1);
      assert.equal(list.items[0].owningUnitId, ouAcadId);
      assert.equal(list.items[0].status, DossierStatus.ARCHIVED);
    });

    it("filters dossiers by search term", async () => {
      const list = await DossierService.listDossiers(specialistUser, {
        search: testRunId,
      });

      assert.ok(list.items.length >= 1);
      assert.ok(list.items[0].title.includes(testRunId));
    });
  });

  // =========================================================================
  // 3. HTTP API ROUTE HANDLERS
  // =========================================================================
  describe("3. HTTP API Route Handlers Verification", () => {
    let apiDossierId: string;
    let apiItemId: string;

    it("POST /api/dossiers creates dossier via HTTP", async () => {
      const req = new NextRequest("http://localhost:3000/api/dossiers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${specialistToken}`,
        },
        body: JSON.stringify({
          code: `HS-API-${testRunId}`,
          title: `Hồ sơ kiểm định chất lượng CTĐT ${testRunId}`,
          owningUnitId: ouAcadId,
          responsiblePersonId: specialistUser.id,
          retentionRuleId: retentionRuleId,
          classification: DataClassification.RESTRICTED,
          storageLocation: "Phòng QLĐT",
        }),
      });

      const res = await createDossierRoute(req);
      const data = await res.json();

      assert.equal(res.status, 201);
      assert.ok(data.id);
      assert.equal(data.code, `HS-API-${testRunId}`);
      apiDossierId = data.id;
    });

    it("GET /api/dossiers lists dossiers via HTTP", async () => {
      const req = new NextRequest(`http://localhost:3000/api/dossiers?search=${testRunId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${specialistToken}`,
        },
      });

      const res = await listDossiersRoute(req);
      const data = await res.json();

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(data.items));
      assert.ok(data.items.length >= 2);
    });

    it("GET /api/dossiers/[id] gets dossier detail via HTTP", async () => {
      const req = new NextRequest(`http://localhost:3000/api/dossiers/${apiDossierId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${specialistToken}`,
        },
      });

      const res = await getDossierDetailRoute(req, { params: Promise.resolve({ id: apiDossierId }) });
      const data = await res.json();

      assert.equal(res.status, 200);
      assert.equal(data.id, apiDossierId);
      assert.equal(data.code, `HS-API-${testRunId}`);
    });

    it("POST /api/dossiers/[id]/items adds an item via HTTP", async () => {
      const req = new NextRequest(`http://localhost:3000/api/dossiers/${apiDossierId}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${specialistToken}`,
        },
        body: JSON.stringify({
          itemType: DossierItemType.DOCUMENT,
          title: "Báo cáo tự đánh giá tiêu chí 1",
          documentId: sampleDocId,
          pageCount: 24,
        }),
      });

      const res = await addItemRoute(req, { params: Promise.resolve({ id: apiDossierId }) });
      const data = await res.json();

      assert.equal(res.status, 201);
      assert.ok(data.id);
      assert.equal(data.title, "Báo cáo tự đánh giá tiêu chí 1");
      apiItemId = data.id;
    });

    it("GET /api/dossiers/[id]/items lists items via HTTP", async () => {
      const req = new NextRequest(`http://localhost:3000/api/dossiers/${apiDossierId}/items`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${specialistToken}`,
        },
      });

      const res = await listItemsRoute(req, { params: Promise.resolve({ id: apiDossierId }) });
      const data = await res.json();

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(data.items));
      assert.equal(data.items.length, 1);
    });

    it("POST /api/dossiers/[id]/actions/close closes dossier via HTTP", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/dossiers/${apiDossierId}/actions/close`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${specialistToken}`,
          },
          body: JSON.stringify({
            notes: "Đóng hồ sơ qua HTTP",
          }),
        }
      );

      const res = await closeDossierRoute(req, { params: Promise.resolve({ id: apiDossierId }) });
      const data = await res.json();

      assert.equal(res.status, 200);
      assert.equal(data.status, DossierStatus.CLOSED);
    });

    it("POST /api/dossiers/[id]/actions/submit-archive submits dossier via HTTP", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/dossiers/${apiDossierId}/actions/submit-archive`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${specialistToken}`,
          },
          body: JSON.stringify({
            notes: "Nộp lưu qua HTTP",
          }),
        }
      );

      const res = await submitArchiveRoute(req, { params: Promise.resolve({ id: apiDossierId }) });
      const data = await res.json();

      assert.equal(res.status, 200);
      assert.equal(data.status, DossierStatus.SUBMITTED_TO_ARCHIVE);
    });

    it("POST /api/dossiers/[id]/actions/accept-archive rejects submitter with 403 (SoD)", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/dossiers/${apiDossierId}/actions/accept-archive`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${specialistToken}`,
          },
          body: JSON.stringify({
            storageLocation: "Kho lưu trữ",
          }),
        }
      );

      const res = await acceptArchiveRoute(req, { params: Promise.resolve({ id: apiDossierId }) });
      const data = await res.json();

      assert.equal(res.status, 403);
      assert.ok(data.error.includes("SoD") || data.error.includes("Người nộp lưu"));
    });

    it("POST /api/dossiers/[id]/actions/accept-archive accepts dossier by Archivist via HTTP", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/dossiers/${apiDossierId}/actions/accept-archive`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${archivistToken}`,
          },
          body: JSON.stringify({
            storageLocation: "Kho số 2, Kệ A1",
            notes: "Tiếp nhận qua HTTP API",
          }),
        }
      );

      const res = await acceptArchiveRoute(req, { params: Promise.resolve({ id: apiDossierId }) });
      const data = await res.json();

      assert.equal(res.status, 200);
      assert.equal(data.status, DossierStatus.ARCHIVED);
      assert.equal(data.archivedById, archivistUser.id);
    });

    it("rejects unauthenticated requests with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/dossiers", {
        method: "GET",
      });

      const res = await listDossiersRoute(req);
      assert.equal(res.status, 401);
    });
  });
});
