/**
 * Khối dữ liệu phụ gặp 429 thì tự chờ rồi thử lại, không hiện lỗi quá tải cho người dùng.
 */
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fetchWithRetry, retryDelayMs } from "../src/lib/fetch-with-retry";

const realFetch = globalThis.fetch;

describe("fetchWithRetry", () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("chờ theo Retry-After (có trần), không có header thì lùi dần", () => {
    assert.equal(retryDelayMs("3", 0, 8000), 3000);
    assert.equal(retryDelayMs("30", 0, 8000), 8000);
    assert.equal(retryDelayMs(null, 0, 8000), 2000);
    assert.equal(retryDelayMs("abc", 1, 8000), 4000);
  });

  test("429 rồi 200: trả kết quả thành công sau khi thử lại", async () => {
    const statuses = [429, 200];
    let calls = 0;
    globalThis.fetch = (async () => {
      const status = statuses[calls++];
      return new Response(status === 200 ? "{}" : "", { status, headers: { "Retry-After": "0" } });
    }) as typeof fetch;
    const res = await fetchWithRetry("/api/x", undefined, { maxWaitMs: 1 });
    assert.equal(res.status, 200);
    assert.equal(calls, 2);
  });

  test("vẫn 429 sau số lần thử thì trả 429 để nơi gọi tự xử lý; lỗi khác không thử lại", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response("", { status: 429 });
    }) as typeof fetch;
    const res = await fetchWithRetry("/api/x", undefined, { retries: 2, maxWaitMs: 1 });
    assert.equal(res.status, 429);
    assert.equal(calls, 3);

    calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response("", { status: 500 });
    }) as typeof fetch;
    assert.equal((await fetchWithRetry("/api/x", undefined, { maxWaitMs: 1 })).status, 500);
    assert.equal(calls, 1);
  });
});
