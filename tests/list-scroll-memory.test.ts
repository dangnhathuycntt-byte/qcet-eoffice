import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readScroll, scrollKeyFor, writeScroll } from "../src/lib/documents/list-scroll-memory";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe("Nhớ vị trí cuộn danh sách văn bản", () => {
  test("ghi rồi đọc lại đúng theo từng bộ lọc", () => {
    const s = fakeStorage();
    writeScroll(s, '{"type":"inbox"}', 640.4);
    writeScroll(s, '{"type":"outbox"}', 120);
    assert.equal(readScroll(s, '{"type":"inbox"}'), 640);
    assert.equal(readScroll(s, '{"type":"outbox"}'), 120);
    assert.equal(readScroll(s, '{"type":"all"}'), 0);
  });

  test("cuộn về đầu thì xóa mục; giá trị hỏng hoặc không có storage thì về 0", () => {
    const s = fakeStorage();
    writeScroll(s, "k", 300);
    writeScroll(s, "k", 0);
    assert.equal(s.data.has(scrollKeyFor("k")), false);
    s.data.set(scrollKeyFor("bad"), "abc");
    assert.equal(readScroll(s, "bad"), 0);
    assert.equal(readScroll(null, "k"), 0);
    assert.doesNotThrow(() => writeScroll(null, "k", 10));
  });

  test("storage ném lỗi không làm hỏng danh sách", () => {
    const broken = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    assert.equal(readScroll(broken, "k"), 0);
    assert.doesNotThrow(() => writeScroll(broken, "k", 10));
  });
});
