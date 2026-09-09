import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import {
  validateDocumentCreatePayload,
  validateDirectivePayload,
  validateDocumentUpdatePayload,
} from "../src/lib/documents/document-validator";
import { GET as listDocumentsRoute, POST as createDocumentRoute } from "../src/app/api/documents/route";
import { GET as getDocumentRoute, PATCH as patchDocumentRoute } from "../src/app/api/documents/[id]/route";
import { POST as postDirectiveRoute } from "../src/app/api/documents/[id]/directives/route";
import { signSessionToken } from "../src/lib/jwt-session";

describe("Document Registry API & Validation Tests (ND30)", () => {
  let seededUserId: string;
  let seededBghUserId: string;
  let seededDeptId: string;
  let sessionToken: string;
  let bghSessionToken: string;
  const createdDocumentIds: string[] = [];
  const createdTaskIds: string[] = [];

  before(async () => {
    // Obtain valid user and department from database
    const user = (await prisma.user.findFirst({
      where: { NOT: { email: { contains: "test" } } },
    })) || (await prisma.user.findFirst());
    assert.ok(user, "At least one user must exist in database");
    seededUserId = user.id;

    sessionToken = signSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const bghUser = (await prisma.user.findFirst({ where: { role: { in: ["BAN_GIAM_HIEU", "ADMIN"] } } })) || user;
    seededBghUserId = bghUser.id;
    bghSessionToken = signSessionToken({
      id: bghUser.id,
      email: bghUser.email,
      name: bghUser.name,
      role: "BAN_GIAM_HIEU",
    });

    const dept = await prisma.department.findFirst();
    assert.ok(dept, "At least one department must exist in database");
    seededDeptId = dept.id;

    // Clean up any lingering test documents and generated tasks from previous runs
    await prisma.documentDirective.deleteMany({
      where: { document: { registrationNumber: { in: [8888, 9999] } } },
    });
    await prisma.document.deleteMany({
      where: { registrationNumber: { in: [8888, 9999] } },
    });
    await prisma.task.deleteMany({
      where: {
        OR: [
          { title: { contains: "888/UBND-KHTN" } },
          { title: { contains: "#8888" } },
        ],
      },
    });
  });

  after(async () => {
    // Clean up created directives, tasks, and documents in reverse order
    if (createdDocumentIds.length > 0) {
      await prisma.documentDirective.deleteMany({
        where: { documentId: { in: createdDocumentIds } },
      });
      await prisma.documentAttachment.deleteMany({
        where: { documentId: { in: createdDocumentIds } },
      });
      // Nullify linkedTaskId before deleting task and document
      await prisma.document.updateMany({
        where: { id: { in: createdDocumentIds } },
        data: { linkedTaskId: null },
      });
    }

    if (createdTaskIds.length > 0) {
      await prisma.taskAssignee.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.taskDeliverable.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.task.deleteMany({
        where: { id: { in: createdTaskIds } },
      });
    }

    if (createdDocumentIds.length > 0) {
      await prisma.document.deleteMany({
        where: { id: { in: createdDocumentIds } },
      });
    }
  });

  describe("Payload Validation Unit Tests", () => {
    test("validateDocumentCreatePayload validates valid document payload", () => {
      const validPayload = {
        type: "VAN_BAN_DEN",
        originalNumber: "99/GDNN",
        issuedDate: "2026-09-01T00:00:00Z",
        issuingAuthority: "Tổng cục Giáo dục Nghề nghiệp",
        category: "Công văn",
        summary: "Kế hoạch tập huấn chuyển đổi số",
        urgency: "THUONG",
        securityLevel: "THUONG",
        registeredById: seededUserId,
      };

      const result = validateDocumentCreatePayload(validPayload);
      assert.equal(result.isValid, true);
      assert.equal(result.errors.length, 0);
    });

    test("validateDocumentCreatePayload rejects payload missing summary, originalNumber or type", () => {
      const invalidPayload = {
        type: "INVALID_TYPE",
        issuingAuthority: "Sở LĐTBXH",
      };

      const result = validateDocumentCreatePayload(invalidPayload);
      assert.equal(result.isValid, false);
      assert.ok(result.errors.length >= 3, "Should catch invalid type, missing originalNumber, summary, etc.");
    });

    test("validateDirectivePayload requires instruction and assignedDeptId", () => {
      const validDirective = {
        leaderId: seededUserId,
        instruction: "Giao Phòng Đào tạo phối hợp Khoa CNTT xây dựng kế hoạch",
        assignedDeptId: seededDeptId,
      };
      const validResult = validateDirectivePayload(validDirective);
      assert.equal(validResult.isValid, true);
      assert.equal(validResult.errors.length, 0);

      const invalidDirective = {
        leaderId: seededUserId,
        instruction: "",
      };
      const invalidResult = validateDirectivePayload(invalidDirective);
      assert.equal(invalidResult.isValid, false);
      assert.ok(invalidResult.errors.some((e) => e.includes("instruction") || e.includes("chỉ đạo")));
      assert.ok(invalidResult.errors.some((e) => e.includes("assignedDeptId") || e.includes("đơn vị")));
    });

    test("validateDocumentUpdatePayload validates fields correctly", () => {
      const validUpdate = {
        status: "DANG_XU_LY",
        summary: "Cập nhật tóm tắt nội dung",
        urgency: "HOA_TOC",
      };
      const result = validateDocumentUpdatePayload(validUpdate);
      assert.equal(result.isValid, true);

      const invalidUpdate = {
        status: "NON_EXISTENT_STATUS",
      };
      const invalidResult = validateDocumentUpdatePayload(invalidUpdate);
      assert.equal(invalidResult.isValid, false);
    });
  });

  describe("GET /api/documents", () => {
    test("returns list of documents with total count", async () => {
      const req = new NextRequest("http://localhost:3000/api/documents?limit=10&page=1", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const res = await listDocumentsRoute(req);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data));
      assert.equal(typeof body.total, "number");
    });

    test("supports query filtering by type and documentYear", async () => {
      const req = new NextRequest("http://localhost:3000/api/documents?type=VAN_BAN_DEN&year=2026", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const res = await listDocumentsRoute(req);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data));
      for (const doc of body.data) {
        assert.equal(doc.type, "VAN_BAN_DEN");
        assert.equal(doc.documentYear, 2026);
      }
    });
  });

  describe("POST /api/documents", () => {
    test("rejects invalid payload with status 400 and validation errors", async () => {
      const req = new NextRequest("http://localhost:3000/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          type: "VAN_BAN_DEN",
          // missing originalNumber, issuingAuthority, summary, etc.
        }),
      });

      const res = await createDocumentRoute(req);
      assert.equal(res.status, 400);

      const body = await res.json();
      assert.equal(body.success, false);
      assert.ok(Array.isArray(body.errors));
      assert.ok(body.errors.length > 0);
    });

    test("registers incoming document with auto-assigned registration number", async () => {
      const req = new NextRequest("http://localhost:3000/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          type: "VAN_BAN_DEN",
          originalNumber: "123/UBND-VX",
          issuedDate: "2026-09-05T08:00:00Z",
          issuingAuthority: "UBND Tỉnh Bình Định",
          category: "Chỉ thị",
          summary: "V/v thực hiện công tác chuyển đổi số và bảo đảm an toàn thông tin 2026",
          urgency: "HOA_TOC",
          securityLevel: "THUONG",
          registeredById: seededUserId,
        }),
      });

      const res = await createDocumentRoute(req);
      assert.equal(res.status, 201);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(body.data);
      assert.ok(body.data.id);
      assert.equal(typeof body.data.registrationNumber, "number");
      assert.ok(body.data.registrationNumber > 0);
      assert.equal(body.data.originalNumber, "123/UBND-VX");
      assert.equal(body.data.urgency, "HOA_TOC");

      createdDocumentIds.push(body.data.id);
    });
  });

  describe("GET & PATCH /api/documents/[id]", () => {
    let testDocId: string;

    before(async () => {
      // Seed a document for testing individual ID endpoints
      const doc = await prisma.document.create({
        data: {
          type: "VAN_BAN_DEN",
          registrationNumber: 9999,
          documentYear: 2026,
          originalNumber: "999/TEST-ID",
          issuedDate: new Date("2026-09-01"),
          issuingAuthority: "QCET Test Authority",
          category: "Công văn",
          summary: "Văn bản mẫu kiểm tra endpoint ID",
          urgency: "THUONG",
          securityLevel: "THUONG",
          status: "CHO_PHAN_CONG",
          registeredById: seededUserId,
        },
      });
      testDocId = doc.id;
      createdDocumentIds.push(testDocId);
    });

    test("GET /api/documents/[id] returns 404 for non-existent ID", async () => {
      const req = new NextRequest("http://localhost:3000/api/documents/non-existent-id-9999", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const res = await getDocumentRoute(req, { params: Promise.resolve({ id: "non-existent-id-9999" }) });
      assert.equal(res.status, 404);

      const body = await res.json();
      assert.equal(body.success, false);
    });

    test("GET /api/documents/[id] returns document details for valid ID", async () => {
      const req = new NextRequest(`http://localhost:3000/api/documents/${testDocId}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const res = await getDocumentRoute(req, { params: Promise.resolve({ id: testDocId }) });
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.id, testDocId);
      assert.equal(body.data.originalNumber, "999/TEST-ID");
      assert.ok(Array.isArray(body.data.attachments));
      assert.ok(Array.isArray(body.data.directives));
    });

    test("PATCH /api/documents/[id] updates document status and fields", async () => {
      const req = new NextRequest(`http://localhost:3000/api/documents/${testDocId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          status: "DANG_XU_LY",
          summary: "Văn bản đã được cập nhật tóm tắt qua PATCH",
          urgency: "THUONG_KHAN",
        }),
      });

      const res = await patchDocumentRoute(req, { params: Promise.resolve({ id: testDocId }) });
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.status, "DANG_XU_LY");
      assert.equal(body.data.summary, "Văn bản đã được cập nhật tóm tắt qua PATCH");
      assert.equal(body.data.urgency, "THUONG_KHAN");
    });
  });

  describe("POST /api/documents/[id]/directives (Bút phê BGH & School Task Generation)", () => {
    let directiveDocId: string;

    before(async () => {
      // Seed a document waiting for assignment
      const doc = await prisma.document.create({
        data: {
          type: "VAN_BAN_DEN",
          registrationNumber: 8888,
          documentYear: 2026,
          originalNumber: "888/UBND-KHTN",
          issuedDate: new Date("2026-09-02"),
          issuingAuthority: "Sở Khoa học và Công nghệ",
          category: "Thông báo",
          summary: "Thông báo nộp đề cương nhiệm vụ NCKH cấp cơ sở năm học 2026-2027",
          urgency: "HOA_TOC",
          securityLevel: "THUONG",
          status: "CHO_PHAN_CONG",
          registeredById: seededUserId,
        },
      });
      directiveDocId = doc.id;
      createdDocumentIds.push(directiveDocId);
    });

    test("rejects directive on non-existent document with status 404", async () => {
      const req = new NextRequest("http://localhost:3000/api/documents/fake-doc/directives", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bghSessionToken}`,
        },
        body: JSON.stringify({
          instruction: "Chỉ đạo mẫu",
          assignedDeptId: seededDeptId,
        }),
      });

      const res = await postDirectiveRoute(req, { params: Promise.resolve({ id: "fake-doc" }) });
      assert.equal(res.status, 404);
    });

    test("rejects invalid directive payload with status 400", async () => {
      const req = new NextRequest(`http://localhost:3000/api/documents/${directiveDocId}/directives`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bghSessionToken}`,
        },
        body: JSON.stringify({
          instruction: "", // empty
          assignedDeptId: "",
        }),
      });

      const res = await postDirectiveRoute(req, { params: Promise.resolve({ id: directiveDocId }) });
      assert.equal(res.status, 400);

      const body = await res.json();
      assert.equal(body.success, false);
      assert.ok(body.errors.length > 0);
    });

    test("records directive, generates School Task, links them and sets status to DANG_XU_LY", async () => {
      const req = new NextRequest(`http://localhost:3000/api/documents/${directiveDocId}/directives`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bghSessionToken}`,
        },
        body: JSON.stringify({
          leaderId: seededBghUserId,
          instruction: "Giao Phòng Đào tạo chủ trì, thông báo rộng rãi đến toàn thể giảng viên đăng ký đề tài",
          assignedDeptId: seededDeptId,
          deadline: "2026-09-20T17:00:00.000Z",
          collaboratorIds: ["khoa-cntt"],
        }),
      });

      const res = await postDirectiveRoute(req, { params: Promise.resolve({ id: directiveDocId }) });
      assert.equal(res.status, 201);

      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(body.data);

      const { task, directive, document } = body.data;
      assert.ok(task && task.id, "School Task must be created");
      assert.ok(directive && directive.id, "DocumentDirective must be recorded");
      assert.ok(document, "Document must be updated");

      // Track created task ID for cleanup
      createdTaskIds.push(task.id);

      // Verify task details
      assert.equal(task.scope, "SCHOOL");
      assert.equal(task.departmentId, seededDeptId);
      assert.ok(task.title.includes("888/UBND-KHTN"), "Task title must include original document number");
      assert.equal(task.priority, "URGENT", "HOA_TOC document urgency must map to URGENT task priority");

      // Verify directive details
      assert.equal(directive.isTaskGenerated, true);
      assert.equal(directive.documentId, directiveDocId);

      // Verify document status & link
      assert.equal(document.status, "DANG_XU_LY");
      assert.equal(document.linkedTaskId, task.id);

      // Verify database state matches
      const dbDoc = await prisma.document.findUnique({
        where: { id: directiveDocId },
      });
      assert.equal(dbDoc?.status, "DANG_XU_LY");
      assert.equal(dbDoc?.linkedTaskId, task.id);

      const dbTask = await prisma.task.findUnique({
        where: { id: task.id },
      });
      assert.ok(dbTask, "Task must exist in database");
      assert.equal(dbTask?.scope, "SCHOOL");
    });
  });
});
