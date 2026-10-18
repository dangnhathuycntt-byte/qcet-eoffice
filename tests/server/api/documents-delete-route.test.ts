/**
 * Đặc tả các nhánh chưa có test của `DELETE /api/documents/{id}`.
 *
 * Đã có ở nơi khác (không lặp lại): 401 (document-routes.test.ts), người ngoài đơn vị 403 và quản trị
 * xóa văn bản do mình tạo (document-routes.test.ts), văn bản đã ký bất biến (document-v2-workflow.test.ts).
 * Ở đây khóa: 404, CSRF, người đọc được nhưng không có quyền xóa (thành viên đơn vị, Văn thư, quản trị
 * kỹ thuật), văn bản hoàn thành theo trạng thái, xóa thành công bởi người vào sổ và trưởng đơn vị chủ trì,
 * phạm vi xóa dây chuyền (tệp, bút phê, đánh dấu, workflow, lịch sử trả lại) và việc route không chặn văn bản
 * đã được đánh dấu hoặc đã liên kết nhiệm vụ (nhiệm vụ vẫn còn). Lỗi theo định dạng cũ (`legacyCompat`).
 * Chạy trên qcet_test; dữ liệu do test tự tạo theo runId và được dọn trong after().
 */
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { DocumentStatus, UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@qcet/db/prisma";
import { LEGACY_SESSION_COOKIE_NAME } from "@/lib/jwt-session";
import { DELETE as deleteDocumentRoute, GET as getDocumentRoute } from "@/app/api/documents/[id]/route";
import {
  BASE_URL,
  DAY_MS,
  bearer,
  createDocumentRouteFixture,
  getRequest,
  routeContext,
  type FixtureUser,
} from "./documents-route-fixtures";

const fx = createDocumentRouteFixture("ddel");

let unitA = "";
let registrar: FixtureUser;
let memberA: FixtureUser;
let headA: FixtureUser;
let clerk: FixtureUser;
let admin: FixtureUser;

const deleteRequest = (id: string, headers: Record<string, string>) =>
  new NextRequest(`${BASE_URL}/api/documents/${id}`, { method: "DELETE", headers });
const deleteAs = (user: FixtureUser, id: string) => deleteDocumentRoute(deleteRequest(id, bearer(user.token)), routeContext(id));
const documentExists = async (id: string) => (await prisma.document.findUnique({ where: { id }, select: { id: true } })) !== null;
const newDocument = async (overrides: { status?: DocumentStatus } = {}) =>
  (await fx.document({ registeredById: registrar.id, leadUnitId: unitA, ...overrides })).id;

async function assertLegacyError(res: Response, status: number, code: string) {
  assert.equal(res.status, status);
  assert.equal(res.headers.get("cache-control"), "private, no-store");
  assert.match(res.headers.get("content-type") ?? "", /^application\/json/);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.code, code);
  assert.equal(body.message, body.error);
  assert.deepEqual(body.errors, [body.message]);
  assert.ok(body.requestId);
  return body;
}

describe("DELETE /api/documents/[id] — các nhánh chưa có test", () => {
  before(async () => {
    unitA = await fx.unit("A");
    const unitClerk = await fx.unit("HC");
    registrar = await fx.user("registrar", { unitId: unitA });
    memberA = await fx.user("memberA", { unitId: unitA });
    headA = await fx.user("headA", { role: UserRole.TRUONG_PHONG, unitId: unitA });
    clerk = await fx.user("clerk", { role: UserRole.VAN_THU, unitId: unitClerk });
    admin = await fx.user("admin", { role: UserRole.ADMIN });
  });

  after(async () => {
    await fx.cleanup();
  });

  test("văn bản không tồn tại -> 404 DOCUMENT_NOT_FOUND", async () => {
    const res = await deleteAs(registrar, `${fx.runId}_khong_ton_tai`);
    const body = await assertLegacyError(res, 404, "DOCUMENT_NOT_FOUND");
    assert.equal(body.message, "Văn bản không tồn tại");
  });

  test("cookie phiên nhưng thiếu Origin/Referer -> 403 CSRF_VALIDATION_FAILED, văn bản còn nguyên", async () => {
    const id = await newDocument();
    const res = await deleteDocumentRoute(
      deleteRequest(id, { Cookie: `${LEGACY_SESSION_COOKIE_NAME}=${registrar.token}` }),
      routeContext(id)
    );
    await assertLegacyError(res, 403, "CSRF_VALIDATION_FAILED");
    assert.equal(await documentExists(id), true);
  });

  test("cookie phiên kèm Origin cùng nguồn -> 200, văn bản bị xóa", async () => {
    const id = await newDocument();
    const res = await deleteDocumentRoute(
      deleteRequest(id, { Cookie: `${LEGACY_SESSION_COOKIE_NAME}=${registrar.token}`, Origin: BASE_URL }),
      routeContext(id)
    );
    assert.equal(res.status, 200);
    assert.equal(await documentExists(id), false);
  });

  describe("đọc được nhưng không có quyền xóa -> 403 FORBIDDEN, văn bản còn nguyên", () => {
    test("thành viên đơn vị chủ trì (không phải người vào sổ, không phải trưởng đơn vị)", async () => {
      const id = await newDocument();
      const detail = await getDocumentRoute(getRequest(`/api/documents/${id}`, bearer(memberA.token)), routeContext(id));
      assert.equal(detail.status, 200, "thành viên đơn vị đọc được văn bản");

      await assertLegacyError(await deleteAs(memberA, id), 403, "FORBIDDEN");
      assert.equal(await documentExists(id), true);
    });

    test("Văn thư: sửa được (canEdit) nhưng không xóa được", async () => {
      const id = await newDocument();
      const detail = await getDocumentRoute(getRequest(`/api/documents/${id}`, bearer(clerk.token)), routeContext(id));
      assert.equal(detail.status, 200);
      assert.equal((await detail.json()).data.canEdit, true);

      await assertLegacyError(await deleteAs(clerk, id), 403, "FORBIDDEN");
      assert.equal(await documentExists(id), true);
    });

    test("quản trị kỹ thuật không liên quan văn bản nội bộ", async () => {
      const id = await newDocument();
      await assertLegacyError(await deleteAs(admin, id), 403, "FORBIDDEN");
      assert.equal(await documentExists(id), true);
    });
  });

  test("văn bản đã hoàn thành theo trạng thái -> 400 IMMUTABLE_DOCUMENT, kể cả người vào sổ", async () => {
    const id = await newDocument({ status: DocumentStatus.DA_HOAN_THANH });
    await assertLegacyError(await deleteAs(registrar, id), 400, "IMMUTABLE_DOCUMENT");
    assert.equal(await documentExists(id), true);
  });

  test("người vào sổ xóa văn bản đã đánh dấu, có tệp, bút phê, lịch sử trả lại và nhiệm vụ liên kết -> 200, xóa dây chuyền, nhiệm vụ còn", async () => {
    const id = await newDocument();
    const task = await prisma.task.create({
      data: {
        code: `${fx.runId}_nv`,
        title: `Nhiệm vụ liên kết ${fx.runId}`,
        createdById: registrar.id,
        leadUnitId: unitA,
        academicMonth: 10,
        academicYear: "2026-2027",
        dueDate: new Date(Date.now() + 7 * DAY_MS),
      },
    });
    fx.trackTask(task.id);
    await prisma.document.update({ where: { id }, data: { linkedTaskId: task.id } });
    const attachment = await prisma.documentAttachment.create({
      data: { documentId: id, fileName: "kiem-thu.pdf", fileUrl: `documents/${fx.runId}/kiem-thu.pdf`, fileSize: 40, mimeType: "application/pdf" },
    });
    await prisma.documentDirective.create({ data: { documentId: id, leaderId: headA.id, instruction: "Giao đơn vị A xử lý" } });
    await prisma.documentMark.create({ data: { documentId: id, userId: memberA.id } });
    await prisma.documentUnitReturn.create({
      data: { documentId: id, fromUnitId: unitA, returnedById: headA.id, reason: "Chuyển nhầm", resolvedAt: new Date() },
    });

    const res = await deleteAs(registrar, id);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await res.json(), { success: true, message: "Đã xóa văn bản thành công" });

    assert.equal(await documentExists(id), false);
    assert.equal(await prisma.documentAttachment.count({ where: { id: attachment.id } }), 0);
    assert.equal(await prisma.documentDirective.count({ where: { documentId: id } }), 0);
    assert.equal(await prisma.documentMark.count({ where: { documentId: id } }), 0);
    assert.equal(await prisma.documentIncomingWorkflow.count({ where: { documentId: id } }), 0);
    assert.equal(await prisma.documentUnitReturn.count({ where: { documentId: id } }), 0);
    assert.ok(await prisma.task.findUnique({ where: { id: task.id }, select: { id: true } }), "nhiệm vụ liên kết không bị xóa");

    const detail = await getDocumentRoute(getRequest(`/api/documents/${id}`, bearer(registrar.token)), routeContext(id));
    assert.equal(detail.status, 404);

    const again = await deleteAs(registrar, id);
    await assertLegacyError(again, 404, "DOCUMENT_NOT_FOUND");
  });

  test("trưởng đơn vị chủ trì xóa văn bản do người khác vào sổ -> 200", async () => {
    const id = await newDocument();
    const res = await deleteAs(headA, id);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).success, true);
    assert.equal(await documentExists(id), false);
  });
});
