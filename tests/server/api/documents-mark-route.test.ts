/**
 * Đặc tả route `POST /api/documents/{id}/actions/mark` (đánh dấu văn bản cho riêng người dùng).
 *
 * Khóa hành vi hiện tại: CSRF → xác thực → kiểm body (strict) → 404 → quyền đọc theo
 * `canReadDocument` (bộ lọc phân loại) → ghi/xóa `DocumentMark`; lỗi theo RFC 9457.
 * Hiệu ứng lên `GET /api/documents/{id}` (`marked`) được kiểm theo từng người dùng.
 * Chạy trên qcet_test; dữ liệu do test tự tạo theo runId và được dọn trong after().
 */
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { DocumentSecurityLevel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LEGACY_SESSION_COOKIE_NAME } from "@/lib/jwt-session";
import { POST as markRoute } from "@/app/api/documents/[id]/actions/mark/route";
import { GET as getDocumentRoute } from "@/app/api/documents/[id]/route";
import {
  BASE_URL,
  PROBLEM_JSON,
  bearer,
  createDocumentRouteFixture,
  getRequest,
  jsonRequest,
  routeContext,
  type FixtureUser,
} from "./documents-route-fixtures";

const fx = createDocumentRouteFixture("dmark");

let registrar: FixtureUser;
let memberA: FixtureUser;
let outsider: FixtureUser;
let docInternal = "";
let docRestricted = "";
let docSecret = "";

const markPath = (id: string) => `/api/documents/${id}/actions/mark`;
const markAs = (user: FixtureUser, id: string, body: unknown) =>
  markRoute(jsonRequest(markPath(id), { headers: bearer(user.token), body }), routeContext(id));
const findMark = (documentId: string, userId: string) =>
  prisma.documentMark.findUnique({ where: { documentId_userId: { documentId, userId } } });

async function detailMarked(user: FixtureUser, id: string): Promise<{ status: number; data?: boolean; document?: boolean }> {
  const res = await getDocumentRoute(getRequest(`/api/documents/${id}`, bearer(user.token)), routeContext(id));
  const body = await res.json();
  return { status: res.status, data: body.data?.marked, document: body.document?.marked };
}

async function assertProblem(res: Response, status: number, code: string) {
  assert.equal(res.status, status);
  assert.equal(res.headers.get("content-type"), PROBLEM_JSON);
  const body = await res.json();
  assert.equal(body.status, status);
  assert.equal(body.code, code);
  assert.equal(body.success, false);
  assert.equal(body.marked, undefined, "lỗi không được kèm kết quả đánh dấu");
  return body;
}

describe("POST /api/documents/[id]/actions/mark", () => {
  before(async () => {
    const unitA = await fx.unit("A");
    const unitB = await fx.unit("B");
    registrar = await fx.user("registrar", { unitId: unitA });
    memberA = await fx.user("memberA", { unitId: unitA });
    outsider = await fx.user("outsider", { unitId: unitB });

    docInternal = (await fx.document({ registeredById: registrar.id, leadUnitId: unitA })).id;
    // Văn bản giới hạn: thành viên đơn vị không đương nhiên được đọc; người vào sổ (quan hệ trực tiếp) thì được.
    docRestricted = (await fx.document({ registeredById: registrar.id, leadUnitId: unitA, notes: "RESTRICTED" })).id;
    // Văn bản mang dấu mật: mặc định từ chối mọi người trên hệ thống thường (Luật 117/2025/QH15).
    docSecret = (
      await fx.document({ registeredById: registrar.id, leadUnitId: unitA, securityLevel: DocumentSecurityLevel.MAT })
    ).id;
  });

  after(async () => {
    await fx.cleanup();
  });

  describe("xác thực và CSRF", () => {
    test("không có thông tin xác thực -> 401 AUTH_REQUIRED (RFC 9457), không ghi gì", async () => {
      const res = await markRoute(jsonRequest(markPath(docInternal), { body: { marked: true } }), routeContext(docInternal));
      const body = await assertProblem(res, 401, "AUTH_REQUIRED");
      assert.equal(body.instance, markPath(docInternal));
      assert.equal(await prisma.documentMark.count({ where: { documentId: docInternal } }), 0);
    });

    test("cookie phiên nhưng thiếu Origin/Referer -> 403 CSRF_VALIDATION_FAILED, không tạo đánh dấu", async () => {
      const res = await markRoute(
        jsonRequest(markPath(docInternal), {
          headers: { Cookie: `${LEGACY_SESSION_COOKIE_NAME}=${memberA.token}` },
          body: { marked: true },
        }),
        routeContext(docInternal)
      );
      await assertProblem(res, 403, "CSRF_VALIDATION_FAILED");
      assert.equal(await findMark(docInternal, memberA.id), null);
    });

    test("cookie phiên kèm Origin cùng nguồn -> 200 (cùng người dùng, cùng văn bản)", async () => {
      const res = await markRoute(
        jsonRequest(markPath(docInternal), {
          headers: { Cookie: `${LEGACY_SESSION_COOKIE_NAME}=${memberA.token}`, Origin: BASE_URL },
          body: { marked: true },
        }),
        routeContext(docInternal)
      );
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { marked: true });
      assert.ok(await findMark(docInternal, memberA.id));
      await prisma.documentMark.deleteMany({ where: { documentId: docInternal, userId: memberA.id } });
    });
  });

  describe("kiểm body", () => {
    const invalidBodies: Array<[string, unknown]> = [
      ["marked không phải boolean", { marked: "yes" }],
      ["thiếu marked", {}],
      ["có trường lạ (strict)", { marked: true, extra: 1 }],
    ];
    for (const [label, body] of invalidBodies) {
      test(`${label} -> 400 VALIDATION_ERROR, không tạo đánh dấu`, async () => {
        const res = await markAs(memberA, docInternal, body);
        const problem = await assertProblem(res, 400, "VALIDATION_ERROR");
        assert.ok(Array.isArray(problem.invalidParams) && problem.invalidParams.length > 0);
        assert.equal(await findMark(docInternal, memberA.id), null);
      });
    }

    test("body rỗng hoặc JSON hỏng -> 400 VALIDATION_ERROR", async () => {
      for (const rawBody of ["", "{marked:"]) {
        const res = await markRoute(
          jsonRequest(markPath(docInternal), { headers: bearer(memberA.token), rawBody }),
          routeContext(docInternal)
        );
        const problem = await assertProblem(res, 400, "VALIDATION_ERROR");
        assert.equal(problem.detail, "Invalid JSON body");
      }
      assert.equal(await findMark(docInternal, memberA.id), null);
    });

    test("Content-Type không phải JSON -> 415 UNSUPPORTED_MEDIA_TYPE", async () => {
      const res = await markRoute(
        jsonRequest(markPath(docInternal), {
          headers: bearer(memberA.token),
          contentType: "text/plain",
          rawBody: JSON.stringify({ marked: true }),
        }),
        routeContext(docInternal)
      );
      await assertProblem(res, 415, "UNSUPPORTED_MEDIA_TYPE");
      assert.equal(await findMark(docInternal, memberA.id), null);
    });
  });

  describe("tồn tại và quyền đọc", () => {
    test("văn bản không tồn tại -> 404 DOCUMENT_NOT_FOUND", async () => {
      const missingId = `${fx.runId}_khong_ton_tai`;
      const res = await markAs(registrar, missingId, { marked: true });
      await assertProblem(res, 404, "DOCUMENT_NOT_FOUND");
      assert.equal(await prisma.documentMark.count({ where: { documentId: missingId } }), 0);
    });

    test("người ngoài đơn vị chủ trì, không liên quan -> 403 FORBIDDEN, không tạo đánh dấu", async () => {
      const res = await markAs(outsider, docInternal, { marked: true });
      const problem = await assertProblem(res, 403, "FORBIDDEN");
      assert.equal(problem.detail, "Bạn không có quyền truy cập văn bản này");
      assert.equal(await findMark(docInternal, outsider.id), null);
    });

    test("văn bản giới hạn: thành viên đơn vị bị 403, người vào sổ đánh dấu được", async () => {
      const denied = await markAs(memberA, docRestricted, { marked: true });
      await assertProblem(denied, 403, "FORBIDDEN");
      assert.equal(await findMark(docRestricted, memberA.id), null);

      const allowed = await markAs(registrar, docRestricted, { marked: true });
      assert.equal(allowed.status, 200);
      assert.deepEqual(await allowed.json(), { marked: true });
      assert.ok(await findMark(docRestricted, registrar.id));
    });

    test("văn bản mang dấu mật: cả người vào sổ cũng bị 403", async () => {
      const res = await markAs(registrar, docSecret, { marked: true });
      await assertProblem(res, 403, "FORBIDDEN");
      assert.equal(await findMark(docSecret, registrar.id), null);
    });
  });

  describe("đánh dấu, bỏ đánh dấu và hiệu ứng lên chi tiết văn bản", () => {
    test("thành viên đơn vị đánh dấu -> 200 {marked:true}; chi tiết hiện marked=true chỉ với người đó", async () => {
      assert.deepEqual(await detailMarked(memberA, docInternal), { status: 200, data: false, document: false });

      const res = await markAs(memberA, docInternal, { marked: true });
      assert.equal(res.status, 200);
      assert.match(res.headers.get("content-type") ?? "", /application\/json/);
      assert.ok(res.headers.get("x-request-id"));
      assert.deepEqual(await res.json(), { marked: true });

      const row = await findMark(docInternal, memberA.id);
      assert.ok(row);
      assert.equal(row.userId, memberA.id);
      assert.deepEqual(await detailMarked(memberA, docInternal), { status: 200, data: true, document: true });
      assert.deepEqual(await detailMarked(registrar, docInternal), { status: 200, data: false, document: false });
    });

    test("đánh dấu lại là idempotent: vẫn 200 và chỉ một bản ghi", async () => {
      const res = await markAs(memberA, docInternal, { marked: true });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { marked: true });
      assert.equal(await prisma.documentMark.count({ where: { documentId: docInternal, userId: memberA.id } }), 1);
    });

    test("bỏ đánh dấu -> 200 {marked:false}, xóa bản ghi, chi tiết hiện marked=false; bỏ lần nữa vẫn 200", async () => {
      const res = await markAs(memberA, docInternal, { marked: false });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { marked: false });
      assert.equal(await findMark(docInternal, memberA.id), null);
      assert.deepEqual(await detailMarked(memberA, docInternal), { status: 200, data: false, document: false });

      const again = await markAs(memberA, docInternal, { marked: false });
      assert.equal(again.status, 200);
      assert.deepEqual(await again.json(), { marked: false });
    });

    test("người vào sổ đánh dấu không ảnh hưởng đánh dấu của người khác", async () => {
      const res = await markAs(registrar, docInternal, { marked: true });
      assert.equal(res.status, 200);
      assert.ok(await findMark(docInternal, registrar.id));
      assert.equal(await findMark(docInternal, memberA.id), null);
      assert.deepEqual(await detailMarked(registrar, docInternal), { status: 200, data: true, document: true });
      assert.equal((await detailMarked(memberA, docInternal)).data, false);
    });
  });
});

