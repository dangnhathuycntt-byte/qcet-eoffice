/**
 * Kiểu "mực" của icon sidebar (người dùng gửi ảnh menu chuột phải và hộp lệnh của Linear 22/10/2026): hộp Ctrl+K bật `ink`
 * để icon có mảng tô như bộ `task-icons`; sidebar không truyền `ink` nên giữ nguyên nét viền. `ink` không được lọt ra DOM.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SIDEBAR_INK_ICONS } from "../src/components/layout/sidebar-rounded-icons";

const render = (Icon: unknown, props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(React.createElement(Icon as React.ComponentType<Record<string, unknown>>, props));
const filledParts = (markup: string) => (markup.match(/fill="currentColor"/g) ?? []).length;

describe("icon sidebar kiểu mực", () => {
  it("bật ink thì thêm mảng tô, mặc định giữ như sidebar", () => {
    assert.ok(SIDEBAR_INK_ICONS.size >= 12);
    for (const Icon of SIDEBAR_INK_ICONS) {
      const name = (Icon as { name?: string }).name;
      const outline = render(Icon);
      const ink = render(Icon, { ink: true });
      assert.ok(filledParts(ink) > filledParts(outline), `${name}: ink phải có thêm mảng tô`);
      assert.ok(!outline.includes("data-ink"), `${name}: sidebar không có mảng tô của kiểu mực`);
      assert.ok(!/\sink=/.test(ink), `${name}: thuộc tính ink lọt ra thẻ svg`);
    }
  });
});
