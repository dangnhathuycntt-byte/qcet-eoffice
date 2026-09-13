import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  groupTasksByStatus,
  KANBAN_COLUMNS,
  getNextStatus,
  getPrevStatus,
  filterKanbanItems,
  mapTaskStatusToKanbanColumn,
  TaskKanbanBoard,
  type KanbanItem,
} from "../src/components/tasks/task-kanban-board";
import type { SchoolTask } from "../src/types/dashboard";

describe("TaskKanbanBoard Helpers & Anti-Slop Contract", () => {
  test("KANBAN_COLUMNS defines 4 status columns with zero emojis", () => {
    assert.equal(KANBAN_COLUMNS.length, 4);
    assert.equal(KANBAN_COLUMNS[0].id, "NEW");
    assert.equal(KANBAN_COLUMNS[1].id, "IN_PROGRESS");
    assert.equal(KANBAN_COLUMNS[2].id, "NEEDS_REVIEW");
    assert.equal(KANBAN_COLUMNS[3].id, "COMPLETED");

    // Assert Vietnamese labels match the required specifications
    assert.ok(
      KANBAN_COLUMNS[0].title.includes("Mới"),
      "Column 0 must represent Mới / Tiếp nhận"
    );
    assert.equal(KANBAN_COLUMNS[1].title, "Đang thực hiện");
    assert.equal(KANBAN_COLUMNS[2].title, "Cần chỉnh sửa");
    assert.equal(KANBAN_COLUMNS[3].title, "Hoàn thành");

    // Zero emojis in columns configuration
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    for (const col of KANBAN_COLUMNS) {
      assert.ok(!emojiRegex.test(col.title), `Column title "${col.title}" must not contain emojis`);
      assert.ok(!emojiRegex.test(col.label), `Column label "${col.label}" must not contain emojis`);
      assert.equal(col.emoji || "", "", `Column emoji property must be empty`);
    }
  });

  test("groupTasksByStatus correctly partitions tasks into 4 status buckets", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "t1",
        title: "Task 1",
        category: "CNTT",
        categoryLabel: "CNTT",
        leadAssigneeName: "Hùng",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-20",
        status: "IN_PROGRESS",
        subTasks: [
          {
            id: "sub-1",
            title: "Sub 1",
            assigneeName: "Hùng",
            status: "NEW",
            dueDate: "2026-09-20",
            parentSchoolTaskId: "t1",
            updatedAt: "2026-09-01",
          },
        ],
        totalSubTasks: 1,
        completedSubTasks: 0,
        progressPercent: 0,
      },
    ];

    const grouped = groupTasksByStatus(mockTasks);
    assert.equal(grouped.IN_PROGRESS.length, 1);
    assert.equal(grouped.NEW.length, 1);
    assert.equal(grouped.NEEDS_REVIEW.length, 0);
    assert.equal(grouped.COMPLETED.length, 0);
  });

  test("getNextStatus and getPrevStatus transition correctly across all 4 columns", () => {
    assert.equal(getNextStatus("NEW"), "IN_PROGRESS");
    assert.equal(getNextStatus("IN_PROGRESS"), "NEEDS_REVIEW");
    assert.equal(getNextStatus("NEEDS_REVIEW"), "COMPLETED");
    assert.equal(getNextStatus("COMPLETED"), null);

    assert.equal(getPrevStatus("NEW"), null);
    assert.equal(getPrevStatus("IN_PROGRESS"), "NEW");
    assert.equal(getPrevStatus("NEEDS_REVIEW"), "IN_PROGRESS");
    assert.equal(getPrevStatus("COMPLETED"), "NEEDS_REVIEW");
  });

  test("filterKanbanItems accurately filters by level, category, and search query", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "t1",
        title: "Triển khai hệ thống mạng",
        category: "CNTT",
        categoryLabel: "CNTT",
        leadAssigneeName: "Trần Hùng",
        coAssignees: ["Nguyễn An"],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-20",
        status: "IN_PROGRESS",
        subTasks: [
          {
            id: "sub-1",
            title: "Lắp đặt Switch Core",
            assigneeName: "Lê Cường",
            status: "IN_PROGRESS",
            dueDate: "2026-09-15",
            parentSchoolTaskId: "t1",
            updatedAt: "2026-09-01",
          },
        ],
        totalSubTasks: 1,
        completedSubTasks: 0,
        progressPercent: 0,
      },
      {
        id: "t2",
        title: "Báo cáo an toàn thông tin",
        category: "ATTT",
        categoryLabel: "An toàn thông tin",
        leadAssigneeName: "Mai Đinh Thị Xuân",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-10",
        status: "COMPLETED",
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 100,
      },
    ];

    // Filter level: TRUONG
    const truongOnly = filterKanbanItems(mockTasks, "TRUONG", "ALL", "");
    assert.equal(truongOnly.length, 2);
    assert.ok(truongOnly.every((item) => item.level === "TRUONG"));

    // Filter level: DON_VI
    const donViOnly = filterKanbanItems(mockTasks, "DON_VI", "ALL", "");
    assert.equal(donViOnly.length, 1);
    assert.equal(donViOnly[0].id, "sub-1");

    // Filter category: ATTT
    const atttOnly = filterKanbanItems(mockTasks, "ALL", "ATTT", "");
    assert.equal(atttOnly.length, 1);
    assert.equal(atttOnly[0].id, "t2");

    // Search query
    const searchSwitch = filterKanbanItems(mockTasks, "ALL", "ALL", "Switch");
    assert.equal(searchSwitch.length, 1);
    assert.equal(searchSwitch[0].id, "sub-1");
  });

  test("Anti-slop check: 0% decorative emojis across kanban board and tasks pages", () => {
    const filesToCheck = [
      "../src/components/tasks/task-kanban-board.tsx",
      "../src/app/tasks/page.tsx",
      "../src/app/unit-tasks/page.tsx",
    ];

    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

    for (const relativePath of filesToCheck) {
      const fullPath = path.resolve(__dirname, relativePath);
      assert.ok(fs.existsSync(fullPath), `File ${relativePath} must exist`);
      const content = fs.readFileSync(fullPath, "utf-8");
      assert.ok(
        !emojiRegex.test(content),
        `File ${relativePath} must not contain any decorative emojis`
      );
    }
  });

  test("Kanban card styling adheres to anti-slop guidelines", () => {
    const kanbanPath = path.resolve(__dirname, "../src/components/tasks/task-kanban-board.tsx");
    const content = fs.readFileSync(kanbanPath, "utf-8");

    // Assert hairline borders and rounded-lg
    assert.ok(
      content.includes("rounded-lg") || content.includes("rounded-xl"),
      "Kanban card must use subtle rounded corners"
    );
    assert.ok(
      content.includes("border-border/60") || content.includes("border-border"),
      "Kanban card must use subtle hairline borders"
    );

    // Assert micro-pill font-mono tabular-nums counters
    assert.ok(
      content.includes("font-mono") && content.includes("tabular-nums"),
      "Counters must use font-mono tabular-nums"
    );

    // Assert action menu button (⋯) is present — replaces avatar 22px check
    assert.ok(
      content.includes('aria-label="Thao tác"') || content.includes("MoreHorizontal"),
      "Card must render ⋯ action menu button (MoreHorizontal icon)"
    );

    // Assert micro progress bar
    assert.ok(
      content.includes("h-1") || content.includes("h-0.5"),
      "Micro progress bar must be h-1 or h-0.5"
    );

    // Assert strokeWidth={1.5}
    assert.ok(
      content.includes("strokeWidth={1.5}"),
      "Lucide icons must be standardized to strokeWidth={1.5}"
    );

    // Assert permanent status select dropdown is NOT present
    assert.ok(
      !content.includes("<select") && !content.includes("status-select-"),
      "Kanban card must NOT render a permanent status <select> dropdown"
    );

    // Assert prev/next chevron buttons (ChevronLeft) are NOT present on cards
    assert.ok(
      !content.includes("ChevronLeft"),
      "Kanban card must NOT render ChevronLeft prev-status button"
    );
  });

  test("mapTaskStatusToKanbanColumn strictly maps operational statuses to 4 columns", () => {
    assert.equal(mapTaskStatusToKanbanColumn("NOT_STARTED"), "NEW");
    assert.equal(mapTaskStatusToKanbanColumn("NEW"), "NEW");
    assert.equal(mapTaskStatusToKanbanColumn("IN_PROGRESS"), "IN_PROGRESS");
    assert.equal(mapTaskStatusToKanbanColumn("OVERDUE"), "IN_PROGRESS");
    assert.equal(mapTaskStatusToKanbanColumn("BLOCKED"), "IN_PROGRESS");
    assert.equal(mapTaskStatusToKanbanColumn("WAITING_APPROVAL"), "NEEDS_REVIEW");
    assert.equal(mapTaskStatusToKanbanColumn("PENDING_EXECUTIVE_APPROVAL"), "NEEDS_REVIEW");
    assert.equal(mapTaskStatusToKanbanColumn("NEEDS_REVIEW"), "NEEDS_REVIEW");
    assert.equal(mapTaskStatusToKanbanColumn("COMPLETED"), "COMPLETED");
  });

  test("Kanban board accounts for all 395 tasks across 4 columns with zero silent loss", () => {
    // Generate 395 mock tasks covering NOT_STARTED (75), WAITING_APPROVAL (9), OVERDUE (1), etc.
    const mock395Tasks: SchoolTask[] = [];

    // 75 NOT_STARTED
    for (let i = 0; i < 75; i++) {
      mock395Tasks.push({
        id: `task-not-started-${i}`,
        title: `Nhiệm vụ chưa bắt đầu ${i}`,
        category: "CNTT",
        categoryLabel: "Công nghệ thông tin",
        leadAssigneeName: "Nguyễn Văn A",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-30",
        status: "NOT_STARTED" as unknown as SchoolTask["status"],
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 0,
      });
    }

    // 100 NEW
    for (let i = 0; i < 100; i++) {
      mock395Tasks.push({
        id: `task-new-${i}`,
        title: `Nhiệm vụ mới ${i}`,
        category: "CHUYEN_DOI_SO",
        categoryLabel: "Chuyển đổi số",
        leadAssigneeName: "Trần Thị B",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-30",
        status: "NEW",
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 0,
      });
    }

    // 100 IN_PROGRESS
    for (let i = 0; i < 100; i++) {
      mock395Tasks.push({
        id: `task-in-progress-${i}`,
        title: `Nhiệm vụ đang làm ${i}`,
        category: "TRUYEN_THONG",
        categoryLabel: "Truyền thông",
        leadAssigneeName: "Lê Văn C",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-30",
        status: "IN_PROGRESS",
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 50,
      });
    }

    // 9 WAITING_APPROVAL
    for (let i = 0; i < 9; i++) {
      mock395Tasks.push({
        id: `task-waiting-approval-${i}`,
        title: `Nhiệm vụ chờ duyệt ${i}`,
        category: "BAO_CAO",
        categoryLabel: "Báo cáo",
        leadAssigneeName: "Phạm Văn D",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-30",
        status: "WAITING_APPROVAL" as unknown as SchoolTask["status"],
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 90,
      });
    }

    // 1 OVERDUE
    mock395Tasks.push({
      id: "task-overdue-1",
      title: "Nhiệm vụ quá hạn 1",
      category: "THU_VIEN",
      categoryLabel: "Thư viện",
      leadAssigneeName: "Hoàng Thị E",
      coAssignees: [],
      assignedDate: "2026-08-01",
      dueDate: "2026-08-15",
      status: "OVERDUE" as unknown as SchoolTask["status"],
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 30,
    });

    // 10 NEEDS_REVIEW
    for (let i = 0; i < 10; i++) {
      mock395Tasks.push({
        id: `task-needs-review-${i}`,
        title: `Nhiệm vụ cần rà soát ${i}`,
        category: "ATTT",
        categoryLabel: "An toàn thông tin",
        leadAssigneeName: "Vũ Văn F",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-30",
        status: "NEEDS_REVIEW",
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 85,
      });
    }

    // 100 COMPLETED
    for (let i = 0; i < 100; i++) {
      mock395Tasks.push({
        id: `task-completed-${i}`,
        title: `Nhiệm vụ hoàn thành ${i}`,
        category: "KHAC",
        categoryLabel: "Khác",
        leadAssigneeName: "Đặng Thị G",
        coAssignees: [],
        assignedDate: "2026-08-01",
        dueDate: "2026-08-25",
        status: "COMPLETED",
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 100,
      });
    }

    assert.equal(mock395Tasks.length, 395, "Total mock tasks must equal 395");

    const grouped = groupTasksByStatus(mock395Tasks);

    // Assert partition across the 4 Kanban columns
    assert.equal(grouped.NEW.length, 175, "NEW column must have 100 NEW + 75 NOT_STARTED = 175");
    assert.equal(grouped.IN_PROGRESS.length, 101, "IN_PROGRESS column must have 100 IN_PROGRESS + 1 OVERDUE = 101");
    assert.equal(grouped.NEEDS_REVIEW.length, 19, "NEEDS_REVIEW column must have 10 NEEDS_REVIEW + 9 WAITING_APPROVAL = 19");
    assert.equal(grouped.COMPLETED.length, 100, "COMPLETED column must have 100 COMPLETED = 100");

    const sumVisible =
      grouped.NEW.length +
      grouped.IN_PROGRESS.length +
      grouped.NEEDS_REVIEW.length +
      grouped.COMPLETED.length;

    assert.equal(sumVisible, 395, "All 395 tasks must be visible on the Kanban board with zero silent loss");

    // Render component and verify count notice header
    const html = renderToStaticMarkup(
      React.createElement(TaskKanbanBoard, { tasks: mock395Tasks })
    );

    assert.ok(
      html.includes('data-slot="kanban-count-notice"'),
      "Kanban count notice container must be rendered"
    );
    assert.ok(
      html.includes("395 / 395 công việc"),
      "Notice must explicitly state '395 / 395 công việc'"
    );
    // Plan T13 (quiet Kanban) + R-D15 (system language is bounded): the board
    // must not make an unconditional "everything is accounted for" claim. The
    // explicit counts above are the guarantee; a universal success badge is not.
    assert.ok(
      !html.includes("Đầy đủ 100% công việc"),
      "Kanban must not assert a universal completeness claim"
    );
  });

  test("Kanban exposes accessible contextual action menu ('⋯') with status transition and WCAG single-pointer compliance", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "task-test-a11y",
        title: "Nhiệm vụ kiểm thử A11Y",
        category: "CNTT",
        categoryLabel: "Công nghệ thông tin",
        leadAssigneeName: "Trần Kiểm Thử",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-20",
        status: "NEW",
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 0,
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(TaskKanbanBoard, { tasks: mockTasks })
    );

    // Card must render ⋯ action menu trigger button with accessible name
    assert.ok(
      html.includes('aria-label="Thao tác"'),
      "Card must render ⋯ button with aria-label='Thao tác'"
    );

    // Trigger button must have data-slot for testability
    assert.ok(
      html.includes('data-slot="kanban-action-menu-trigger"'),
      "⋯ button must carry data-slot='kanban-action-menu-trigger'"
    );

    // Trigger button must declare status-transition as its action domain
    assert.ok(
      html.includes('data-actions="status-transition"'),
      "⋯ button must declare data-actions='status-transition'"
    );

    // Touch targets: ⋯ button must meet 44px minimum on mobile
    assert.ok(
      html.includes("min-h-[44px]"),
      "⋯ action menu button must have touch target >= 44px (min-h-[44px])"
    );

    // Card must NOT render permanent <select> status dropdown
    assert.ok(
      !html.includes("<select"),
      "Card must NOT render a permanent <select> status dropdown"
    );

    // Card title must be rendered
    assert.ok(
      html.includes("Nhiệm vụ kiểm thử A11Y"),
      "Card must render the task title"
    );

    // Card must show deadline with 'Hạn' prefix
    assert.ok(
      html.includes("Hạn"),
      "Card must render deadline with 'Hạn' prefix"
    );

    // Card must NOT render ChevronLeft or prev-status step buttons
    const kanbanPath = path.resolve(__dirname, "../src/components/tasks/task-kanban-board.tsx");
    const src = fs.readFileSync(kanbanPath, "utf-8");
    assert.ok(
      !src.includes("ChevronLeft"),
      "Source must NOT import or use ChevronLeft (prev-status button removed)"
    );
  });

  test("Source contains Escape key handler (e.key === \"Escape\") wired to dismiss menu", () => {
    const kanbanPath = path.resolve(__dirname, "../src/components/tasks/task-kanban-board.tsx");
    const src = fs.readFileSync(kanbanPath, "utf-8");

    // 1. The Escape key comparison must be present in source
    assert.ok(
      src.includes('e.key === "Escape"'),
      'Source must contain e.key === "Escape" to detect Escape key presses'
    );

    // 2. The handler must be registered on document via addEventListener for keydown
    assert.ok(
      src.includes('document.addEventListener("keydown"'),
      'Source must wire the Escape handler to document via addEventListener("keydown", ...)'
    );

    // 3. The handler must call setMenuOpen(false) to dismiss the menu
    assert.ok(
      src.includes("setMenuOpen(false)"),
      "Source must call setMenuOpen(false) to dismiss the menu on Escape"
    );

    // 4. The cleanup must remove the keydown listener to prevent leaks
    assert.ok(
      src.includes('document.removeEventListener("keydown"'),
      'Source must clean up the keydown listener via document.removeEventListener("keydown", ...)'
    );
  });

  test("Escape key handler is co-located with menuOpen guard (only active when menu is open)", () => {
    const kanbanPath = path.resolve(__dirname, "../src/components/tasks/task-kanban-board.tsx");
    const src = fs.readFileSync(kanbanPath, "utf-8");

    // The useEffect block that registers the keydown listener must guard on menuOpen
    // Pattern: the effect that calls document.addEventListener("keydown") must early-return when !menuOpen
    const effectBlock = src.slice(
      src.indexOf('document.addEventListener("keydown"') - 600,
      src.indexOf('document.addEventListener("keydown"') + 10
    );
    assert.ok(
      effectBlock.includes("if (!menuOpen) return"),
      "The useEffect registering the keydown Escape handler must guard with 'if (!menuOpen) return' so it is only active when the menu is open"
    );
  });
});
