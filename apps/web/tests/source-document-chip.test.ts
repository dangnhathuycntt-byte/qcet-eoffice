import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SourceDocumentChip, linkTaskToDocument } from "../src/components/tasks/create/source-document-chip";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("Chip văn bản nguồn của hộp tạo nhiệm vụ", () => {
  it("gắn nhiệm vụ vào văn bản bằng PATCH linkedTaskId và báo thành công theo mã phản hồi", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return { ok: true } as Response;
    }) as typeof fetch;

    assert.equal(await linkTaskToDocument("doc-1", "task-9"), true);
    assert.equal(calls[0].url, "/api/documents/doc-1");
    assert.equal(calls[0].init?.method, "PATCH");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { linkedTaskId: "task-9" });
  });

  it("trả false khi server từ chối (văn bản đã gắn, bất biến hoặc không đủ quyền) hoặc mất kết nối", async () => {
    globalThis.fetch = (async () => ({ ok: false, status: 409 }) as Response) as typeof fetch;
    assert.equal(await linkTaskToDocument("doc-1", "task-9"), false);

    globalThis.fetch = (async () => {
      throw new Error("network");
    }) as typeof fetch;
    assert.equal(await linkTaskToDocument("doc-1", "task-9"), false);
  });

  it("chưa chọn: chip chỉ là nút có tên 'Văn bản nguồn'; đã chọn: hiện số ký hiệu", () => {
    const render = (value: { id: string; number: string; summary: string } | null) =>
      renderToStaticMarkup(
        React.createElement(SourceDocumentChip, { value, onChange: () => {}, open: false, onOpenChange: () => {} }),
      );

    const empty = render(null);
    assert.ok(empty.includes('aria-label="Văn bản nguồn"'));

    const picked = render({ id: "d1", number: "128/TCGDNN-VP", summary: "Kế hoạch" });
    assert.ok(picked.includes("128/TCGDNN-VP"));
    assert.ok(picked.includes('aria-label="Văn bản nguồn: 128/TCGDNN-VP"'));
  });
});
