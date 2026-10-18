/**
 * Đặc tả route `GET /api/documents/{id}/returns` (lịch sử trả lại và chuyển lại văn bản đến, V-01).
 *
 * Khóa hành vi hiện tại: xác thực → mã văn bản không rỗng → văn bản phải nằm trong phạm vi đọc
 * (`buildDocumentReadWhere`); ngoài phạm vi hoặc không tồn tại đều là 404 DOCUMENT_NOT_FOUND (RFC 9457).
 * Dữ liệu trả lại được tạo bằng dịch vụ có sẵn (`returnIncomingDocument`, `rerouteIncomingDocument`).
 * Chạy trên qcet_test; dữ liệu do test tự tạo theo runId và được dọn trong after().
 */
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { IncomingDocumentStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { GET as getReturnsRoute } from "@/app/api/documents/[id]/returns/route";
import {
  rerouteIncomingDocument,
  returnIncomingDocument,
} from "@/server/documents/incoming-document-routing-service";
import {
  PROBLEM_JSON,
  bearer,
  createDocumentRouteFixture,
  getRequest,
  routeContext,
  type FixtureUser,
} from "./documents-route-fixtures";

const fx = createDocumentRouteFixture("dret");

let unitA = "";
let unitB = "";
let clerk: FixtureUser;
let headA: FixtureUser;
let headB: FixtureUser;
let memberB: FixtureUser;
let outsider: FixtureUser;
/** Trả lại một lần rồi Văn thư chuyển cho đơn vị B: một bản ghi đã đóng. */
let docRerouted = "";
/** Trả lại (A), chuyển B, B trả lại tiếp: hai bản ghi, bản mới nhất còn mở. */
let docTwice = "";
/** Đang ở đơn vị A, chưa trả lại lần nào. */
let docNoReturn = "";

const session = (user: FixtureUser, role: string, departmentId?: string) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role,
  departmentId,
});

const returnsOf = (user: FixtureUser | null, id: string) =>
  getReturnsRoute(
    getRequest(`/api/documents/${encodeURIComponent(id)}/returns`, user ? bearer(user.token) : {}),
    routeContext(id)
  );

async function assertProblem(res: Response, status: number, code: string) {
  assert.equal(res.status, status);
  assert.equal(res.headers.get("content-type"), PROBLEM_JSON);
  const body = await res.json();
  assert.equal(body.status, status);
  assert.equal(body.code, code);
  assert.equal(body.success, false);
  assert.equal(body.returns, undefined, "lỗi không được kèm lịch sử trả lại");
  return body;
}

describe("GET /api/documents/[id]/returns", () => {
  before(async () => {
    unitA = await fx.unit("A");
    unitB = await fx.unit("B");
    const unitC = await fx.unit("C");
    clerk = await fx.user("clerk", { role: UserRole.VAN_THU });
    headA = await fx.user("headA", { role: UserRole.TRUONG_PHONG, unitId: unitA });
    headB = await fx.user("headB", { role: UserRole.TRUONG_PHONG, unitId: unitB });
    memberB = await fx.user("memberB", { unitId: unitB });
    outsider = await fx.user("outsider", { unitId: unitC });

    const assigned = { registeredById: clerk.id, leadUnitId: unitA, incomingStatus: IncomingDocumentStatus.ASSIGNED_TO_LEAD_UNIT };
    docRerouted = (await fx.document(assigned)).id;
    docTwice = (await fx.document(assigned)).id;
    docNoReturn = (await fx.document(assigned)).id;

    const asHeadA = session(headA, "TRUONG_PHONG", unitA);
    const asHeadB = session(headB, "TRUONG_PHONG", unitB);
    const asClerk = session(clerk, "VAN_THU");

    await returnIncomingDocument(docRerouted, { reason: "Thuộc thẩm quyền đơn vị B" }, asHeadA);
    await rerouteIncomingDocument(docRerouted, { leadUnitId: unitB, note: "Đúng chức năng đơn vị B" }, asClerk);

    await returnIncomingDocument(docTwice, { reason: "Lần trả thứ nhất" }, asHeadA);
    await rerouteIncomingDocument(docTwice, { leadUnitId: unitB }, asClerk);
    await returnIncomingDocument(docTwice, { reason: "Lần trả thứ hai" }, asHeadB);

    // Route chỉ đọc lịch sử; xóa ngay sự kiện outbox của fixture để worker của test khác không gửi thông báo.
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: [docRerouted, docTwice] } } });
  });

  after(async () => {
    await fx.cleanup();
  });

  test("không có thông tin xác thực -> 401 AUTH_REQUIRED (RFC 9457)", async () => {
    const res = await returnsOf(null, docRerouted);
    const body = await assertProblem(res, 401, "AUTH_REQUIRED");
    assert.equal(body.instance, `/api/documents/${docRerouted}/returns`);
  });

  test("mã văn bản rỗng -> 400 VALIDATION_ERROR", async () => {
    const res = await returnsOf(clerk, "   ");
    const body = await assertProblem(res, 400, "VALIDATION_ERROR");
    assert.equal(body.detail, "Mã văn bản (id) không hợp lệ");
  });

  test("văn bản không tồn tại -> 404 DOCUMENT_NOT_FOUND", async () => {
    const res = await returnsOf(clerk, `${fx.runId}_khong_ton_tai`);
    await assertProblem(res, 404, "DOCUMENT_NOT_FOUND");
  });

  test("người ngoài phạm vi đọc -> 404 DOCUMENT_NOT_FOUND (như không tồn tại), người trong phạm vi thấy dữ liệu", async () => {
    const denied = await returnsOf(outsider, docRerouted);
    await assertProblem(denied, 404, "DOCUMENT_NOT_FOUND");

    const allowed = await returnsOf(memberB, docRerouted);
    assert.equal(allowed.status, 200);
    const body = await allowed.json();
    assert.equal(body.returns.length, 1);
  });

  test("thành viên đơn vị đang chủ trì đọc lịch sử: đúng một bản ghi đã đóng, đủ trường, không thừa trường", async () => {
    const res = await returnsOf(memberB, docRerouted);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /application\/json/);
    assert.equal(res.headers.get("cache-control"), "private, no-store");
    assert.ok(res.headers.get("x-request-id"));

    const body = await res.json();
    assert.deepEqual(Object.keys(body), ["returns"]);
    assert.equal(body.returns.length, 1);
    const [row] = body.returns;
    const stored = await prisma.documentUnitReturn.findFirstOrThrow({ where: { documentId: docRerouted } });

    assert.deepEqual(Object.keys(row).sort(), [
      "createdAt",
      "fromUnit",
      "id",
      "reason",
      "rerouteNote",
      "resolvedAt",
      "returnedBy",
      "toUnit",
    ]);
    assert.equal(row.id, stored.id);
    assert.equal(row.fromUnit.id, unitA);
    assert.match(row.fromUnit.name, /Đơn vị kiểm thử A/);
    assert.equal(row.toUnit.id, unitB);
    assert.deepEqual(row.returnedBy, { id: headA.id, name: headA.name });
    assert.equal(row.reason, "Thuộc thẩm quyền đơn vị B");
    assert.equal(row.rerouteNote, "Đúng chức năng đơn vị B");
    assert.equal(row.createdAt, stored.createdAt.toISOString());
    assert.equal(row.resolvedAt, stored.resolvedAt?.toISOString());
    assert.ok(row.resolvedAt, "bản ghi đã được Văn thư chuyển lại phải có thời điểm đóng");
  });

  test("Văn thư (người vào sổ) đọc lịch sử nhiều lần trả lại: mới nhất trước, bản mới nhất còn mở", async () => {
    const res = await returnsOf(clerk, docTwice);
    assert.equal(res.status, 200);
    const { returns } = await res.json();
    assert.deepEqual(
      returns.map((r: { reason: string }) => r.reason),
      ["Lần trả thứ hai", "Lần trả thứ nhất"]
    );
    const [latest, first] = returns;
    assert.equal(latest.fromUnit.id, unitB);
    assert.equal(latest.returnedBy.id, headB.id);
    assert.equal(latest.toUnit, null);
    assert.equal(latest.resolvedAt, null);
    assert.equal(latest.rerouteNote, null);
    assert.equal(first.fromUnit.id, unitA);
    assert.equal(first.toUnit.id, unitB);
    assert.ok(first.resolvedAt);
  });

  test("văn bản trong phạm vi nhưng chưa trả lại lần nào -> 200 với danh sách rỗng", async () => {
    const res = await returnsOf(headA, docNoReturn);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { returns: [] });
  });
});
