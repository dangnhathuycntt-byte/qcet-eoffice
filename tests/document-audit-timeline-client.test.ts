import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { fetchDocumentAuditTimeline, isEmptyTimeline } from "../src/lib/documents/audit-timeline-client";

const reply = (status: number, body?: unknown) => async () => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (body === undefined) throw new SyntaxError("Unexpected end of JSON input");
    return body;
  },
});

const realPayload = {
  documentId: "doc-1",
  documentNumber: "12/QĐ",
  type: "inbox",
  progressPercent: 40,
  completedCount: 2,
  totalSteps: 5,
  steps: [{ id: "s1", stepNumber: 1, key: "RECEIVED", title: "Tiếp nhận", subtitle: "", status: "completed", actorName: "Nguyễn Thị Lan" }],
  auditLogs: [{ id: "l1", action: "DOCUMENT_CREATED", actionLabel: "Vào sổ", actorName: "Nguyễn Thị Lan", timestamp: "2026-10-01T01:00:00.000Z" }],
};

describe("fetchDocumentAuditTimeline", () => {
  for (const status of [403, 404, 500]) {
    test(`HTTP ${status} trả lỗi, không dựng người xử lý hay tiến độ`, async () => {
      const result = await fetchDocumentAuditTimeline("doc-1", reply(status, { error: "x" }));
      assert.equal(result.ok, false);
      assert.ok(!result.ok && result.error.length > 0);
      assert.equal("data" in result, false);
    });
  }

  test("lỗi mạng trả lỗi", async () => {
    const result = await fetchDocumentAuditTimeline("doc-1", async () => { throw new TypeError("fetch failed"); });
    assert.equal(result.ok, false);
    assert.equal("data" in result, false);
  });

  test("phản hồi sai cấu trúc hoặc không phải JSON bị từ chối", async () => {
    for (const body of [{ success: true }, { data: { steps: "x", auditLogs: [] } }, null, "ok", undefined]) {
      const result = await fetchDocumentAuditTimeline("doc-1", reply(200, body));
      assert.equal(result.ok, false);
      assert.equal("data" in result, false);
    }
  });

  test("mảng chứa phần tử null/sai kiểu hoặc số liệu sai bị từ chối (không để UI crash)", async () => {
    const bad = [
      { ...realPayload, steps: [null] },
      { ...realPayload, steps: [{ ...realPayload.steps[0], actorName: {} }] },
      { ...realPayload, steps: [{ ...realPayload.steps[0], status: "unknown" }] },
      { ...realPayload, steps: [{ ...realPayload.steps[0], stepNumber: "1" }] },
      { ...realPayload, steps: [{ ...realPayload.steps[0], title: undefined }] },
      { ...realPayload, auditLogs: [{ ...realPayload.auditLogs[0], actorName: 42 }] },
      { ...realPayload, auditLogs: [undefined] },
      { ...realPayload, progressPercent: "40" },
      { ...realPayload, completedCount: Number.NaN },
      { ...realPayload, totalSteps: undefined },
    ];
    for (const body of bad) {
      const result = await fetchDocumentAuditTimeline("doc-1", reply(200, body));
      assert.equal(result.ok, false, JSON.stringify(body).slice(0, 80));
    }
  });

  test("trường tùy chọn null hoặc vắng mặt vẫn hợp lệ và không bị chuẩn hóa", async () => {
    const body = { ...realPayload, steps: [{ ...realPayload.steps[0], actorName: null, notes: null, timestamp: undefined }] };
    const result = await fetchDocumentAuditTimeline("doc-1", reply(200, body));
    assert.ok(result.ok);
    if (result.ok) assert.equal(result.data.steps[0].actorName, null);
  });

  test("yêu cầu bị hủy trả aborted, không phải lỗi hiển thị", async () => {
    const controller = new AbortController();
    const result = await fetchDocumentAuditTimeline(
      "doc-1",
      async (_url, init) => {
        controller.abort();
        if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError");
        return reply(200, realPayload)();
      },
      controller.signal,
    );
    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.aborted === true);
  });

  test("dữ liệu thật được giữ nguyên, kể cả khi bọc trong data", async () => {
    for (const body of [realPayload, { success: true, data: realPayload }]) {
      const result = await fetchDocumentAuditTimeline("doc-1", reply(200, body));
      assert.ok(result.ok);
      if (result.ok) {
        assert.equal(result.data.progressPercent, 40);
        assert.equal(result.data.steps[0].actorName, "Nguyễn Thị Lan");
        assert.equal(isEmptyTimeline(result.data), false);
      }
    }
  });

  test("phản hồi hợp lệ nhưng rỗng là trạng thái chưa có lịch sử", async () => {
    const result = await fetchDocumentAuditTimeline("doc-1", reply(200, { ...realPayload, progressPercent: 0, completedCount: 0, steps: [], auditLogs: [] }));
    assert.ok(result.ok);
    if (result.ok) assert.equal(isEmptyTimeline(result.data), true);
  });

  test("mã văn bản được mã hóa trong URL", async () => {
    let url = "";
    await fetchDocumentAuditTimeline("a/b c", async (input) => { url = input; return reply(404)(); });
    assert.equal(url, "/api/documents/a%2Fb%20c/audit-logs");
  });
});
