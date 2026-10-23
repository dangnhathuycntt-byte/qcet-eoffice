import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { AssignmentStatus, AssignmentType, OutboxStatus, SignatureType, UnitType, UserRole } from "@prisma/client";
import { prisma } from "@qcet/db/prisma";
import { OutgoingDocumentService } from "@/server/documents/outgoing-document-service";
import { runOutboxCycle } from "@/server/outbox/outbox-worker";

/**
 * Thông báo từng bước của văn bản đi (spec Văn bản §8.3, N1): người làm bước kế nhận đúng một thông báo, người vừa thao
 * tác thì không, và sự kiện đã cũ (việc đã rút lại) không báo nữa. Chạy sự kiện qua `runOutboxCycle` như worker thật.
 */
describe("Văn bản đi: thông báo từng bước qua outbox", () => {
  const runId = `onf_${Date.now()}`;
  const userIds: string[] = [];
  const unitIds: string[] = [];
  const assignmentIds: string[] = [];
  const people: Record<string, any> = {};
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

  /**
   * Chạy mọi sự kiện đang chờ của văn bản này như worker thật và kiểm không sự kiện nào kẹt hay lỗi. Danh sách Văn thư/
   * Hiệu trưởng lấy từ cả DB test dùng chung nên file test khác xóa người giữa chừng có thể làm một lần ghi thông báo
   * vi phạm khóa ngoại; worker khi đó giữ sự kiện để thử lại, nên test cũng thử lại (đẩy đồng hồ qua thời gian chờ).
   */
  async function drain() {
    const pending = await prisma.outboxEvent.findMany({
      where: { aggregateId: docId, status: OutboxStatus.PENDING },
      select: { id: true },
    });
    const ids = pending.map((e) => e.id);
    let left: { eventType: string; status: OutboxStatus; lastError: string | null }[] = [];
    for (let pass = 0; pass < 3; pass++) {
      await runOutboxCycle(prisma, { ids, now: new Date(Date.now() + pass * 10 * 60_000) });
      left = await prisma.outboxEvent.findMany({
        where: { id: { in: ids }, status: { not: OutboxStatus.COMPLETED } },
        select: { eventType: true, status: true, lastError: true },
      });
      if (left.length === 0) break;
    }
    assert.deepEqual(left.map((e) => [e.eventType, e.status, e.lastError]), [], "sự kiện phải xử lý xong, không kẹt hay lỗi");
  }

  /** Thông báo của văn bản này gửi cho một người, theo loại. */
  async function noticesOf(key: string) {
    const rows = await prisma.notification.findMany({
      where: { userId: people[key].id, linkHref: { contains: docId } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => r.type);
  }

  before(async () => {
    for (const key of ["A", "B"] as const) {
      const unit = await prisma.organizationalUnit.create({
        data: { id: `ou-${key}-${runId}`, code: `${key}_${runId.slice(-6)}`, name: `Đơn vị ${key} ${runId}`, type: UnitType.DEPARTMENT },
      });
      unitIds.push(unit.id);
    }
    const [unitA, unitB] = unitIds;
    await makeUser("drafter", UserRole.CHUYEN_VIEN, "CHUYEN_VIEN", unitA);
    await makeUser("leader", UserRole.TRUONG_PHONG, "TRUONG_PHONG", unitA);
    await makeUser("clerk", UserRole.VAN_THU, "VAN_THU", unitB);
    await makeUser("rector", UserRole.BAN_GIAM_HIEU, "HIEU_TRUONG", unitB);

    const draft = await OutgoingDocumentService.createOutgoingDraft({ title: `Thông báo bước ${runId}` }, people.drafter);
    docId = draft.document.id;
  });

  after(async () => {
    try {
      await prisma.notification.deleteMany({ where: { linkHref: { contains: docId } } });
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

  it("tạo bản nháp không báo ai", async () => {
    await drain();
    for (const key of Object.keys(people)) assert.deepEqual(await noticesOf(key), [], `${key} không được nhận gì`);
  });

  it("trình duyệt: báo người duyệt (mặc định trưởng đơn vị soạn), không báo người soạn", async () => {
    await OutgoingDocumentService.submitContentReview({ documentId: docId }, people.drafter);
    await drain();
    assert.deepEqual(await noticesOf("leader"), ["outgoing_review_requested"]);
    assert.deepEqual(await noticesOf("drafter"), []);
    assert.deepEqual(await noticesOf("clerk"), []);
  });

  it("rút lại: báo người duyệt đã được trình; sự kiện trình cũ chưa kịp xử lý thì không báo nữa", async () => {
    await OutgoingDocumentService.withdrawContentReview({ documentId: docId }, people.drafter);
    await OutgoingDocumentService.submitContentReview({ documentId: docId }, people.drafter);
    await OutgoingDocumentService.withdrawContentReview({ documentId: docId }, people.drafter);
    await drain();
    const leader = await noticesOf("leader");
    assert.equal(leader.filter((t) => t === "outgoing_review_requested").length, 1, "lần trình đã rút không báo thêm");
    assert.equal(leader.filter((t) => t === "outgoing_review_withdrawn").length, 2, "mỗi lần rút báo người duyệt một lần");
  });

  it("trả lại: báo người soạn kèm lý do, không báo người trả", async () => {
    await OutgoingDocumentService.submitContentReview({ documentId: docId }, people.drafter);
    await OutgoingDocumentService.rejectContent({ documentId: docId, notes: "Thiếu căn cứ pháp lý" }, people.leader);
    const leaderBefore = await noticesOf("leader");
    await drain();
    assert.deepEqual(await noticesOf("drafter"), ["outgoing_returned"]);
    const notice = await prisma.notification.findFirstOrThrow({
      where: { userId: people.drafter.id, linkHref: { contains: docId } },
    });
    assert.match(notice.body, /Thiếu căn cứ pháp lý/);
    assert.deepEqual(await noticesOf("leader"), leaderBefore, "người trả không nhận thông báo cho việc của mình");
  });

  it("duyệt nội dung → Văn thư kiểm thể thức → người ký → Văn thư cấp số, mỗi bước báo đúng người", async () => {
    await OutgoingDocumentService.submitContentReview({ documentId: docId }, people.drafter);
    await OutgoingDocumentService.approveContent({ documentId: docId }, people.leader);
    await drain();
    assert.deepEqual(await noticesOf("clerk"), ["outgoing_format_check"]);
    assert.deepEqual(await noticesOf("rector"), [], "chưa tới lượt ký");

    await OutgoingDocumentService.approveFormat({ documentId: docId }, people.clerk);
    await drain();
    assert.deepEqual(await noticesOf("rector"), ["outgoing_sign_requested"]);
    assert.deepEqual(await noticesOf("clerk"), ["outgoing_format_check"], "người kiểm thể thức không nhận báo cho việc của mình");

    await OutgoingDocumentService.signDocument(
      {
        documentId: docId,
        signatureType: SignatureType.PERSONAL_DIGITAL,
        certificateMetadata: { issuer: "Ban Cơ yếu Chính phủ", serialNumber: `CA-${runId}`, subject: "Hiệu trưởng" },
      },
      people.rector
    );
    await drain();
    assert.deepEqual(await noticesOf("clerk"), ["outgoing_format_check", "outgoing_number_requested"]);
    assert.deepEqual(await noticesOf("rector"), ["outgoing_sign_requested"], "người ký không nhận báo cho việc của mình");
  });
});
