import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  HANDLE_WIDTH,
  LIST_MIN,
  PANE_DEFAULT,
  PANE_MAX,
  PANE_MIN,
  nextWidthForKey,
  parseStoredPaneWidth,
  resolvePaneLayout,
} from "../src/lib/documents/document-pane-layout";

describe("resolvePaneLayout (SPEC §6.1)", () => {
  test("đủ LIST_MIN + PANE_MIN thì là pane, không thì overlay", () => {
    assert.equal(resolvePaneLayout(LIST_MIN + HANDLE_WIDTH + PANE_MIN, PANE_DEFAULT).mode, "pane");
    assert.equal(resolvePaneLayout(LIST_MIN + HANDLE_WIDTH + PANE_MIN - 1, PANE_DEFAULT).mode, "overlay");
    assert.deepEqual(resolvePaneLayout(600, PANE_DEFAULT), { mode: "overlay", width: 0, max: 0 });
    assert.equal(resolvePaneLayout(Number.NaN, PANE_DEFAULT).mode, "overlay");
  });

  test("kéo rộng không bao giờ làm danh sách nhỏ hơn LIST_MIN", () => {
    for (const workspace of [920, 1000, 1280, 1600, 2400]) {
      const layout = resolvePaneLayout(workspace, 5000);
      assert.ok(workspace - layout.width - HANDLE_WIDTH >= LIST_MIN, `workspace ${workspace}`);
      assert.ok(layout.width <= PANE_MAX);
    }
  });

  test("độ rộng chọn được clamp vào [PANE_MIN, max] nhưng không bị ghi đè", () => {
    assert.equal(resolvePaneLayout(1400, 100).width, PANE_MIN);
    assert.equal(resolvePaneLayout(1400, 700).width, 700);
    assert.equal(resolvePaneLayout(1000, 900).width, 514);
    // cùng giá trị ưa thích, màn rộng hơn thì lấy lại đủ độ rộng
    assert.equal(resolvePaneLayout(1900, 900).width, 900);
  });

  test("hysteresis 24px quanh ngưỡng", () => {
    const threshold = LIST_MIN + HANDLE_WIDTH + PANE_MIN;
    assert.equal(resolvePaneLayout(threshold - 10, PANE_DEFAULT, "pane").mode, "pane");
    assert.equal(resolvePaneLayout(threshold - 25, PANE_DEFAULT, "pane").mode, "overlay");
    assert.equal(resolvePaneLayout(threshold + 10, PANE_DEFAULT, "overlay").mode, "overlay");
    assert.equal(resolvePaneLayout(threshold + 24, PANE_DEFAULT, "overlay").mode, "pane");
  });

  test("giá trị lưu hỏng hoặc ngoài khoảng dùng mặc định", () => {
    assert.equal(parseStoredPaneWidth(null), PANE_DEFAULT);
    assert.equal(parseStoredPaneWidth("abc"), PANE_DEFAULT);
    assert.equal(parseStoredPaneWidth("50"), PANE_DEFAULT);
    assert.equal(parseStoredPaneWidth("5000"), PANE_DEFAULT);
    assert.equal(parseStoredPaneWidth("720.4"), 720);
  });

  test("phím ←/→ đổi 20px, Home về mặc định, phím khác bỏ qua", () => {
    const layout = resolvePaneLayout(1600, 700);
    assert.equal(nextWidthForKey("ArrowLeft", 700, layout), 720);
    assert.equal(nextWidthForKey("ArrowRight", 700, layout), 680);
    assert.equal(nextWidthForKey("ArrowRight", PANE_MIN, layout), PANE_MIN);
    assert.equal(nextWidthForKey("Home", 900, layout), PANE_DEFAULT);
    assert.equal(nextWidthForKey("a", 700, layout), null);
  });
});
