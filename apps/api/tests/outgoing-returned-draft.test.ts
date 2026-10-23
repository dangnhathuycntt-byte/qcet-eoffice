import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { AssignmentStatus, AssignmentType, OutgoingDocumentStatus, UnitType, UserRole } from "@prisma/client";
import { prisma } from "@qcet/db/prisma";
import { OutgoingDocumentService } from "@/server/documents/outgoing-document-service";
import { initialSignOutgoing } from "@/server/documents/outgoing-initial-sign";
import { buildOutgoingStepView } from "@/server/documents/outgoing-step-view";
import { getDocumentById } from "@/server/documents/document-service";
import { isDocumentImmutable } from "@/server/documents/state-machine";
import { signSessionToken } from "@/lib/jwt-session";
import { PATCH as patchDocumentRoute } from "@/app/api/documents/[id]/route";

/**
 * Dự thảo bị trả lại (spec Văn bản Q4, G5): người soạn thấy ai trả, khi nào, lý do; ký nháy trước khi trả không khóa
 * bản nháp; sau khi trình lại thì hết "bị trả lại".
 */
describe("Văn bản đi: dự thảo bị trả lại", () => {
  const runId = `ret_${Date.now()}`;
  const userIds: string[] = [];
  const assignmentIds: string[] = [];
  let unitId: string;
  let drafter: any;
  let leader: any;
  let docId: string;

  async function makeUser(key: string, role: UserRole, positionCode: string) {
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
    return user;
  }

  const sessionOf = (u: any) => ({ id: u.id, email: u.email, name: u.name, role: u.role }) as any;
  const stepViewOf = async (u: any) => {
    const doc = await getDocumentById(docId);
    assert.ok(doc);
    return buildOutgoingStepView(sessionOf(u), doc);
  };

  before(async () => {
    const unit = await prisma.organizationalUnit.create({
      data: { id: `ou-${runId}`, code: `R_${runId.slice(-6)}`, name: `Đơn vị ${runId}`, type: UnitType.DEPARTMENT },
    });
    unitId = unit.id;
    drafter = await makeUser("drafter", UserRole.CHUYEN_VIEN, "CHUYEN_VIEN");
    leader = await makeUser("leader", UserRole.TRUONG_PHONG, "TRUONG_PHONG");
  });

  after(async () => {
    try {
      if (docId) {
        await prisma.outboxEvent.deleteMany({ where: { aggregateId: docId } });
        await prisma.auditEvent.deleteMany({ where: { entityId: docId } });
        await prisma.document.deleteMany({ where: { id: docId } });
      }
      await prisma.positionAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.organizationalUnit.deleteMany({ where: { id: unitId } });
    } catch {
      // dọn dẹp không được làm hỏng kết quả test
    }
  });

  it("ký nháy rồi trả lại: bản nháp vẫn sửa được, người soạn thấy ai trả, khi nào và lý do", async () => {
    const draft = await OutgoingDocumentService.createOutgoingDraft({ title: `Dự thảo bị trả lại ${runId}` }, drafter);
    docId = draft.document.id;
    await OutgoingDocumentService.submitContentReview({ documentId: docId, contentReviewerId: leader.id }, drafter);
    await initialSignOutgoing(sessionOf(leader), docId, {});
    assert.equal(
      isDocumentImmutable((await getDocumentById(docId))!),
      false,
      "ký nháy không khóa dự thảo đang soát xét"
    );
    await OutgoingDocumentService.rejectContent({ documentId: docId, notes: "Cần bổ sung căn cứ pháp lý" } as any, leader);

    const returned = await getDocumentById(docId);
    assert.equal(returned?.outgoingWorkflow?.status, OutgoingDocumentStatus.DRAFT);
    assert.equal(isDocumentImmutable(returned!), false, "ký nháy trước khi trả không khóa bản nháp bị trả");
    assert.equal(returned?.needsRevision, true, "danh sách đánh dấu Cần sửa");

    const view = await stepViewOf(drafter);
    assert.equal(view?.returned?.by, leader.name);
    assert.equal(view?.returned?.note, "Cần bổ sung căn cứ pháp lý");
    assert.ok(view?.returned?.at);
    assert.deepEqual(view?.actions, ["submit-content-review"], "người soạn trình lại được");
  });

  it("người soạn sửa trích yếu của bản nháp bị trả lại qua PATCH (trước đây 400 IMMUTABLE_DOCUMENT)", async () => {
    const token = signSessionToken({ id: drafter.id, email: drafter.email, name: drafter.name, role: drafter.role });
    const req = new NextRequest(`http://localhost:3000/api/documents/${docId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ summary: `Đã sửa theo ý kiến ${runId}` }),
    });
    const res = await patchDocumentRoute(req, { params: Promise.resolve({ id: docId }) });
    assert.equal(res.status, 200, await res.clone().text());
    assert.equal((await getDocumentById(docId))?.summary, `Đã sửa theo ý kiến ${runId}`);
  });

  it("lý do trống: trả lại không ghi lý do thì khối hiện câu mặc định (note = null); trình lại thì hết bị trả lại", async () => {
    await OutgoingDocumentService.submitContentReview({ documentId: docId, contentReviewerId: leader.id }, drafter);
    assert.equal((await stepViewOf(drafter))?.returned, null, "đang chờ duyệt thì không còn bị trả lại");
    assert.equal((await getDocumentById(docId))?.needsRevision, false);

    await OutgoingDocumentService.rejectContent({ documentId: docId } as any, leader);
    const view = await stepViewOf(drafter);
    assert.equal(view?.returned?.by, leader.name);
    assert.equal(view?.returned?.note, null);
  });
});
