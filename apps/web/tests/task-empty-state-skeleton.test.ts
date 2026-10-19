import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { TaskEmptyState } from "../src/components/tasks/table/components/task-empty-state";

/** Nút Hướng dẫn mở lại thẻ hướng dẫn bước đầu ngay trên trang, không dẫn sang /docs (người dùng chốt 15/10/2026: /docs chưa ổn định). */
const hasGuideButton = (html: string) => html.includes(">Hướng dẫn</button>");
const hasDocsLink = (html: string) => /href="\/docs/.test(html);

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

  it("được tạo việc: có nút Tạo việc và nút Hướng dẫn mở lại thẻ hướng dẫn; thẻ chỉ hiện sau khi trang chạy (không có trong HTML render sẵn)", () => {
    const html = renderToString(
      React.createElement(TaskEmptyState, {
        canAddTask: true,
        onAddTask: () => {},
      })
    );

    assert.ok(html.includes(">Tạo việc</button>"));
    assert.ok(hasGuideButton(html));
    assert.ok(!hasDocsLink(html), "không dẫn sang /docs");
    assert.ok(!html.includes('data-slot="onboarding-hint"'), "thẻ hướng dẫn không có sẵn trong HTML render phía server");
  });

  it("chưa có nhiệm vụ nào: nói rõ bảng dùng để làm gì, không dựng dữ liệu giả, không dùng thuật ngữ kỹ thuật", () => {
    const html = renderToString(React.createElement(TaskEmptyState, { canAddTask: true, onAddTask: () => {} }));

    assert.ok(html.includes("Chưa có nhiệm vụ nào"));
    assert.ok(html.includes("Tạo nhiệm vụ đầu tiên để phân công"));
    assert.ok(!html.includes("cơ sở dữ liệu"));
    assert.ok(!html.includes("máy chủ"));
    assert.ok(!html.includes("Hoàn thiện kế hoạch kiểm định chất lượng HK1"), "không hiển thị nhiệm vụ mẫu");
    assert.ok(!html.includes("Người phụ trách A"));
  });

  it("người không có quyền tạo việc không thấy nút tạo, lời mời tạo hay nút Hướng dẫn (thẻ hướng dẫn chỉ nói bước tạo việc)", () => {
    const html = renderToString(React.createElement(TaskEmptyState, {}));
    assert.ok(!html.includes(">Tạo việc</button>"));
    assert.ok(!hasGuideButton(html));
    assert.ok(!hasDocsLink(html));
  });

  it("nút Hướng dẫn chỉ có ở trang chưa có nhiệm vụ nào", () => {
    const filtered = renderToString(
      React.createElement(TaskEmptyState, { department: "CNTT", onResetFilters: () => {}, canAddTask: true, onAddTask: () => {} })
    );
    assert.ok(!hasGuideButton(filtered));
  });

  it("khi lọc loại hết kết quả: nêu bộ lọc đang áp dụng và ưu tiên nút Xóa bộ lọc", () => {
    const html = renderToString(
      React.createElement(TaskEmptyState, { academicMonth: 9, department: "CNTT", priority: "HIGH", onResetFilters: () => {}, canAddTask: true, onAddTask: () => {} })
    );
    assert.ok(html.includes("Đang áp dụng tháng 9, 2 bộ lọc khác."));
    assert.ok(html.includes("Xóa bộ lọc"));
    assert.ok(!html.includes(">Tạo việc</button>"), "đang lọc thì chỉ còn Xóa bộ lọc");
  });

  it("Đang thực hiện trống vì việc chưa xong đều đã trễ: nói rõ lý do, nút chữ thường sang Trễ hạn, tranh đồng hồ báo thức", () => {
    const html = renderToString(
      React.createElement(TaskEmptyState, { taskTab: "active", suggestedView: { id: "overdue", count: 1, onSelect: () => {} } })
    );
    assert.ok(html.includes("Không có nhiệm vụ nào đang thực hiện"));
    assert.ok(html.includes("Việc chưa xong đều đã quá hạn: 1 nhiệm vụ đang ở Trễ hạn."));
    assert.ok(html.includes(">Xem việc trễ hạn</button>"));
    assert.ok(html.includes("illustrations/overdue.png"));
  });

  it("Trễ hạn trống còn việc đang làm: nêu số việc, tranh nằm võng; Hoàn thành trống: tranh bảng việc", () => {
    const overdue = renderToString(
      React.createElement(TaskEmptyState, { taskTab: "overdue", suggestedView: { id: "active", count: 3, onSelect: () => {} } })
    );
    assert.ok(overdue.includes("3 nhiệm vụ đang thực hiện."));
    assert.ok(overdue.includes(">Xem việc đang thực hiện</button>"));
    assert.ok(overdue.includes("illustrations/all-done.png"));

    const done = renderToString(
      React.createElement(TaskEmptyState, { taskTab: "done", suggestedView: { id: "active", count: 3, onSelect: () => {} } })
    );
    assert.ok(done.includes("Chưa có nhiệm vụ nào hoàn thành"));
    assert.ok(done.includes("illustrations/tasks.png"));
  });
});
