import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { TaskEmptyState } from "../src/components/tasks/table/components/task-empty-state";

describe("TaskEmptyState", () => {
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

  it("chưa có nhiệm vụ nào: nói rõ bảng dùng để làm gì, không dựng dữ liệu giả, không dùng thuật ngữ kỹ thuật", () => {
    const html = renderToString(React.createElement(TaskEmptyState, { canAddTask: true, onAddTask: () => {} }));

    assert.ok(html.includes("Chưa có nhiệm vụ nào"));
    assert.ok(html.includes("sẽ hiện ở đây"));
    assert.ok(!html.includes("cơ sở dữ liệu"));
    assert.ok(!html.includes("máy chủ"));
    assert.ok(!html.includes("Hoàn thiện kế hoạch kiểm định chất lượng HK1"), "không hiển thị nhiệm vụ mẫu");
    assert.ok(!html.includes("Người phụ trách A"));
  });

  it("người không có quyền tạo việc không thấy nút tạo và lời mời tạo", () => {
    const html = renderToString(React.createElement(TaskEmptyState, {}));
    assert.ok(!html.includes("Tạo nhiệm vụ mới"));
    assert.ok(!html.includes("tạo nhiệm vụ đầu tiên"));
  });

  it("khi lọc loại hết kết quả: nêu bộ lọc đang áp dụng và ưu tiên nút Xóa bộ lọc", () => {
    const html = renderToString(
      React.createElement(TaskEmptyState, { academicMonth: 9, department: "CNTT", priority: "HIGH", onResetFilters: () => {}, canAddTask: true, onAddTask: () => {} })
    );
    assert.ok(html.includes("Đang áp dụng tháng 9, 2 bộ lọc khác."));
    assert.ok(html.indexOf("Xóa bộ lọc") < html.indexOf("Tạo nhiệm vụ mới"));
  });
});
