import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { getWorkQueueSnapshot, refreshWorkQueue } from "../src/lib/documents/work-queue";

const realFetch = globalThis.fetch;
const realWindow = (globalThis as { window?: unknown }).window;

beforeEach(() => {
  (globalThis as { window?: unknown }).window = {};
});
afterEach(() => {
  globalThis.fetch = realFetch;
  (globalThis as { window?: unknown }).window = realWindow;
});

const summary = (outgoingAwaiting: number, status = 200) =>
  new Response(JSON.stringify({ success: true, data: { outgoingAwaiting } }), { status });

describe("Chấm báo việc chờ ở sidebar: số việc chờ của người dùng", () => {
  it("tải số việc chờ từ máy chủ", async () => {
    globalThis.fetch = (async () => summary(3)) as typeof fetch;
    await refreshWorkQueue({ force: true });
    assert.equal(getWorkQueueSnapshot(), 3);
  });

  it("lỗi tạm thời (5xx, mất mạng) giữ số cũ, không ghi thành 0", async () => {
    globalThis.fetch = (async () => summary(2)) as typeof fetch;
    await refreshWorkQueue({ force: true });
    globalThis.fetch = (async () => summary(0, 503)) as typeof fetch;
    await refreshWorkQueue({ force: true });
    assert.equal(getWorkQueueSnapshot(), 2);
    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    await refreshWorkQueue({ force: true });
    assert.equal(getWorkQueueSnapshot(), 2);
  });

  it("lần tải mới nhất thắng: phản hồi chậm của lần trước không ghi đè số sau thao tác", async () => {
    let releaseSlow!: () => void;
    const slowGate = new Promise<void>((resolve) => (releaseSlow = resolve));
    globalThis.fetch = (async () => {
      await slowGate;
      return summary(1);
    }) as typeof fetch;
    const slow = refreshWorkQueue({ force: true });
    globalThis.fetch = (async () => summary(5)) as typeof fetch;
    await refreshWorkQueue({ force: true });
    releaseSlow();
    await slow;
    assert.equal(getWorkQueueSnapshot(), 5);
  });

  it("không làm mới liên tục: lần gọi không ép trong 15 giây không gọi lại máy chủ", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return summary(4);
    }) as typeof fetch;
    await refreshWorkQueue({ force: true });
    await refreshWorkQueue();
    await refreshWorkQueue();
    assert.equal(calls, 1);
  });
});
