import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "../src/components/tasks/task-action-icons";

describe("Bộ icon thao tác nhiệm vụ (cùng ngôn ngữ với icon sidebar)", () => {
  const entries = Object.entries(icons).filter(([name]) => name.startsWith("TaskIcon"));

  // Trạng thái, ưu tiên và ngày hạn theo hình học của Linear: lục giác 14px có lề 1px, còn lại lưới 16
  const LINEAR_STATUS = /^TaskIconStatus(New|InProgress|Review|Overdue|Done|Cancelled)$/;
  const LINEAR_GRID = /^TaskIcon(Priority(Urgent|High|Normal|Low)|Due(Soon|Overdue|Closed)?)$/;

  it("xuất đủ 57 icon", () => {
    assert.equal(entries.length, 57);
  });

  for (const [name, Icon] of entries) {
    const viewBox = LINEAR_STATUS.test(name) ? "-1 -1 16 16" : LINEAR_GRID.test(name) ? "0 0 16 16" : "0 0 19 19";
    it(`${name}: lưới ${viewBox}, nét 1.5 bo tròn, dùng currentColor, ẩn với trình đọc màn hình`, () => {
      const html = renderToStaticMarkup(React.createElement(Icon as React.ComponentType));
      assert.ok(html.includes(`viewBox="${viewBox}"`));
      assert.ok(html.includes('stroke="currentColor"'));
      assert.ok(html.includes('stroke-width="1.5"'));
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
