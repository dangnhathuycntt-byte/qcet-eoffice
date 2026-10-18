import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  INITIAL_DETAIL_STATE,
  detailReducer,
  fetchDocumentDetail,
  type DetailResult,
} from "../src/lib/documents/document-detail-client";

const respond = (status: number, body: unknown = {}) =>
  (async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

const item = (id: string) => ({ id, summary: id }) as never;
const ok = (id: string): DetailResult => ({ ok: true, item: item(id), availableActions: ["document.read"] });

describe("fetchDocumentDetail", () => {
  test("200 trả về văn bản và availableActions", async () => {
    const result = await fetchDocumentDetail("A", { fetchImpl: respond(200, { data: { id: "A" }, availableActions: ["x"] }) });
    assert.ok(result.ok && result.item.id === "A" && result.availableActions[0] === "x");
  });

  test("403 -> forbidden, 404 -> not_found, 500 -> unknown, mất mạng -> network", async () => {
    const kind = async (impl: typeof fetch) => {
      const r = await fetchDocumentDetail("A", { fetchImpl: impl });
      return r.ok ? "ok" : r.kind;
    };
    assert.equal(await kind(respond(403)), "forbidden");
    assert.equal(await kind(respond(404)), "not_found");
    assert.equal(await kind(respond(500)), "unknown");
    assert.equal(await kind((async () => { throw new TypeError("fail"); }) as unknown as typeof fetch), "network");
  });

  test("API trả văn bản khác id yêu cầu thì không bao giờ hiển thị nhầm", async () => {
    const result = await fetchDocumentDetail("A", { fetchImpl: respond(200, { data: { id: "B" } }) });
    assert.ok(!result.ok);
  });

  test("hủy yêu cầu ném AbortError để hook bỏ qua", async () => {
    const impl = (async () => { throw Object.assign(new Error("aborted"), { name: "AbortError" }); }) as unknown as typeof fetch;
    await assert.rejects(fetchDocumentDetail("A", { fetchImpl: impl }), { name: "AbortError" });
  });
});

describe("detailReducer", () => {
  test("chọn văn bản -> loading; chọn lại cùng văn bản không đổi; bỏ chọn -> idle", () => {
    const loading = detailReducer(INITIAL_DETAIL_STATE, { type: "select", docId: "A" });
    assert.equal(loading.status, "loading");
    assert.equal(detailReducer(loading, { type: "select", docId: "A" }), loading);
    assert.equal(detailReducer(loading, { type: "select", docId: null }).status, "idle");
  });

  test("kết quả của văn bản cũ bị bỏ khi đã đổi sang văn bản khác", () => {
    let state = detailReducer(INITIAL_DETAIL_STATE, { type: "select", docId: "A" });
    state = detailReducer(state, { type: "select", docId: "B" });
    const after = detailReducer(state, { type: "result", docId: "A", result: ok("A") });
    assert.equal(after, state);
    assert.equal(detailReducer(after, { type: "result", docId: "B", result: ok("B") }).status, "ready");
  });

  test("lỗi 403/404 hiện trạng thái lỗi của đúng văn bản, không mở văn bản khác", () => {
    const state = detailReducer(INITIAL_DETAIL_STATE, { type: "select", docId: "A" });
    const err = detailReducer(state, { type: "result", docId: "A", result: { ok: false, kind: "forbidden", message: "m" } });
    assert.ok(err.status === "error" && err.kind === "forbidden" && err.docId === "A");
  });

  test("làm mới giữ dữ liệu cũ trong lúc tải", () => {
    let state = detailReducer(INITIAL_DETAIL_STATE, { type: "select", docId: "A" });
    state = detailReducer(state, { type: "result", docId: "A", result: ok("A") });
    const refreshing = detailReducer(state, { type: "refresh", docId: "A" });
    assert.ok(refreshing.status === "loading" && refreshing.item?.id === "A");
  });
});
