import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "../src/components/tasks/task-action-icons";

describe("Bộ icon thao tác nhiệm vụ (cùng ngôn ngữ với icon sidebar)", () => {
  const entries = Object.entries(icons).filter(([name]) => name.startsWith("TaskIcon"));

  it("xuất đủ 48 icon", () => {
    assert.equal(entries.length, 48);
  });

  for (const [name, Icon] of entries) {
    it(`${name}: lưới 19x19, nét 1.5 bo tròn, dùng currentColor, ẩn với trình đọc màn hình`, () => {
      const html = renderToStaticMarkup(React.createElement(Icon as React.ComponentType));
      assert.ok(html.includes('viewBox="0 0 19 19"'));
      assert.ok(html.includes('stroke="currentColor"'));
      assert.ok(html.includes('stroke-width="1.5"'));
      assert.ok(html.includes('stroke-linecap="round"'));
      assert.ok(html.includes('stroke-linejoin="round"'));
      assert.ok(html.includes('aria-hidden="true"'));
    });
  }

  it("cho phép đổi kích thước và độ dày nét", () => {
    const html = renderToStaticMarkup(React.createElement(icons.TaskIconStar, { size: 24, strokeWidth: 2 }));
    assert.ok(html.includes('width="24"') && html.includes('stroke-width="2"'));
  });
});
