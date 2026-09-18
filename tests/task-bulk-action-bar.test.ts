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
  TaskRow,
  CircularProgressRing,
  areTaskRowPropsEqual,
  parseLeadAssignee,
} from "../src/components/tasks/table/components/task-row";
import { BatchActionBar } from "../src/components/tasks/table/components/batch-action-bar";
import { TaskTableHeader } from "../src/components/tasks/table/components/task-table-header";
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
    it("renders the T10 first row and offers department, category, density and view controls on the disclosed panels", () => {
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

      // Plan T10 desktop north star, standing open:
      // [Scope] [Search] [Filter] [Display] [Giao việc]
      assert.ok(html.includes('aria-label="Tìm kiếm nhiệm vụ"'));
      assert.ok(html.includes('value="Nhiệm vụ số"'));
      assert.ok(html.includes('aria-label="Xóa từ khóa tìm kiếm"'));
      assert.ok(html.includes("Tạo nhiệm vụ") || html.includes("Thêm công việc"));
      assert.ok(html.includes(">Lọc<"));
      assert.ok(html.includes("Hiển thị"));

      // T10: the rest live on secondary surfaces, so they must NOT stand open.
      for (const disclosed of [
        'aria-label="Lọc theo đơn vị phòng ban"',
        'aria-label="Mật độ hiển thị bảng"',
        'aria-label="Chế độ hiển thị gọn"',
        'aria-label="Chế độ xem không gian làm việc"',
      ]) {
        assert.ok(
          !html.includes(disclosed),
          `${disclosed} must be disclosed, not standing open on the first row`
        );
      }

      // …but every one of them must still be offered by the toolbar.
      const toolbarSrc = fs.readFileSync(
        path.resolve(
          process.cwd(),
          "src/components/tasks/table/components/task-table-toolbar.tsx"
        ),
        "utf-8"
      );
      assert.ok(toolbarSrc.includes('data-slot="desktop-filter-panel"'), "Filter panel must exist");
      assert.ok(toolbarSrc.includes('data-slot="desktop-display-panel"'), "Display panel must exist");
      for (const offered of [
        'aria-label="Lọc theo đơn vị phòng ban"',
        'aria-label="Mật độ hiển thị bảng"',
        'aria-label="Chế độ hiển thị gọn"',
        'aria-label="Chế độ xem không gian làm việc"',
        "Xuất Excel",
      ]) {
        assert.ok(toolbarSrc.includes(offered), `Toolbar must still offer ${offered}`);
      }
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

});

// ---------------------------------------------------------------------------
// Merged from task-row-bulk-actions.test.ts — TaskRow render, header, batch bar
// ---------------------------------------------------------------------------
describe("Task Row Simplification & Bulk Action Floating Bar", () => {
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

  describe("1. Prioritized Row Columns Hierarchy (TaskRow)", () => {
    it("renders prioritized columns in correct order: Checkbox, Nhiệm vụ, Trạng thái, Ưu tiên, Chủ trì/Đơn vị, Hạn, Việc con, Tiến độ, Actions", () => {
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
      assert.ok(html.includes(`data-task-id="${mockTask.id}"`), "Preserves internal task id");

      // 2. Nhiệm vụ (Title)
      assert.ok(
        html.includes("Xây dựng khung năng lực số cho sinh viên ngành CNTT"),
        "Should render task title"
      );

      // 3. Đơn vị & Chủ trì (Phụ trách)
      assert.ok(html.includes("Khoa CNTT"), "Should render department");
      assert.ok(html.includes("Nguyễn Tiến Phong"), "Should render DRI name");
      assert.ok(html.includes('src="https://example.com/avatar1.jpg"'), "Should render avatar");

      // 4. Hạn (SLA formatted date)
      assert.ok(html.includes("30/09/2026"), "Should render SLA formatted date");

      // 5. Trạng thái (Single clear status badge)
      assert.ok(html.includes("Đang thực hiện"), "Should render status badge");

      // 6. Actions (Overflow menu button)
      assert.ok(html.includes('aria-label="Thao tác nhanh"'), "Should render overflow menu button");
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
      assert.ok(
        !html.includes(">Duyệt<"),
        "Standard IN_PROGRESS task should NOT have inline Duyệt button"
      );
    });

    it("renders WAITING_APPROVAL status health indicator clearly", () => {
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
        htmlWaiting.includes("Chờ duyệt"),
        "WAITING_APPROVAL task must display Chờ duyệt health indicator"
      );
    });

    it("renders clean action menu trigger without cluttered inline buttons", () => {
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
        htmlReadOnly.includes('aria-label="Thao tác nhanh"'),
        "Task row must render contextual action menu trigger"
      );
    });
  });

  describe("3. Table Header Alignment & Synchronization", () => {
    it("renders matching headers for prioritized columns", () => {
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
      assert.ok(html.includes("Phụ trách") || html.includes("Chủ trì"), "Header contains Phụ trách");
      assert.ok(html.includes("Phối hợp") || html.includes("Việc con"), "Header contains Phối hợp");
      assert.ok(html.includes("Thời hạn") || html.includes("Hạn"), "Header contains Thời hạn");
      assert.ok(html.includes("Tình trạng") || html.includes("Trạng thái"), "Header contains Tình trạng");
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
          allowedLifecycleTargets: [
            "IN_PROGRESS",
            "WAITING_APPROVAL",
            "NEEDS_REVIEW",
            "COMPLETED",
            "CANCELLED",
          ],
        })
      );

      assert.ok(html.includes("Đã chọn"), "Mentions selection count");
      assert.ok(html.includes("4"), "Displays 4 selected count");
      assert.ok(html.includes("/12"), "Displays total 12 tasks count");
      assert.ok(html.includes("nhiệm vụ được chọn"), "Follows required brief copy");

      assert.ok(html.includes("Đổi trạng thái..."), "Contains status change select");
      assert.ok(html.includes("Hoàn thành"), "Contains Hoàn thành quick action");
      assert.ok(html.includes("Giao lại"), "Contains Giao lại action button");
      assert.ok(html.includes("Gia hạn hạn chót..."), "Contains deadline extension select");
      assert.ok(html.includes("+7 ngày (1 tuần)"), "Contains 7-day option");
      assert.ok(html.includes("Xuất Excel"), "Contains export action button");
      assert.ok(html.includes("Bỏ chọn"), "Contains deselect button");
      assert.ok(html.includes("Esc"), "Mentions Esc keyboard hint");
    });
  });

  describe("5. TaskRow Title Primacy, Progress Rules & SLA Icon", () => {
    function renderRow(task: SchoolTask, extraProps: Record<string, unknown> = {}): string {
      return renderToStaticMarkup(
        React.createElement("table", null,
          React.createElement("tbody", null,
            React.createElement(TaskRow, { task, ...extraProps } as never)
          )
        )
      );
    }

    it("renders title as primary and keeps internal task id on container", () => {
      const html = renderRow(mockTask, { showSelection: false });
      const title = "Xây dựng khung năng lực số cho sinh viên ngành CNTT";
      assert.ok(html.includes(title), "title must render");
      assert.ok(html.includes(`data-task-id="${mockTask.id}"`), "internal task id must be preserved");
    });

    it("renders 0% progress with 0% text", () => {
      const html = renderToStaticMarkup(
        React.createElement(CircularProgressRing, { percent: 0 })
      );
      assert.ok(html.includes("0%"), "0% text must render");
    });

    it("renders completed 100% with 100% text", () => {
      const html = renderToStaticMarkup(
        React.createElement(CircularProgressRing, { percent: 100 })
      );
      assert.ok(html.includes("100%"), "100% text must render");
    });

    it("renders partial progress with ring indicator", () => {
      const html = renderToStaticMarkup(
        React.createElement(CircularProgressRing, { percent: 45 })
      );
      assert.ok(html.includes("45%"), "45% text must render");
      assert.ok(html.includes("<svg"), "progress must render ring svg");
    });

    it("renders overdue SLA chip with Quá hạn text", () => {
      const html = renderRow(
        { ...mockTask, dueDate: "2026-09-01", status: "IN_PROGRESS" },
        { referenceDate: "2026-09-09" }
      );
      assert.ok(html.includes("Quá hạn"), "overdue chip must show Quá hạn");
    });
  });
});
