import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { AssignmentStatus, AssignmentType, OutgoingDocumentStatus, UnitType, UserRole } from "@prisma/client";
import { prisma } from "@qcet/db/prisma";
import { OutgoingDocumentService } from "@/server/documents/outgoing-document-service";
import { buildOutgoingStepView } from "@/server/documents/outgoing-step-view";
import { getDocumentById } from "@/server/documents/document-service";
import { isOutgoingUnderReview, patchTouchesLockedContent } from "@/server/documents/state-machine";
import { ForbiddenError, InvalidTransitionError, ValidationError } from "@/server/api/errors";
import { signSessionToken } from "@/lib/jwt-session";
import { PATCH as patchDocumentRoute, GET as getDocumentRoute } from "@/app/api/documents/[id]/route";
import { POST as addAttachmentRoute } from "@/app/api/documents/[id]/attachments/route";

/**
 * Trình duyệt có chọn người duyệt, Rút lại và khóa nội dung khi chờ duyệt (spec Văn bản Q2, Q5, Q15).
 */
describe("Văn bản đi: chọn người duyệt, rút lại và khóa nội dung khi chờ duyệt", () => {
  const runId = `lck_${Date.now()}`;
  const userIds: string[] = [];
  const assignmentIds: string[] = [];
  const unitIds: string[] = [];
  let unitA: string;
  let unitB: string;
  let drafter: any;
  let leader: any;
  let rector: any;
  let staff: any;
  let docId: string;

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
    return user;
  }

  const sessionOf = (u: any) => ({ id: u.id, email: u.email, name: u.name, role: u.role }) as any;
  const tokenOf = (u: any) => signSessionToken({ id: u.id, email: u.email, name: u.name, role: u.role });
  const stepViewOf = async (u: any) => {
    const doc = await getDocumentById(docId);
    assert.ok(doc);
    return buildOutgoingStepView(sessionOf(u), doc);
  };
  const patchSummary = async (u: any, summary: string) =>
    patchDocumentRoute(
      new NextRequest(`http://localhost:3000/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${tokenOf(u)}` },
        body: JSON.stringify({ summary }),
      }),
      { params: Promise.resolve({ id: docId }) }
    );

  before(async () => {
    for (const key of ["A", "B"] as const) {
      const unit = await prisma.organizationalUnit.create({
        data: { id: `ou-${key}-${runId}`, code: `${key}_${runId.slice(-6)}`, name: `Đơn vị ${key} ${runId}`, type: UnitType.DEPARTMENT },
      });
      unitIds.push(unit.id);
      if (key === "A") unitA = unit.id;
      else unitB = unit.id;
    }
    drafter = await makeUser("drafter", UserRole.CHUYEN_VIEN, "CHUYEN_VIEN", unitA);
    leader = await makeUser("leader", UserRole.TRUONG_PHONG, "TRUONG_PHONG", unitA);
    staff = await makeUser("staff", UserRole.CHUYEN_VIEN, "CHUYEN_VIEN", unitB);
    rector = await makeUser("rector", UserRole.BAN_GIAM_HIEU, "HIEU_TRUONG", unitB);
    const draft = await OutgoingDocumentService.createOutgoingDraft({ title: `Khóa khi chờ duyệt ${runId}` }, drafter);
    docId = draft.document.id;
  });

  after(async () => {
    try {
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: docId } });
      await prisma.auditEvent.deleteMany({ where: { entityId: docId } });
      await prisma.document.deleteMany({ where: { id: docId } });
      await prisma.positionAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.organizationalUnit.deleteMany({ where: { id: { in: unitIds } } });
    } catch {
      // dọn dẹp không được làm hỏng kết quả test
    }
  });

  it("người soạn thấy danh sách người duyệt: trưởng đơn vị soạn (mặc định) rồi lãnh đạo trường, không có chính mình", async () => {
    const view = await stepViewOf(drafter);
    const reviewers = view!.reviewers;
    // Lãnh đạo trường là toàn trường (CSDL test còn người của các test khác), nên chỉ kiểm thứ tự và thành viên
    assert.equal(reviewers[0].id, leader.id, "trưởng đơn vị soạn đứng đầu");
    assert.deepEqual(reviewers.filter((r) => r.recommended).map((r) => r.id), [leader.id], "chỉ một người mặc định");
    assert.match(reviewers[0].title, /Trưởng phòng/);
    assert.ok(reviewers.some((r) => r.id === rector.id), "lãnh đạo trường chọn được");
    assert.ok(!reviewers.some((r) => r.id === drafter.id), "người soạn không tự duyệt");
    assert.ok(!reviewers.some((r) => r.id === staff.id), "chuyên viên không phải người duyệt");
    assert.deepEqual((await stepViewOf(leader))?.reviewers, [], "người khác không cần danh sách");
  });

  it("trình: người không phải trưởng đơn vị soạn hay lãnh đạo không được chọn; không chọn thì mặc định trưởng đơn vị soạn", async () => {
    await assert.rejects(
      () => OutgoingDocumentService.submitContentReview({ documentId: docId, contentReviewerId: staff.id }, drafter),
      (error: unknown) => error instanceof ValidationError && (error as any).code === "INVALID_CONTENT_REVIEWER"
    );
    assert.equal((await prisma.documentOutgoingWorkflow.findUnique({ where: { documentId: docId } }))?.status, OutgoingDocumentStatus.DRAFT);

    await assert.rejects(
      () => OutgoingDocumentService.submitContentReview({ documentId: docId }, leader),
      (error: unknown) => error instanceof ForbiddenError,
      "trưởng đơn vị không trình thay người soạn"
    );

    await OutgoingDocumentService.submitContentReview({ documentId: docId, notes: "Mời anh xem giúp" }, drafter);
    const workflow = await prisma.documentOutgoingWorkflow.findUnique({ where: { documentId: docId } });
    assert.equal(workflow?.status, OutgoingDocumentStatus.CONTENT_REVIEW);
    assert.equal(workflow?.contentReviewerId, leader.id, "mặc định là trưởng đơn vị soạn");
    assert.equal(workflow?.contentReviewNotes, "Mời anh xem giúp");

    const waiting = (await stepViewOf(drafter))?.waiting;
    assert.deepEqual([waiting?.who, waiting?.task], [leader.name, "duyệt nội dung"]);
  });

  it("đang chờ duyệt: nội dung và tệp đứng yên, canEdit tắt; liên kết nhiệm vụ không bị khóa", async () => {
    assert.equal(isOutgoingUnderReview((await getDocumentById(docId))!), true);
    const blocked = await patchSummary(drafter, `Sửa khi đang chờ ${runId}`);
    assert.equal(blocked.status, 400);
    const body = await blocked.json();
    assert.equal(body.code, "OUTGOING_UNDER_REVIEW");
    assert.match(String(body.detail ?? body.message ?? body.error ?? JSON.stringify(body)), /rút lại/i);
    assert.notEqual((await getDocumentById(docId))?.summary, `Sửa khi đang chờ ${runId}`);

    const attach = await addAttachmentRoute(
      new NextRequest(`http://localhost:3000/api/documents/${docId}/attachments`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${tokenOf(drafter)}` },
        body: JSON.stringify({ fileId: "khong-can-ton-tai" }),
      }),
      { params: Promise.resolve({ id: docId }) }
    );
    assert.equal(attach.status, 400);
    assert.equal((await attach.json()).code, "OUTGOING_UNDER_REVIEW");

    const detail = await getDocumentRoute(
      new NextRequest(`http://localhost:3000/api/documents/${docId}`, { headers: { authorization: `Bearer ${tokenOf(drafter)}` } }),
      { params: Promise.resolve({ id: docId }) }
    );
    assert.equal((await detail.json()).data.canEdit, false);

    assert.equal(patchTouchesLockedContent({ linkedTaskId: "t1" }), false, "gắn nhiệm vụ không đổi bản người duyệt đang xem");
    assert.equal(patchTouchesLockedContent({ linkedTaskId: "t1", summary: "x" }), true);
    assert.equal(patchTouchesLockedContent({ summary: undefined }), false);
  });

  it("rút lại: chỉ người soạn; về Nháp, bỏ người duyệt; sau đó sửa được và người duyệt không duyệt được nữa", async () => {
    assert.deepEqual((await stepViewOf(drafter))?.actions, ["withdraw-content-review"]);
    assert.deepEqual((await stepViewOf(leader))?.actions, ["approve-content", "reject-content"]);
    assert.equal((await stepViewOf(leader))?.waiting, null, "người có việc ở bước không cần dòng chờ");

    await assert.rejects(
      () => OutgoingDocumentService.withdrawContentReview({ documentId: docId }, leader),
      (error: unknown) => error instanceof ForbiddenError,
      "người duyệt không rút lại thay người soạn"
    );

    await OutgoingDocumentService.withdrawContentReview({ documentId: docId }, drafter);
    const workflow = await prisma.documentOutgoingWorkflow.findUnique({ where: { documentId: docId } });
    assert.equal(workflow?.status, OutgoingDocumentStatus.DRAFT);
    assert.equal(workflow?.contentReviewerId, null);
    assert.equal(workflow?.contentReviewNotes, null, "rút lại không phải bị trả lại");
    assert.equal((await stepViewOf(drafter))?.returned, null);

    await assert.rejects(
      () => OutgoingDocumentService.approveContent({ documentId: docId }, leader),
      (error: unknown) => error instanceof InvalidTransitionError,
      "người duyệt bấm chậm sau khi người soạn rút lại"
    );
    assert.equal((await patchSummary(drafter, `Sửa sau khi rút lại ${runId}`)).status, 200);

    const audit = await prisma.auditEvent.findFirst({ where: { entityId: docId, action: "DOCUMENT_CONTENT_REVIEW_WITHDRAWN" } });
    assert.equal(audit?.actorId, drafter.id);
    const outbox = await prisma.outboxEvent.findFirst({ where: { aggregateId: docId, eventType: "DOCUMENT_CONTENT_REVIEW_WITHDRAWN" } });
    assert.ok(outbox, "người duyệt cần được báo bằng sự kiện");
  });

  it("đã duyệt xong thì không rút lại được", async () => {
    await OutgoingDocumentService.submitContentReview({ documentId: docId, contentReviewerId: rector.id }, drafter);
    await OutgoingDocumentService.approveContent({ documentId: docId }, rector);
    await assert.rejects(
      () => OutgoingDocumentService.withdrawContentReview({ documentId: docId }, drafter),
      (error: unknown) => error instanceof InvalidTransitionError
    );
    assert.deepEqual((await stepViewOf(drafter))?.actions, []);
  });
});
