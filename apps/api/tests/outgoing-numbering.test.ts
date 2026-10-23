import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { AssignmentStatus, AssignmentType, OutgoingDocumentStatus, SignatureType, UnitType, UserRole } from "@prisma/client";
import { prisma } from "@qcet/db/prisma";
import { OutgoingDocumentService } from "@/server/documents/outgoing-document-service";
import { getNextRegistrationNumber, peekNextRegistrationNumber } from "@/server/documents/numbering-engine";
import { addCalendarDays, getTodayIctDate, parseStrictDateOnly } from "@qcet/shared/lib/academic-calendar";
import { HybridAuthorizationError } from "@/server/authorization/hybrid-authorization";

/**
 * Cấp số văn bản đi (spec Văn bản G2, G3): ký hiệu theo loại và đơn vị soạn, xem trước số, ngày ban hành trong khoảng
 * cho phép, lỗi nhập liệu không tiêu thụ số. Chạy trên CSDL test thật.
 */
describe("Văn bản đi: cấp số, ký hiệu theo loại, ngày ban hành", () => {
  const runId = `onu_${Date.now()}`;
  const userIds: string[] = [];
  const unitIds: string[] = [];
  const assignmentIds: string[] = [];
  const docIds: string[] = [];
  const people: Record<string, any> = {};
  const today = getTodayIctDate();
  const startOfYear = `${today.slice(0, 4)}-01-01`;

  async function makeUser(key: string, role: UserRole, positionCode: string, unitId: string) {
    const user = await prisma.user.create({
      data: { id: `${key}-${runId}`, email: `${key}.${runId}@qcet.edu.vn`, name: `Người ${key}`, role, isActive: true },
    });
    userIds.push(user.id);
    const def = await prisma.positionDefinition.findUnique({ where: { code: positionCode } });
    assert.ok(def, `Thiếu PositionDefinition ${positionCode}`);
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
    people[key] = user;
  }

  /** Đưa một dự thảo qua duyệt nội dung, kiểm thể thức và ký chức danh tới bước chờ cấp số. */
  async function draftSignedDocument(category: string) {
    const draft = await OutgoingDocumentService.createOutgoingDraft({ title: `Cấp số ${category} ${runId}`, category }, people.drafter);
    const documentId = draft.document.id;
    docIds.push(documentId);
    await OutgoingDocumentService.submitContentReview({ documentId }, people.drafter);
    await OutgoingDocumentService.approveContent({ documentId }, people.leader);
    await OutgoingDocumentService.approveFormat({ documentId }, people.clerk);
    await OutgoingDocumentService.signDocument({ documentId, signatureType: SignatureType.PERSONAL_DIGITAL }, people.rector);
    return documentId;
  }
  const workflowOf = (documentId: string) => prisma.documentOutgoingWorkflow.findUniqueOrThrow({ where: { documentId }, include: { document: true } });

  before(async () => {
    const unit = await prisma.organizationalUnit.create({
      data: {
        id: `ou-A-${runId}`,
        code: `A_${runId.slice(-6)}`,
        name: `Phòng Thử nghiệm ${runId}`,
        type: UnitType.DEPARTMENT,
        metadata: { shortName: "Phòng TNQ" },
      },
    });
    const other = await prisma.organizationalUnit.create({
      data: { id: `ou-B-${runId}`, code: `B_${runId.slice(-6)}`, name: `Đơn vị B ${runId}`, type: UnitType.DEPARTMENT },
    });
    unitIds.push(unit.id, other.id);
    await makeUser("drafter", UserRole.CHUYEN_VIEN, "CHUYEN_VIEN", unit.id);
    await makeUser("leader", UserRole.TRUONG_PHONG, "TRUONG_PHONG", unit.id);
    await makeUser("clerk", UserRole.VAN_THU, "VAN_THU", other.id);
    await makeUser("rector", UserRole.BAN_GIAM_HIEU, "HIEU_TRUONG", other.id);
  });

  after(async () => {
    try {
      for (const id of docIds) {
        await prisma.outboxEvent.deleteMany({ where: { aggregateId: id } });
        await prisma.auditEvent.deleteMany({ where: { entityId: id } });
        await prisma.document.deleteMany({ where: { id } });
      }
      await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.positionAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.organizationalUnit.deleteMany({ where: { id: { in: unitIds } } });
      await prisma.documentNumberSequence.deleteMany({ where: { year: 2999 } });
    } catch {
      // dọn dẹp không được làm hỏng kết quả test
    }
  });

  it("xem trước số khớp số cấp kế tiếp của dãy (không ghi gì, cấp xong thì số tăng)", async () => {
    await prisma.documentNumberSequence.deleteMany({ where: { year: 2999 } });
    assert.equal(await peekNextRegistrationNumber("VAN_BAN_DI" as any, 2999), 1);
    assert.equal(await peekNextRegistrationNumber("VAN_BAN_DI" as any, 2999), 1, "xem trước không tiêu thụ số");
    assert.equal(await getNextRegistrationNumber("VAN_BAN_DI" as any, 2999), 1);
    assert.equal(await peekNextRegistrationNumber("VAN_BAN_DI" as any, 2999), 2);
    assert.equal(await getNextRegistrationNumber("VAN_BAN_DI" as any, 2999), 2);
  });

  it("Công văn: ký hiệu theo cơ quan và đơn vị soạn; hộp xem trước đúng số, ký hiệu và khoảng ngày; người không cấp số không xem được", async () => {
    const documentId = await draftSignedDocument("Công văn");
    const preview = await OutgoingDocumentService.previewAssignNumber(documentId, people.clerk);
    assert.equal(preview.notation, "CĐKTCNQN-TNQ");
    assert.equal(preview.numberStr, `${preview.number}/CĐKTCNQN-TNQ`);
    assert.equal(preview.year, Number(today.slice(0, 4)));
    assert.equal(preview.issuedDate, today);
    assert.equal(preview.maxIssuedDate, today);
    assert.ok(preview.minIssuedDate >= startOfYear && preview.minIssuedDate <= today);
    await assert.rejects(() => OutgoingDocumentService.previewAssignNumber(documentId, people.drafter), HybridAuthorizationError);

    const numbered = await OutgoingDocumentService.assignOutgoingNumber({ documentId }, people.clerk);
    assert.ok(numbered.outgoingNumber! >= preview.number, "số cấp thật không nhỏ hơn số xem trước (người khác có thể cấp trước)");
    assert.equal(numbered.outgoingNumberStr, `${numbered.outgoingNumber}/CĐKTCNQN-TNQ`);
    const saved = await workflowOf(documentId);
    assert.equal(saved.document.originalNumber, numbered.outgoingNumberStr);
    assert.equal(parseStrictDateOnly(saved.document.issuedDate), today);
    assert.equal(saved.document.documentYear, Number(today.slice(0, 4)));
  });

  it("Quyết định: ký hiệu QĐ-CĐKTCNQN, không kèm đơn vị", async () => {
    const documentId = await draftSignedDocument("Quyết định");
    assert.equal((await OutgoingDocumentService.previewAssignNumber(documentId, people.clerk)).notation, "QĐ-CĐKTCNQN");
    const numbered = await OutgoingDocumentService.assignOutgoingNumber({ documentId }, people.clerk);
    assert.match(numbered.outgoingNumberStr!, /^\d+\/QĐ-CĐKTCNQN$/);
  });

  it("dự thảo tạo không nói hình thức là Công văn (không còn mặc định Quyết định)", async () => {
    const draft = await OutgoingDocumentService.createOutgoingDraft({ title: `Mặc định ${runId}` }, people.drafter);
    docIds.push(draft.document.id);
    assert.equal(draft.document.category, "Công văn");
  });

  it("Văn thư sửa được ký hiệu; ký hiệu sai hoặc ngày ngoài khoảng bị từ chối và không tiêu thụ số", async () => {
    const documentId = await draftSignedDocument("Kế hoạch");
    const rejected = async (input: Record<string, unknown>, code: string) => {
      await assert.rejects(
        () => OutgoingDocumentService.assignOutgoingNumber({ documentId, ...input }, people.clerk),
        (error: any) => error.code === code
      );
      const workflow = await workflowOf(documentId);
      assert.equal(workflow.status, OutgoingDocumentStatus.AUTHORIZED_SIGN, "chưa chiếm bước");
      assert.equal(workflow.outgoingNumber, null);
    };
    await rejected({ codeNotation: "12/QĐ-X" }, "INVALID_NOTATION");
    await rejected({ codeNotation: "KH XYZ" }, "INVALID_NOTATION");
    await rejected({ issuedDate: addCalendarDays(today, 1) }, "INVALID_ISSUED_DATE");
    await rejected({ issuedDate: "2026-02-30" }, "INVALID_ISSUED_DATE");

    // Ngày ký lùi về đầu khoảng cho phép để chọn một ngày trước hôm nay
    const signedDay = addCalendarDays(today, -3)! > startOfYear ? addCalendarDays(today, -3)! : startOfYear;
    await prisma.documentOutgoingWorkflow.update({ where: { documentId }, data: { authorizedSignedAt: new Date(`${signedDay}T03:00:00+07:00`) } });
    await rejected({ issuedDate: addCalendarDays(signedDay, -1) }, "INVALID_ISSUED_DATE");

    const numbered = await OutgoingDocumentService.assignOutgoingNumber(
      { documentId, codeNotation: "KH-TNQ", issuedDate: signedDay },
      people.clerk
    );
    assert.match(numbered.outgoingNumberStr!, /^\d+\/KH-TNQ$/);
    const saved = await workflowOf(documentId);
    assert.equal(parseStrictDateOnly(saved.document.issuedDate), signedDay, "ngày ban hành ghi đúng ngày đã chọn");
  });
});
