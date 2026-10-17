import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SIDEBAR_COLLAPSED_COOKIE,
  parseSidebarCollapsed,
  readSidebarCollapsedFromCookieString,
  serializeSidebarCollapsedCookie,
} from "../src/lib/navigation/sidebar-state";
import {
  CHUNK_RELOAD_COOLDOWN_MS,
  CHUNK_RELOAD_STORAGE_KEY,
  isChunkLoadError,
  reloadOnceForChunkError,
} from "../src/lib/chunk-load-recovery";
import { preloadWhenIdle } from "../src/lib/idle-preload";
import { SIDEBAR_STORAGE_KEY } from "../src/components/layout/sidebar-context";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

describe("Sidebar thu gọn: cookie cho lần render đầu ở server", () => {
  it("dùng chung tên với khóa localStorage cũ để chuyển dữ liệu", () => {
    assert.equal(SIDEBAR_COLLAPSED_COOKIE, SIDEBAR_STORAGE_KEY);
  });

  it("chỉ nhận true/false, còn lại coi như chưa có", () => {
    assert.equal(parseSidebarCollapsed("true"), true);
    assert.equal(parseSidebarCollapsed("false"), false);
    assert.equal(parseSidebarCollapsed(undefined), null);
    assert.equal(parseSidebarCollapsed("1"), null);
  });

  it("đọc lại được giá trị vừa ghi giữa các cookie khác", () => {
    const pair = serializeSidebarCollapsedCookie(true).split(";")[0];
    assert.equal(readSidebarCollapsedFromCookieString(`a=1; ${pair}; b=2`), true);
    assert.equal(readSidebarCollapsedFromCookieString("a=1; b=2"), null);
    assert.match(serializeSidebarCollapsedCookie(false), /Path=\/; Max-Age=\d+; SameSite=Lax$/);
  });
});

describe("Phục hồi lỗi tải chunk", () => {
  it("nhận diện lỗi chunk của webpack, Turbopack và import() gốc", () => {
    const chunkError = Object.assign(new Error("Loading chunk 123 failed.\n(error: /_next/x.js)"), { name: "ChunkLoadError" });
    assert.equal(isChunkLoadError(chunkError), true);
    assert.equal(isChunkLoadError(new Error("Loading CSS chunk 9 failed.")), true);
    assert.equal(isChunkLoadError(new Error("Failed to load chunk /_next/static/chunks/a.js from module 1")), true);
    assert.equal(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://x/a.js")), true);
    assert.equal(isChunkLoadError(new TypeError("Importing a module script failed.")), true);
    assert.equal(isChunkLoadError(new Error("Không có quyền xem nhiệm vụ")), false);
    assert.equal(isChunkLoadError(null), false);
  });

  it("tải lại một lần rồi dừng trong thời gian chờ để không lặp vô hạn", () => {
    const storage = memoryStorage();
    let reloads = 0;
    const reload = () => void reloads++;
    const now = 1_000_000;

    assert.equal(reloadOnceForChunkError({ storage, now, online: true, reload }), true);
    assert.equal(storage.data.get(CHUNK_RELOAD_STORAGE_KEY), String(now));
    assert.equal(reloadOnceForChunkError({ storage, now: now + 5_000, online: true, reload }), false);
    assert.equal(reloadOnceForChunkError({ storage, now: now + CHUNK_RELOAD_COOLDOWN_MS, online: true, reload }), true);
    assert.equal(reloads, 2);
  });

  it("không tự tải lại khi offline hoặc không có sessionStorage", () => {
    let reloads = 0;
    const reload = () => void reloads++;
    assert.equal(reloadOnceForChunkError({ storage: memoryStorage(), now: 1, online: false, reload }), false);
    assert.equal(reloadOnceForChunkError({ storage: null, now: 1, online: true, reload }), false);
    assert.equal(reloads, 0);
  });
});

describe("Nạp trước chunk lúc rảnh", () => {
  function runNow() {
    const tasks: Array<() => void> = [];
    return {
      env: { online: true, saveData: false, schedule: (task: () => void) => void tasks.push(task) },
      async flush() {
        while (tasks.length > 0) {
          tasks.shift()!();
          await new Promise((resolve) => setImmediate(resolve));
        }
      },
    };
  }

  it("nạp tuần tự, bỏ qua lỗi và không nạp lại khóa đã xong", async () => {
    const order: string[] = [];
    const scheduler = runNow();
    const entries = [
      { key: "t1-a", load: async () => void order.push("a") },
      { key: "t1-b", load: async () => { order.push("b"); throw new Error("offline"); } },
      { key: "t1-c", load: async () => void order.push("c") },
    ];
    preloadWhenIdle(entries, scheduler.env);
    await scheduler.flush();
    assert.deepEqual(order, ["a", "b", "c"]);

    preloadWhenIdle(entries, scheduler.env);
    await scheduler.flush();
    // a, c đã nạp xong; b lỗi nên được thử lại ở lần mount sau
    assert.deepEqual(order, ["a", "b", "c", "b"]);
  });

  it("bỏ qua khi offline hoặc bật tiết kiệm dữ liệu", async () => {
    let loads = 0;
    const entries = [{ key: "t2", load: async () => void loads++ }];
    const scheduler = runNow();
    preloadWhenIdle(entries, { ...scheduler.env, online: false });
    preloadWhenIdle(entries, { ...scheduler.env, saveData: true });
    preloadWhenIdle(entries, null);
    await scheduler.flush();
    assert.equal(loads, 0);
  });
});
