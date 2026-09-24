import { test, describe } from "node:test";
import assert from "node:assert/strict";
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
  executeKanbanStatusTransition,
  applyOptimisticOverrides,
  calculateMenuPosition,
  DEFAULT_DISPLAY_SETTINGS,
  type KanbanItem,
  type KanbanTransitionState,
  type KanbanDisplaySettings,
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

  test("mapTaskStatusToKanbanColumn strictly maps operational statuses to 4 columns", () => {
    assert.equal(mapTaskStatusToKanbanColumn("NOT_STARTED"), "NEW");
    assert.equal(mapTaskStatusToKanbanColumn("NEW"), "NEW");
    assert.equal(mapTaskStatusToKanbanColumn("IN_PROGRESS"), "IN_PROGRESS");
    assert.equal(mapTaskStatusToKanbanColumn("BLOCKED"), "IN_PROGRESS");
    assert.equal(mapTaskStatusToKanbanColumn("WAITING_APPROVAL"), "NEEDS_REVIEW");
    assert.equal(mapTaskStatusToKanbanColumn("PENDING_EXECUTIVE_APPROVAL"), "NEEDS_REVIEW");
    assert.equal(mapTaskStatusToKanbanColumn("NEEDS_REVIEW"), "NEEDS_REVIEW");
    assert.equal(mapTaskStatusToKanbanColumn("COMPLETED"), "COMPLETED");
  });

  test("Kanban board accounts for all 394 tasks across 4 columns with zero silent loss", () => {
    // Generate 394 mock tasks covering NOT_STARTED (75), WAITING_APPROVAL (9), IN_PROGRESS (100), etc.
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

    // 100 IN_PROGRESS (replacing 1 OVERDUE task with IN_PROGRESS to maintain dataset structure)
    // OVERDUE has been removed from TaskStatus enum — past-due tasks remain IN_PROGRESS with isOverdue flag
    mock395Tasks.push({
      id: "task-overdue-1",
      title: "Nhiệm vụ quá hạn 1",
      category: "THU_VIEN",
      categoryLabel: "Thư viện",
      leadAssigneeName: "Hoàng Thị E",
      coAssignees: [],
      assignedDate: "2026-08-01",
      dueDate: "2026-08-15",
      status: "IN_PROGRESS" as unknown as SchoolTask["status"],
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
    assert.equal(grouped.IN_PROGRESS.length, 101, "IN_PROGRESS column must have 100 IN_PROGRESS + 1 extra IN_PROGRESS = 101");
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

  });
});

describe("Plan 10.7: Kanban progress suppression, overdue text label, column coverage + count integrity", () => {
  function makeSchoolTask(
    id: string,
    overrides: Partial<SchoolTask> = {}
  ): SchoolTask {
    return {
      id,
      title: `Nhiệm vụ ${id}`,
      category: "CNTT",
      categoryLabel: "CNTT",
      leadAssigneeName: "Nguyễn Văn A",
      coAssignees: [],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-30",
      status: "IN_PROGRESS",
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 0,
      ...overrides,
    };
  }

  test("0% progress card suppresses the progress bar", () => {
    const tasks: SchoolTask[] = [
      makeSchoolTask("zero", {
        title: "Nhiệm vụ 0 phần trăm",
        status: "IN_PROGRESS",
        progressPercent: 0,
      }),
    ];
    const html = renderToStaticMarkup(
      React.createElement(TaskKanbanBoard, { tasks })
    );
    assert.ok(
      html.includes("Nhiệm vụ 0 phần trăm"),
      "card must render so the suppression assertion is not vacuous"
    );
    assert.ok(
      !html.includes("Tiến độ"),
      "0% card must suppress the 'Tiến độ' progress block"
    );
  });

  test("100% COMPLETED card suppresses the progress bar", () => {
    const tasks: SchoolTask[] = [
      makeSchoolTask("done", {
        title: "Nhiệm vụ hoàn thành triệt để",
        status: "COMPLETED",
        progressPercent: 100,
        dueDate: "2026-08-25",
      }),
    ];
    const html = renderToStaticMarkup(
      React.createElement(TaskKanbanBoard, { tasks })
    );
    assert.ok(
      html.includes("Nhiệm vụ hoàn thành triệt để"),
      "card must render so the suppression assertion is not vacuous"
    );
    assert.ok(
      !html.includes("Tiến độ"),
      "100% COMPLETED card must suppress the progress block (nothing left to track)"
    );
  });

  test("65% in-progress card suppresses progress bar per kanban view simplification", () => {
    const tasks: SchoolTask[] = [
      makeSchoolTask("mid", {
        title: "Nhiệm vụ đang dở dang",
        status: "IN_PROGRESS",
        progressPercent: 65,
      }),
    ];
    const html = renderToStaticMarkup(
      React.createElement(TaskKanbanBoard, { tasks })
    );
    assert.ok(
      !html.includes("Tiến độ"),
      "kanban card must suppress the 'Tiến độ' progress block"
    );
  });

  test("overdue is not color-only: text label 'Quá hạn' is present", () => {
    const tasks: SchoolTask[] = [
      makeSchoolTask("past-due", {
        title: "Nhiệm vụ trễ hạn theo ngày",
        status: "IN_PROGRESS",
        dueDate: "2026-08-01",
        progressPercent: 30,
      }),
      makeSchoolTask("flagged", {
        title: "Nhiệm vụ bị gắn cờ quá hạn",
        status: "IN_PROGRESS",
        isOverdue: true,
        dueDate: "2026-08-01",
        progressPercent: 30,
      }),
    ];
    const html = renderToStaticMarkup(
      React.createElement(TaskKanbanBoard, { tasks })
    );
    assert.ok(
      html.includes("Nhiệm vụ trễ hạn theo ngày") &&
        html.includes("Nhiệm vụ bị gắn cờ quá hạn"),
      "both overdue cards must render"
    );
    assert.ok(
      html.includes("Quá hạn"),
      "overdue must render the 'Quá hạn' text label, not color alone"
    );
  });

  test("every active status maps to a visible canonical column", () => {
    const ACTIVE_STATUSES: SchoolTask["status"][] = [
      "NOT_STARTED",
      "NEW",
      "IN_PROGRESS",
      "BLOCKED",
      "WAITING_APPROVAL",
      "PENDING_EXECUTIVE_APPROVAL",
      "NEEDS_REVIEW",
      "COMPLETED",
    ];
    const VISIBLE_COLUMNS = new Set([
      "NEW",
      "IN_PROGRESS",
      "NEEDS_REVIEW",
      "COMPLETED",
    ]);

    for (const s of ACTIVE_STATUSES) {
      const col = mapTaskStatusToKanbanColumn(s);
      assert.ok(
        VISIBLE_COLUMNS.has(col),
        `${s} must map to a visible canonical column, got ${col}`
      );
    }

    // Grouped: one task per active status lands exactly once across the 4 columns.
    const tasks = ACTIVE_STATUSES.map((s, i) =>
      makeSchoolTask(`active-${i}`, {
        title: `Nhiệm vụ active ${i}`,
        status: s,
        progressPercent: 10,
      })
    );
    const grouped = groupTasksByStatus(tasks);
    const visible =
      grouped.NEW.length +
      grouped.IN_PROGRESS.length +
      grouped.NEEDS_REVIEW.length +
      grouped.COMPLETED.length;
    assert.equal(
      visible,
      ACTIVE_STATUSES.length,
      "every active task must land in exactly one visible column"
    );
    assert.ok(
      grouped.NEW.length > 0 &&
        grouped.IN_PROGRESS.length > 0 &&
        grouped.NEEDS_REVIEW.length > 0 &&
        grouped.COMPLETED.length > 0,
      "all four canonical columns must be reachable from active statuses"
    );
  });

  test("cancelled/archived exclusion is explicit and counts reconcile (visible + excluded = extracted)", () => {
    const tasks: SchoolTask[] = [
      makeSchoolTask("a1", {
        title: "Nhiệm vụ hiện hữu 1",
        status: "IN_PROGRESS",
        progressPercent: 40,
      }),
      makeSchoolTask("a2", {
        title: "Nhiệm vụ hiện hữu 2",
        status: "NEW",
        progressPercent: 0,
      }),
      makeSchoolTask("a3", {
        title: "Nhiệm vụ hiện hữu 3",
        status: "COMPLETED",
        progressPercent: 100,
      }),
      makeSchoolTask("x1", {
        title: "Nhiệm vụ đã huỷ bỏ",
        status: "CANCELLED",
        progressPercent: 0,
      }),
      makeSchoolTask("x2", {
        title: "Nhiệm vụ lưu trữ kho",
        status: "ARCHIVED" as unknown as SchoolTask["status"],
        progressPercent: 0,
      }),
      makeSchoolTask("x3", {
        title: "Nhiệm vụ canceled legacy",
        status: "CANCELED" as unknown as SchoolTask["status"],
        progressPercent: 0,
      }),
    ];

    const extracted = filterKanbanItems(tasks, "ALL", "ALL", "");
    const grouped = groupTasksByStatus(tasks);
    const visible =
      grouped.NEW.length +
      grouped.IN_PROGRESS.length +
      grouped.NEEDS_REVIEW.length +
      grouped.COMPLETED.length;
    const excluded = extracted.length - visible;

    assert.equal(extracted.length, 6, "extraction must see every task");
    assert.equal(visible, 3, "only the 3 active tasks are visible on columns");
    assert.equal(excluded, 3, "cancelled/archived tasks are the excluded remainder");

    const html = renderToStaticMarkup(
      React.createElement(TaskKanbanBoard, { tasks })
    );
    assert.ok(
      html.includes("3 / 6 công việc"),
      "count notice must state visible / extracted"
    );
    assert.ok(
      html.includes("bị huỷ / lưu trữ không hiển thị"),
      "exclusion of cancelled/archived tasks must be explicit, not silent"
    );
    assert.ok(
      !html.includes("Nhiệm vụ đã huỷ bỏ") &&
        !html.includes("Nhiệm vụ lưu trữ kho") &&
        !html.includes("Nhiệm vụ canceled legacy"),
      "excluded tasks must not render as board cards"
    );
  });
});

// ─── Task 5: Pending lock, double-click prevention, rollback, portal menu ────

describe("Task 5 — executeKanbanStatusTransition contract", () => {
  function emptyState(): KanbanTransitionState {
    return { pendingTaskIds: {}, optimisticStatuses: {}, taskErrors: {} };
  }

  test("pending lock: request is blocked while same taskId is already pending", async () => {
    // Pre-set task as pending to simulate in-flight state
    const state: KanbanTransitionState = {
      pendingTaskIds: { "t1": true },
      optimisticStatuses: {},
      taskErrors: {},
    };
    const result = await executeKanbanStatusTransition(
      "t1",
      "IN_PROGRESS",
      "NEW",
      state,
      async () => { /* noop */ }
    );
    assert.equal(result.ok, false, "must reject while task is already pending");
    assert.ok(
      result.error && result.error.length > 0,
      "must return non-empty error message for blocked request"
    );
    // State should not be mutated further (still pending)
    assert.equal(result.state.pendingTaskIds["t1"], true, "pending flag must remain");
  });

  test("double-click prevention: second identical call returns ok:false while first is in-flight", async () => {
    const state = emptyState();
    let resolveFirst!: () => void;
    const firstCallPromise = new Promise<void>((res) => { resolveFirst = res; });

    // Start first transition (blocks)
    const firstResult = executeKanbanStatusTransition(
      "t2",
      "IN_PROGRESS",
      "NEW",
      state,
      () => firstCallPromise
    );

    // Attempt second call while first is still pending (using same pending state)
    const pendingState: KanbanTransitionState = {
      pendingTaskIds: { "t2": true },
      optimisticStatuses: { "t2": "IN_PROGRESS" },
      taskErrors: {},
    };
    const secondResult = await executeKanbanStatusTransition(
      "t2",
      "IN_PROGRESS",
      "NEW",
      pendingState,
      async () => { /* should not fire */ }
    );

    assert.equal(secondResult.ok, false, "second call must be rejected while pending");

    // Resolve first
    resolveFirst();
    const first = await firstResult;
    assert.equal(first.ok, true, "first call must succeed after resolution");
    assert.equal(first.state.pendingTaskIds["t2"], undefined, "pending cleared after success");
  });

  test("request rejected: rollback optimistic status and set Vietnamese error message", async () => {
    const state = emptyState();
    const result = await executeKanbanStatusTransition(
      "t3",
      "COMPLETED",
      "IN_PROGRESS",
      state,
      async () => { throw new Error("Máy chủ từ chối cập nhật trạng thái."); }
    );

    assert.equal(result.ok, false, "must return ok:false on rejection");
    // Optimistic status should be rolled back
    assert.equal(
      result.state.optimisticStatuses["t3"],
      undefined,
      "optimistic status must be rolled back after failure"
    );
    // Pending must be cleared
    assert.equal(
      result.state.pendingTaskIds["t3"],
      undefined,
      "pending flag must be cleared after error"
    );
    // Error message must be set
    assert.ok(
      result.state.taskErrors["t3"] && result.state.taskErrors["t3"]!.length > 0,
      "taskErrors must carry a non-empty message for the failing task"
    );
    // Error message must be in Vietnamese or contain the original error
    assert.ok(
      result.error && (result.error.includes("chối") || result.error.includes("thất bại") || result.error.includes("Vui lòng")),
      "error must be Vietnamese user-facing message"
    );
  });

  test("pending cleared after error: no stuck pending on consecutive calls", async () => {
    const state = emptyState();
    // First call fails
    const failResult = await executeKanbanStatusTransition(
      "t4",
      "NEEDS_REVIEW",
      "IN_PROGRESS",
      state,
      async () => { throw new Error("Network error"); }
    );
    assert.equal(failResult.ok, false);
    assert.equal(
      failResult.state.pendingTaskIds["t4"],
      undefined,
      "pending must not be stuck after failed request"
    );

    // Second call should be allowed (not blocked)
    const retryResult = await executeKanbanStatusTransition(
      "t4",
      "NEEDS_REVIEW",
      "IN_PROGRESS",
      failResult.state,
      async () => { /* success */ }
    );
    assert.equal(retryResult.ok, true, "retry must succeed after error is cleared");
  });

  test("same-status no-op: transition to current status returns ok:true without mutation", async () => {
    const state = emptyState();
    let called = false;
    const result = await executeKanbanStatusTransition(
      "t5",
      "IN_PROGRESS",
      "IN_PROGRESS",
      state,
      async () => { called = true; }
    );
    assert.equal(result.ok, true, "same-status call must return ok:true");
    assert.equal(called, false, "onStatusChange must NOT be called for no-op transition");
    assert.deepEqual(result.state, state, "state must be unchanged for no-op");
  });

  test("applyOptimisticOverrides: overrides parent and subtask statuses without touching others", () => {
    const tasks: SchoolTask[] = [
      {
        id: "p1",
        title: "Nhiệm vụ gốc",
        category: "CNTT",
        categoryLabel: "CNTT",
        leadAssigneeName: "An",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-30",
        status: "NEW",
        subTasks: [
          {
            id: "s1",
            title: "Tiểu nhiệm vụ",
            assigneeName: "Bình",
            status: "NEW",
            dueDate: "2026-09-20",
            parentSchoolTaskId: "p1",
            updatedAt: "2026-09-01",
          },
        ],
        totalSubTasks: 1,
        completedSubTasks: 0,
        progressPercent: 0,
      },
      {
        id: "p2",
        title: "Nhiệm vụ không thay đổi",
        category: "CNTT",
        categoryLabel: "CNTT",
        leadAssigneeName: "Cường",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-30",
        status: "IN_PROGRESS",
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 50,
      },
    ];

    const optimistic = { p1: "IN_PROGRESS" as const, s1: "IN_PROGRESS" as const };
    const result = applyOptimisticOverrides(tasks, optimistic);

    assert.equal(result[0].status, "IN_PROGRESS", "parent optimistic override must apply");
    assert.equal(result[0].subTasks![0].status, "IN_PROGRESS", "subtask optimistic override must apply");
    assert.equal(result[1].status, "IN_PROGRESS", "unrelated task status must be unchanged");
    // Original array not mutated
    assert.equal(tasks[0].status, "NEW", "original task array must not be mutated");
  });

  test("calculateMenuPosition: menu placed above when space below is insufficient", () => {
    // Trigger near bottom of viewport
    const triggerRect = { top: 800, bottom: 830, left: 100, right: 180 };
    const viewport = { width: 1280, height: 900 };
    const menuSize = { width: 192, height: 220 };

    const result = calculateMenuPosition(triggerRect, viewport, menuSize);
    assert.equal(result.placement, "top", "menu must open above when space below is insufficient");
    assert.ok(result.top < triggerRect.top, "menu top must be above trigger top when placed above");
    assert.ok(result.top >= 0, "menu must not go above viewport");
  });

  test("calculateMenuPosition: menu placed below when space is available", () => {
    // Trigger near top of viewport
    const triggerRect = { top: 50, bottom: 80, left: 100, right: 200 };
    const viewport = { width: 1280, height: 900 };
    const menuSize = { width: 192, height: 220 };

    const result = calculateMenuPosition(triggerRect, viewport, menuSize);
    assert.equal(result.placement, "bottom", "menu must open below when space is available");
    assert.ok(result.top > triggerRect.bottom - 1, "menu top must be below trigger bottom");
  });

  test("calculateMenuPosition: left-clamped to stay within viewport on narrow screens", () => {
    // Trigger flush to left edge — menu width would go negative left
    const triggerRect = { top: 100, bottom: 130, left: 5, right: 20 };
    const viewport = { width: 360, height: 700 };
    const menuSize = { width: 192, height: 140 };

    const result = calculateMenuPosition(triggerRect, viewport, menuSize);
    assert.ok(result.left >= 0, "menu must not overflow left edge of viewport");
    assert.ok(
      result.left + menuSize.width <= viewport.width + 8,
      "menu must not overflow right edge (with 8px tolerance for margin)"
    );
  });

  test("SSR: TaskKanbanBoard renders aria-busy on pending task without portal", () => {
    const tasks: SchoolTask[] = [
      {
        id: "pending-task",
        title: "Nhiệm vụ đang xử lý",
        category: "CNTT",
        categoryLabel: "CNTT",
        leadAssigneeName: "Hùng",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-30",
        status: "IN_PROGRESS",
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 40,
      },
    ];
    // In SSR (renderToStaticMarkup), portal falls back to null (mounted=false)
    // The card itself should still render aria-busy="true" when isPending prop is true
    // We verify the board renders without throwing and contains the task
    const html = renderToStaticMarkup(
      React.createElement(TaskKanbanBoard, { tasks })
    );
    assert.ok(html.includes("Nhiệm vụ đang xử lý"), "pending task title must render in SSR");
    // aria-busy is set on the card div when isPending=true; here isPending comes from
    // transitionState which starts empty, so aria-busy="false" in initial render
    assert.ok(html.includes("aria-busy"), "card must emit aria-busy attribute");
  });
});

describe("Linear Kanban Redesign & Display Settings Contract", () => {
  test("DEFAULT_DISPLAY_SETTINGS configures minimal defaults per Linear design", () => {
    assert.equal(DEFAULT_DISPLAY_SETTINGS.showAssignee, true);
    assert.equal(DEFAULT_DISPLAY_SETTINGS.showDueDate, true);
    assert.equal(DEFAULT_DISPLAY_SETTINGS.showParentTask, true);
    assert.equal(DEFAULT_DISPLAY_SETTINGS.showProgress, false);
    assert.equal(DEFAULT_DISPLAY_SETTINGS.showSubtaskCount, false);
  });

  test("Card conditionally renders properties based on displaySettings prop", () => {
    const task: SchoolTask = {
      id: "task-display-test",
      title: "Thiết kế giao diện Linear",
      category: "CNTT",
      categoryLabel: "Công nghệ thông tin",
      leadAssigneeName: "Nguyễn Văn Test",
      coAssignees: [],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-30",
      status: "IN_PROGRESS",
      subTasks: [],
      totalSubTasks: 2,
      completedSubTasks: 1,
      progressPercent: 50,
    };

    // 1. With subtasks enabled via displaySettings (progress bar removed from kanban)
    const htmlWithProgress = renderToStaticMarkup(
      React.createElement(TaskKanbanBoard, {
        tasks: [task],
        displaySettings: {
          ...DEFAULT_DISPLAY_SETTINGS,
          showSubtaskCount: true,
        },
      })
    );
    assert.ok(!htmlWithProgress.includes("Tiến độ"), "Must not show progress bar in kanban cards");
    assert.ok(htmlWithProgress.includes("1/2"), "Must show subtask count when enabled");

    // 2. With all optional properties disabled
    const htmlMinimal = renderToStaticMarkup(
      React.createElement(TaskKanbanBoard, {
        tasks: [task],
        displaySettings: {
          showAssignee: false,
          showDueDate: false,
          showParentTask: false,
          showProgress: false,
          showSubtaskCount: false,
        },
      })
    );
    assert.ok(!htmlMinimal.includes("Tiến độ"), "Must not show progress when disabled");
    assert.ok(!htmlMinimal.includes("Nguyễn Văn Test"), "Must not show assignee when disabled");
    assert.ok(!htmlMinimal.includes("Hạn 30/09"), "Must not show due date when disabled");
    assert.ok(htmlMinimal.includes("Thiết kế giao diện Linear"), "Must always show task title");
  });

  test("Columns are rendered directly on surface without heavy container boxes", () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskKanbanBoard, { tasks: [] })
    );

    // Bỏ card/container lớn bao quanh từng cột (không còn rounded-2xl border bg-muted/30)
    assert.ok(
      !html.includes("rounded-2xl border border-border/60 bg-muted/30"),
      "Columns must NOT be wrapped in heavy container cards"
    );

    // Cột mang data-slot="kanban-column" và width chuẩn 280px
    assert.ok(
      html.includes('data-slot="kanban-column"'),
      "Column must render data-slot='kanban-column'"
    );
    assert.ok(
      html.includes("w-[280px]"),
      "Column width must be 280px (w-[280px])"
    );

    // Empty state is a lightweight '+' button, not a large dashed empty-state box
    assert.ok(
      !html.includes("Không có nhiệm vụ"),
      "Empty state must not render verbose 'Không có nhiệm vụ' placeholder"
    );
  });

  test("Display settings popover toggle button is present on the board header", () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskKanbanBoard, { tasks: [] })
    );

    assert.ok(
      html.includes('aria-label="Tùy chọn hiển thị thẻ"'),
      "Board must render display settings button with aria-label='Tùy chọn hiển thị thẻ'"
    );
    assert.ok(
      html.includes("Hiển thị"),
      "Board must render 'Hiển thị' text on larger screens"
    );
  });
});
