import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { didDrag, markSelectionStartTarget, installGlobalSelectionStart, SELECTION_DRAG_THRESHOLD } from "../src/components/tasks/detail/block-selection-canvas";

function fakeEvent(target: unknown, button = 0) {
  return { button, target } as unknown as import("react").MouseEvent<HTMLElement>;
}
const el = (interactive: boolean) => ({
  dataset: {} as Record<string, string>,
  closest: () => (interactive ? {} : null),
});

describe("Kéo chọn khối từ khoảng trống của trang", () => {
  it("đánh dấu vùng trống làm điểm bắt đầu kéo chọn", () => {
    const target = el(false);
    markSelectionStartTarget(fakeEvent(target));
    assert.equal(target.dataset.plateSelectable, "true");
  });

  it("không đánh dấu ô tương tác (nút, ô nhập, cột thuộc tính...) và chuột phải", () => {
    const btn = el(true);
    markSelectionStartTarget(fakeEvent(btn));
    assert.equal(btn.dataset.plateSelectable, undefined);
    const blank = el(false);
    markSelectionStartTarget(fakeEvent(blank, 2));
    assert.equal(blank.dataset.plateSelectable, undefined);
  });

  it("phân biệt kéo và nhấp đơn theo ngưỡng", () => {
    assert.equal(didDrag(null, { x: 5, y: 5 }), false);
    assert.equal(didDrag({ x: 0, y: 0 }, { x: SELECTION_DRAG_THRESHOLD, y: 0 }), false);
    assert.equal(didDrag({ x: 0, y: 0 }, { x: 20, y: 30 }), true);
  });

  it("cho bắt đầu kéo từ sidebar và thanh trên: lắng nghe toàn tài liệu và gỡ được", () => {
    const calls: string[] = [];
    const prev = (globalThis as any).document;
    (globalThis as any).document = {
      addEventListener: (type: string, _h: unknown, capture: boolean) => calls.push(`add:${type}:${capture}`),
      removeEventListener: (type: string, _h: unknown, capture: boolean) => calls.push(`remove:${type}:${capture}`),
    };
    try {
      const off = installGlobalSelectionStart();
      off();
    } finally {
      (globalThis as any).document = prev;
    }
    assert.deepEqual(calls, ["add:mousedown:true", "remove:mousedown:true"]);
  });

  it("trang và khung việc con đều dùng vùng cuộn làm phạm vi kéo chọn", () => {
    const page = readFileSync("src/components/tasks/task-detail-page.tsx", "utf8");
    const drawer = readFileSync("src/components/tasks/detail/subtask-detail-drawer.tsx", "utf8");
    assert.ok(page.includes('data-selection-canvas="page"') && page.includes('selectionContainerSelector="body"'), "trang dùng toàn cửa sổ làm phạm vi");
    assert.ok(drawer.includes('data-selection-canvas="peek"') && drawer.includes("selectionContainerSelector"));
    const css = readFileSync("src/app/globals.css", "utf8");
    assert.ok(css.includes(".slate-selection-area"));
  });
});
