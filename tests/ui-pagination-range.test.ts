import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getPaginationRange } from "../src/components/ui/pagination";

describe("getPaginationRange", () => {
  test("hiện đủ mọi trang khi ít trang", () => {
    assert.deepEqual(getPaginationRange(1, 5), [1, 2, 3, 4, 5]);
    assert.deepEqual(getPaginationRange(3, 7), [1, 2, 3, 4, 5, 6, 7]);
  });

  test("rút gọn phía sau khi đang ở đầu danh sách", () => {
    assert.deepEqual(getPaginationRange(1, 24), [1, 2, "gap", 24]);
  });

  test("rút gọn hai phía khi đang ở giữa", () => {
    assert.deepEqual(getPaginationRange(8, 24), [1, "gap", 7, 8, 9, "gap", 24]);
  });

  test("rút gọn phía trước khi đang ở cuối", () => {
    assert.deepEqual(getPaginationRange(24, 24), [1, "gap", 23, 24]);
  });
});
