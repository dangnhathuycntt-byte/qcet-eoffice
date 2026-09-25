import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { TaskEmptyState } from "../src/components/tasks/table/components/task-empty-state";

describe("TaskEmptyState Skeleton Reveal Upgrade", () => {
  it("renders contextual empty state title and description", () => {
    const html = renderToString(
      React.createElement(TaskEmptyState, {
        academicMonth: 9,
      })
    );

    assert.ok(html.includes("Không có nhiệm vụ trong Tháng 9"));
    assert.ok(html.includes("Thử thay đổi hoặc xóa bộ lọc hiện tại"));
  });

  it("renders search specific empty state when searchQuery is present", () => {
    const html = renderToString(
      React.createElement(TaskEmptyState, {
        searchQuery: "kiểm định",
      })
    );

    assert.ok(html.includes("Không tìm thấy nhiệm vụ với từ khóa"));
    assert.ok(html.includes("kiểm định"));
  });

  it("renders reset filter button when filters are active", () => {
    const html = renderToString(
      React.createElement(TaskEmptyState, {
        department: "CNTT",
        onResetFilters: () => {},
      })
    );

    assert.ok(html.includes("Xóa bộ lọc"));
  });

  it("renders add task button when canAddTask is true", () => {
    const html = renderToString(
      React.createElement(TaskEmptyState, {
        canAddTask: true,
        onAddTask: () => {},
      })
    );

    assert.ok(html.includes("Tạo nhiệm vụ mới"));
  });

  it("renders mock task rows inside skeleton container", () => {
    const html = renderToString(
      React.createElement(TaskEmptyState, {})
    );

    // Verify mock tasks are rendered for the hover reveal layer
    assert.ok(html.includes("Hoàn thiện kế hoạch kiểm định chất lượng HK1"));
    assert.ok(html.includes("Rà soát đề cương chi tiết học phần CNTT"));
    assert.ok(html.includes("Đặng Nhật Huy"));
  });
});
