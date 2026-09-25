import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { GET as getAuditLogsRoute } from "../src/app/api/documents/[id]/audit-logs/route";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/jwt-session";
import {
  DocumentType,
  DocumentStatus,
  DocumentUrgency,
  DocumentSecurityLevel,
  IncomingDocumentStatus,
} from "@prisma/client";
import { auditService, AuditAction, AuditEntityType } from "../src/lib/db/audit";

describe("Document Audit Timeline & Circulation History API Tests", () => {
  let seededUser: any;
  let sessionToken: string;
  let testDocument: any;
  let testWorkflow: any;
  const createdDocumentIds: string[] = [];
  const createdUserIds: string[] = [];

  before(async () => {
    // 1. Get or create seeded user
    seededUser = (await prisma.user.findFirst({
      where: { role: "VAN_THU" },
    })) || (await prisma.user.findFirst());

    if (!seededUser) {
      seededUser = await prisma.user.create({
        data: {
          id: `test-clerk-${Date.now()}`,
          email: `test-clerk-${Date.now()}@cdktcnqn.edu.vn`,
          name: "Văn thư Thử nghiệm",
          role: "VAN_THU",
          title: "Văn thư viên",
        },
      });
      createdUserIds.push(seededUser.id);
    }

    sessionToken = signSessionToken({
      id: seededUser.id,
      email: seededUser.email,
      name: seededUser.name,
      role: seededUser.role,
    });

    // 2. Create test document with incoming workflow
    const timestamp = Date.now();
    testDocument = await prisma.document.create({
      data: {
        registrationNumber: Math.floor(Math.random() * 900000) + 10000,
        documentYear: 2026,
        originalNumber: `CV-TEST-${timestamp}`,
        issuedDate: new Date(),
        registeredDate: new Date(),
        issuingAuthority: "Bộ Giáo dục và Đào tạo",
        category: "CONG_VAN",
        summary: `Văn bản kiểm thử Timeline và Lịch sử luân chuyển ${timestamp}`,
        type: DocumentType.VAN_BAN_DEN,
        urgency: DocumentUrgency.THUONG,
        securityLevel: DocumentSecurityLevel.THUONG,
        status: DocumentStatus.DANG_XU_LY,
        registeredById: seededUser.id,
      },
    });
    createdDocumentIds.push(testDocument.id);

    // 3. Create workflow record
    testWorkflow = await prisma.documentIncomingWorkflow.create({
      data: {
        documentId: testDocument.id,
        status: IncomingDocumentStatus.DIRECTED,
        presentedAt: new Date(),
        presentedById: seededUser.id,
        presenterNotes: "Kính trình BGH xem xét cho ý kiến chỉ đạo",
        directedAt: new Date(),
        leaderId: seededUser.id,
        leadershipInstruction: "Giao Phòng Đào tạo chủ trì triển khai theo kế hoạch",
      },
    });

    // 4. Log audit events for the document
    await auditService.logEvent({
      actorId: seededUser.id,
      action: AuditAction.DOCUMENT_CREATED,
      entityType: AuditEntityType.DOCUMENT,
      entityId: testDocument.id,
      afterData: {
        documentId: testDocument.id,
        summary: testDocument.summary,
      },
    });

    await auditService.logEvent({
      actorId: seededUser.id,
      action: AuditAction.DOCUMENT_PRESENTED,
      entityType: AuditEntityType.DOCUMENT,
      entityId: testDocument.id,
      afterData: {
        status: "PRESENTED",
        presenterNotes: "Kính trình BGH xem xét cho ý kiến chỉ đạo",
      },
    });
  });

  after(async () => {
    // Cleanup created records
    for (const docId of createdDocumentIds) {
      await prisma.documentIncomingWorkflow.deleteMany({ where: { documentId: docId } });
      await prisma.auditEvent.deleteMany({ where: { entityId: docId } });
      await prisma.document.deleteMany({ where: { id: docId } });
    }
    for (const uId of createdUserIds) {
      await prisma.user.deleteMany({ where: { id: uId } });
    }
  });

  test("GET /api/documents/[id]/audit-logs returns 401 when unauthenticated", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/documents/${testDocument.id}/audit-logs`
    );
    const res = await getAuditLogsRoute(req, {
      params: Promise.resolve({ id: testDocument.id }),
    });

    assert.equal(res.status, 401);
  });

  test("GET /api/documents/[id]/audit-logs returns 404 for non-existent document", async () => {
    const nonExistentId = "non-existent-doc-999999";
    const req = new NextRequest(
      `http://localhost:3000/api/documents/${nonExistentId}/audit-logs`,
      {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
      }
    );
    const res = await getAuditLogsRoute(req, {
      params: Promise.resolve({ id: nonExistentId }),
    });

    assert.equal(res.status, 404);
  });

  test("GET /api/documents/[id]/audit-logs returns 5-step canonical timeline and audit trail", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/documents/${testDocument.id}/audit-logs`,
      {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
      }
    );
    const res = await getAuditLogsRoute(req, {
      params: Promise.resolve({ id: testDocument.id }),
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);

    const data = json.data;
    assert.ok(data);
    assert.equal(data.documentId, testDocument.id);
    assert.equal(Array.isArray(data.steps), true);
    assert.equal(data.steps.length, 5);

    // Verify 5 canonical steps
    const stepKeys = data.steps.map((s: any) => s.key);
    assert.deepEqual(stepKeys, [
      "RECEIVED",
      "PRESENTED",
      "DIRECTED",
      "UNIT_ASSIGNED",
      "COMPLETED",
    ]);

    // Check step 1 details (Tiếp nhận & Vào sổ)
    assert.equal(data.steps[0].status, "completed");
    assert.equal(data.steps[0].title, "Tiếp nhận & Vào sổ");

    // Check step 2 details (Trình BGH)
    assert.equal(data.steps[1].status, "completed");
    assert.equal(data.steps[1].title, "Trình Ban Giám Hiệu");

    // Check step 3 details (Chỉ đạo BGH)
    assert.equal(data.steps[2].status, "completed");
    assert.equal(data.steps[2].title, "Chỉ đạo & Bút phê BGH");
    assert.ok(data.steps[2].notes?.includes("Giao Phòng Đào tạo"));

    // Check progress percentage
    assert.ok(typeof data.progressPercent === "number");
    assert.ok(data.progressPercent > 0);

    // Check audit logs trail
    assert.equal(Array.isArray(data.auditLogs), true);
    assert.ok(data.auditLogs.length >= 2);
    const createdLog = data.auditLogs.find((l: any) => l.action === "DOCUMENT_CREATED");
    assert.ok(createdLog);
    assert.equal(createdLog.actionLabel, "Tiếp nhận & Vào sổ văn bản");
  });
});
