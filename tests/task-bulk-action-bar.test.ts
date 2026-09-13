import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  TaskBulkActionBar,
  calculateExtendedDeadline,
  getBatchStatusUpdatePayload,
  getBatchDeadlinePayload,
  getBatchReassignPayload,
} from "../src/components/tasks/table/components/task-bulk-action-bar";
import {
  TaskTableToolbar,
  isSearchShortcut,
  aggregateFilterCounts,
} from "../src/components/tasks/table/components/task-table-toolbar";
import type { SchoolTask, StaffTask } from "@/types/dashboard";

describe("Task 4: Interactive Toolbars - Filter Pills & Floating Bulk Action Dock", () => {
  // Mock tasks fixture for testing
  const mockTasks: SchoolTask[] = [
    {
      id: "task-01",
      code: "NV-01",
      title: "Triển khai phần mềm quản lý công việc",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueDate: "2026-09-09", // Today based on reference date 2026-09-09
      progressPercent: 50,
      totalSubTasks: 1,
      completedSubTasks: 1,
      leadAssigneeName: "Nguyễn Văn A",
      leadAssigneeId: "user-1",
      coAssignees: [],
      assignedDate: "2026-09-01",
      department: "Khoa CNTT",
      departmentId: "CNTT",
      subTasks: [
        {
          id: "sub-01",
          title: "Thiết kế cơ sở dữ liệu",
          status: "COMPLETED",
          dueDate: "2026-09-05",
          assigneeName: "Trần B",
          assigneeId: "user-2",
        } as StaffTask,
      ],
    },
    {
      id: "task-02",
      code: "NV-02",
      title: "Báo cáo an toàn thông tin quý 3",
      category: "ATTT",
      categoryLabel: "An toàn thông tin",
      status: "OVERDUE",
      priority: "URGENT",
      dueDate: "2026-09-01", // Past due
      progressPercent: 20,
      totalSubTasks: 0,
      completedSubTasks: 0,
      leadAssigneeName: "Trần B",
      leadAssigneeId: "user-2",
      coAssignees: [],
      assignedDate: "2026-08-15",
      department: "TT An toàn thông tin",
      departmentId: "ATTT",
      subTasks: [],
    },
    {
      id: "task-03",
      code: "NV-03",
      title: "Nghiệm thu hồ sơ minh chứng đào tạo",
      category: "BAO_CAO",
      categoryLabel: "Báo cáo",
      status: "WAITING_APPROVAL",
      priority: "NORMAL",
      dueDate: "2026-09-20",
      progressPercent: 100,
      totalSubTasks: 0,
      completedSubTasks: 0,
      leadAssigneeName: "Lê C",
      leadAssigneeId: "user-3",
      coAssignees: [],
      assignedDate: "2026-09-02",
      department: "Phòng Đào tạo",
      departmentId: "DAO_TAO",
      subTasks: [],
    },
    {
      id: "task-04",
      code: "NV-04",
      title: "Hoàn thiện thư viện điện tử",
      category: "THU_VIEN",
      categoryLabel: "Thư viện",
      status: "COMPLETED",
      priority: "NORMAL",
      dueDate: "2026-08-30",
      progressPercent: 100,
      totalSubTasks: 0,
      completedSubTasks: 0,
      leadAssigneeName: "Nguyễn Văn A",
      leadAssigneeId: "user-1",
      coAssignees: [],
      assignedDate: "2026-08-01",
      department: "Thư viện",
      departmentId: "THU_VIEN",
      subTasks: [],
    },
  ];

  describe("1. Keyboard Shortcut Engine (isSearchShortcut)", () => {
    it("activates search on '/' key press when target is not an input element", () => {
      const eventOnBody = { key: "/", target: { tagName: "BODY" } };
      assert.equal(isSearchShortcut(eventOnBody), true);

      const eventOnDiv = { key: "/", target: { tagName: "DIV" } };
      assert.equal(isSearchShortcut(eventOnDiv), true);

      const eventNullTarget = { key: "/" };
      assert.equal(isSearchShortcut(eventNullTarget), true);
    });

    it("does NOT activate search on '/' key press when typing inside input/textarea/select", () => {
      const eventInInput = { key: "/", target: { tagName: "INPUT" } };
      assert.equal(isSearchShortcut(eventInInput), false);

      const eventInTextarea = { key: "/", target: { tagName: "TEXTAREA" } };
      assert.equal(isSearchShortcut(eventInTextarea), false);

      const eventInSelect = { key: "/", target: { tagName: "SELECT" } };
      assert.equal(isSearchShortcut(eventInSelect), false);

      const eventInEditable = {
        key: "/",
        target: { isContentEditable: true },
      };
      assert.equal(isSearchShortcut(eventInEditable), false);
    });

    it("activates search on Cmd+K or Ctrl+K regardless of target element", () => {
      const eventCmdK = { key: "k", metaKey: true };
      assert.equal(isSearchShortcut(eventCmdK), true);

      const eventCtrlK = { key: "K", ctrlKey: true };
      assert.equal(isSearchShortcut(eventCtrlK), true);

      const eventCmdKInInput = {
        key: "k",
        metaKey: true,
        target: { tagName: "INPUT" },
      };
      assert.equal(isSearchShortcut(eventCmdKInInput), true);
    });

    it("ignores other unrelated keys", () => {
      assert.equal(isSearchShortcut({ key: "j" }), false);
      assert.equal(isSearchShortcut({ key: "Enter" }), false);
      assert.equal(isSearchShortcut({ key: "Escape" }), false);
    });
  });

  describe("2. Filter Pills Count Aggregation & Active Selection", () => {
    it("correctly aggregates counts across smart filter categories", () => {
      const counts = aggregateFilterCounts(mockTasks, {
        currentUserId: "user-1",
        currentUserName: "Nguyễn Văn A",
        referenceDate: "2026-09-09",
      });

      // All tasks
      assert.equal(counts.all, 4);

      // My tasks (user-1 is lead on task-01 and task-04)
      assert.equal(counts.my_tasks, 2);

      // Overdue (task-02 is OVERDUE and past due)
      assert.equal(counts.overdue, 1);

      // Review (task-03 is WAITING_APPROVAL)
      assert.equal(counts.review, 1);

      // Today (task-01 has dueDate 2026-09-09)
      assert.equal(counts.today, 1);

      // In progress (task-01 is IN_PROGRESS)
      assert.equal(counts.in_progress, 1);

      // Completed (task-04 is COMPLETED)
      assert.equal(counts.completed, 1);
    });

    it("renders filter pills with active state and count badges in TaskTableToolbar", () => {
      const counts = aggregateFilterCounts(mockTasks, {
        currentUserId: "user-1",
        referenceDate: "2026-09-09",
      });

      const html = renderToStaticMarkup(
        React.createElement(TaskTableToolbar, {
          searchQuery: "",
          onSearchChange: () => {},
          activeTab: "overdue",
          onTabChange: () => {},
          pillCounts: counts,
          selectedDepartment: "ALL",
          onDepartmentChange: () => {},
          selectedCategory: "ALL",
          onCategoryChange: () => {},
          density: "comfortable",
          onDensityChange: () => {},
          viewMode: "table",
          onViewModeChange: () => {},
        })
      );

      // Role tablist present
      assert.ok(html.includes('role="tablist"'));

      // Overdue pill should be selected
      assert.ok(
        html.includes('aria-selected="true"') && html.includes("Quá hạn"),
        "Overdue tab should have aria-selected='true'"
      );

      // Count badge 1 should be visible
      assert.ok(html.includes("Quá hạn"));
      assert.ok(html.includes("1"));
      assert.ok(html.includes("Tất cả"));
      assert.ok(html.includes("4"));
    });

    it("integrates totalTasksCount as fallback when pillCounts.all is omitted", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskTableToolbar, {
          searchQuery: "",
          onSearchChange: () => {},
          activeTab: "all",
          onTabChange: () => {},
          totalTasksCount: 42,
          selectedDepartment: "ALL",
          selectedCategory: "ALL",
        })
      );

      assert.ok(html.includes("Tất cả"));
      assert.ok(html.includes("42"));
    });
  });

  describe("3. Bulk Action Payloads & Date Extension Calculation", () => {
    it("generates correct batch status update payload", () => {
      const taskIds = ["task-01", "task-02", "task-03"];
      const payload = getBatchStatusUpdatePayload(taskIds, "COMPLETED");

      assert.deepEqual(payload, {
        taskIds: ["task-01", "task-02", "task-03"],
        status: "COMPLETED",
      });
    });

    it("generates correct batch deadline payload", () => {
      const taskIds = ["task-01", "task-02"];
      const payload = getBatchDeadlinePayload(taskIds, "2026-09-16");

      assert.deepEqual(payload, {
        taskIds: ["task-01", "task-02"],
        dueDate: "2026-09-16",
      });
    });

    it("generates correct batch reassign payload", () => {
      const taskIds = ["task-01", "task-02"];
      const payload = getBatchReassignPayload(taskIds, "user-lead-99");

      assert.deepEqual(payload, {
        taskIds: ["task-01", "task-02"],
        assigneeId: "user-lead-99",
      });
    });

    it("calculates extended deadline safely using UTC to prevent date drift", () => {
      const baseDate = "2026-09-09";

      // +3 days
      assert.equal(calculateExtendedDeadline(3, baseDate), "2026-09-12");

      // +7 days (1 week)
      assert.equal(calculateExtendedDeadline(7, baseDate), "2026-09-16");

      // +14 days (2 weeks)
      assert.equal(calculateExtendedDeadline(14, baseDate), "2026-09-23");

      // +30 days
      assert.equal(calculateExtendedDeadline(30, baseDate), "2026-10-09");
    });
  });

  describe("4. TaskBulkActionBar Accessibility & Presentation", () => {
    it("returns null when selectedCount is 0", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskBulkActionBar, {
          selectedCount: 0,
          selectedIds: [],
          onClearSelection: () => {},
        })
      );
      assert.equal(html, "");
    });

    it("renders floating dock with aria-live and aria-label when selectedCount > 0", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskBulkActionBar, {
          selectedCount: 3,
          selectedIds: ["task-01", "task-02", "task-03"],
          totalCount: 10,
          onClearSelection: () => {},
          onBulkStatusChange: () => {},
          onBulkExtendDeadline: () => {},
          onExportExcel: () => {},
          // P0-07: the bar exposes only transitions valid for the whole
          // selection, so rendering its approval actions requires capability.
          allowedLifecycleTargets: [
            "IN_PROGRESS",
            "WAITING_APPROVAL",
            "NEEDS_REVIEW",
            "COMPLETED",
            "CANCELLED",
          ],
        })
      );

      // Aria-live region for accessibility announcement
      assert.ok(html.includes('role="region"'));
      assert.ok(html.includes('aria-live="polite"'));
      assert.ok(html.includes('aria-label="Thao tác hàng loạt"'));

      // Selected counter display
      assert.ok(html.includes("Đã chọn"));
      assert.ok(html.includes("3"));
      assert.ok(html.includes("/10"));

      // Actions present
      assert.ok(html.includes("Hoàn thành"));
      assert.ok(html.includes("Đổi trạng thái..."));
      assert.ok(html.includes("Gia hạn hạn chót..."));
      assert.ok(html.includes("Xuất Excel"));
      assert.ok(html.includes("Bỏ chọn"));
      assert.ok(html.includes("Esc"));
    });

    it("P0-07: withholds approval actions the whole selection may not perform", () => {
      // Regression: before the fix the bar always offered "Hoàn thành" and a
      // free status dropdown, letting an actor bulk-approve a selection that
      // included tasks they had no authority over.
      const html = renderToStaticMarkup(
        React.createElement(TaskBulkActionBar, {
          selectedCount: 2,
          selectedIds: ["task-01", "task-02"],
          onClearSelection: () => {},
          onBulkStatusChange: () => {},
          // Capability computed for this selection: write-only, no approval.
          allowedLifecycleTargets: ["IN_PROGRESS", "CANCELLED"],
        })
      );

      assert.ok(
        !html.includes("Đánh dấu hoàn thành tất cả công việc đã chọn"),
        "quick COMPLETED action must be withheld when the selection is not approvable"
      );
      assert.ok(
        !html.includes('<option value="COMPLETED"'),
        "COMPLETED must not be offered as a bulk status option"
      );
      assert.ok(
        !html.includes('<option value="WAITING_APPROVAL"'),
        "WAITING_APPROVAL must not be offered as a bulk status option"
      );

      // The bar must still expose what IS permitted.
      assert.ok(html.includes('<option value="IN_PROGRESS"'), "permitted options remain");
    });

    it("P0-07: fails safe when no capability information is supplied", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskBulkActionBar, {
          selectedCount: 1,
          selectedIds: ["task-01"],
          onClearSelection: () => {},
          onBulkStatusChange: () => {},
        })
      );

      assert.ok(
        !html.includes("Đánh dấu hoàn thành tất cả công việc đã chọn"),
        "without capability information the bar must not offer a bulk approval"
      );
    });

    it("renders batch reassign action when onBulkReassign is provided", () => {
      let reassignCalled = false;
      const onBulkReassign = () => {
        reassignCalled = true;
      };

      const html = renderToStaticMarkup(
        React.createElement(TaskBulkActionBar, {
          selectedCount: 2,
          selectedIds: ["task-01", "task-02"],
          onClearSelection: () => {},
          onBulkReassign,
        })
      );

      assert.ok(html.includes("Phân công lại"));
      assert.ok(
        html.includes('aria-label="Phân công lại các công việc đã chọn"')
      );
    });

    it("renders optional Delete action when onBulkDelete is provided", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskBulkActionBar, {
          selectedCount: 2,
          selectedIds: ["task-01", "task-02"],
          onClearSelection: () => {},
          onBulkDelete: () => {},
        })
      );

      assert.ok(html.includes("Xóa"));
    });
  });

  describe("5. TaskTableToolbar Presentation Controls", () => {
    it("renders search input, department dropdown, category dropdown, density controls, and action buttons", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskTableToolbar, {
          searchQuery: "Nhiệm vụ số",
          onSearchChange: () => {},
          activeTab: "all",
          onTabChange: () => {},
          selectedDepartment: "CNTT",
          onDepartmentChange: () => {},
          selectedCategory: "CHUYEN_DOI_SO",
          onCategoryChange: () => {},
          density: "compact",
          onDensityChange: () => {},
          viewMode: "kanban",
          onViewModeChange: () => {},
          onAddTask: () => {},
          onExportExcel: () => {},
        })
      );

      // Search input
      assert.ok(html.includes('aria-label="Tìm kiếm nhiệm vụ"'));
      assert.ok(html.includes('value="Nhiệm vụ số"'));
      assert.ok(html.includes('aria-label="Xóa từ khóa tìm kiếm"'));

      // Department dropdown
      assert.ok(html.includes('aria-label="Lọc theo đơn vị phòng ban"'));

      // Category dropdown
      assert.ok(html.includes('aria-label="Lọc theo danh mục DACUM"'));

      // Density control
      assert.ok(html.includes('aria-label="Mật độ hiển thị bảng"'));
      assert.ok(html.includes('aria-label="Chế độ hiển thị gọn"'));

      // View mode control
      assert.ok(html.includes('aria-label="Chế độ xem không gian làm việc"'));
      assert.ok(html.includes("Kanban"));
      assert.ok(html.includes("Bảng"));

      // Action buttons
      assert.ok(html.includes("Thêm công việc"));
      assert.ok(html.includes("Xuất Excel"));
    });

    it("renders loading spinner in search input when loading prop is true", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskTableToolbar, {
          searchQuery: "",
          onSearchChange: () => {},
          activeTab: "all",
          onTabChange: () => {},
          loading: true,
        })
      );

      assert.ok(html.includes('aria-label="Đang tải dữ liệu"'));
      assert.ok(html.includes("animate-spin"));
    });
  });

  describe("6. Anti-Slop & Design System Audit", () => {
    const targetFiles = [
      "src/components/tasks/table/components/task-table-toolbar.tsx",
      "src/components/tasks/table/components/task-bulk-action-bar.tsx",
    ];

    it("contains zero dark: utility classes (Light-Only Standard)", () => {
      for (const relPath of targetFiles) {
        const fullPath = path.join(process.cwd(), relPath);
        assert.ok(fs.existsSync(fullPath), `File must exist: ${relPath}`);
        const content = fs.readFileSync(fullPath, "utf-8");
        assert.ok(
          !content.includes("dark:"),
          `File ${relPath} must NOT contain dark: classes (found dark:)`
        );
      }
    });

    it("contains zero decorative emojis across all code and labels", () => {
      const emojiRegex =
        /[\u{1F300}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

      for (const relPath of targetFiles) {
        const fullPath = path.join(process.cwd(), relPath);
        const content = fs.readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");
        lines.forEach((line, idx) => {
          assert.ok(
            !emojiRegex.test(line),
            `Found decorative emoji in ${relPath}:${idx + 1}: ${line}`
          );
        });
      }
    });

    it("complies with typography floor >= 12px (no text-[10px], text-[9px], text-[11px])", () => {
      const microFontRegex = /text-\[(?:[0-9]|10|11)px\]/g;

      for (const relPath of targetFiles) {
        const fullPath = path.join(process.cwd(), relPath);
        const content = fs.readFileSync(fullPath, "utf-8");
        const matches = content.match(microFontRegex);
        assert.equal(
          matches,
          null,
          `File ${relPath} contains typography micro-classes below 12px floor: ${JSON.stringify(
            matches
          )}`
        );
      }
    });
  });
});
