import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { POST as batchRoute } from "../src/app/api/documents/batch/route";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/jwt-session";
import {
  DocumentType,
  DocumentStatus,
  DocumentUrgency,
  DocumentSecurityLevel,
  IncomingDocumentStatus,
  JobCatalogGroup,
} from "@prisma/client";
import { AuditAction, AuditEntityType } from "../src/lib/db/audit";
import { BatchDocumentRequestSchema } from "../src/contracts/documents";

describe("Document Batch Operations API (NĐ 30/2020)", () => {
  let clerkUserId: string;
  let clerkSessionToken: string;
  let bghUserId: string;
  let bghSessionToken: string;
  let staffUserId: string;
  let staffSessionToken: string;
  let testUnitId: string;
  let secondUnitId: string;
  const createdDocumentIds: string[] = [];
  const createdDossierIds: string[] = [];

  before(async () => {
    // 1. Fetch or create test units
    const units = await prisma.organizationalUnit.findMany({ take: 2 });
    assert.ok(units.length > 0, "At least one unit must exist");
    testUnitId = units[0].id;
    secondUnitId = units[1]?.id || units[0].id;

    // 2. Setup Clerk User (VAN_THU)
    let clerk = await prisma.user.findFirst({ where: { role: "VAN_THU" } });
    if (!clerk) {
      clerk = await prisma.user.create({
        data: {
          id: `test-clerk-batch-${Date.now()}`,
          email: `clerk-batch-${Date.now()}@cdktcnqn.edu.vn`,
          name: "Văn thư kiểm thử lô",
          role: "VAN_THU",
        },
      });
    }
    clerkUserId = clerk.id;
    clerkSessionToken = signSessionToken({
      id: clerk.id,
      email: clerk.email,
      name: clerk.name,
      role: clerk.role,
    });

    // 3. Setup BGH User (BAN_GIAM_HIEU / HIEU_TRUONG)
    let bgh = await prisma.user.findFirst({ where: { role: "BAN_GIAM_HIEU" } });
    if (!bgh) {
      bgh = await prisma.user.create({
        data: {
          id: `test-bgh-batch-${Date.now()}`,
          email: `bgh-batch-${Date.now()}@cdktcnqn.edu.vn`,
          name: "Lãnh đạo BGH kiểm thử lô",
          role: "BAN_GIAM_HIEU",
        },
      });
    }
    bghUserId = bgh.id;
    bghSessionToken = signSessionToken({
      id: bgh.id,
      email: bgh.email,
      name: bgh.name,
      role: bgh.role,
    });

    // 4. Setup Staff User (CHUYEN_VIEN)
    let staff = await prisma.user.findFirst({ where: { role: "CHUYEN_VIEN" } });
    if (!staff) {
      staff = await prisma.user.create({
        data: {
          id: `test-staff-batch-${Date.now()}`,
          email: `staff-batch-${Date.now()}@cdktcnqn.edu.vn`,
          name: "Chuyên viên kiểm thử lô",
          role: "CHUYEN_VIEN",
        },
      });
    }
    staffUserId = staff.id;
    staffSessionToken = signSessionToken({
      id: staff.id,
      email: staff.email,
      name: staff.name,
      role: staff.role,
    });
  });

  after(async () => {
    if (createdDocumentIds.length > 0) {
      await prisma.dossierItem.deleteMany({
        where: { itemId: { in: createdDocumentIds } },
      });
      await prisma.documentIncomingWorkflow.deleteMany({
        where: { documentId: { in: createdDocumentIds } },
      });
      await prisma.documentOutgoingWorkflow.deleteMany({
        where: { documentId: { in: createdDocumentIds } },
      });
      await prisma.document.deleteMany({
        where: { id: { in: createdDocumentIds } },
      });
    }
    if (createdDossierIds.length > 0) {
      await prisma.dossierItem.deleteMany({
        where: { dossierId: { in: createdDossierIds } },
      });
      await prisma.workDossier.deleteMany({
        where: { id: { in: createdDossierIds } },
      });
    }
  });

  // Helper to create test incoming documents
  async function createTestDocument(type: DocumentType = DocumentType.VAN_BAN_DEN) {
    const regNum = Math.floor(100000 + Math.random() * 899999);
    const doc = await prisma.document.create({
      data: {
        type,
        registrationNumber: regNum,
        documentYear: 2026,
        originalNumber: `TEST-BATCH-${regNum}`,
        issuedDate: new Date(),
        issuingAuthority: "Bộ Giáo dục và Đào tạo",
        category: "Quyết định",
        summary: `Văn bản kiểm thử batch operations số ${regNum}`,
        urgency: DocumentUrgency.THUONG,
        securityLevel: DocumentSecurityLevel.THUONG,
        status: DocumentStatus.CHO_PHAN_CONG,
        registeredById: clerkUserId,
        incomingWorkflow:
          type === DocumentType.VAN_BAN_DEN
            ? {
                create: {
                  status: IncomingDocumentStatus.REGISTERED,
                },
              }
            : undefined,
      },
    });
    createdDocumentIds.push(doc.id);
    return doc;
  }

  test("Zod Contract: BatchDocumentRequestSchema validation", () => {
    // Valid MARK_RESOLVED payload
    const validResolved = BatchDocumentRequestSchema.parse({
      action: "MARK_RESOLVED",
      documentIds: ["doc-1", "doc-2"],
      resolutionSummary: "Đã xử lý xong toàn bộ",
    });
    assert.equal(validResolved.action, "MARK_RESOLVED");
    assert.equal(validResolved.documentIds.length, 2);

    // Valid ASSIGN_LEAD_UNIT payload
    const validAssign = BatchDocumentRequestSchema.parse({
      action: "ASSIGN_LEAD_UNIT",
      documentIds: ["doc-1"],
      leadUnitId: "unit-123",
      instruction: "Khẩn trương xử lý theo đúng hạn",
    });
    assert.equal(validAssign.action, "ASSIGN_LEAD_UNIT");
    assert.equal(validAssign.leadUnitId, "unit-123");

    // ASSIGN_LEAD_UNIT missing leadUnitId must throw
    assert.throws(() => {
      BatchDocumentRequestSchema.parse({
        action: "ASSIGN_LEAD_UNIT",
        documentIds: ["doc-1"],
      });
    });

    // Empty documentIds must throw
    assert.throws(() => {
      BatchDocumentRequestSchema.parse({
        action: "MARK_RESOLVED",
        documentIds: [],
      });
    });
  });

  test("RBAC: Staff cannot perform batch operations (403 Forbidden)", async () => {
    const doc = await createTestDocument();

    const req = new NextRequest("http://localhost:3000/api/documents/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${SESSION_COOKIE_NAME}=${staffSessionToken}`,
        origin: "http://localhost:3000",
        "x-requested-with": "XMLHttpRequest",
      },
      body: JSON.stringify({
        action: "MARK_RESOLVED",
        documentIds: [doc.id],
      }),
    });

    const res = await batchRoute(req);
    const data = await res.json();
    assert.equal(res.status, 403);
    assert.equal(data.success, false);
  });

  test("Batch Action 1: MARK_RESOLVED marks multiple documents resolved", async () => {
    const doc1 = await createTestDocument();
    const doc2 = await createTestDocument();

    const req = new NextRequest("http://localhost:3000/api/documents/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${SESSION_COOKIE_NAME}=${bghSessionToken}`,
        origin: "http://localhost:3000",
        "x-requested-with": "XMLHttpRequest",
      },
      body: JSON.stringify({
        action: "MARK_RESOLVED",
        documentIds: [doc1.id, doc2.id],
        resolutionSummary: "Đã hoàn thành xử lý lô tài liệu",
      }),
    });

    const res = await batchRoute(req);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.action, "MARK_RESOLVED");
    assert.equal(body.data.successCount, 2);
    assert.equal(body.data.failureCount, 0);

    // Verify DB updates
    const updatedDoc1 = await prisma.document.findUnique({
      where: { id: doc1.id },
      include: { incomingWorkflow: true },
    });
    assert.equal(updatedDoc1?.status, DocumentStatus.DA_HOAN_THANH);
    assert.equal(updatedDoc1?.incomingWorkflow?.status, IncomingDocumentStatus.RESOLVED);
    assert.equal(updatedDoc1?.incomingWorkflow?.resolutionSummary, "Đã hoàn thành xử lý lô tài liệu");

    // Verify Audit Event logged
    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        entityId: doc1.id,
        action: AuditAction.DOCUMENT_RESOLVED,
      },
    });
    assert.ok(auditEvents.length > 0, "Audit event must be logged for document resolution");
  });

  test("Batch Action 2: ASSIGN_LEAD_UNIT assigns lead unit to multiple documents", async () => {
    const doc1 = await createTestDocument();
    const doc2 = await createTestDocument();

    const req = new NextRequest("http://localhost:3000/api/documents/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${SESSION_COOKIE_NAME}=${bghSessionToken}`,
        origin: "http://localhost:3000",
        "x-requested-with": "XMLHttpRequest",
      },
      body: JSON.stringify({
        action: "ASSIGN_LEAD_UNIT",
        documentIds: [doc1.id, doc2.id],
        leadUnitId: secondUnitId,
        instruction: "Đề nghị đơn vị chủ trì báo cáo kết quả trước 30/09/2026",
        deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
      }),
    });

    const res = await batchRoute(req);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.action, "ASSIGN_LEAD_UNIT");
    assert.equal(body.data.successCount, 2);

    // Verify DB updates
    const updatedDoc1 = await prisma.document.findUnique({
      where: { id: doc1.id },
      include: { incomingWorkflow: true },
    });
    assert.equal(updatedDoc1?.status, DocumentStatus.DANG_XU_LY);
    assert.equal(updatedDoc1?.incomingWorkflow?.status, IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT);
    assert.equal(updatedDoc1?.incomingWorkflow?.leadUnitId, secondUnitId);

    // Verify Audit Event logged
    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        entityId: doc1.id,
        action: AuditAction.DOCUMENT_DIRECTED,
      },
    });
    assert.ok(auditEvents.length > 0, "Audit event must be logged for unit assignment");
  });

  test("Batch Action 3: FILE_DOCUMENTS files documents into a work dossier", async () => {
    const doc1 = await createTestDocument();
    const doc2 = await createTestDocument();

    // Create a test work dossier
    const dossierCode = `HS-TEST-${Date.now()}`;
    const dossier = await prisma.workDossier.create({
      data: {
        code: dossierCode,
        title: "Hồ sơ công việc kiểm thử lô",
        owningUnitId: testUnitId,
        responsiblePersonId: clerkUserId,
      },
    });
    createdDossierIds.push(dossier.id);

    const req = new NextRequest("http://localhost:3000/api/documents/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${SESSION_COOKIE_NAME}=${clerkSessionToken}`,
        origin: "http://localhost:3000",
        "x-requested-with": "XMLHttpRequest",
      },
      body: JSON.stringify({
        action: "FILE_DOCUMENTS",
        documentIds: [doc1.id, doc2.id],
        dossierId: dossier.id,
        storageLocation: "Tủ hồ sơ A2, Tầng 3",
        filingNotes: "Đưa vào hồ sơ chuyên đề kiểm định",
      }),
    });

    const res = await batchRoute(req);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.action, "FILE_DOCUMENTS");
    assert.equal(body.data.successCount, 2);

    // Verify Document and Workflow
    const updatedDoc1 = await prisma.document.findUnique({
      where: { id: doc1.id },
      include: { incomingWorkflow: true },
    });
    assert.equal(updatedDoc1?.status, DocumentStatus.LUU_THEO_DOI);
    assert.equal(updatedDoc1?.incomingWorkflow?.status, IncomingDocumentStatus.FILED);

    // Verify Dossier items created
    const dossierItems = await prisma.dossierItem.findMany({
      where: { dossierId: dossier.id },
    });
    assert.equal(dossierItems.length, 2, "Dossier must contain 2 items linked to documents");
  });

  test("Batch Action 4: ARCHIVE_DOCUMENTS archives documents", async () => {
    const doc1 = await createTestDocument();

    const req = new NextRequest("http://localhost:3000/api/documents/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${SESSION_COOKIE_NAME}=${clerkSessionToken}`,
        origin: "http://localhost:3000",
        "x-requested-with": "XMLHttpRequest",
      },
      body: JSON.stringify({
        action: "ARCHIVE_DOCUMENTS",
        documentIds: [doc1.id],
        archiveReason: "Hết thời hạn sử dụng hiện hành, chuyển lưu trữ vĩnh viễn",
      }),
    });

    const res = await batchRoute(req);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.action, "ARCHIVE_DOCUMENTS");
    assert.equal(body.data.successCount, 1);

    const updatedDoc = await prisma.document.findUnique({
      where: { id: doc1.id },
      include: { incomingWorkflow: true },
    });
    assert.equal(updatedDoc?.status, DocumentStatus.LUU_THEO_DOI);
    assert.equal(updatedDoc?.incomingWorkflow?.status, IncomingDocumentStatus.ARCHIVED);
    assert.ok(updatedDoc?.archivedAt, "archivedAt must be set");
  });

  test("Handling non-existent document IDs gracefully with detailed failure reports", async () => {
    const doc1 = await createTestDocument();
    const fakeId = "non-existent-doc-id-999999";

    const req = new NextRequest("http://localhost:3000/api/documents/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${SESSION_COOKIE_NAME}=${clerkSessionToken}`,
        origin: "http://localhost:3000",
        "x-requested-with": "XMLHttpRequest",
      },
      body: JSON.stringify({
        action: "MARK_RESOLVED",
        documentIds: [doc1.id, fakeId],
      }),
    });

    const res = await batchRoute(req);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.total, 2);
    assert.equal(body.data.successCount, 1);
    assert.equal(body.data.failureCount, 1);
    assert.equal(body.data.failed[0].documentId, fakeId);
  });
});
