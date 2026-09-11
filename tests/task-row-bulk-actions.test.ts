import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SchoolTask } from "@/types/dashboard";
import {
  TaskRow,
  areTaskRowPropsEqual,
  parseLeadAssignee,
} from "../src/components/tasks/table/components/task-row";
import {
  BatchActionBar,
  TaskBulkActionBar,
  calculateExtendedDeadline,
  getBatchStatusUpdatePayload,
  getBatchDeadlinePayload,
  getBatchReassignPayload,
} from "../src/components/tasks/table/components/batch-action-bar";
import { TaskTableHeader } from "../src/components/tasks/table/components/task-table-header";

const mockTask: SchoolTask = {
  id: "task-001",
  taskCode: "NV-01",
  code: "NV-01",
  title: "Xây dựng khung năng lực số cho sinh viên ngành CNTT",
  department: "Khoa CNTT",
  category: "CHUYEN_DOI_SO",
  categoryLabel: "Chuyển đổi số",
  leadAssigneeName: "ThS. Nguyễn Tiến Phong",
  leadAssigneeAvatar: "https://example.com/avatar1.jpg",
  dueDate: "2026-09-30",
  priority: "HIGH",
  status: "IN_PROGRESS",
  progressPercent: 65,
  coAssignees: [],
  assignedDate: "2026-09-01",
  assignees: [],
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
  subTasks: [
    {
      id: "sub-1",
      title: "Khảo sát yêu cầu doanh nghiệp",
      status: "COMPLETED",
      dueDate: "2026-09-15",
      assigneeName: "Nguyễn Văn C",
      updatedAt: "2026-09-02T00:00:00.000Z",
    },
    {
      id: "sub-2",
      title: "Biên soạn dự thảo khung chuẩn",
      status: "IN_PROGRESS",
      dueDate: "2026-09-25",
      assigneeName: "Nguyễn Tiến Phong",
      updatedAt: "2026-09-02T00:00:00.000Z",
    },
  ],
  completedSubTasks: 1,
  totalSubTasks: 2,
};

const mockApprovalTask: SchoolTask = {
  id: "task-002",
  taskCode: "NV-02",
  code: "NV-02",
  title: "Đề xuất kinh phí trang thiết bị phòng lab AI",
  department: "Phòng QT-TB",
  category: "CNTT",
  categoryLabel: "Công nghệ thông tin",
  leadAssigneeName: "TS. Trần Văn B",
  dueDate: "2026-09-20",
  priority: "URGENT",
  status: "WAITING_APPROVAL",
  progressPercent: 90,
  completedSubTasks: 0,
  totalSubTasks: 0,
  coAssignees: [],
  assignedDate: "2026-09-01",
  subTasks: [],
  assignees: [],
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
};

describe("Task 5: Task Row Simplification & Bulk Action Floating Bar", () => {
  describe("1. Prioritized Row Columns Hierarchy (TaskRow)", () => {
    it("renders prioritized columns in correct order: Checkbox, Nhiệm vụ, Đơn vị, DRI, Tiến độ, Hạn, Trạng thái, Actions", () => {
      const html = renderToStaticMarkup(
        React.createElement("table", null,
          React.createElement("tbody", null,
            React.createElement(TaskRow, {
              task: mockTask,
              isSelected: false,
              isExpanded: false,
              showSelection: true,
            })
          )
        )
      );

      // 1. Selection Checkbox
      assert.ok(html.includes('type="checkbox"'), "Should render selection checkbox");
      assert.ok(html.includes('aria-label="Chọn nhiệm vụ NV-01"'), "Accessible checkbox label");

      // 2. Nhiệm vụ (Code & Title & Subtask rollup)
      assert.ok(html.includes("NV-01"), "Should render task code");
      assert.ok(
        html.includes("Xây dựng khung năng lực số cho sinh viên ngành CNTT"),
        "Should render task title"
      );
      assert.ok(html.includes("[1/2]"), "Should render subtask rollup indicator [1/2]");

      // 3. Đơn vị (Department tag)
      assert.ok(html.includes("Khoa CNTT"), "Should render department");
      assert.ok(html.includes("Chuyển đổi số"), "Should render category label");

      // 4. DRI (Single clean avatar & primary name)
      assert.ok(html.includes("Nguyễn Tiến Phong"), "Should render DRI name");
      assert.ok(html.includes('src="https://example.com/avatar1.jpg"'), "Should render avatar");

      // 5. Tiến độ (Compact progress bar + tabular percent)
      assert.ok(html.includes("65%"), "Should render tabular progress percentage");
      assert.ok(html.includes("width:65%"), "Should render progress bar width");

      // 6. Hạn (SLA formatted date)
      assert.ok(html.includes("30/09/2026"), "Should render SLA formatted date");

      // 7. Trạng thái (Single clear status badge)
      assert.ok(html.includes("Đang thực hiện"), "Should render status badge");

      // 8. Actions (Overflow menu button)
      assert.ok(html.includes('aria-label="Thao tác khác"'), "Should render overflow menu button");
    });

    it("renders initials placeholder when DRI avatar is not provided", () => {
      const taskNoAvatar = { ...mockTask, leadAssigneeAvatar: undefined };
      const html = renderToStaticMarkup(
        React.createElement("table", null,
          React.createElement("tbody", null,
            React.createElement(TaskRow, { task: taskNoAvatar })
          )
        )
      );
      assert.ok(html.includes("NP"), "Initials of Nguyễn Tiến Phong should be NP");
    });

    it("highlights overdue tasks in red with SLA badge", () => {
      const overdueTask: SchoolTask = {
        ...mockTask,
        dueDate: "2026-09-01",
        status: "IN_PROGRESS",
      };
      const html = renderToStaticMarkup(
        React.createElement("table", null,
          React.createElement("tbody", null,
            React.createElement(TaskRow, {
              task: overdueTask,
              referenceDate: "2026-09-09",
            })
          )
        )
      );
      assert.ok(html.includes("text-rose-700"), "Overdue task should have rose-700 text");
      assert.ok(html.includes("Quá hạn"), "Overdue task should show Quá hạn badge");
    });
  });

  describe("2. Row Interaction Rules & Noise Reduction", () => {
    it("has entire row clickable with role='row' and tabIndex=0", () => {
      const html = renderToStaticMarkup(
        React.createElement("table", null,
          React.createElement("tbody", null,
            React.createElement(TaskRow, { task: mockTask })
          )
        )
      );
      assert.ok(html.includes('role="row"'), "Row must have role='row'");
      assert.ok(html.includes('tabindex="0"'), "Row must be keyboard focusable");
      assert.ok(html.includes('data-task-id="task-001"'), "Row contains task identifier");
    });

    it("does NOT display noisy default inline buttons on standard tasks (clean row)", () => {
      const html = renderToStaticMarkup(
        React.createElement("table", null,
          React.createElement("tbody", null,
            React.createElement(TaskRow, {
              task: mockTask,
              canAssign: true,
              onStatusChange: () => {},
              onUrge: () => {},
              onAddSubTask: () => {},
            })
          )
        )
      );

      // In the new simplified design, noisy inline buttons are moved into the ... menu
      // Check that inline row actions do not show "Đôn đốc" or "Duyệt" on standard IN_PROGRESS tasks
      assert.ok(
        !html.includes(">Duyệt<"),
        "Standard IN_PROGRESS task should NOT have inline Duyệt button"
      );
    });

    it("displays inline contextual [Duyệt] action ONLY for tasks in WAITING_APPROVAL", () => {
      const htmlWaiting = renderToStaticMarkup(
        React.createElement("table", null,
          React.createElement("tbody", null,
            React.createElement(TaskRow, {
              task: mockApprovalTask,
              canAssign: true,
              onStatusChange: () => {},
            })
          )
        )
      );

      assert.ok(
        htmlWaiting.includes(">Duyệt<"),
        "WAITING_APPROVAL task must display inline [Duyệt] button"
      );
      assert.ok(
        htmlWaiting.includes('aria-label="Duyệt nhiệm vụ NV-02"'),
        "Duyệt button has clear aria-label"
      );
    });

    it("does NOT display inline [Duyệt] button if onStatusChange handler is missing", () => {
      const htmlReadOnly = renderToStaticMarkup(
        React.createElement("table", null,
          React.createElement("tbody", null,
            React.createElement(TaskRow, {
              task: mockApprovalTask,
              canAssign: false,
              onStatusChange: undefined,
            })
          )
        )
      );

      assert.ok(
        !htmlReadOnly.includes(">Duyệt<"),
        "Read-only WAITING_APPROVAL task must not show [Duyệt] action"
      );
    });
  });

  describe("3. Table Header Alignment & Synchronization", () => {
    it("renders matching headers for all 8 prioritized columns", () => {
      const html = renderToStaticMarkup(
        React.createElement("table", null,
          React.createElement(TaskTableHeader, {
            allSelected: false,
            showSelection: true,
            showExpandAll: true,
            isAllExpanded: false,
            onToggleExpandAll: () => {},
          })
        )
      );

      assert.ok(html.includes("Nhiệm vụ"), "Header contains Nhiệm vụ");
      assert.ok(html.includes("Đơn vị"), "Header contains Đơn vị");
      assert.ok(html.includes("DRI"), "Header contains DRI");
      assert.ok(html.includes("Tiến độ"), "Header contains Tiến độ");
      assert.ok(html.includes("Hạn"), "Header contains Hạn");
      assert.ok(html.includes("Trạng thái"), "Header contains Trạng thái");
      assert.ok(html.includes("Thao tác"), "Header contains Thao tác");
      assert.ok(html.includes('aria-label="Mở rộng tất cả việc con"'), "Contains expand all toggle");
    });
  });

  describe("4. Floating Bulk Actions Bar (BatchActionBar)", () => {
    it("returns null when selectedCount <= 0", () => {
      const html = renderToStaticMarkup(
        React.createElement(BatchActionBar, {
          selectedCount: 0,
          selectedIds: [],
          onClearSelection: () => {},
        })
      );
      assert.equal(html, "");
    });

    it("renders floating dock with [[x] N nhiệm vụ được chọn], [Đổi trạng thái], [Giao lại], [Gia hạn], [Xuất], [Esc Bỏ chọn]", () => {
      const html = renderToStaticMarkup(
        React.createElement(BatchActionBar, {
          selectedCount: 4,
          selectedIds: ["t-1", "t-2", "t-3", "t-4"],
          totalCount: 12,
          onClearSelection: () => {},
          onBulkStatusChange: () => {},
          onBulkExtendDeadline: () => {},
          onBulkReassign: () => {},
          onExportExcel: () => {},
        })
      );

      // [[x] N nhiệm vụ được chọn]
      assert.ok(html.includes("Đã chọn"), "Mentions selection count");
      assert.ok(html.includes("4"), "Displays 4 selected count");
      assert.ok(html.includes("/12"), "Displays total 12 tasks count");
      assert.ok(html.includes("nhiệm vụ được chọn"), "Follows required brief copy");

      // [Đổi trạng thái]
      assert.ok(html.includes("Đổi trạng thái..."), "Contains status change select");
      assert.ok(html.includes("Hoàn thành"), "Contains Hoàn thành quick action");

      // [Giao lại]
      assert.ok(html.includes("Giao lại"), "Contains Giao lại action button");

      // [Gia hạn]
      assert.ok(html.includes("Gia hạn hạn chót..."), "Contains deadline extension select");
      assert.ok(html.includes("+7 ngày (1 tuần)"), "Contains 7-day option");

      // [Xuất]
      assert.ok(html.includes("Xuất Excel"), "Contains export action button");

      // [Esc Bỏ chọn]
      assert.ok(html.includes("Bỏ chọn"), "Contains deselect button");
      assert.ok(html.includes("Esc"), "Mentions Esc keyboard hint");

      // Floating styling
      assert.ok(html.includes("fixed bottom-6"), "Floating positioned at bottom of viewport");
      assert.ok(html.includes("shadow-xl"), "Subtle prominent shadow");
      assert.ok(html.includes("rounded-2xl"), "Rounded border container");
    });

    it("calculates extended deadline safely using UTC", () => {
      const base = "2026-09-09";
      assert.equal(calculateExtendedDeadline(3, base), "2026-09-12");
      assert.equal(calculateExtendedDeadline(7, base), "2026-09-16");
      assert.equal(calculateExtendedDeadline(14, base), "2026-09-23");
      assert.equal(calculateExtendedDeadline(30, base), "2026-10-09");
    });

    it("constructs correct payloads for bulk operations", () => {
      const ids = ["task-1", "task-2"];
      const statusPayload = getBatchStatusUpdatePayload(ids, "COMPLETED");
      assert.deepEqual(statusPayload, { taskIds: ids, status: "COMPLETED" });

      const deadlinePayload = getBatchDeadlinePayload(ids, "2026-10-15");
      assert.deepEqual(deadlinePayload, { taskIds: ids, dueDate: "2026-10-15" });

      const reassignPayload = getBatchReassignPayload(ids, "user-456");
      assert.deepEqual(reassignPayload, { taskIds: ids, assigneeId: "user-456" });
    });
  });

  describe("5. Anti-Slop & Light-Only Standard Compliance", () => {
    const taskRowSource = fs.readFileSync(
      path.join(process.cwd(), "src/components/tasks/table/components/task-row.tsx"),
      "utf8"
    );
    const batchBarSource = fs.readFileSync(
      path.join(process.cwd(), "src/components/tasks/table/components/batch-action-bar.tsx"),
      "utf8"
    );
    const tableHeaderSource = fs.readFileSync(
      path.join(process.cwd(), "src/components/tasks/table/components/task-table-header.tsx"),
      "utf8"
    );

    it("contains zero dark: utility classes across all modified components", () => {
      assert.equal(taskRowSource.includes("dark:"), false, "No dark: in task-row.tsx");
      assert.equal(batchBarSource.includes("dark:"), false, "No dark: in batch-action-bar.tsx");
      assert.equal(tableHeaderSource.includes("dark:"), false, "No dark: in task-table-header.tsx");
    });

    it("contains zero decorative emojis across all code and labels", () => {
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      assert.equal(emojiRegex.test(taskRowSource), false, "No emojis in task-row.tsx");
      assert.equal(emojiRegex.test(batchBarSource), false, "No emojis in batch-action-bar.tsx");
      assert.equal(emojiRegex.test(tableHeaderSource), false, "No emojis in task-table-header.tsx");
    });

    it("complies with typography floor >= 12px (no micro-fonts like text-[10px], text-[9px])", () => {
      const microFontRegex = /text-\[(?:8|9|10|11)px\]/;
      assert.equal(microFontRegex.test(taskRowSource), false, "No sub-12px font in task-row.tsx");
      assert.equal(microFontRegex.test(batchBarSource), false, "No sub-12px font in batch-action-bar.tsx");
      assert.equal(microFontRegex.test(tableHeaderSource), false, "No sub-12px font in task-table-header.tsx");
    });
  });
});
