import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskRow } from "../src/components/tasks/table/components/task-row";
import type { SchoolTask } from "@qcet/contracts/types/dashboard";

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
  // Nền hàng đặt bằng --row-bg của bảng dùng chung (ui/table), không còn lớp bg-* trên từng ô
  const ACCENT_BG = "[--row-bg:var(--color-accent)]";

  it("giữ nền accent khi isContextMenuTarget=true", () => {
    const html = render({ isContextMenuTarget: true });
    assert.ok(html.includes("data-menu-target") && html.includes(ACCENT_BG));
  });

  it("không có nền accent mặc định khi không phải đích menu", () => {
    const html = render({ isContextMenuTarget: false });
    assert.ok(!html.includes("data-menu-target") && !html.includes(ACCENT_BG));
  });

  it("dòng đang chọn giữ nền chọn, không bị đè bởi nền menu", () => {
    const html = render({ isContextMenuTarget: true, isSelected: true });
    assert.ok(html.includes("var(--color-selected)"));
    assert.ok(!html.includes(ACCENT_BG));
  });
});
