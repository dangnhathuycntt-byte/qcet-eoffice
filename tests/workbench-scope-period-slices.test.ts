/**
 * W4 / Plan T03 — scope + period unification (AC06, AC09, AC14, F15).
 *
 * Requirements covered:
 *  - The summary, the executive queue, department health and the action items all
 *    derive from ONE scope + period task set. A lower-month change re-derives all
 *    of them together.
 *  - An empty scope renders empty — it never widens back to the raw school-wide list.
 *  - The reference date is normalized once and threaded in.
 *  - A stale (out-of-order) response can never overwrite a newer one.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { computeDashboardSlices } from "../src/hooks/use-task-filters";
import { createLatestRequestGuard } from "../src/lib/latest-request-guard";
import type { AuthUser } from "../src/types/auth";
import type { SchoolTask } from "../src/types/dashboard";

const ACADEMIC_YEAR = "2026-2027";
const REFERENCE_DATE = "2026-09-13";

function user(overrides: Partial<AuthUser> & { name: string; role: AuthUser["role"] }): AuthUser {
  return {
    id: overrides.id ?? "u1",
    email: "u1@qcet.edu.vn",
    roleLabel: overrides.role,
    department: "Khoa CNTT",
    departmentCode: "K_CNTT",
    ...overrides,
  };
}

function task(overrides: Partial<SchoolTask> & { id: string; title: string }): SchoolTask {
  return {
    category: "KHAC",
    categoryLabel: "Khác",
    status: "IN_PROGRESS",
    dueDate: "2026-09-20",
    progressPercent: 40,
    totalSubTasks: 0,
    completedSubTasks: 0,
    leadAssigneeName: "Nguyễn Văn A",
    coAssignees: [],
    assignedDate: "2026-09-01",
    subTasks: [],
    ...overrides,
  };
}

const TASKS: SchoolTask[] = [
  task({ id: "t1", title: "t1 — CNTT, hạn tháng 9", leadDepartmentCode: "K_CNTT", dueDate: "2026-09-20" }),
  task({
    id: "t2",
    title: "t2 — CNTT bị chặn, hạn tháng 9",
    leadDepartmentCode: "K_CNTT",
    leadAssigneeName: "Trần Văn B",
    status: "BLOCKED",
    dueDate: "2026-09-21",
  }),
  task({
    id: "t3",
    title: "t3 — HCQT, hạn tháng 9",
    leadDepartmentCode: "P_HCQT",
    leadAssigneeName: "Lê Văn C",
    dueDate: "2026-09-22",
  }),
  task({
    id: "t4",
    title: "t4 — CNTT chờ xem xét, hạn tháng 10",
    leadDepartmentCode: "K_CNTT",
    status: "PENDING_EXECUTIVE_APPROVAL",
    dueDate: "2026-10-05",
  }),
];

function slice(over: Partial<Parameters<typeof computeDashboardSlices>[0]>) {
  return computeDashboardSlices({
    tasks: TASKS,
    effectiveScope: "SCHOOL_TASKS",
    user: user({ name: "Quản trị", role: "ADMIN" }),
    selectedDepartment: "ALL",
    selectedAcademicMonth: "ALL",
    academicYear: ACADEMIC_YEAR,
    referenceDate: REFERENCE_DATE,
    isExecutive: true,
    activeZone: "dashboard",
    ...over,
  });
}

const ids = (tasks: SchoolTask[]) => tasks.map((t) => t.id).sort();

describe("W4 — actor scope school / unit / my", () => {
  test("school scope sees every task; the summary counts that same set", () => {
    const s = slice({ effectiveScope: "SCHOOL_TASKS", user: user({ name: "Quản trị", role: "ADMIN" }) });
    assert.deepEqual(ids(s.monthScopedBaseTasks), ["t1", "t2", "t3", "t4"]);
    assert.equal(s.displayedStats.totalSchoolTasks, 4);
    assert.deepEqual(ids(s.executiveActionItems.map((i) => TASKS.find((t) => t.id === i.taskId)!)), [
      "t2",
      "t4",
    ]);
  });

  test("unit scope is confined to the selected department", () => {
    const s = slice({
      effectiveScope: "UNIT_TASKS",
      user: user({ name: "Trưởng đơn vị", role: "MANAGER" }),
      selectedDepartment: "K_CNTT",
    });
    assert.deepEqual(ids(s.monthScopedBaseTasks), ["t1", "t2", "t4"]);
    assert.equal(s.displayedStats.totalSchoolTasks, 3);
    assert.equal(s.monthScopedBaseTasks.some((t) => t.id === "t3"), false);
  });

  test("my scope is confined to the actor's own tasks", () => {
    const s = slice({
      effectiveScope: "MY_TASKS",
      user: user({ name: "Nguyễn Văn A", role: "STAFF" }),
      isExecutive: false,
    });
    assert.deepEqual(ids(s.monthScopedBaseTasks), ["t1", "t4"]);
    assert.equal(s.displayedStats.totalSchoolTasks, 2);
  });
});

describe("W4 — month change re-derives every surface together", () => {
  test("month 9 excludes the month-10 review file", () => {
    const s = slice({
      effectiveScope: "UNIT_TASKS",
      user: user({ name: "Trưởng đơn vị", role: "MANAGER" }),
      selectedDepartment: "K_CNTT",
      selectedAcademicMonth: 9,
    });
    assert.deepEqual(ids(s.monthScopedBaseTasks), ["t1", "t2"]);
    assert.equal(s.displayedStats.totalSchoolTasks, 2);
    // Executive queue derives from the SAME month+scope set: t4 must be absent.
    assert.equal(s.executiveActionItems.some((i) => i.taskId === "t4"), false);
    assert.equal(s.executiveActionItems.some((i) => i.taskId === "t2"), true);
  });

  test("month 10 excludes the month-9 blocked task", () => {
    const s = slice({
      effectiveScope: "UNIT_TASKS",
      user: user({ name: "Trưởng đơn vị", role: "MANAGER" }),
      selectedDepartment: "K_CNTT",
      selectedAcademicMonth: 10,
    });
    assert.deepEqual(ids(s.monthScopedBaseTasks), ["t4"]);
    assert.equal(s.executiveActionItems.some((i) => i.taskId === "t4"), true);
    assert.equal(s.executiveActionItems.some((i) => i.taskId === "t2"), false);
  });
});

describe("W4 — empty scope renders empty, never school-wide", () => {
  test("an actor with no matching task sees an empty summary", () => {
    const s = slice({
      effectiveScope: "MY_TASKS",
      user: user({ name: "Không Ai Cả", role: "STAFF" }),
      isExecutive: false,
    });
    assert.deepEqual(s.monthScopedBaseTasks, []);
    assert.equal(s.displayedStats.totalSchoolTasks, 0, "empty scope must NOT fall back to all tasks");
    assert.deepEqual(s.executiveActionItems, []);
    assert.deepEqual(s.departmentHealth, []);
  });

  test("a set of zero tasks stays zero", () => {
    const s = slice({ tasks: [], effectiveScope: "SCHOOL_TASKS" });
    assert.equal(s.displayedStats.totalSchoolTasks, 0);
    assert.deepEqual(s.executiveActionItems, []);
  });
});

describe("W4 — stale / out-of-order responses", () => {
  test("an older response is not current once a newer request starts", () => {
    const guard = createLatestRequestGuard();
    const first = guard.begin();
    assert.equal(guard.isCurrent(first), true);
    const second = guard.begin();
    assert.equal(guard.isCurrent(first), false, "the first response must be rejected");
    assert.equal(guard.isCurrent(second), true);
    assert.equal(guard.current(), second);
  });

  test("a lone response is always current", () => {
    const guard = createLatestRequestGuard();
    const only = guard.begin();
    assert.equal(guard.isCurrent(only), true);
  });
});
