import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { POST as rejectContentRoute } from "@/app/api/documents/[id]/actions/reject-content/route";
import { OutgoingDocumentService } from "@/lib/services/outgoing-document-service";
import { NextRequest } from "next/server";
import {
  DocumentType,
  OutgoingDocumentStatus,
  UserRole,
  UnitType,
  DocumentSecurityLevel,
  AssignmentType,
  AssignmentStatus,
} from "@prisma/client";
import { signSessionToken } from "@/lib/jwt-session";

describe("Security & Authorization: Reject Content Action & Outgoing Page", () => {
  const testRunId = `rc_${Date.now()}`;
  let deptId: string;
  let drafterUser: any;
  let managerUser: any;
  let drafterToken: string;
  let managerToken: string;
  let docId: string;
  let posAssignmentId: string;
  let drafterPosAssignmentId: string;

  before(async () => {
    // 1. Create Unit
    const dept = await prisma.organizationalUnit.create({
      data: {
        id: `ou-rc-${testRunId}`,
        code: `RC_${testRunId.slice(-6)}`,
        name: `Đơn vị Kiểm thử ${testRunId}`,
        type: UnitType.DEPARTMENT,
      },
    });
    deptId = dept.id;

    // 2. Create Drafter User
    drafterUser = await prisma.user.create({
      data: {
        id: `user-drafter-${testRunId}`,
        email: `drafter.${testRunId}@qcet.edu.vn`,
        name: "Chuyên viên Soạn thảo",
        role: UserRole.CHUYEN_VIEN,
        isActive: true,
      },
    });

    // 3. Create Manager User
    managerUser = await prisma.user.create({
      data: {
        id: `user-manager-${testRunId}`,
        email: `manager.${testRunId}@qcet.edu.vn`,
        name: "Trưởng Đơn vị Duyệt",
        role: UserRole.TRUONG_PHONG,
        isActive: true,
      },
    });

    // Ensure PositionDefinition for TRUONG_PHONG exists
    let managerPosDef = await prisma.positionDefinition.findUnique({
      where: { code: "TRUONG_PHONG" },
    });
    if (!managerPosDef) {
      managerPosDef = await prisma.positionDefinition.create({
        data: {
          id: `pos-tp-${testRunId}`,
          code: "TRUONG_PHONG",
          title: "Trưởng phòng",
          group: "LDPU" as any,
          isLeadership: true,
        },
      });
    }

    // Ensure PositionDefinition for CHUYEN_VIEN exists
    let drafterPosDef = await prisma.positionDefinition.findUnique({
      where: { code: "CHUYEN_VIEN" },
    });
    if (!drafterPosDef) {
      drafterPosDef = await prisma.positionDefinition.create({
        data: {
          id: `pos-cv-${testRunId}`,
          code: "CHUYEN_VIEN",
          title: "Chuyên viên",
          group: "VC" as any,
          isLeadership: false,
        },
      });
    }

    const drafterPosAssign = await prisma.positionAssignment.create({
      data: {
        userId: drafterUser.id,
        positionDefinitionId: drafterPosDef.id,
        unitId: deptId,
        type: AssignmentType.PRIMARY,
        status: AssignmentStatus.ACTIVE,
        effectiveFrom: new Date("2024-01-01T00:00:00.000Z"),
      },
    });
    drafterPosAssignmentId = drafterPosAssign.id;

    const posAssign = await prisma.positionAssignment.create({
      data: {
        userId: managerUser.id,
        positionDefinitionId: managerPosDef.id,
        unitId: deptId,
        type: AssignmentType.PRIMARY,
        status: AssignmentStatus.ACTIVE,
        effectiveFrom: new Date("2024-01-01T00:00:00.000Z"),
      },
    });
    posAssignmentId = posAssign.id;

    // Generate JWT tokens
    drafterToken = signSessionToken({
      id: drafterUser.id,
      email: drafterUser.email,
      name: drafterUser.name,
      role: drafterUser.role,
    });

    managerToken = signSessionToken({
      id: managerUser.id,
      email: managerUser.email,
      name: managerUser.name,
      role: managerUser.role,
    });
  });

  after(async () => {
    // Cleanup
    try {
      if (posAssignmentId) {
        await prisma.positionAssignment.delete({ where: { id: posAssignmentId } }).catch(() => {});
      }
      if (drafterPosAssignmentId) {
        await prisma.positionAssignment.delete({ where: { id: drafterPosAssignmentId } }).catch(() => {});
      }
      if (docId) {
        await prisma.documentOutgoingWorkflow.deleteMany({ where: { documentId: docId } });
        await prisma.outboxEvent.deleteMany({ where: { aggregateId: docId } });
        await prisma.auditEvent.deleteMany({ where: { entityId: docId } });
        await prisma.document.deleteMany({ where: { id: docId } });
      }
      if (drafterUser?.id) await prisma.user.delete({ where: { id: drafterUser.id } }).catch(() => {});
      if (managerUser?.id) await prisma.user.delete({ where: { id: managerUser.id } }).catch(() => {});
      if (deptId) await prisma.organizationalUnit.delete({ where: { id: deptId } }).catch(() => {});
    } catch {}
  });

  it("1. Rejects unauthenticated requests on reject-content", async () => {
    const fakeId = "doc-fake-id";
    const req = new NextRequest(`http://localhost:3000/api/documents/${fakeId}/actions/reject-content`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ notes: "Reject without auth" }),
    });

    const res = await rejectContentRoute(req, { params: Promise.resolve({ id: fakeId }) });
    assert.strictEqual(res.status, 401);
  });

  it("2. Rejects request with missing/invalid CSRF protection", async () => {
    // A request with cookie auth but missing valid Origin/Referer on browser state-changing request
    const fakeId = "doc-fake-id";
    const req = new NextRequest(`http://localhost:3000/api/documents/${fakeId}/actions/reject-content`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `authjs.session-token=${drafterToken}`,
        origin: "http://malicious-site.com",
      },
      body: JSON.stringify({ notes: "Cross site request" }),
    });

    const res = await rejectContentRoute(req, { params: Promise.resolve({ id: fakeId }) });
    assert.strictEqual(res.status, 403);
  });

  it("3. Enforces SoD: Drafter cannot reject their own content", async () => {
    // Create draft and move to CONTENT_REVIEW
    const draftRes = await OutgoingDocumentService.createOutgoingDraft(
      {
        title: `Văn bản thử nghiệm SoD ${testRunId}`,
        summary: `Tóm tắt thử nghiệm ${testRunId}`,
        draftingDeptId: deptId,
      },
      drafterUser
    );
    docId = draftRes.document.id;

    await OutgoingDocumentService.submitContentReview(
      {
        documentId: docId,
        contentReviewerId: managerUser.id,
      },
      drafterUser
    );

    // Drafter attempts to reject their own content
    const req = new NextRequest(`http://localhost:3000/api/documents/${docId}/actions/reject-content`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${drafterToken}`,
      },
      body: JSON.stringify({ notes: "Tự từ chối nội dung của mình" }),
    });

    const res = await rejectContentRoute(req, { params: Promise.resolve({ id: docId }) });
    assert.strictEqual(res.status, 403);
  });

  it("4. Authorized manager successfully rejects content, records audit log, and publishes outbox event", async () => {
    const req = new NextRequest(`http://localhost:3000/api/documents/${docId}/actions/reject-content`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({ notes: "Nội dung cần bổ sung số liệu" }),
    });

    const res = await rejectContentRoute(req, { params: Promise.resolve({ id: docId }) });
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.workflow?.status, OutgoingDocumentStatus.DRAFT);
    assert.ok(json.workflow?.contentReviewNotes?.includes("Nội dung cần bổ sung số liệu"));

    // Verify DB state
    const wf = await prisma.documentOutgoingWorkflow.findUnique({
      where: { documentId: docId },
    });
    assert.strictEqual(wf?.status, OutgoingDocumentStatus.DRAFT);
    assert.strictEqual(wf?.contentReviewSubmittedAt, null);

    // Verify Audit Event
    const auditLogs = await prisma.auditEvent.findMany({
      where: {
        entityId: docId,
        action: "DOCUMENT_CONTENT_REJECTED",
      },
    });
    assert.ok(auditLogs.length >= 1, "Audit log must be recorded");
    assert.strictEqual(auditLogs[0].actorId, managerUser.id);

    // Verify Outbox Event
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        aggregateId: docId,
        eventType: "DOCUMENT_CONTENT_REJECTED",
      },
    });
    assert.ok(outboxEvents.length >= 1, "Outbox event must be published");
  });

  it("5. Authorization policy correctly guards document read based on confidentiality and department", async () => {
    const { canReadDocument } = await import("@/server/policies/document-policy");
    const { loadAuthorizationContext } = await import("@/server/authorization/authorization-context-service");
    const { buildDocumentResource } = await import("@/server/authorization/available-actions");

    const managerAuthCtx = await loadAuthorizationContext(managerUser.id);
    const drafterAuthCtx = await loadAuthorizationContext(drafterUser.id);

    const doc = await prisma.document.findUnique({
      where: { id: docId },
      include: { outgoingWorkflow: true },
    });
    assert.ok(doc, "Document must exist");
    const docResource = buildDocumentResource({
      ...doc,
      draftingUnitId: (doc.outgoingWorkflow as any)?.draftingUnitId || deptId,
      leadUnitId: (doc.outgoingWorkflow as any)?.draftingUnitId || deptId,
    });

    // Manager and drafter who created/registered the document can read normal document
    assert.strictEqual(canReadDocument(managerAuthCtx, docResource as any), true);
    assert.strictEqual(canReadDocument(drafterAuthCtx, docResource as any), true);

    // Unrelated user from another department cannot access confidential/restricted document
    const unrelatedUser = await prisma.user.create({
      data: {
        id: `user-unrelated-${testRunId}`,
        email: `unrelated.${testRunId}@qcet.edu.vn`,
        name: "Người dùng ngoài đơn vị",
        role: UserRole.CHUYEN_VIEN,
        isActive: true,
      },
    });

    try {
      const unrelatedAuthCtx = await loadAuthorizationContext(unrelatedUser.id);

      // If document has securityLevel TUYET_MAT (State secret), access is forbidden
      const secretDoc = buildDocumentResource({ ...doc, securityLevel: DocumentSecurityLevel.TUYET_MAT });
      assert.strictEqual(canReadDocument(unrelatedAuthCtx, secretDoc as any), false);
    } finally {
      await prisma.user.delete({ where: { id: unrelatedUser.id } }).catch(() => {});
    }
  });
});
