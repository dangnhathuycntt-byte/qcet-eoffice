/**
 * Đặc tả tham số phân trang của `GET /api/documents/outgoing` (limit/offset).
 *
 * Mặc định limit=50/offset=0, phân trang theo thứ tự tạo workflow mới nhất trước, tham số rỗng, offset vượt
 * tổng, tổng số và danh sách chỉ trong phạm vi đọc (không có văn bản tuyệt mật, không có văn bản của người
 * khác). limit ngoài 1..100, offset âm hoặc giá trị không phải số nguyên trả 400 như GET /api/documents
 * (trước đây vào thẳng Prisma: 500 hoặc phân trang sai). Lỗi theo RFC 9457.
 * Chạy trên qcet_test; dữ liệu do test tự tạo theo runId và được dọn trong after().
 */
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { DocumentSecurityLevel, DocumentType, OutgoingDocumentStatus } from "@prisma/client";
import { GET as listOutgoingRoute } from "@/app/api/documents/outgoing/route";
import {
  PROBLEM_JSON,
  bearer,
  createDocumentRouteFixture,
  getRequest,
  type FixtureUser,
} from "./documents-route-fixtures";

const fx = createDocumentRouteFixture("doutp");

let owner: FixtureUser;
/** Văn bản đi của `owner`, theo thứ tự danh sách (workflow tạo mới nhất trước). */
const ownDocs: string[] = [];
let secretDoc = "";
let foreignDoc = "";

const MINUTE_MS = 60_000;

async function list(query: string, user: FixtureUser | null = owner) {
  const res = await listOutgoingRoute(getRequest(`/api/documents/outgoing${query}`, user ? bearer(user.token) : {}));
  return { res, body: await res.json() };
}

const idsOf = (items: Array<{ documentId: string }>) => items.map((item) => item.documentId);

describe("GET /api/documents/outgoing — limit/offset", () => {
  before(async () => {
    owner = await fx.user("owner");
    const other = await fx.user("other");
    for (let i = 1; i <= 3; i += 1) {
      const doc = await fx.document({
        registeredById: owner.id,
        type: DocumentType.VAN_BAN_DI,
        outgoingStatus: OutgoingDocumentStatus.DRAFT,
        outgoingCreatedAt: new Date(Date.now() - i * MINUTE_MS),
      });
      ownDocs.push(doc.id);
    }
    secretDoc = (
      await fx.document({
        registeredById: owner.id,
        type: DocumentType.VAN_BAN_DI,
        outgoingStatus: OutgoingDocumentStatus.DRAFT,
        securityLevel: DocumentSecurityLevel.TUYET_MAT,
        outgoingCreatedAt: new Date(Date.now() - 30 * 1000),
      })
    ).id;
    foreignDoc = (
      await fx.document({
        registeredById: other.id,
        type: DocumentType.VAN_BAN_DI,
        outgoingStatus: OutgoingDocumentStatus.DRAFT,
        outgoingCreatedAt: new Date(Date.now() - 30 * 1000),
      })
    ).id;
  });

  after(async () => {
    await fx.cleanup();
  });

  test("không có thông tin xác thực -> 401 AUTH_REQUIRED (RFC 9457), không có danh sách", async () => {
    const { res, body } = await list("", null);
    assert.equal(res.status, 401);
    assert.equal(res.headers.get("content-type"), PROBLEM_JSON);
    assert.equal(body.code, "AUTH_REQUIRED");
    assert.equal(body.instance, "/api/documents/outgoing");
    assert.equal(body.items, undefined);
    assert.equal(body.total, undefined);
  });

  test("không truyền tham số -> limit 50, offset 0, đủ văn bản trong phạm vi theo thứ tự mới nhất trước", async () => {
    const { res, body } = await list("");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /^application\/json/);
    assert.deepEqual(Object.keys(body).sort(), ["items", "limit", "offset", "total"]);
    assert.equal(body.limit, 50);
    assert.equal(body.offset, 0);
    assert.equal(body.total, 3);
    assert.deepEqual(idsOf(body.items), ownDocs);
    for (const item of body.items) {
      assert.equal(item.status, OutgoingDocumentStatus.DRAFT);
      assert.equal(item.document.id, item.documentId);
    }
  });

  test("văn bản tuyệt mật và văn bản của người khác không có trong danh sách lẫn tổng số", async () => {
    const { body } = await list("?limit=100");
    const ids = idsOf(body.items);
    assert.equal(ids.includes(secretDoc), false);
    assert.equal(ids.includes(foreignDoc), false);
    assert.equal(body.total, 3);
  });

  test("limit=2&offset=1 -> trang chứa văn bản thứ hai và thứ ba, tổng vẫn là 3", async () => {
    const { res, body } = await list("?limit=2&offset=1");
    assert.equal(res.status, 200);
    assert.equal(body.limit, 2);
    assert.equal(body.offset, 1);
    assert.equal(body.total, 3);
    assert.deepEqual(idsOf(body.items), ownDocs.slice(1, 3));
  });

  test("limit=1 -> chỉ văn bản mới nhất", async () => {
    const { body } = await list("?limit=1");
    assert.equal(body.limit, 1);
    assert.deepEqual(idsOf(body.items), ownDocs.slice(0, 1));
    assert.equal(body.total, 3);
  });

  // limit=0 trước đây trả 200 danh sách rỗng; nay thống nhất giới hạn 1..100 với GET /api/documents.
  for (const query of ["?limit=0", "?limit=101", "?limit=abc", "?limit=-1", "?limit=1.5", "?limit=Infinity", "?offset=abc", "?offset=-1", "?offset=1.5"]) {
    test(`${query} -> 400 VALIDATION_ERROR (RFC 9457), không có danh sách`, async () => {
      const { res, body } = await list(query);
      assert.equal(res.status, 400);
      assert.equal(res.headers.get("content-type"), PROBLEM_JSON);
      assert.equal(body.code, "VALIDATION_ERROR");
      assert.equal(body.items, undefined);
      assert.equal(body.total, undefined);
    });
  }

  test("limit=100 (biên trên) -> 200, đủ văn bản trong phạm vi", async () => {
    const { res, body } = await list("?limit=100");
    assert.equal(res.status, 200);
    assert.equal(body.limit, 100);
    assert.deepEqual(idsOf(body.items), ownDocs);
  });

  test("tham số rỗng (limit=&offset=) -> dùng mặc định 50/0", async () => {
    const { res, body } = await list("?limit=&offset=");
    assert.equal(res.status, 200);
    assert.equal(body.limit, 50);
    assert.equal(body.offset, 0);
    assert.deepEqual(idsOf(body.items), ownDocs);
  });

  test("offset vượt tổng -> danh sách rỗng, tổng số không đổi", async () => {
    const { res, body } = await list("?offset=10");
    assert.equal(res.status, 200);
    assert.equal(body.offset, 10);
    assert.deepEqual(body.items, []);
    assert.equal(body.total, 3);
  });
});
