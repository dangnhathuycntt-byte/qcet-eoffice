import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  AssignmentStatus,
  AssignmentType,
  DocumentSecurityLevel,
  DocumentType,
  DocumentUrgency,
  FileScanStatus,
  OutgoingDocumentStatus,
  UnitType,
  UserRole,
} from "@prisma/client";
import { prisma } from "@qcet/db/prisma";
import { OutgoingDocumentService } from "@/server/documents/outgoing-document-service";
import { readDocumentForUser } from "@/server/documents/read-document-for-user";
import { buildDocumentReadWhere } from "@/server/policies/document-policy";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { authorizeFileObjectDownload } from "@/server/files/file-access-service";
import { ForbiddenError } from "@/server/api/errors";

/**
 * Trưởng/phó đơn vị soạn đọc và duyệt dự thảo văn bản đi của nhân viên mình (D5, spec Văn bản §A1); người được trình duyệt
 * và người duyệt bước tờ trình mở được tệp (T3). Chạy trên CSDL test thật như các test văn bản đi khác.
 */
describe("Văn bản đi: đơn vị soạn, quyền đọc/duyệt của trưởng đơn vị và quyền mở tệp", () => {
  const runId = `dua_${Date.now()}`;
  const docIds: string[] = [];
  const userIds: string[] = [];
  const unitIds: string[] = [];
  const assignmentIds: string[] = [];
  const fileObjectIds: string[] = [];

  let unitA: string;
  let unitB: string;
  let drafter: any;
  let peer: any;
  let leaderA: any;
  let leaderB: any;
  let reviewerB: any;
  let rector: any;
  let outsiderB: any;
  let draftId: string;

  const authUserOf = (u: any) => ({ id: u.id, email: u.email, name: u.name, role: u.role }) as any;
  const ctxOf = (u: any) => loadAuthorizationContext(u.id, new Date());
  const canList = async (u: any, documentId: string) =>
    Boolean(
      await prisma.document.findFirst({
        where: { AND: [{ id: documentId }, buildDocumentReadWhere(await ctxOf(u))] },
        select: { id: true },
      })
    );
  const canOpen = async (u: any, documentId: string) => {
    try {
      await readDocumentForUser(await ctxOf(u), documentId);
      return true;
    } catch (error) {
      if (error instanceof ForbiddenError) return false;
      throw error;
    }
  };

  async function makeUser(key: string, role: UserRole, positionCode: string, unitId: string) {
    const user = await prisma.user.create({
      data: { id: `${key}-${runId}`, email: `${key}.${runId}@qcet.edu.vn`, name: `Người ${key}`, role, isActive: true },
    });
    userIds.push(user.id);
    const def = await prisma.positionDefinition.findUnique({ where: { code: positionCode } });
    assert.ok(def, `Thiếu PositionDefinition ${positionCode} trong CSDL test`);
    const assignment = await prisma.positionAssignment.create({
      data: {
        userId: user.id,
        positionDefinitionId: def.id,
        unitId,
        type: AssignmentType.PRIMARY,
        status: AssignmentStatus.ACTIVE,
        effectiveFrom: new Date("2024-01-01T00:00:00.000Z"),
      },
    });
    assignmentIds.push(assignment.id);
    return user;
  }

  before(async () => {
    for (const [key, name] of [
      ["A", "Phòng soạn"],
      ["B", "Phòng khác"],
    ] as const) {
      const unit = await prisma.organizationalUnit.create({
        data: { id: `ou-${key}-${runId}`, code: `${key}_${runId.slice(-6)}`, name: `${name} ${runId}`, type: UnitType.DEPARTMENT },
      });
      unitIds.push(unit.id);
      if (key === "A") unitA = unit.id;
      else unitB = unit.id;
    }
    drafter = await makeUser("drafter", UserRole.CHUYEN_VIEN, "CHUYEN_VIEN", unitA);
    peer = await makeUser("peer", UserRole.CHUYEN_VIEN, "CHUYEN_VIEN", unitA);
    leaderA = await makeUser("leaderA", UserRole.TRUONG_PHONG, "TRUONG_PHONG", unitA);
    leaderB = await makeUser("leaderB", UserRole.TRUONG_PHONG, "TRUONG_PHONG", unitB);
    reviewerB = await makeUser("reviewerB", UserRole.CHUYEN_VIEN, "CHUYEN_VIEN", unitB);
    rector = await makeUser("rector", UserRole.BAN_GIAM_HIEU, "HIEU_TRUONG", unitB);
    outsiderB = await makeUser("outsiderB", UserRole.CHUYEN_VIEN, "CHUYEN_VIEN", unitB);
  });

  after(async () => {
    try {
      for (const id of docIds) {
        await prisma.outboxEvent.deleteMany({ where: { aggregateId: id } });
        await prisma.auditEvent.deleteMany({ where: { entityId: id } });
        await prisma.document.deleteMany({ where: { id } });
      }
      await prisma.fileObject.deleteMany({ where: { id: { in: fileObjectIds } } });
      await prisma.positionAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.organizationalUnit.deleteMany({ where: { id: { in: unitIds } } });
    } catch {
      // dọn dẹp không được làm hỏng kết quả test
    }
  });

  it("1. Dự thảo ghi đơn vị soạn của người soạn và bỏ qua đơn vị họ không thuộc về", async () => {
    const own = await OutgoingDocumentService.createOutgoingDraft(
      { title: `Dự thảo đơn vị soạn ${runId}`, draftingDeptId: unitA },
      drafter
    );
    docIds.push(own.document.id);
    draftId = own.document.id;
    assert.equal(own.workflow.draftingUnitId, unitA);

    const spoofed = await OutgoingDocumentService.createOutgoingDraft(
      { title: `Dự thảo gán đơn vị lạ ${runId}`, draftingDeptId: unitB },
      drafter
    );
    docIds.push(spoofed.document.id);
    assert.equal(spoofed.workflow.draftingUnitId, unitA, "không cho gán đơn vị người soạn không thuộc về");

    const implicit = await OutgoingDocumentService.createOutgoingDraft({ title: `Dự thảo mặc định ${runId}` }, drafter);
    docIds.push(implicit.document.id);
    assert.equal(implicit.workflow.draftingUnitId, unitA, "không chọn thì lấy đơn vị chính của người soạn");
  });

  it("2. Trưởng đơn vị soạn mở được dự thảo; trưởng đơn vị khác, đồng nghiệp và người ngoài thì không", async () => {
    assert.equal(await canOpen(drafter, draftId), true);
    assert.equal(await canOpen(leaderA, draftId), true, "trưởng đơn vị soạn phải đọc được");
    assert.equal(await canOpen(leaderB, draftId), false, "trưởng đơn vị khác không đọc được");
    assert.equal(await canOpen(peer, draftId), false, "đồng nghiệp cùng đơn vị không đọc dự thảo chưa trình");
    assert.equal(await canOpen(outsiderB, draftId), false);
  });

  it("3. Danh sách khớp quyền mở chi tiết", async () => {
    assert.equal(await canList(drafter, draftId), true);
    assert.equal(await canList(leaderA, draftId), true);
    assert.equal(await canList(leaderB, draftId), false);
    assert.equal(await canList(peer, draftId), false);
    assert.equal(await canList(outsiderB, draftId), false);
  });

  it("4. Người được trình duyệt nội dung đọc được dù khác đơn vị; người khác vẫn không", async () => {
    // Người duyệt chọn được là trưởng đơn vị soạn hoặc lãnh đạo trường; ở đây chọn Hiệu trưởng (đơn vị khác)
    await OutgoingDocumentService.submitContentReview({ documentId: draftId, contentReviewerId: rector.id }, drafter);
    assert.equal(await canOpen(rector, draftId), true);
    assert.equal(await canList(rector, draftId), true);
    assert.equal(await canOpen(outsiderB, draftId), false);
    assert.equal(await canList(outsiderB, draftId), false);
  });

  it("5. Duyệt nội dung chỉ thuộc người được trình hoặc trưởng/phó đơn vị soạn", async () => {
    await assert.rejects(
      () => OutgoingDocumentService.approveContent({ documentId: draftId }, leaderB),
      (error: unknown) => error instanceof ForbiddenError,
      "trưởng đơn vị khác không được duyệt dự thảo không phải của mình"
    );
    await assert.rejects(
      () => OutgoingDocumentService.rejectContent({ documentId: draftId, notes: "x" } as any, leaderB),
      (error: unknown) => error instanceof ForbiddenError
    );
    const approved = await OutgoingDocumentService.approveContent({ documentId: draftId }, leaderA);
    assert.equal(approved.status, OutgoingDocumentStatus.FORMAT_CHECK);
  });

  it("6. Tệp đính kèm dự thảo: trưởng đơn vị soạn mở được, trưởng đơn vị khác bị từ chối", async () => {
    const fileObject = await prisma.fileObject.create({
      data: {
        storageKey: `test/${runId}/draft.pdf`,
        originalName: "draft.pdf",
        mimeType: "application/pdf",
        extension: "pdf",
        byteSize: BigInt(10),
        contentHash: "0".repeat(64),
        scanStatus: FileScanStatus.CLEAN,
        uploadedById: drafter.id,
      },
    });
    fileObjectIds.push(fileObject.id);
    await prisma.documentAttachment.create({
      data: {
        documentId: draftId,
        fileName: "draft.pdf",
        fileUrl: `/uploads/${runId}/draft.pdf`,
        fileObjectId: fileObject.id,
        fileSize: 10,
        mimeType: "application/pdf",
      },
    });

    const opened = await authorizeFileObjectDownload({ authUser: authUserOf(leaderA), fileObjectId: fileObject.id, requestId: "t" });
    assert.equal(opened.id, fileObject.id);
    await assert.rejects(
      () => authorizeFileObjectDownload({ authUser: authUserOf(leaderB), fileObjectId: fileObject.id, requestId: "t" }),
      (error: unknown) => error instanceof ForbiddenError
    );
    await assert.rejects(
      () => authorizeFileObjectDownload({ authUser: authUserOf(outsiderB), fileObjectId: fileObject.id, requestId: "t" }),
      (error: unknown) => error instanceof ForbiddenError
    );
  });

  it("7. Tệp của tờ trình: người duyệt bước mở được, người ngoài bị từ chối", async () => {
    const now = new Date();
    const proposal = await prisma.document.create({
      data: {
        type: DocumentType.TO_TRINH_NOI_BO,
        registrationNumber: -Math.floor(Math.random() * 1_000_000_000),
        documentYear: -now.getFullYear(),
        registeredDate: now,
        originalNumber: `TT-${runId}`,
        issuedDate: now,
        issuingAuthority: "Kiểm thử",
        category: "Tờ trình",
        summary: `Tờ trình kiểm thử ${runId}`,
        urgency: DocumentUrgency.THUONG,
        securityLevel: DocumentSecurityLevel.THUONG,
        registeredById: drafter.id,
      },
    });
    docIds.push(proposal.id);
    const fileObject = await prisma.fileObject.create({
      data: {
        storageKey: `test/${runId}/proposal.pdf`,
        originalName: "proposal.pdf",
        mimeType: "application/pdf",
        extension: "pdf",
        byteSize: BigInt(10),
        contentHash: "1".repeat(64),
        scanStatus: FileScanStatus.CLEAN,
        uploadedById: drafter.id,
      },
    });
    fileObjectIds.push(fileObject.id);
    await prisma.documentAttachment.create({
      data: {
        documentId: proposal.id,
        fileName: "proposal.pdf",
        fileUrl: `/uploads/${runId}/proposal.pdf`,
        fileObjectId: fileObject.id,
        fileSize: 10,
        mimeType: "application/pdf",
      },
    });
    await prisma.documentApprovalWorkflow.create({
      data: {
        documentId: proposal.id,
        status: "WAITING_LEADER",
        round: 1,
        submittedById: drafter.id,
        submittedAt: now,
        steps: { create: [{ round: 1, stage: "LEADER", approverUserId: reviewerB.id }] },
      },
    });

    const opened = await authorizeFileObjectDownload({ authUser: authUserOf(reviewerB), fileObjectId: fileObject.id, requestId: "t" });
    assert.equal(opened.id, fileObject.id, "người duyệt bước phải mở được tệp của tờ trình");
    await assert.rejects(
      () => authorizeFileObjectDownload({ authUser: authUserOf(outsiderB), fileObjectId: fileObject.id, requestId: "t" }),
      (error: unknown) => error instanceof ForbiddenError
    );
  });
});
