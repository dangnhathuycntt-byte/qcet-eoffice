/**
 * Khối phụ trang chi tiết nhiệm vụ dùng dữ liệu page-data gửi kèm (useBlockSeed): lần mở trang không gọi GET riêng,
 * lượt effect chạy lặp của StrictMode cũng không; trạng thái đổi thì tải lại; khối gắn lại (đổi tab) với cùng bản seed thì tải mới.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useBlockSeed } from "../src/hooks/use-block-seed";

function mount<T>(seed: T | null | undefined) {
  let hook!: ReturnType<typeof useBlockSeed<T>>;
  function Probe() {
    hook = useBlockSeed(seed);
    return null;
  }
  renderToStaticMarkup(React.createElement(Probe));
  return hook;
}

test("có seed: bỏ GET ở các lượt cùng khóa, kể cả lượt lặp của StrictMode", () => {
  const { seed, skipLoad } = mount({ criteria: [] });
  assert.deepEqual(seed, { criteria: [] });
  assert.equal(skipLoad("task|NOT_STARTED"), true);
  assert.equal(skipLoad("task|NOT_STARTED"), true);
});

test("khóa đổi thì tải lại, và từ đó luôn tải lại kể cả khi khóa quay về giá trị cũ", () => {
  const { skipLoad } = mount({ declined: null });
  assert.equal(skipLoad("task|NOT_STARTED"), true);
  assert.equal(skipLoad("task|WAITING_APPROVAL"), false);
  assert.equal(skipLoad("task|NOT_STARTED"), false);
});

test("khối gắn lại với cùng bản seed đã dùng thì không dùng lại seed", () => {
  const shared = { comments: [] };
  mount(shared).skipLoad("task");
  const again = mount(shared);
  assert.equal(again.seed, null);
  assert.equal(again.skipLoad("task"), false);
});

test("không có seed (API cũ, khối lỗi): tải như trước", () => {
  for (const missing of [undefined, null]) {
    const { seed, skipLoad } = mount(missing);
    assert.equal(seed, null);
    assert.equal(skipLoad("task"), false);
  }
});
