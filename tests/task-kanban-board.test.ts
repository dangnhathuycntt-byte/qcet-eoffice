import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  groupTasksByStatus,
  KANBAN_COLUMNS,
  getNextStatus,
  getPrevStatus,
  filterKanbanItems,
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

    // Assert 22px avatar size
    assert.ok(
      content.includes("22px") || content.includes("size-[22px]"),
      "Assignee avatar must be standardized 22px"
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
  });
});
