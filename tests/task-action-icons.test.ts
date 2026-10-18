import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "../src/components/tasks/task-action-icons";

describe("Bộ icon thao tác nhiệm vụ (cùng ngôn ngữ với icon sidebar)", () => {
  const entries = Object.entries(icons).filter(([name]) => name.startsWith("TaskIcon"));

  // Trạng thái, ưu tiên và ngày hạn theo hình học của Linear: lục giác 14px có lề 1px, còn lại lưới 16
  const LINEAR_STATUS = /^TaskIconStatus(New|InProgress|Review|Overdue|Done|Cancelled)$/;
  const LINEAR_GRID = /^TaskIcon(Priority(None|Urgent|High|Normal|Low)|Due(Soon|Overdue|Closed)?)$/;
  // Ba nút tròn của thanh công cụ vẽ như icon sidebar: lưới 16, nét 1,25
  const TOOLBAR = /^TaskIcon(Search|Filter|Display)$/;

  it("xuất đủ 58 icon", () => {
    assert.equal(entries.length, 58);
  });

  for (const [name, Icon] of entries) {
    const viewBox = LINEAR_STATUS.test(name) ? "-1 -1 16 16" : LINEAR_GRID.test(name) || TOOLBAR.test(name) ? "0 0 16 16" : "0 0 19 19";
    const stroke = TOOLBAR.test(name) ? "1.25" : "1.5";
    it(`${name}: lưới ${viewBox}, nét ${stroke} bo tròn, dùng currentColor, ẩn với trình đọc màn hình`, () => {
      const html = renderToStaticMarkup(React.createElement(Icon as React.ComponentType));
      assert.ok(html.includes(`viewBox="${viewBox}"`));
      assert.ok(html.includes('stroke="currentColor"'));
      assert.ok(html.includes(`stroke-width="${stroke}"`));
      assert.ok(html.includes('stroke-linecap="round"'));
      assert.ok(html.includes('stroke-linejoin="round"'));
      assert.ok(html.includes('aria-hidden="true"'));
    });
  }

  it("cho phép đổi kích thước và độ dày nét", () => {
    const html = renderToStaticMarkup(React.createElement(icons.TaskIconStatus, { size: 24, strokeWidth: 2 }));
    assert.ok(html.includes('width="24"') && html.includes('stroke-width="2"'));
  });
});
