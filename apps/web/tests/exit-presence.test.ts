/**
 * Thanh thao tác hàng loạt mờ đi và trượt xuống khi bỏ chọn thay vì biến mất đột ngột (23/10/2026). `useExitPresence` giữ phần tử
 * thêm một nhịp (150ms), gỡ ngay khi giảm chuyển động hoặc tab ẩn; chỉ opacity/transform qua `animate-out`.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const hook = readFileSync("src/hooks/use-exit-presence.ts", "utf8");
const bars = {
  "SelectionActionBar": readFileSync("src/components/ui/selection-action-bar.tsx", "utf8"),
  "TaskBulkActionBar": readFileSync("src/components/tasks/table/components/batch-action-bar.tsx", "utf8"),
};

describe("useExitPresence", () => {
  it("gỡ ngay khi giảm chuyển động hoặc tab ẩn, thời lượng khớp duration-150", () => {
    assert.match(hook, /EXIT_PRESENCE_MS = 150/);
    assert.match(hook, /prefersReducedMotion\(\) \|\| document\.hidden/);
  });

  it("so sánh nông giá trị giữ lại: truyền đối tượng literal mỗi lần dựng không gây vòng lặp setState", () => {
    assert.match(hook, /shallowEqual\(held, value\)/);
  });
});

for (const [name, source] of Object.entries(bars)) {
  describe(name, () => {
    it("dùng useExitPresence thay vì return null ngay khi bỏ chọn", () => {
      assert.match(source, /useExitPresence\(/);
      assert.match(source, /if \(!mounted\)/);
    });

    it("lúc thoát: animate-out chỉ fade + trượt, inert và aria-hidden để không nhận bấm", () => {
      assert.match(source, /animate-out fade-out slide-out-to-bottom-3 fill-mode-forwards duration-150 motion-reduce:animate-none/);
      assert.match(source, /inert=\{leaving \|\| undefined\}/);
      assert.match(source, /aria-hidden=\{leaving \|\| undefined\}/);
    });

    it("số đã chọn giữ giá trị cuối trong lúc mờ đi, không nháy sang 0", () => {
      assert.match(source, /shown\./);
    });
  });
}
