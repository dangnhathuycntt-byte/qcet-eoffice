import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  UserRole,
  DocumentType,
  DocumentUrgency,
  DocumentSecurityLevel,
  OutgoingDocumentStatus,
  SignatureType,
  SignatureVerificationStatus,
  UnitType,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { OutgoingDocumentService } from "../src/lib/services/outgoing-document-service";
import { signSessionToken } from "../src/lib/jwt-session";
import { POST as createDraftRoute } from "../src/app/api/documents/outgoing/route";
import { POST as submitContentReviewRoute } from "../src/app/api/documents/[id]/actions/submit-content-review/route";
import { POST as approveContentRoute } from "../src/app/api/documents/[id]/actions/approve-content/route";
import { POST as submitFormatCheckRoute } from "../src/app/api/documents/[id]/actions/submit-format-check/route";
import { POST as approveFormatRoute } from "../src/app/api/documents/[id]/actions/approve-format/route";
import { POST as signRoute } from "../src/app/api/documents/[id]/actions/sign/route";
import { POST as assignNumberRoute } from "../src/app/api/documents/[id]/actions/assign-number/route";
import { POST as orgSignRoute } from "../src/app/api/documents/[id]/actions/organization-sign/route";
import { POST as issueRoute } from "../src/app/api/documents/[id]/actions/issue/route";

describe("Phase 6: Outgoing Documents V2 & Digital Signatures (Nghị định 30/2020 & 68/2024)", () => {
  const testRunId = `out_v2_${Date.now()}`;

  let deptAcademicId: string;
  let deptAdminId: string;
  let deptUnrelatedId: string;

  let drafterSpecialist: any;
  let unitHeadAcademic: any;
  let clerkUser: any;
  let rectorUser: any;
  let unprivilegedStaff: any;

  before(async () => {
    // 1. Create Organizational Units and Departments
    await prisma.organizationalUnit.create({
      data: {
        id: `ou-acad-${testRunId}`,
        code: `QLDT_${testRunId.slice(-4)}`,
        name: `Phòng Quản lý Đào tạo ${testRunId}`,
        type: UnitType.DEPARTMENT,
      },
    });
    const d1 = await prisma.department.create({
      data: {
        id: `dept-acad-${testRunId}`,
        name: `Phòng Quản lý Đào tạo ${testRunId}`,
        shortName: `QLDT_${testRunId.slice(-4)}`,
      },
    });
    deptAcademicId = d1.id;

    await prisma.organizationalUnit.create({
      data: {
        id: `ou-admin-${testRunId}`,
        code: `HCTH_${testRunId.slice(-4)}`,
        name: `Phòng Hành chính - Tổng hợp ${testRunId}`,
        type: UnitType.DEPARTMENT,
      },
    });
    const d2 = await prisma.department.create({
      data: {
        id: `dept-admin-${testRunId}`,
        name: `Phòng Hành chính - Tổng hợp ${testRunId}`,
        shortName: `HCTH_${testRunId.slice(-4)}`,
      },
    });
    deptAdminId = d2.id;

    await prisma.organizationalUnit.create({
      data: {
        id: `ou-unrel-${testRunId}`,
        code: `CNTT_${testRunId.slice(-4)}`,
        name: `Khoa CNTT ${testRunId}`,
        type: UnitType.FACULTY,
      },
    });
    const d3 = await prisma.department.create({
      data: {
        id: `dept-unrel-${testRunId}`,
        name: `Khoa CNTT ${testRunId}`,
        shortName: `CNTT_${testRunId.slice(-4)}`,
      },
    });
    deptUnrelatedId = d3.id;

    // 2. Create Users
    drafterSpecialist = await prisma.user.create({
      data: {
        id: `user-drafter-${testRunId}`,
        email: `drafter.${testRunId}@qcet.edu.vn`,
        name: "Chuyên viên Soạn thảo Test",
        role: UserRole.CHUYEN_VIEN,
        title: "Chuyên viên",
        departmentId: deptAcademicId,
      },
    });

    unitHeadAcademic = await prisma.user.create({
      data: {
        id: `user-head-acad-${testRunId}`,
        email: `head.acad.${testRunId}@qcet.edu.vn`,
        name: "Trưởng phòng Đào tạo Test",
        role: UserRole.TRUONG_PHONG,
        title: "Trưởng phòng",
        departmentId: deptAcademicId,
      },
    });

    clerkUser = await prisma.user.create({
      data: {
        id: `user-clerk-${testRunId}`,
        email: `clerk.${testRunId}@qcet.edu.vn`,
        name: "Văn thư Test",
        role: UserRole.VAN_THU,
        title: "Văn thư",
        departmentId: deptAdminId,
      },
    });

    rectorUser = await prisma.user.create({
      data: {
        id: `user-rector-${testRunId}`,
        email: `rector.${testRunId}@qcet.edu.vn`,
        name: "Hiệu trưởng Test",
        role: UserRole.BAN_GIAM_HIEU,
        title: "Hiệu trưởng",
        departmentId: null,
      },
    });

    unprivilegedStaff = await prisma.user.create({
      data: {
        id: `user-unprivileged-${testRunId}`,
        email: `unprivileged.${testRunId}@qcet.edu.vn`,
        name: "Nhân viên Không Thẩm Quyền Test",
        role: UserRole.CHUYEN_VIEN,
        title: "Nhân viên",
        departmentId: deptUnrelatedId,
      },
    });
  });

  after(async () => {
    try {
      // Clean up test documents, workflows, signatures, and users
      const docs = await prisma.document.findMany({
        where: {
          summary: { contains: testRunId },
        },
        select: { id: true },
      });
      const docIds = docs.map((d) => d.id);

      await prisma.signatureRecord.deleteMany({
        where: { documentId: { in: docIds } },
      });
      await prisma.documentOutgoingWorkflow.deleteMany({
        where: { documentId: { in: docIds } },
      });
      await prisma.document.deleteMany({
        where: { id: { in: docIds } },
      });
      await prisma.user.deleteMany({
        where: {
          id: {
            in: [
              drafterSpecialist.id,
              unitHeadAcademic.id,
              clerkUser.id,
              rectorUser.id,
              unprivilegedStaff.id,
            ],
          },
        },
      });
      await prisma.department.deleteMany({
        where: { id: { in: [deptAcademicId, deptAdminId, deptUnrelatedId] } },
      });
      await prisma.organizationalUnit.deleteMany({
        where: {
          id: {
            in: [
              `ou-acad-${testRunId}`,
              `ou-admin-${testRunId}`,
              `ou-unrel-${testRunId}`,
            ],
          },
        },
      });
    } catch (err) {
      console.error("Cleanup error in outgoing tests:", err);
    }
  });

  // =========================================================================
  // 1. HAPPY PATH: End-to-End Lifecycle
  // =========================================================================
  describe("1. Full Outgoing Document Lifecycle (NĐ 30/2020/NĐ-CP)", () => {
    let documentId: string;

    it("creates an outgoing document draft with initial version 1", async () => {
      const res = await OutgoingDocumentService.createOutgoingDraft(
        {
          title: `Quyết định ban hành Quy chế Đào tạo 2026 - ${testRunId}`,
          summary: `Tóm tắt quyết định đào tạo ${testRunId}`,
          documentType: DocumentType.VAN_BAN_DI,
          urgency: DocumentUrgency.THUONG,
          securityLevel: DocumentSecurityLevel.THUONG,
          draftingDeptId: deptAcademicId,
          authorizedSignerId: rectorUser.id,
          signingCapacity: "HIỆU TRƯỞNG",
          signerPosition: "Hiệu trưởng",
        },
        drafterSpecialist,
        { requestId: `req-draft-${testRunId}` }
      );

      assert.ok(res.document);
      assert.ok(res.workflow);
      documentId = res.document.id;

      assert.equal(res.workflow.status, OutgoingDocumentStatus.DRAFT);
      assert.equal(res.workflow.currentVersion, 1);
      assert.equal(res.document.registeredById, drafterSpecialist.id);
      assert.equal(res.workflow.authorizedSignerId, rectorUser.id);

      // Verify Audit Event
      const audit = await prisma.auditEvent.findFirst({
        where: {
          entityId: documentId,
          action: "DOCUMENT_CREATED",
        },
      });
      assert.ok(audit, "Audit event for draft creation must exist");
      assert.equal(audit.actorId, drafterSpecialist.id);

      // Verify Outbox Event
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: documentId,
          eventType: "DOCUMENT_DRAFT_CREATED",
        },
      });
      assert.ok(outbox, "Outbox event for draft creation must exist");
    });

    it("submits the draft for content review", async () => {
      const res = await OutgoingDocumentService.submitContentReview(
        {
          documentId,
          contentReviewerId: unitHeadAcademic.id,
          notes: "Kính trình Trưởng phòng thẩm định nội dung",
        },
        drafterSpecialist,
        { requestId: `req-submit-content-${testRunId}` }
      );

      assert.equal(res.status, OutgoingDocumentStatus.CONTENT_REVIEW);
      assert.equal(res.contentReviewerId, unitHeadAcademic.id);
      assert.ok(res.contentReviewSubmittedAt);
    });

    it("approves content by unit head", async () => {
      const res = await OutgoingDocumentService.approveContent(
        {
          documentId,
          approvalNotes: "Nội dung đầy đủ, chính xác theo quy chuẩn đào tạo",
        },
        unitHeadAcademic,
        { requestId: `req-appr-content-${testRunId}` }
      );

      assert.equal(res.status, OutgoingDocumentStatus.FORMAT_CHECK);
      assert.ok(res.contentApprovedAt);
    });

    it("submits format check to Văn thư", async () => {
      const res = await OutgoingDocumentService.submitFormatCheck(
        {
          documentId,
          formatReviewerId: clerkUser.id,
          notes: "Kính chuyển Văn thư kiểm tra thể thức văn bản",
        },
        unitHeadAcademic,
        { requestId: `req-sub-format-${testRunId}` }
      );

      assert.equal(res.status, OutgoingDocumentStatus.FORMAT_CHECK);
      assert.equal(res.formatReviewerId, clerkUser.id);
    });

    it("approves format by Văn thư (Clerk)", async () => {
      const res = await OutgoingDocumentService.approveFormat(
        {
          documentId,
          notes: "Thể thức chuẩn theo NĐ 30/2020/NĐ-CP",
        },
        clerkUser,
        { requestId: `req-appr-format-${testRunId}` }
      );

      assert.equal(res.status, OutgoingDocumentStatus.AUTHORIZED_SIGN);
      assert.ok(res.formatApprovedAt);
    });

    it("authorized leader (Hiệu trưởng) signs personal digital signature", async () => {
      const res = await OutgoingDocumentService.signDocument(
        {
          documentId,
          signatureType: SignatureType.PERSONAL_DIGITAL,
          certificateMetadata: {
            issuer: "Ban Cơ yếu Chính phủ",
            serialNumber: `CA-QCET-${testRunId}`,
            subject: "Hiệu trưởng Test",
          },
        },
        rectorUser,
        { requestId: `req-sign-${testRunId}` }
      );

      assert.ok(res.workflow.authorizedSignedAt);
      assert.ok(res.signatureRecord);
      assert.equal(res.signatureRecord.signerUserId, rectorUser.id);
      assert.equal(res.signatureRecord.signatureType, SignatureType.PERSONAL_DIGITAL);
      assert.equal(res.signatureRecord.verificationStatus, SignatureVerificationStatus.VALID);
      assert.equal(res.signatureRecord.version, 1);
    });

    it("Văn thư assigns outgoing number and code notation", async () => {
      const res = await OutgoingDocumentService.assignOutgoingNumber(
        {
          documentId,
          outgoingNumberStr: "128",
          codeNotation: "128/QĐ-CĐKTCN",
        },
        clerkUser,
        { requestId: `req-assign-num-${testRunId}` }
      );

      assert.equal(res.status, OutgoingDocumentStatus.NUMBERED);
      assert.equal(res.outgoingNumberStr, "128");
      assert.ok(res.numberedAt);
      assert.equal(res.numbererId, clerkUser.id);
    });

    it("Văn thư applies organization digital signature (đóng dấu số cơ quan)", async () => {
      const res = await OutgoingDocumentService.organizationSign(
        {
          documentId,
          certificateMetadata: {
            issuer: "Ban Cơ yếu Chính phủ",
            organization: "Trường Cao đẳng Kinh tế và Công nghệ Quảng Ninh",
            serialNumber: `ORG-QCET-${testRunId}`,
          },
        },
        clerkUser,
        { requestId: `req-org-sign-${testRunId}` }
      );

      assert.equal(res.workflow.status, OutgoingDocumentStatus.ORGANIZATION_SIGNED);
      assert.ok(res.workflow.orgSignedAt);
      assert.ok(res.signatureRecord);
      assert.equal(res.signatureRecord.signatureType, SignatureType.ORGANIZATION_DIGITAL);
      assert.equal(res.signatureRecord.signerUserId, clerkUser.id);
      assert.equal(res.signatureRecord.verificationStatus, SignatureVerificationStatus.VALID);
    });

    it("Văn thư issues (phát hành) the document", async () => {
      const res = await OutgoingDocumentService.issueDocument(
        {
          documentId,
          recipientList: "Các Phòng, Khoa, Trung tâm trực thuộc Trường",
          deliveryMethod: "Trục liên thông văn bản quốc gia và Cổng thông tin nội bộ",
        },
        clerkUser,
        { requestId: `req-issue-${testRunId}` }
      );

      assert.equal(res.status, OutgoingDocumentStatus.ISSUED);
      assert.ok(res.issuedAt);
      assert.equal(res.issuerId, clerkUser.id);
      assert.equal(res.recipientList, "Các Phòng, Khoa, Trung tâm trực thuộc Trường");

      // Verify Audit Event for issuance
      const audit = await prisma.auditEvent.findFirst({
        where: {
          entityId: documentId,
          action: "OUTGOING_DOCUMENT_ISSUED",
        },
      });
      assert.ok(audit, "Audit event for document issuance must exist");
    });
  });

  // =========================================================================
  // 2. SEPARATION OF DUTIES (SoD) ENFORCEMENT
  // =========================================================================
  describe("2. Separation of Duties (SoD) Constraints", () => {
    let sodDocId: string;

    before(async () => {
      const res = await OutgoingDocumentService.createOutgoingDraft(
        {
          title: `Tờ trình phân bổ kinh phí - ${testRunId}`,
          summary: `SoD Test Doc ${testRunId}`,
          documentType: DocumentType.VAN_BAN_DI,
          draftingDeptId: deptAcademicId,
          authorizedSignerId: rectorUser.id,
        },
        drafterSpecialist,
        { requestId: `sod-draft-${testRunId}` }
      );
      sodDocId = res.document.id;
      await OutgoingDocumentService.submitContentReview(
        { documentId: sodDocId },
        drafterSpecialist,
        { requestId: `sod-submit-${testRunId}` }
      );
    });

    it("rejects content approval by drafter (Drafter != Content Reviewer)", async () => {
      await assert.rejects(
        async () => {
          await OutgoingDocumentService.approveContent(
            { documentId: sodDocId, approvalNotes: "Tự duyệt nội dung" },
            drafterSpecialist,
            { requestId: `sod-fail-approve-${testRunId}` }
          );
        },
        (err: any) => {
          assert.ok(
            err.name === "SeparationOfDutiesError" ||
              err.name === "HybridAuthorizationError" ||
              err.message?.includes("SoD") ||
              err.message?.includes("Người soạn thảo không được tự phê duyệt")
          );
          return true;
        }
      );
    });

    it("rejects unauthorized signing by clerk or format checker", async () => {
      // Transition to format check then to authorized sign
      await OutgoingDocumentService.approveContent(
        { documentId: sodDocId, approvalNotes: "Duyệt hợp lệ bởi Trưởng phòng" },
        unitHeadAcademic,
        { requestId: `sod-appr-ok-${testRunId}` }
      );
      await OutgoingDocumentService.approveFormat(
        { documentId: sodDocId, notes: "Thể thức đúng" },
        clerkUser,
        { requestId: `sod-format-ok-${testRunId}` }
      );

      // Format checker (Clerk) attempting to sign for Rector must fail
      await assert.rejects(
        async () => {
          await OutgoingDocumentService.signDocument(
            { documentId: sodDocId },
            clerkUser,
            { requestId: `sod-fail-sign-clerk-${testRunId}` }
          );
        },
        (err: any) => {
          assert.ok(
            err.name === "SeparationOfDutiesError" ||
              err.name === "HybridAuthorizationError" ||
              err.message?.includes("thể thức") ||
              err.message?.includes("thẩm quyền") ||
              err.message?.includes("SoD")
          );
          return true;
        }
      );
    });

    it("rejects authorized sign attempt by unprivileged staff", async () => {
      await assert.rejects(
        async () => {
          await OutgoingDocumentService.signDocument(
            { documentId: sodDocId },
            unprivilegedStaff,
            { requestId: `sod-fail-sign-staff-${testRunId}` }
          );
        },
        (err: any) => {
          assert.ok(
            err.name === "HybridAuthorizationError" ||
              err.name === "AuthorizationError" ||
              err.message?.includes("thẩm quyền") ||
              err.message?.includes("thao tác")
          );
          return true;
        }
      );
    });

    it("rejects numbering and stamping by signer (Signer != Numberer)", async () => {
      // Rector signs legally
      await OutgoingDocumentService.signDocument(
        { documentId: sodDocId },
        rectorUser,
        { requestId: `sod-rector-sign-${testRunId}` }
      );

      // Rector attempts to assign outgoing number
      await assert.rejects(
        async () => {
          await OutgoingDocumentService.assignOutgoingNumber(
            { documentId: sodDocId, outgoingNumberStr: "999" },
            rectorUser,
            { requestId: `sod-fail-num-rector-${testRunId}` }
          );
        },
        (err: any) => {
          assert.ok(
            err.name === "ForbiddenError" ||
              err.name === "SeparationOfDutiesError" ||
              err.name === "HybridAuthorizationError" ||
              err.message?.includes("SoD") ||
              err.message?.includes("tự cấp số")
          );
          return true;
        }
      );

      // Rector attempts to organization-sign (stamp)
      await assert.rejects(
        async () => {
          await OutgoingDocumentService.organizationSign(
            { documentId: sodDocId },
            rectorUser,
            { requestId: `sod-fail-stamp-rector-${testRunId}` }
          );
        },
        (err: any) => {
          assert.ok(
            err.name === "ForbiddenError" ||
              err.name === "SeparationOfDutiesError" ||
              err.name === "HybridAuthorizationError" ||
              err.message?.includes("SoD") ||
              err.message?.includes("đóng dấu")
          );
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 3. IMMUTABILITY & REVISION CONTROL
  // =========================================================================
  describe("3. Digital Signature Immutability & Revision Control", () => {
    let immutDocId: string;

    before(async () => {
      const res = await OutgoingDocumentService.createOutgoingDraft(
        {
          title: `Kế hoạch Đào tạo Quý 3 - ${testRunId}`,
          summary: `Immutability Test Doc ${testRunId}`,
          documentType: DocumentType.VAN_BAN_DI,
          draftingDeptId: deptAcademicId,
          authorizedSignerId: rectorUser.id,
        },
        drafterSpecialist,
        { requestId: `immut-draft-${testRunId}` }
      );
      immutDocId = res.document.id;

      await OutgoingDocumentService.submitContentReview(
        { documentId: immutDocId },
        drafterSpecialist,
        { requestId: `immut-sub-cont-${testRunId}` }
      );
      await OutgoingDocumentService.approveContent(
        { documentId: immutDocId },
        unitHeadAcademic,
        { requestId: `immut-appr-cont-${testRunId}` }
      );
      await OutgoingDocumentService.approveFormat(
        { documentId: immutDocId },
        clerkUser,
        { requestId: `immut-appr-fmt-${testRunId}` }
      );
      await OutgoingDocumentService.signDocument(
        { documentId: immutDocId },
        rectorUser,
        { requestId: `immut-sign-${testRunId}` }
      );
    });

    it("rejects direct re-signing of an already signed document version", async () => {
      await assert.rejects(
        async () => {
          await OutgoingDocumentService.signDocument(
            { documentId: immutDocId },
            rectorUser,
            { requestId: `immut-resign-fail-${testRunId}` }
          );
        },
        (err: any) => {
          assert.ok(
            err.name === "ValidationError" ||
              err.name === "InvalidTransitionError" ||
              err.name === "DomainStateTransitionError" ||
              err.message?.includes("đã được ký") ||
              err.message?.includes("không ở trạng thái chờ ký")
          );
          return true;
        }
      );
    });

    it("bumps version from 1 to 2 when a document revision is created and resets workflow", async () => {
      const res = await OutgoingDocumentService.createDocumentRevision(
        {
          documentId: immutDocId,
          changeReason: "Bổ sung điều chỉnh chỉ tiêu đào tạo theo yêu cầu Bộ GD&ĐT",
          title: `Kế hoạch Đào tạo Quý 3 (Bổ sung v2) - ${testRunId}`,
        },
        drafterSpecialist,
        { requestId: `immut-rev-${testRunId}` }
      );

      assert.equal(res.currentVersion, 2);
      assert.equal(res.status, OutgoingDocumentStatus.DRAFT);
      assert.equal(res.authorizedSignedAt, null);
      assert.equal(res.numberedAt, null);
      assert.equal(res.orgSignedAt, null);
      assert.equal(res.issuedAt, null);

      // Verify that previously created signature records for version 1 are now REVOKED
      const v1Signatures = await prisma.signatureRecord.findMany({
        where: {
          documentId: immutDocId,
          version: 1,
        },
      });
      assert.ok(v1Signatures.length > 0);
      assert.ok(
        v1Signatures.every((s) => s.verificationStatus === SignatureVerificationStatus.REVOKED),
        "Previous version signatures must be marked REVOKED upon revision creation"
      );

      // Verify new revision Audit Event
      const audit = await prisma.auditEvent.findFirst({
        where: {
          entityId: immutDocId,
          action: "DOCUMENT_REVISION_CREATED",
        },
      });
      assert.ok(audit, "Audit event for document revision must exist");
    });

    it("requires the new version 2 to re-traverse the full review and signing chain", async () => {
      // 1. Submit content review for v2
      await OutgoingDocumentService.submitContentReview(
        { documentId: immutDocId },
        drafterSpecialist,
        { requestId: `v2-sub-cont-${testRunId}` }
      );

      // 2. Approve content for v2
      await OutgoingDocumentService.approveContent(
        { documentId: immutDocId },
        unitHeadAcademic,
        { requestId: `v2-appr-cont-${testRunId}` }
      );

      // 3. Approve format for v2
      await OutgoingDocumentService.approveFormat(
        { documentId: immutDocId },
        clerkUser,
        { requestId: `v2-appr-fmt-${testRunId}` }
      );

      // 4. Sign v2 with Rector
      const signRes = await OutgoingDocumentService.signDocument(
        { documentId: immutDocId },
        rectorUser,
        { requestId: `v2-sign-${testRunId}` }
      );

      assert.equal(signRes.workflow.currentVersion, 2);
      assert.equal(signRes.signatureRecord?.version, 2);
      assert.equal(signRes.signatureRecord?.verificationStatus, SignatureVerificationStatus.VALID);
    });
  });

  // =========================================================================
  // 4. COMMAND API ROUTE HANDLERS (HTTP Layer Verification)
  // =========================================================================
  describe("4. Command API Route Handlers (HTTP Layer Verification)", () => {
    let apiDocId: string;
    let drafterToken: string;
    let unitHeadToken: string;
    let clerkToken: string;
    let rectorToken: string;

    before(() => {
      drafterToken = signSessionToken({
        id: drafterSpecialist.id,
        email: drafterSpecialist.email,
        name: drafterSpecialist.name,
        role: drafterSpecialist.role,
        departmentId: drafterSpecialist.departmentId,
      });

      unitHeadToken = signSessionToken({
        id: unitHeadAcademic.id,
        email: unitHeadAcademic.email,
        name: unitHeadAcademic.name,
        role: unitHeadAcademic.role,
        departmentId: unitHeadAcademic.departmentId,
      });

      clerkToken = signSessionToken({
        id: clerkUser.id,
        email: clerkUser.email,
        name: clerkUser.name,
        role: clerkUser.role,
        departmentId: clerkUser.departmentId,
      });

      rectorToken = signSessionToken({
        id: rectorUser.id,
        email: rectorUser.email,
        name: rectorUser.name,
        role: rectorUser.role,
        departmentId: rectorUser.departmentId,
      });
    });

    it("POST /api/documents/outgoing creates draft via HTTP", async () => {
      const req = new NextRequest("http://localhost:3000/api/documents/outgoing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${drafterToken}`,
        },
        body: JSON.stringify({
          title: `Công văn thông báo học bổng - ${testRunId}`,
          summary: `HTTP API Outgoing Test ${testRunId}`,
          documentType: DocumentType.VAN_BAN_DI,
          urgency: DocumentUrgency.THUONG,
          securityLevel: DocumentSecurityLevel.THUONG,
          draftingDeptId: deptAcademicId,
          authorizedSignerId: rectorUser.id,
        }),
      });

      const res = await createDraftRoute(req);
      const data = await res.json();

      assert.equal(res.status, 201);
      assert.ok(data.document?.id);
      apiDocId = data.document.id;
    });

    it("POST /api/documents/[id]/actions/submit-content-review submits content review", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/documents/${apiDocId}/actions/submit-content-review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${drafterToken}`,
          },
          body: JSON.stringify({
            contentReviewerId: unitHeadAcademic.id,
            notes: "Kính trình duyệt",
          }),
        }
      );

      const res = await submitContentReviewRoute(req, { params: Promise.resolve({ id: apiDocId }) });
      const data = await res.json();

      assert.equal(res.status, 200);
      assert.equal(data.status, OutgoingDocumentStatus.CONTENT_REVIEW);
    });

    it("POST /api/documents/[id]/actions/approve-content approves content", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/documents/${apiDocId}/actions/approve-content`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${unitHeadToken}`,
          },
          body: JSON.stringify({
            approvalNotes: "Duyệt nội dung đạt yêu cầu",
          }),
        }
      );

      const res = await approveContentRoute(req, { params: Promise.resolve({ id: apiDocId }) });
      const data = await res.json();

      assert.equal(res.status, 200);
      assert.equal(data.status, OutgoingDocumentStatus.FORMAT_CHECK);
    });

    it("POST /api/documents/[id]/actions/submit-format-check submits format check", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/documents/${apiDocId}/actions/submit-format-check`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${unitHeadToken}`,
          },
          body: JSON.stringify({
            formatReviewerId: clerkUser.id,
          }),
        }
      );

      const res = await submitFormatCheckRoute(req, { params: Promise.resolve({ id: apiDocId }) });
      const data = await res.json();

      assert.equal(res.status, 200);
      assert.equal(data.status, OutgoingDocumentStatus.FORMAT_CHECK);
    });

    it("POST /api/documents/[id]/actions/approve-format approves format", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/documents/${apiDocId}/actions/approve-format`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${clerkToken}`,
          },
          body: JSON.stringify({
            notes: "Thể thức chuẩn",
          }),
        }
      );

      const res = await approveFormatRoute(req, { params: Promise.resolve({ id: apiDocId }) });
      const data = await res.json();

      assert.equal(res.status, 200);
      assert.equal(data.status, OutgoingDocumentStatus.AUTHORIZED_SIGN);
    });

    it("POST /api/documents/[id]/actions/sign executes authorized signature", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/documents/${apiDocId}/actions/sign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${rectorToken}`,
          },
          body: JSON.stringify({
            signatureType: SignatureType.PERSONAL_DIGITAL,
            certificateMetadata: {
              subject: "Hiệu trưởng Test",
            },
          }),
        }
      );

      const res = await signRoute(req, { params: Promise.resolve({ id: apiDocId }) });
      const data = await res.json();

      assert.equal(res.status, 200);
      assert.ok(data.workflow?.authorizedSignedAt);
      assert.ok(data.signatureRecord);
    });

    it("POST /api/documents/[id]/actions/assign-number assigns outgoing number", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/documents/${apiDocId}/actions/assign-number`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${clerkToken}`,
          },
          body: JSON.stringify({
            outgoingNumberStr: "555",
            codeNotation: "555/TB-CĐKTCN",
          }),
        }
      );

      const res = await assignNumberRoute(req, { params: Promise.resolve({ id: apiDocId }) });
      const data = await res.json();

      assert.equal(res.status, 200);
      assert.equal(data.outgoingNumberStr, "555");
    });

    it("POST /api/documents/[id]/actions/organization-sign applies organization stamp", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/documents/${apiDocId}/actions/organization-sign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${clerkToken}`,
          },
          body: JSON.stringify({
            certificateMetadata: {
              organization: "QCET",
            },
          }),
        }
      );

      const res = await orgSignRoute(req, { params: Promise.resolve({ id: apiDocId }) });
      const data = await res.json();

      assert.equal(res.status, 200);
      assert.equal(data.workflow?.status, OutgoingDocumentStatus.ORGANIZATION_SIGNED);
    });

    it("POST /api/documents/[id]/actions/issue issues document to recipients", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/documents/${apiDocId}/actions/issue`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${clerkToken}`,
          },
          body: JSON.stringify({
            recipientList: "Toàn thể cán bộ giảng viên",
            deliveryMethod: "Trục liên thông văn bản",
          }),
        }
      );

      const res = await issueRoute(req, { params: Promise.resolve({ id: apiDocId }) });
      const data = await res.json();

      assert.equal(res.status, 200);
      assert.equal(data.status, OutgoingDocumentStatus.ISSUED);
      assert.ok(data.issuedAt);
    });
  });
});
