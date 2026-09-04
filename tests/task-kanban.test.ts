import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  groupTasksByStatus,
  KANBAN_COLUMNS,
  getNextStatus,
  getPrevStatus,
  filterKanbanItems,
  type KanbanItem,
} from "../src/components/tasks/task-kanban-board";
import type { SchoolTask } from "../src/types/dashboard";

describe("TaskKanbanBoard Helpers", () => {
  test("KANBAN_COLUMNS defines 4 status columns", () => {
    assert.equal(KANBAN_COLUMNS.length, 4);
    assert.equal(KANBAN_COLUMNS[0].id, "NEW");
    assert.equal(KANBAN_COLUMNS[1].id, "IN_PROGRESS");
    assert.equal(KANBAN_COLUMNS[2].id, "NEEDS_REVIEW");
    assert.equal(KANBAN_COLUMNS[3].id, "COMPLETED");
  });

  test("groupTasksByStatus correctly partitions tasks", () => {
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
    assert.equal(grouped.NEW.length, 1); // subtask placed in NEW
  });

  test("getNextStatus and getPrevStatus transition correctly across 4 columns", () => {
    assert.equal(getNextStatus("NEW"), "IN_PROGRESS");
    assert.equal(getNextStatus("IN_PROGRESS"), "NEEDS_REVIEW");
    assert.equal(getNextStatus("NEEDS_REVIEW"), "COMPLETED");
    assert.equal(getNextStatus("COMPLETED"), null);

    assert.equal(getPrevStatus("NEW"), null);
    assert.equal(getPrevStatus("IN_PROGRESS"), "NEW");
    assert.equal(getPrevStatus("NEEDS_REVIEW"), "IN_PROGRESS");
    assert.equal(getPrevStatus("COMPLETED"), "NEEDS_REVIEW");
  });

  test("filterKanbanItems filters by level, category, and search query", () => {
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
    assert.equal(donViOnly[0].level, "DON_VI");

    // Filter category: ATTT
    const atttOnly = filterKanbanItems(mockTasks, "ALL", "ATTT", "");
    assert.equal(atttOnly.length, 1);
    assert.equal(atttOnly[0].id, "t2");

    // Search query
    const searchSwitch = filterKanbanItems(mockTasks, "ALL", "ALL", "Switch");
    assert.equal(searchSwitch.length, 1);
    assert.equal(searchSwitch[0].id, "sub-1");

    const searchHung = filterKanbanItems(mockTasks, "ALL", "ALL", "Hùng");
    assert.equal(searchHung.length, 1);
    assert.equal(searchHung[0].id, "t1");
  });
});
