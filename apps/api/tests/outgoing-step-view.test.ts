import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { AssignmentStatus, AssignmentType, OutgoingDocumentStatus, UnitType, UserRole } from "@prisma/client";
import { prisma } from "@qcet/db/prisma";
import { OutgoingDocumentService } from "@/server/documents/outgoing-document-service";
import { buildOutgoingStepView } from "@/server/documents/outgoing-step-view";
import { getDocumentById } from "@/server/documents/document-service";

/**
 * Ma trận vai trò × trạng thái của `outgoingStep` (spec Văn bản Q3, Q9): nút chỉ hiện cho người server sẽ chấp nhận,
 * người khác thấy "Đang chờ …". Chạy trên CSDL test thật, đặt trạng thái bằng cập nhật workflow.
 */
describe("Văn bản đi: thao tác theo người xem (outgoingStep)", () => {
  const runId = `osv_${Date.now()}`;
  const userIds: string[] = [];
  const unitIds: string[] = [];
  const assignmentIds: string[] = [];
  const docIds: string[] = [];

  let unitA: string;
  let unitB: string;
  let docId: string;
  const people: Record<string, any> = {};

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

  const view = async (key: string) => {
    const doc = await getDocumentById(docId);
    assert.ok(doc);
    const { id, email, name, role } = people[key];
    return buildOutgoingStepView({ id, email, name, role } as any, doc);
  };
  const actionsOf = async (key: string) => (await view(key))?.actions ?? [];
  const setWorkflow = (data: Record<string, unknown>) =>
    prisma.documentOutgoingWorkflow.update({ where: { documentId: docId }, data: data as any });

  before(async () => {
    for (const key of ["A", "B"] as const) {
      const unit = await prisma.organizationalUnit.create({
        data: { id: `ou-${key}-${runId}`, code: `${key}_${runId.slice(-6)}`, name: `Đơn vị ${key} ${runId}`, type: UnitType.DEPARTMENT },
      });
      unitIds.push(unit.id);
      if (key === "A") unitA = unit.id;
      else unitB = unit.id;
    }
    await makeUser("drafter", UserRole.CHUYEN_VIEN, "CHUYEN_VIEN", unitA);
    await makeUser("leaderA", UserRole.TRUONG_PHONG, "TRUONG_PHONG", unitA);
    await makeUser("leaderB", UserRole.TRUONG_PHONG, "TRUONG_PHONG", unitB);
    await makeUser("clerk", UserRole.VAN_THU, "VAN_THU", unitB);
    await makeUser("rector", UserRole.BAN_GIAM_HIEU, "HIEU_TRUONG", unitB);

    const draft = await OutgoingDocumentService.createOutgoingDraft({ title: `Ma trận bước ${runId}` }, people.drafter);
    docId = draft.document.id;
    docIds.push(docId);
  });

  after(async () => {
    try {
      for (const id of docIds) {
        await prisma.outboxEvent.deleteMany({ where: { aggregateId: id } });
        await prisma.auditEvent.deleteMany({ where: { entityId: id } });
        await prisma.document.deleteMany({ where: { id } });
      }
      await prisma.positionAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.organizationalUnit.deleteMany({ where: { id: { in: unitIds } } });
    } catch {
      // dọn dẹp không được làm hỏng kết quả test
    }
  });

  it("DRAFT: chỉ người soạn thấy nút Trình; trưởng đơn vị không trình thay; không ai phải chờ", async () => {
    assert.deepEqual(await actionsOf("drafter"), ["submit-content-review"]);
    assert.deepEqual(await actionsOf("leaderA"), []);
    assert.deepEqual(await actionsOf("clerk"), []);
    assert.equal((await view("drafter"))?.waiting, null);
  });

  it("CONTENT_REVIEW: trưởng đơn vị soạn duyệt/trả; người soạn và trưởng đơn vị khác không; ai cũng thấy đang chờ ai", async () => {
    await setWorkflow({ status: OutgoingDocumentStatus.CONTENT_REVIEW, contentReviewSubmittedAt: new Date() });
    assert.deepEqual(await actionsOf("leaderA"), ["approve-content", "reject-content"]);
    assert.deepEqual(await actionsOf("drafter"), [], "người soạn không tự duyệt (SoD)");
    assert.deepEqual(await actionsOf("leaderB"), [], "trưởng đơn vị khác không duyệt dự thảo không phải của mình");
    assert.deepEqual(await actionsOf("clerk"), []);
    const waiting = (await view("drafter"))?.waiting;
    assert.equal(waiting?.task, "duyệt nội dung");
    assert.equal(waiting?.who, "Trưởng đơn vị", "chưa chỉ định người duyệt thì nêu vai trò");
    assert.ok(waiting?.since);

    await setWorkflow({ contentReviewerId: people.leaderB.id });
    assert.deepEqual(await actionsOf("leaderB"), ["approve-content", "reject-content"], "người được trình duyệt được duyệt");
    assert.equal((await view("drafter"))?.waiting?.who, people.leaderB.name, "nêu tên người được trình duyệt");
  });

  it("FORMAT_CHECK: chỉ Văn thư kiểm thể thức", async () => {
    await setWorkflow({ status: OutgoingDocumentStatus.FORMAT_CHECK, formatReviewSubmittedAt: new Date() });
    assert.deepEqual(await actionsOf("clerk"), ["approve-format"]);
    assert.deepEqual(await actionsOf("leaderA"), []);
    assert.deepEqual(await actionsOf("drafter"), []);
    const waiting = (await view("leaderA"))?.waiting;
    assert.deepEqual([waiting?.who, waiting?.task], ["Văn thư", "kiểm tra thể thức"]);
  });

  it("AUTHORIZED_SIGN chưa ký: chỉ lãnh đạo thấy Ký, không ai thấy Cấp số; người kiểm thể thức không tự ký", async () => {
    await setWorkflow({ status: OutgoingDocumentStatus.AUTHORIZED_SIGN, formatApprovedAt: new Date(), formatReviewerId: people.clerk.id });
    assert.deepEqual(await actionsOf("rector"), ["sign"]);
    assert.deepEqual(await actionsOf("clerk"), [], "Văn thư không ký, không cấp số trước khi có chữ ký");
    assert.deepEqual(await actionsOf("leaderA"), []);
    const waiting = (await view("clerk"))?.waiting;
    assert.deepEqual([waiting?.who, waiting?.task], ["Lãnh đạo", "ký"]);
  });

  it("AUTHORIZED_SIGN đã ký: chỉ Văn thư thấy Cấp số, người ký không còn nút Ký", async () => {
    await setWorkflow({ authorizedSignedAt: new Date(), authorizedSignerId: people.rector.id });
    assert.deepEqual(await actionsOf("clerk"), ["assign-number"]);
    assert.deepEqual(await actionsOf("rector"), [], "người ký không ký lại, không tự cấp số");
    const waiting = (await view("rector"))?.waiting;
    assert.deepEqual([waiting?.who, waiting?.task], ["Văn thư", "cấp số"]);
  });

  it("NUMBERED: chỉ Văn thư đóng dấu; ORGANIZATION_SIGNED không còn nút bước, chờ phát hành", async () => {
    await setWorkflow({ status: OutgoingDocumentStatus.NUMBERED, numberedAt: new Date(), outgoingNumber: 1, outgoingNumberStr: "1/TEST" });
    assert.deepEqual(await actionsOf("clerk"), ["organization-sign"]);
    assert.deepEqual(await actionsOf("rector"), [], "người ký không tự đóng dấu");
    assert.equal((await view("drafter"))?.waiting?.task, "đóng dấu cơ quan");

    await setWorkflow({ status: OutgoingDocumentStatus.ORGANIZATION_SIGNED, orgSignedAt: new Date() });
    assert.deepEqual(await actionsOf("clerk"), []);
    assert.equal((await view("drafter"))?.waiting?.task, "phát hành");
  });

  it("Bước đã qua không còn chờ ai (ISSUED)", async () => {
    await setWorkflow({ status: OutgoingDocumentStatus.ISSUED, issuedAt: new Date() });
    const result = await view("clerk");
    assert.deepEqual(result, { actions: [], waiting: null });
  });
});
