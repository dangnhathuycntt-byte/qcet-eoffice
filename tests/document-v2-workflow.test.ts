import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  UserRole,
  DocumentType,
  DocumentUrgency,
  DocumentSecurityLevel,
  DocumentStatus,
  IncomingDocumentStatus,
  OutgoingDocumentStatus,
  SignatureType,
  SignatureVerificationStatus,
  UnitType,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { signSessionToken } from "../src/lib/jwt-session";
import {
  IncomingDocumentStateMachine,
  OutgoingDocumentStateMachine,
  isDocumentImmutable,
  assertDocumentNotImmutable,
} from "../src/lib/documents/state-machine";
import {
  getNextRegistrationNumber,
  formatDocumentDisplayNumber,
  generateDocumentCode,
} from "../src/lib/documents/numbering-engine";
import {
  validateDocumentUpdatePayload,
  isWorkflowControlledField,
  ALLOWED_DOCUMENT_UPDATE_FIELDS,
} from "../src/lib/documents/document-validator";
import { canReadDocument, canDeleteDocument } from "../src/server/policies/document-policy";
import { PATCH, DELETE, GET } from "../src/app/api/documents/[id]/route";

describe("Sprint 5: Document V2 Full Cutover", () => {
  const testRunId = `doc_v2_${Date.now()}`;

  let unitAcademicId: string;
  let unitAdminId: string;
  let drafterUser: any;
  let clerkUser: any;
  let rectorUser: any;
  let unprivilegedUser: any;
  let drafterToken: string;
  let clerkToken: string;

  before(async () => {
    // 1. Setup Organizational Units and Departments
    await prisma.organizationalUnit.create({
      data: {
        id: `ou-acad-${testRunId}`,
        code: `DT_${testRunId.slice(-4)}`,
        name: `Phòng Đào tạo ${testRunId}`,
        type: UnitType.DEPARTMENT,
      },
    });
    const d1 = await prisma.organizationalUnit.create({
      data: {
        id: `dept-acad-${testRunId}`,
        name: `Phòng Đào tạo ${testRunId}`,

      },
    });
    unitAcademicId = d1.id;

    await prisma.organizationalUnit.create({
      data: {
        id: `ou-adm-${testRunId}`,
        code: `HC_${testRunId.slice(-4)}`,
        name: `Phòng Hành chính ${testRunId}`,
        type: UnitType.DEPARTMENT,
      },
    });
    const d2 = await prisma.organizationalUnit.create({
      data: {
        id: `dept-adm-${testRunId}`,
        name: `Phòng Hành chính ${testRunId}`,

      },
    });
    unitAdminId = d2.id;

    // 2. Setup Users
    drafterUser = await prisma.user.create({
      data: {
        id: `user-draft-${testRunId}`,
        email: `drafter.${testRunId}@qcet.edu.vn`,
        name: "Chuyên viên Soạn thảo",
        role: UserRole.CHUYEN_VIEN,
        title: "Chuyên viên",

      },
    });

    clerkUser = await prisma.user.create({
      data: {
        id: `user-clerk-${testRunId}`,
        email: `clerk.${testRunId}@qcet.edu.vn`,
        name: "Văn thư Cơ quan",
        role: UserRole.VAN_THU,
        title: "Văn thư",

      },
    });

    rectorUser = await prisma.user.create({
      data: {
        id: `user-rector-${testRunId}`,
        email: `rector.${testRunId}@qcet.edu.vn`,
        name: "Hiệu trưởng QCET",
        role: UserRole.BAN_GIAM_HIEU,
        title: "Hiệu trưởng",

      },
    });

    unprivilegedUser = await prisma.user.create({
      data: {
        id: `user-unprv-${testRunId}`,
        email: `unprv.${testRunId}@qcet.edu.vn`,
        name: "Người dùng không quyền",
        role: UserRole.CHUYEN_VIEN,
        title: "Giảng viên",

      },
    });

    drafterToken = await signSessionToken({
      id: drafterUser.id,
      email: drafterUser.email,
      role: drafterUser.role,
      name: drafterUser.name,

    });

    clerkToken = await signSessionToken({
      id: clerkUser.id,
      email: clerkUser.email,
      role: clerkUser.role,
      name: clerkUser.name,

    });
  });

  after(async () => {
    try {
      const docs = await prisma.document.findMany({
        where: { summary: { contains: testRunId } },
        select: { id: true },
      });
      const docIds = docs.map((d) => d.id);

      await prisma.documentAttachment.deleteMany({
        where: { documentId: { in: docIds } },
      });
      await prisma.signatureRecord.deleteMany({
        where: { documentId: { in: docIds } },
      });
      await prisma.documentOutgoingWorkflow.deleteMany({
        where: { documentId: { in: docIds } },
      });
      await prisma.documentIncomingWorkflow.deleteMany({
        where: { documentId: { in: docIds } },
      });
      await prisma.document.deleteMany({
        where: { id: { in: docIds } },
      });
      await prisma.user.deleteMany({
        where: {
          id: {
            in: [
              drafterUser.id,
              clerkUser.id,
              rectorUser.id,
              unprivilegedUser.id,
            ],
          },
        },
      });
      await prisma.organizationalUnit.deleteMany({
        where: { id: { in: [unitAcademicId, unitAdminId] } },
      });
      await prisma.organizationalUnit.deleteMany({
        where: {
          id: { in: [`ou-acad-${testRunId}`, `ou-adm-${testRunId}`] },
        },
      });
    } catch (err) {
      console.error("Cleanup error in Sprint 5 tests:", err);
    }
  });

  // =========================================================================
  // 1. Generic PATCH Locking & Safe Metadata Only
  // =========================================================================
  describe("1. Generic PATCH Locking & Safe Metadata Only", () => {
    let testDocId: string;

    before(async () => {
      const doc = await prisma.document.create({
        data: {
          id: `doc-patch-${testRunId}`,
          summary: `Tóm tắt PATCH test ${testRunId}`,
          category: "Tờ trình",
          originalNumber: `01/TTr-${testRunId}`,
          issuedDate: new Date(),
          issuingAuthority: "QCET",
          type: DocumentType.VAN_BAN_DI,
          documentYear: 2026,
          registrationNumber: -999,
          status: DocumentStatus.CHO_PHAN_CONG,
          securityLevel: DocumentSecurityLevel.THUONG,
          urgency: DocumentUrgency.THUONG,
          registeredById: drafterUser.id,
          draftingDeptId: unitAcademicId,
        },
      });
      testDocId = doc.id;
    });

    it("identifies workflow-controlled fields correctly", () => {
      assert.equal(isWorkflowControlledField("status"), true);
      assert.equal(isWorkflowControlledField("signedAt"), true);
      assert.equal(isWorkflowControlledField("signer"), true);
      assert.equal(isWorkflowControlledField("signerName"), true);
      assert.equal(isWorkflowControlledField("documentNumber"), true);
      assert.equal(isWorkflowControlledField("registrationNumber"), true);
      assert.equal(isWorkflowControlledField("issuedDate"), true);

      assert.equal(isWorkflowControlledField("notes"), false);
      assert.equal(isWorkflowControlledField("summary"), false);
      assert.equal(isWorkflowControlledField("urgency"), false);
      assert.equal(isWorkflowControlledField("securityLevel"), false);
    });

    it("rejects attempt to change status via generic PATCH", async () => {
      const req = new NextRequest(`http://localhost:3000/api/documents/${testDocId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${drafterToken}`,
          Cookie: `qcet_session=${drafterToken}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          status: "DA_BAN_HANH",
        }),
      });

      const res = await PATCH(req, { params: Promise.resolve({ id: testDocId }) });
      assert.equal(res.status, 400);
      const json = await res.json();
      const errMsg = typeof json.error === "string" ? json.error : json.error?.message || json.message;
      assert.ok(
        errMsg?.includes("không được phép") ||
        json.code === "VALIDATION_ERROR" ||
        json.code === "CANONICAL_COMMAND_REQUIRED"
      );
    });

    it("rejects attempt to change documentNumber / registrationNumber via generic PATCH", async () => {
      const req = new NextRequest(`http://localhost:3000/api/documents/${testDocId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${drafterToken}`,
          Cookie: `qcet_session=${drafterToken}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          registrationNumber: 9999,
          documentNumber: "9999/QĐ-QCET",
        }),
      });

      const res = await PATCH(req, { params: Promise.resolve({ id: testDocId }) });
      assert.equal(res.status, 400);
    });

    it("rejects attempt to set signer / signedAt via generic PATCH", async () => {
      const req = new NextRequest(`http://localhost:3000/api/documents/${testDocId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${drafterToken}`,
          Cookie: `qcet_session=${drafterToken}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          signerName: "Hiệu trưởng Giả mạo",
          signedAt: new Date().toISOString(),
        }),
      });

      const res = await PATCH(req, { params: Promise.resolve({ id: testDocId }) });
      assert.equal(res.status, 400);
    });

    it("allows updating safe metadata via generic PATCH", async () => {
      const req = new NextRequest(`http://localhost:3000/api/documents/${testDocId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${drafterToken}`,
          Cookie: `qcet_session=${drafterToken}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          summary: `Tóm tắt đã được cập nhật an toàn - ${testRunId}`,
          notes: "Ghi chú bổ sung an toàn",
          urgency: "HOA_TOC",
        }),
      });

      const res = await PATCH(req, { params: Promise.resolve({ id: testDocId }) });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.ok(json.success);

      const updated = await prisma.document.findUnique({
        where: { id: testDocId },
      });
      assert.equal(updated?.summary, `Tóm tắt đã được cập nhật an toàn - ${testRunId}`);
      assert.equal(updated?.notes, "Ghi chú bổ sung an toàn");
      assert.equal(updated?.urgency, DocumentUrgency.HOA_TOC);
    });
  });

  // =========================================================================
  // 2. Incoming & Outgoing State Machines
  // =========================================================================
  describe("2. Incoming & Outgoing State Machines (Nghị định 30/2020 & 68/2024)", () => {
    it("IncomingDocumentStateMachine validates compliant lifecycle transitions", () => {
      // Valid transitions
      assert.equal(
        IncomingDocumentStateMachine.canTransition(
          IncomingDocumentStatus.RECEIVED,
          IncomingDocumentStatus.REGISTERED
        ),
        true
      );
      assert.equal(
        IncomingDocumentStateMachine.canTransition(
          IncomingDocumentStatus.REGISTERED,
          IncomingDocumentStatus.PRESENTED
        ),
        true
      );
      assert.equal(
        IncomingDocumentStateMachine.canTransition(
          IncomingDocumentStatus.PRESENTED,
          IncomingDocumentStatus.DIRECTED
        ),
        true
      );
      assert.equal(
        IncomingDocumentStateMachine.canTransition(
          IncomingDocumentStatus.DIRECTED,
          IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT
        ),
        true
      );
      assert.equal(
        IncomingDocumentStateMachine.canTransition(
          IncomingDocumentStatus.IN_PROGRESS,
          IncomingDocumentStatus.RESOLVED
        ),
        true
      );
      assert.equal(
        IncomingDocumentStateMachine.canTransition(
          IncomingDocumentStatus.RESOLVED,
          IncomingDocumentStatus.FILED
        ),
        true
      );

      // Invalid transitions (illegal skips or backwards)
      assert.equal(
        IncomingDocumentStateMachine.canTransition(
          IncomingDocumentStatus.RECEIVED,
          IncomingDocumentStatus.RESOLVED
        ),
        false
      );
      assert.equal(
        IncomingDocumentStateMachine.canTransition(
          IncomingDocumentStatus.ARCHIVED,
          IncomingDocumentStatus.IN_PROGRESS
        ),
        false
      );
      assert.equal(
        IncomingDocumentStateMachine.canTransition(
          IncomingDocumentStatus.RESOLVED,
          IncomingDocumentStatus.RECEIVED
        ),
        false
      );

      // Assert throws on invalid transition
      assert.throws(() => {
        IncomingDocumentStateMachine.assertTransition(
          IncomingDocumentStatus.RECEIVED,
          IncomingDocumentStatus.RESOLVED
        );
      });
    });

    it("OutgoingDocumentStateMachine validates compliant lifecycle transitions", () => {
      // Valid transitions
      assert.equal(
        OutgoingDocumentStateMachine.canTransition(
          OutgoingDocumentStatus.DRAFT,
          OutgoingDocumentStatus.CONTENT_REVIEW
        ),
        true
      );
      assert.equal(
        OutgoingDocumentStateMachine.canTransition(
          OutgoingDocumentStatus.CONTENT_REVIEW,
          OutgoingDocumentStatus.FORMAT_CHECK
        ),
        true
      );
      assert.equal(
        OutgoingDocumentStateMachine.canTransition(
          OutgoingDocumentStatus.FORMAT_CHECK,
          OutgoingDocumentStatus.AUTHORIZED_SIGN
        ),
        true
      );
      assert.equal(
        OutgoingDocumentStateMachine.canTransition(
          OutgoingDocumentStatus.AUTHORIZED_SIGN,
          OutgoingDocumentStatus.NUMBERED
        ),
        true
      );
      assert.equal(
        OutgoingDocumentStateMachine.canTransition(
          OutgoingDocumentStatus.NUMBERED,
          OutgoingDocumentStatus.ORGANIZATION_SIGNED
        ),
        true
      );
      assert.equal(
        OutgoingDocumentStateMachine.canTransition(
          OutgoingDocumentStatus.ORGANIZATION_SIGNED,
          OutgoingDocumentStatus.ISSUED
        ),
        true
      );
      assert.equal(
        OutgoingDocumentStateMachine.canTransition(
          OutgoingDocumentStatus.ISSUED,
          OutgoingDocumentStatus.DELIVERED
        ),
        true
      );
      assert.equal(
        OutgoingDocumentStateMachine.canTransition(
          OutgoingDocumentStatus.DELIVERED,
          OutgoingDocumentStatus.FILED
        ),
        true
      );

      // Invalid transitions (skipping authorization / signing)
      assert.equal(
        OutgoingDocumentStateMachine.canTransition(
          OutgoingDocumentStatus.DRAFT,
          OutgoingDocumentStatus.ISSUED
        ),
        false
      );
      assert.equal(
        OutgoingDocumentStateMachine.canTransition(
          OutgoingDocumentStatus.FORMAT_CHECK,
          OutgoingDocumentStatus.ORGANIZATION_SIGNED
        ),
        false
      );
      assert.equal(
        OutgoingDocumentStateMachine.canTransition(
          OutgoingDocumentStatus.ARCHIVED,
          OutgoingDocumentStatus.DRAFT
        ),
        false
      );

      // Assert throws on invalid transition
      assert.throws(() => {
        OutgoingDocumentStateMachine.assertTransition(
          OutgoingDocumentStatus.DRAFT,
          OutgoingDocumentStatus.ISSUED
        );
      });
    });

    it("OutgoingDocumentStateMachine enforces Separation of Duties (SoD)", () => {
      const sameUserId = "user-sod-1";
      const differentUserId = "user-sod-2";

      // 1. Drafter != Reviewer
      assert.throws(() => {
        OutgoingDocumentStateMachine.assertDrafterNotContentReviewer(sameUserId, sameUserId);
      });
      assert.doesNotThrow(() => {
        OutgoingDocumentStateMachine.assertDrafterNotContentReviewer(sameUserId, differentUserId);
      });

      // 2. Signer != Numberer
      assert.throws(() => {
        OutgoingDocumentStateMachine.assertSignerNotNumberer(sameUserId, sameUserId);
      });
      assert.doesNotThrow(() => {
        OutgoingDocumentStateMachine.assertSignerNotNumberer(sameUserId, differentUserId);
      });

      // 3. Signer != Org Signer
      assert.throws(() => {
        OutgoingDocumentStateMachine.assertSignerNotOrganizationSigner(sameUserId, sameUserId);
      });
      assert.doesNotThrow(() => {
        OutgoingDocumentStateMachine.assertSignerNotOrganizationSigner(sameUserId, differentUserId);
      });
    });
  });

  // =========================================================================
  // 3. Atomic Numbering Sequence (Concurrency Safety)
  // =========================================================================
  describe("3. Atomic Numbering Sequence (No MAX+1 Race Conditions)", () => {
    it("allocates monotonic sequential numbers atomically under concurrent calls", async () => {
      const testYear = 2026;
      const type = DocumentType.VAN_BAN_DEN;

      // Launch 25 concurrent requests to allocate registration numbers
      const concurrentRequests = Array.from({ length: 25 }, () =>
        getNextRegistrationNumber(type, testYear, prisma)
      );

      const allocatedNumbers = await Promise.all(concurrentRequests);

      // Verify no duplicate numbers were assigned
      const uniqueSet = new Set(allocatedNumbers);
      assert.equal(
        uniqueSet.size,
        25,
        "Every concurrent allocation must yield a distinct unique registration number"
      );

      // Sort and verify strict monotonicity
      const sorted = [...allocatedNumbers].sort((a, b) => a - b);
      for (let i = 0; i < sorted.length - 1; i++) {
        assert.equal(
          sorted[i + 1],
          sorted[i] + 1,
          `Numbers must be strictly consecutive: ${sorted[i]} followed by ${sorted[i + 1]}`
        );
      }
    });

    it("formats standard document display numbers and codes correctly", () => {
      assert.equal(formatDocumentDisplayNumber("VAN_BAN_DEN", 5, 2026), "05");
      assert.equal(formatDocumentDisplayNumber("VAN_BAN_DEN", 128, 2026), "128");
      assert.equal(
        formatDocumentDisplayNumber("VAN_BAN_DI", 128, 2026, "CĐKTCN"),
        "128/CĐKTCN"
      );
      assert.equal(generateDocumentCode("VAN_BAN_DEN", 2026, 7), "VBDEN-2026-0007");
      assert.equal(generateDocumentCode("VAN_BAN_DI", 2026, 128), "VBDI-2026-0128");
    });
  });

  // =========================================================================
  // 4. Document Immutability & Attachment Security
  // =========================================================================
  describe("4. Document Immutability & Attachment Security", () => {
    let signedDocId: string;
    let attachmentId: string;

    before(async () => {
      // Create a signed/completed document with an attachment
      const doc = await prisma.document.create({
        data: {
          id: `doc-immutable-${testRunId}`,
          summary: `Tóm tắt văn bản bất biến ${testRunId}`,
          category: "Quyết định",
          originalNumber: `02/QĐ-${testRunId}`,
          issuedDate: new Date(),
          issuingAuthority: "QCET",
          type: DocumentType.VAN_BAN_DI,
          documentYear: 2026,
          registrationNumber: 777,
          status: DocumentStatus.DA_HOAN_THANH,
          securityLevel: DocumentSecurityLevel.TUYET_MAT, // Confidential / Tuyệt mật
          urgency: DocumentUrgency.THUONG,
          registeredById: drafterUser.id,
          draftingDeptId: unitAcademicId,
          signerName: "Hiệu trưởng",
          outgoingWorkflow: {
            create: {
              status: OutgoingDocumentStatus.ISSUED,
              authorizedSignerId: rectorUser.id,
              authorizedSignedAt: new Date(),
              outgoingNumberStr: "777",
              issuedAt: new Date(),
            },
          },
        },
        include: {
          outgoingWorkflow: true,
        },
      });
      signedDocId = doc.id;

      const att = await prisma.documentAttachment.create({
        data: {
          id: `att-secret-${testRunId}`,
          documentId: signedDocId,
          fileName: "mat_lenh_tuyet_mat.pdf",
          fileUrl: `/uploads/secret_${testRunId}.pdf`,
          fileSize: 1024,
          mimeType: "application/pdf",
        },
      });
      attachmentId = att.id;
    });

    it("detects signed / issued document as strictly immutable", () => {
      const target = {
        status: DocumentStatus.DA_HOAN_THANH,
        outgoingWorkflow: {
          status: OutgoingDocumentStatus.ISSUED,
          authorizedSignedAt: new Date(),
        },
      };

      assert.equal(isDocumentImmutable(target), true);
      assert.throws(() => {
        assertDocumentNotImmutable(target);
      });
    });

    it("rejects generic PATCH on immutable document with IMMUTABLE_DOCUMENT error", async () => {
      const req = new NextRequest(`http://localhost:3000/api/documents/${signedDocId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${drafterToken}`,
          Cookie: `qcet_session=${drafterToken}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          notes: "Cố gắng thay đổi ghi chú của văn bản đã ban hành",
        }),
      });

      const res = await PATCH(req, { params: Promise.resolve({ id: signedDocId }) });
      assert.equal(res.status, 400);
      const json = await res.json();
      const errMsg = typeof json.error === "string" ? json.error : json.error?.message || json.message;
      assert.ok(
        errMsg?.includes("bất biến") ||
        json.code === "IMMUTABLE_DOCUMENT" ||
        json.code === "VALIDATION_ERROR"
      );
    });

    it("rejects DELETE on immutable document", async () => {
      const req = new NextRequest(`http://localhost:3000/api/documents/${signedDocId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${drafterToken}`,
          Cookie: `qcet_session=${drafterToken}`,
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      const res = await DELETE(req, { params: Promise.resolve({ id: signedDocId }) });
      assert.ok(res.status === 400 || res.status === 403);
    });

    it("enforces attachment security classification inheritance", () => {
      const secretDoc = {
        id: signedDocId,
        securityLevel: DocumentSecurityLevel.TUYET_MAT,

        creatorId: drafterUser.id,
      };

      // Unprivileged staff without clearance cannot read the document
      const canUnprivilegedRead = canReadDocument(unprivilegedUser, secretDoc as any);
      assert.equal(
        canUnprivilegedRead,
        false,
        "Unprivileged user without clearance must NOT be able to read TUYET_MAT document"
      );

      // Deletion of immutable document must be rejected by policy
      const canDelete = canDeleteDocument(drafterUser, secretDoc as any);
      assert.equal(
        canDelete,
        false,
        "Policy must reject deletion of immutable / signed document"
      );
    });
  });
});
