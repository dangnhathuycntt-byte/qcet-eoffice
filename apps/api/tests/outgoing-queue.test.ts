import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { AssignmentStatus, AssignmentType, OutgoingDocumentStatus, UnitType, UserRole } from "@prisma/client";
import { prisma } from "@qcet/db/prisma";
import { OutgoingDocumentService } from "@/server/documents/outgoing-document-service";
import { buildOutgoingStepView } from "@/server/documents/outgoing-step-view";
import { buildDocumentBucketWhere } from "@/server/documents/document-bucket-where";
import { outgoingQueueViewerOf } from "@/server/documents/outgoing-queue";
import { countOutgoingAwaitingViewer, getDocumentById } from "@/server/documents/document-service";
import { loadFreshAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { authorize } from "@/server/authorization/hybrid-authorization";
import { resolveUserContext } from "@/server/documents/incoming-document-service";

/**
 * Hàng đợi văn bản đi theo người xem (spec Văn bản §8.2, S3): "Chờ xử lý" là việc của chính người xem, "Đã xử lý" là
 * văn bản người xem đã làm bước và đang ở người khác. Ràng buộc chính: mọi văn bản trong "Chờ xử lý" của một người
 * phải là văn bản người đó bấm được ở chi tiết (cùng nguồn sự thật với `outgoingStep`), trừ bản nháp của chính mình.
 */
describe("Văn bản đi: hàng đợi Chờ xử lý / Đã xử lý theo người xem", () => {
  const runId = `oqu_${Date.now()}`;
  const userIds: string[] = [];
  const unitIds: string[] = [];
  const assignmentIds: string[] = [];
  const people: Record<string, any> = {};
  let unitA: string;
  let unitB: string;
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
    people[key] = user;
  }

  const setWorkflow = (data: Record<string, unknown>) =>
    prisma.documentOutgoingWorkflow.update({ where: { documentId: docId }, data: data as any });

  async function inBucket(key: string, bucket: "pending" | "done") {
    const ctx = await loadFreshAuthorizationContext(people[key].id);
    const where = buildDocumentBucketWhere("VAN_BAN_DI", bucket, undefined, outgoingQueueViewerOf(ctx));
    assert.ok(where);
    return (await prisma.document.count({ where: { AND: [{ id: docId }, where] } })) === 1;
  }
  const keys = () => Object.keys(people);
  const queues = async (bucket: "pending" | "done") => {
    const hits: string[] = [];
    for (const key of keys()) if (await inBucket(key, bucket)) hits.push(key);
    return hits.sort();
  };
  /** Người xem bấm được bước nào đó ở chi tiết (không kể Rút lại, vốn không phải việc chờ). */
  async function hasStepWork(key: string) {
    const doc = await getDocumentById(docId);
    assert.ok(doc);
    const { id, email, name, role } = people[key];
    const view = await buildOutgoingStepView({ id, email, name, role } as any, doc);
    return (view?.actions ?? []).some((a) => a !== "withdraw-content-review");
  }
  /** Phát hành làm ở khối nơi nhận (không phải bước của `outgoingStep`) nên kiểm quyền phát hành. */
  async function canIssue(key: string) {
    const user = await resolveUserContext(people[key]);
    return (await authorize(user, "document.outgoing.issue", { id: docId, type: "document", scope: "school" })).allowed;
  }
  /** Mọi người trong hàng đợi phải bấm được, trừ người soạn với bản nháp của mình. */
  async function assertQueueIsActionable() {
    const doc = await prisma.document.findUniqueOrThrow({ where: { id: docId }, include: { outgoingWorkflow: true } });
    const status = doc.outgoingWorkflow?.status;
    for (const key of await queues("pending")) {
      if (status === OutgoingDocumentStatus.DRAFT && doc.registeredById === people[key].id) continue;
      const actionable =
        status === OutgoingDocumentStatus.ORGANIZATION_SIGNED ? await canIssue(key) : await hasStepWork(key);
      assert.ok(actionable, `${key} có văn bản trong Chờ xử lý nhưng không làm được gì ở chi tiết (${status})`);
    }
  }

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

    const draft = await OutgoingDocumentService.createOutgoingDraft({ title: `Hàng đợi ${runId}` }, people.drafter);
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

  it("Nháp: chỉ người soạn có việc; lãnh đạo và trưởng đơn vị không thấy nháp của người khác", async () => {
    assert.deepEqual(await queues("pending"), ["drafter"]);
    assert.deepEqual(await queues("done"), []);
    await assertQueueIsActionable();
  });

  it("Chấm báo việc ở sidebar: nháp thường của mình không tính, bản bị trả lại và việc tới lượt thì tính", async () => {
    // Người soạn và trưởng đơn vị A chỉ có văn bản này nên số đếm toàn cục của họ xác định được.
    const countFor = async (key: string) => countOutgoingAwaitingViewer(await loadFreshAuthorizationContext(people[key].id));
    assert.equal(await countFor("drafter"), 0, "nháp thường nằm trong Chờ xử lý nhưng không đáng một chấm");
    await setWorkflow({ contentReviewNotes: "[Trả lại]: Thiếu căn cứ" });
    assert.equal(await countFor("drafter"), 1, "bản bị trả lại cần sửa");
    await setWorkflow({ contentReviewNotes: null, status: OutgoingDocumentStatus.CONTENT_REVIEW, contentReviewerId: people.leaderA.id, draftingUnitId: unitA });
    assert.equal(await countFor("drafter"), 0);
    assert.equal(await countFor("leaderA"), 1, "việc tới lượt người duyệt");
    await setWorkflow({ status: OutgoingDocumentStatus.DRAFT });
  });

  it("Chờ duyệt nội dung: việc của người được trình; người soạn chuyển sang Đã xử lý; Hiệu trưởng không có việc nếu không được trình", async () => {
    await setWorkflow({ status: OutgoingDocumentStatus.CONTENT_REVIEW, contentReviewerId: people.leaderA.id, draftingUnitId: unitA });
    assert.deepEqual(await queues("pending"), ["leaderA"]);
    assert.deepEqual(await queues("done"), ["drafter"], "người soạn đã làm xong phần mình; người duyệt còn việc nên chưa vào Đã xử lý");
    await assertQueueIsActionable();
  });

  it("Dự thảo cũ chưa có người được trình: trưởng đơn vị soạn có việc, trưởng đơn vị khác thì không", async () => {
    await setWorkflow({ contentReviewerId: null });
    assert.deepEqual(await queues("pending"), ["leaderA"]);
    await assertQueueIsActionable();
    await setWorkflow({ contentReviewerId: people.leaderA.id });
  });

  it("Chờ kiểm thể thức: việc của Văn thư; người soạn và người duyệt nội dung sang Đã xử lý", async () => {
    await setWorkflow({ status: OutgoingDocumentStatus.FORMAT_CHECK, formatReviewSubmittedAt: new Date() });
    assert.deepEqual(await queues("pending"), ["clerk"]);
    assert.deepEqual(await queues("done"), ["drafter", "leaderA"]);
    await assertQueueIsActionable();
  });

  it("Chờ ký: việc của Hiệu trưởng; người ký được chỉ định thì chỉ người đó; người kiểm thể thức sang Đã xử lý", async () => {
    await setWorkflow({ status: OutgoingDocumentStatus.AUTHORIZED_SIGN, formatApprovedAt: new Date(), formatReviewerId: people.clerk.id });
    assert.deepEqual(await queues("pending"), ["rector"]);
    assert.deepEqual(await queues("done"), ["clerk", "drafter", "leaderA"]);
    await assertQueueIsActionable();

    await setWorkflow({ authorizedSignerId: people.leaderB.id });
    assert.deepEqual(await queues("pending"), ["leaderB"], "đã chỉ định người ký thì Hiệu trưởng không có việc trong hàng đợi");
    await setWorkflow({ authorizedSignerId: null });
  });

  it("Đã ký: việc của Văn thư (cấp số); người ký sang Đã xử lý và không tự cấp số", async () => {
    await setWorkflow({ authorizedSignedAt: new Date(), authorizedSignerId: people.rector.id });
    assert.deepEqual(await queues("pending"), ["clerk"]);
    assert.ok((await queues("done")).includes("rector"));
    await assertQueueIsActionable();
  });

  it("Đã cấp số rồi đã đóng dấu: vẫn việc của Văn thư (đóng dấu, phát hành), không rời Chờ xử lý", async () => {
    await setWorkflow({ status: OutgoingDocumentStatus.NUMBERED, numberedAt: new Date(), numbererId: people.clerk.id });
    assert.deepEqual(await queues("pending"), ["clerk"]);
    await assertQueueIsActionable();
    await setWorkflow({ status: OutgoingDocumentStatus.ORGANIZATION_SIGNED, orgSignedAt: new Date(), orgSignerId: people.clerk.id });
    assert.deepEqual(await queues("pending"), ["clerk"]);
    await assertQueueIsActionable();
  });

  it("Văn thư đồng thời là người ký thì không có việc cấp số, đóng dấu của chính văn bản đó (phân tách nhiệm vụ)", async () => {
    await setWorkflow({ status: OutgoingDocumentStatus.NUMBERED, authorizedSignerId: people.clerk.id });
    assert.deepEqual(await queues("pending"), []);
    await assertQueueIsActionable();
  });

  it("Đã phát hành: không còn trong Chờ xử lý lẫn Đã xử lý của ai", async () => {
    await setWorkflow({ status: OutgoingDocumentStatus.ISSUED, issuedAt: new Date() });
    assert.deepEqual(await queues("pending"), []);
    assert.deepEqual(await queues("done"), []);
  });

  it("Báo cáo vẫn tính theo trạng thái cho cả trường khi không truyền người xem", () => {
    const where = buildDocumentBucketWhere("VAN_BAN_DI", "pending");
    assert.ok(JSON.stringify(where).includes("CONTENT_REVIEW"));
    assert.ok(!JSON.stringify(where).includes("registeredById"));
  });
});
