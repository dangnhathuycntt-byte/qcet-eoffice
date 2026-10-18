import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRuntimeFeatures } from "../src/lib/runtime-features";

// Cache ở mức module: cả chuỗi kịch bản chạy trên cùng một lần nạp module (file test chạy riêng một tiến trình).
test("cờ tải một lần cho cả phiên; lỗi không bị nhớ nên lần sau tải lại", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  const replies: Array<() => Response> = [
    () => {
      throw new TypeError("mất mạng");
    },
    () => new Response("", { status: 503 }),
    () => new Response(JSON.stringify({ features: { taskAgent: true, assistant: false } }), { status: 200, headers: { "content-type": "application/json" } }),
  ];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    const reply = replies.shift();
    if (!reply) throw new Error("fetch được gọi thừa");
    return reply();
  }) as unknown as typeof fetch;
  try {
    assert.deepEqual(await loadRuntimeFeatures(), {}); // mất mạng: trả {} cho lần này
    assert.deepEqual(await loadRuntimeFeatures(), {}); // HTTP 503: không nhớ lỗi, tải lại
    assert.deepEqual(await loadRuntimeFeatures(), { taskAgent: true, assistant: false });
    assert.deepEqual(await loadRuntimeFeatures(), { taskAgent: true, assistant: false }); // đã cache, không gọi lại
    assert.deepEqual(calls, ["/api/runtime-config", "/api/runtime-config", "/api/runtime-config"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
