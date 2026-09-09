import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";
import { filterTasksByExecutive } from "../src/lib/executive-matrix-aggregator";
import {
  filterTasksByAcademicMonth,
  computeMonthlyTaskCounts,
  filterTasksHub,
} from "../src/lib/unified-task-hub";
import { getAcademicMonthInfo, getAcademicMonthsForYear } from "../src/lib/academic-calendar";

// Helper to build a minimal SchoolTask for testing
function makeSchoolTask(
  overrides: Partial<SchoolTask> & { id: string }
): SchoolTask {
  return {
    title: `Task ${overrides.id}`,
    category: "CNTT",
    categoryLabel: "CNTT",
    leadAssigneeName: "Test Person",
    coAssignees: [],
    assignedDate: "2026-08-01",
    dueDate: "2026-09-15",
    status: "IN_PROGRESS",
    subTasks: [],
    totalSubTasks: 0,
    completedSubTasks: 0,
    progressPercent: 50,
    ...overrides,
  };
}

// Helper to build a minimal StaffTask for testing
function makeStaffTask(
  overrides: Partial<StaffTask> & { id: string }
): StaffTask {
  return {
    title: `Sub ${overrides.id}`,
    assigneeName: "Staff Member",
    status: "IN_PROGRESS",
    dueDate: "2026-09-15",
    parentSchoolTaskId: "task-parent",
    updatedAt: "2026-09-01",
    ...overrides,
  };
}

const REF_DATE = "2026-09-04";

describe("filterTasksByExecutive", () => {
  const tasks: SchoolTask[] = [
    // PENDING_APPROVAL: progressPercent === 100, status !== COMPLETED
    makeSchoolTask({
      id: "pending-1",
      progressPercent: 100,
      status: "IN_PROGRESS",
    }),
    // COMPLETED task with 100% -- should NOT show as pending approval
    makeSchoolTask({
      id: "completed-100",
      progressPercent: 100,
      status: "COMPLETED",
    }),
    // BLOCKED_OVERDUE: task-level blocked
    makeSchoolTask({
      id: "blocked-1",
      status: "BLOCKED" as SchoolTask["status"],
      progressPercent: 30,
    }),
    // BLOCKED_OVERDUE: parent overdue (dueDate in the past relative to REF_DATE)
    makeSchoolTask({
      id: "overdue-1",
      status: "IN_PROGRESS",
      dueDate: "2026-09-01",
      progressPercent: 40,
    }),
    // BLOCKED_OVERDUE: has a blocked subtask
    makeSchoolTask({
      id: "has-blocked-sub",
      status: "IN_PROGRESS",
      progressPercent: 60,
      subTasks: [
        makeStaffTask({ id: "sub-blocked", status: "BLOCKED" }),
        makeStaffTask({ id: "sub-ok", status: "IN_PROGRESS" }),
      ],
    }),
    // BLOCKED_OVERDUE: has an overdue subtask
    makeSchoolTask({
      id: "has-overdue-sub",
      status: "IN_PROGRESS",
      progressPercent: 55,
      subTasks: [
        makeStaffTask({
          id: "sub-overdue",
          status: "IN_PROGRESS",
          dueDate: "2026-09-02",
        }),
      ],
    }),
    // STRATEGIC: status === IN_PROGRESS (normal healthy task)
    makeSchoolTask({
      id: "strategic-1",
      status: "IN_PROGRESS",
      progressPercent: 70,
    }),
    // Neither pending nor blocked/overdue nor strategic
    makeSchoolTask({
      id: "completed-normal",
      status: "COMPLETED",
      progressPercent: 100,
    }),
  ];

  test("ALL filter returns all tasks unchanged", () => {
    const result = filterTasksByExecutive(tasks, "ALL", REF_DATE);
    assert.strictEqual(result.length, tasks.length);
  });

  test("PENDING_APPROVAL returns only tasks with 100% progress and not completed", () => {
    const result = filterTasksByExecutive(tasks, "PENDING_APPROVAL", REF_DATE);
    assert.ok(result.length > 0, "Should find at least one pending approval task");
    for (const t of result) {
      assert.strictEqual(t.progressPercent, 100);
      assert.notStrictEqual(t.status, "COMPLETED");
    }
    // pending-1 matches, completed-100 does not
    const ids = result.map((t) => t.id);
    assert.ok(ids.includes("pending-1"));
    assert.ok(!ids.includes("completed-100"));
  });

  test("BLOCKED_OVERDUE returns tasks that are blocked, overdue, or have blocked/overdue subtasks", () => {
    const result = filterTasksByExecutive(tasks, "BLOCKED_OVERDUE", REF_DATE);
    const ids = result.map((t) => t.id);
    assert.ok(ids.includes("blocked-1"), "Task-level BLOCKED should match");
    assert.ok(ids.includes("overdue-1"), "Parent-level overdue should match");
    assert.ok(ids.includes("has-blocked-sub"), "Task with blocked subtask should match");
    assert.ok(ids.includes("has-overdue-sub"), "Task with overdue subtask should match");
    // Normal tasks should not appear
    assert.ok(!ids.includes("completed-normal"));
    assert.ok(!ids.includes("pending-1"));
    assert.ok(!ids.includes("completed-100"));
  });

  test("STRATEGIC returns only tasks with status IN_PROGRESS", () => {
    const result = filterTasksByExecutive(tasks, "STRATEGIC", REF_DATE);
    for (const t of result) {
      assert.strictEqual(t.status, "IN_PROGRESS");
    }
    const ids = result.map((t) => t.id);
    // Tasks with IN_PROGRESS should match
    assert.ok(ids.includes("strategic-1"));
    assert.ok(ids.includes("pending-1")); // pending-1 is also IN_PROGRESS
    // COMPLETED, BLOCKED should not
    assert.ok(!ids.includes("completed-100"));
    assert.ok(!ids.includes("blocked-1"));
    assert.ok(!ids.includes("completed-normal"));
  });

  test("Empty task list returns empty for all filters", () => {
    for (const filter of ["ALL", "PENDING_APPROVAL", "BLOCKED_OVERDUE", "STRATEGIC"] as const) {
      const result = filterTasksByExecutive([], filter, REF_DATE);
      assert.strictEqual(result.length, 0, `${filter} on empty list should return empty`);
    }
  });

  test("No emojis in the filterTasksByExecutive source file", () => {
    const fs = require("fs");
    const source = fs.readFileSync(
      require("path").resolve(__dirname, "../src/lib/executive-matrix-aggregator.ts"),
      "utf-8"
    );
    // Common emoji ranges
    const emojiPattern =
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2702}-\u{27B0}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert.ok(!emojiPattern.test(source), "Source file must contain zero emojis");
  });

  test("No emojis in page.tsx", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../src/app/page.tsx"),
      "utf-8"
    );
    const emojiPattern =
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2702}-\u{27B0}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert.ok(!emojiPattern.test(source), "page.tsx must contain zero emojis");
  });
});

describe("Academic Month Filtering Integration in Dashboard Hub", () => {
  const sampleTasks: SchoolTask[] = [
    // Month 9 task (25/08/2026 - 24/09/2026)
    makeSchoolTask({
      id: "task-month-9",
      dueDate: "2026-09-10",
      status: "IN_PROGRESS",
    }),
    // Month 9 boundary task (exact first day: 2026-08-25)
    makeSchoolTask({
      id: "task-month-9-boundary-start",
      dueDate: "2026-08-25",
      status: "IN_PROGRESS",
    }),
    // Month 9 boundary task (exact last day: 2026-09-24)
    makeSchoolTask({
      id: "task-month-9-boundary-end",
      dueDate: "2026-09-24",
      status: "IN_PROGRESS",
    }),
    // Month 10 task (25/09/2026 - 24/10/2026)
    makeSchoolTask({
      id: "task-month-10",
      dueDate: "2026-10-05",
      status: "IN_PROGRESS",
    }),
    // Task with parent in Month 11 but subtask in Month 9
    makeSchoolTask({
      id: "task-cross-month",
      dueDate: "2026-11-15",
      status: "IN_PROGRESS",
      subTasks: [
        makeStaffTask({
          id: "sub-in-month-9",
          dueDate: "2026-09-12",
        }),
      ],
    }),
    // Month 1 task in next year (25/12/2026 - 24/01/2027)
    makeSchoolTask({
      id: "task-month-1",
      dueDate: "2027-01-10",
      status: "IN_PROGRESS",
    }),
  ];

  test("Filters tasks strictly by operational academic month", () => {
    // Month 9 filter should capture:
    // - task-month-9 (due 2026-09-10)
    // - task-month-9-boundary-start (due 2026-08-25)
    // - task-month-9-boundary-end (due 2026-09-24)
    // - task-cross-month (subtask due 2026-09-12)
    const month9Result = filterTasksByAcademicMonth(sampleTasks, 9, "2026-2027");
    const ids9 = month9Result.map((t) => t.id);

    assert.equal(month9Result.length, 4);
    assert.ok(ids9.includes("task-month-9"));
    assert.ok(ids9.includes("task-month-9-boundary-start"));
    assert.ok(ids9.includes("task-month-9-boundary-end"));
    assert.ok(ids9.includes("task-cross-month"));
    assert.ok(!ids9.includes("task-month-10"));
    assert.ok(!ids9.includes("task-month-1"));
  });

  test("Month 10 filter captures only month 10 tasks", () => {
    const month10Result = filterTasksByAcademicMonth(sampleTasks, 10, "2026-2027");
    const ids10 = month10Result.map((t) => t.id);

    assert.equal(month10Result.length, 1);
    assert.ok(ids10.includes("task-month-10"));
  });

  test("ALL filter retains all tasks without truncation", () => {
    const allResult = filterTasksByAcademicMonth(sampleTasks, "ALL", "2026-2027");
    assert.equal(allResult.length, sampleTasks.length);
  });

  test("computeMonthlyTaskCounts generates accurate distribution across operational months", () => {
    const counts = computeMonthlyTaskCounts(sampleTasks, "2026-2027");

    assert.equal(counts[9], 4, "Month 9 should count 4 tasks");
    assert.equal(counts[10], 1, "Month 10 should count 1 task");
    assert.equal(counts[11], 1, "Month 11 should count 1 task (task-cross-month parent dueDate)");
    assert.equal(counts[1], 1, "Month 1 should count 1 task");
    assert.equal(counts[2], 0, "Month 2 should count 0 tasks");
  });

  test("filterTasksHub seamlessly applies academicMonth alongside scope and search", () => {
    const hubResult = filterTasksHub({
      tasks: sampleTasks,
      scope: "SCHOOL_TASKS",
      academicMonth: 9,
      academicYear: "2026-2027",
    });
    assert.equal(hubResult.length, 4);

    const hubResultWithSearch = filterTasksHub({
      tasks: sampleTasks,
      scope: "SCHOOL_TASKS",
      academicMonth: 9,
      academicYear: "2026-2027",
      searchQuery: "boundary-start",
    });
    assert.equal(hubResultWithSearch.length, 1);
    assert.equal(hubResultWithSearch[0].id, "task-month-9-boundary-start");
  });

  test("page.tsx connects selectedAcademicMonth and passes monthlyTaskCounts to toolbar", () => {
    const source = [
      fs.readFileSync(path.resolve(__dirname, "../src/app/page.tsx"), "utf-8"),
      fs.readFileSync(path.resolve(__dirname, "../src/hooks/use-url-params-sync.ts"), "utf-8"),
      fs.readFileSync(path.resolve(__dirname, "../src/components/dashboard/zones/tasks-expanded-views.tsx"), "utf-8"),
    ].join("\n");

    // Verify state definition
    assert.ok(
      source.includes("selectedAcademicMonth") && source.includes("setSelectedAcademicMonth"),
      "page.tsx must define selectedAcademicMonth state"
    );

    // Verify monthlyTaskCounts computation
    assert.ok(
      source.includes("monthlyTaskCounts"),
      "page.tsx must compute monthlyTaskCounts"
    );

    // Verify passing props to UnifiedTaskToolbar
    assert.ok(
      source.includes("selectedAcademicMonth={selectedAcademicMonth}"),
      "page.tsx must pass selectedAcademicMonth to UnifiedTaskToolbar"
    );
    assert.ok(
      source.includes("onAcademicMonthChange="),
      "page.tsx must pass onAcademicMonthChange to UnifiedTaskToolbar"
    );
    assert.ok(
      source.includes("monthlyTaskCounts={monthlyTaskCounts}"),
      "page.tsx must pass monthlyTaskCounts to UnifiedTaskToolbar"
    );
  });
});
