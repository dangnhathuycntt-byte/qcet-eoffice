import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskRow } from "../src/components/tasks/table/components/task-row";
import type { SchoolTask } from "../src/types/dashboard";

const task = {
  id: "task-ctx-1",
  code: "NV-CTX-01",
  title: "Nhiệm vụ thử menu chuột phải",
  category: "CHUYEN_DOI_SO",
  categoryLabel: "Chuyển đổi số",
  status: "IN_PROGRESS",
  priority: "NORMAL",
  dueDate: "2026-12-31",
  progressPercent: 10,
  leadAssigneeName: "Nguyễn Văn A",
  leadAssigneeId: "user-1",
  coAssignees: [],
  assignedDate: "2026-09-01",
  department: "Khoa CNTT",
} as unknown as SchoolTask;

function render(props: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    React.createElement(
      "table",
      null,
      React.createElement("tbody", null, React.createElement(TaskRow, { task, ...props }))
    )
  );
}

describe("TaskRow: nền nổi bật khi là đích của menu chuột phải", () => {
  it("giữ nền bg-accent khi isContextMenuTarget=true", () => {
    assert.ok(render({ isContextMenuTarget: true }).includes("bg-accent"));
  });

  it("không có nền bg-accent mặc định khi không phải đích menu", () => {
    assert.ok(!render({ isContextMenuTarget: false }).includes(" bg-accent"));
  });

  it("dòng đang chọn giữ nền chọn, không bị đè bởi nền menu", () => {
    const html = render({ isContextMenuTarget: true, isSelected: true });
    assert.ok(html.includes("bg-selected"));
    assert.ok(!html.includes(" bg-accent "));
  });
});
