/**
 * Dashboard scope invariants — "Role Is Not Scope" (plan T10.2 / T10.6).
 *
 * REPLACED: the previous file defined a local `resolveCanonicalDashboardScope` fake and
 * imported NO production code. This version exercises the real scope filter that the
 * dashboard and /tasks actually run (`filterTasksByScope`), asserting exact IDs.
 *
 * Requirement now covered: selecting a scope changes WHICH tasks are visible, and a
 * role label does not grant a wider dataset on its own. TaskScope stays a display/
 * aggregation filter, never a permission (core.md #2).
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { filterTasksByScope } from "../src/components/dashboard/unified-task-toolbar";
import type { AuthUser } from "../src/types/auth";
import type { SchoolTask } from "../src/types/dashboard";

function task(id: string, leadAssigneeName: string, leadDepartmentCode: string): SchoolTask {
  return {
    id,
    title: `${id} — nhiệm vụ`,
    category: "KHAC",
    categoryLabel: "Khác",
    status: "IN_PROGRESS",
    dueDate: "2026-09-20",
    progressPercent: 40,
    totalSubTasks: 0,
    completedSubTasks: 0,
    leadAssigneeName,
    coAssignees: [],
    assignedDate: "2026-09-01",
    subTasks: [],
    leadDepartmentCode,
  };
}

function user(over: Partial<AuthUser> & { name: string; role: AuthUser["role"] }): AuthUser {
  return {
    id: "u1",
    email: "u1@qcet.edu.vn",
    roleLabel: over.role,
    department: "Khoa CNTT",
    departmentCode: "K_CNTT",
    ...over,
  };
}

const TASKS: SchoolTask[] = [
  task("s1", "Nguyễn Văn A", "K_CNTT"),
  task("s2", "Trần Văn B", "K_CNTT"),
  task("s3", "Nguyễn Văn A", "P_HCQT"),
];

const ids = (list: SchoolTask[]) => list.map((t) => t.id).sort();

describe("Dashboard scope invariants (production filterTasksByScope)", () => {
  test("school scope exposes the whole permitted set", () => {
    const result = filterTasksByScope(TASKS, "SCHOOL_TASKS", user({ name: "Quản trị", role: "ADMIN" }));
    assert.deepEqual(ids(result), ["s1", "s2", "s3"]);
  });

  test("unit scope is confined to the department", () => {
    const result = filterTasksByScope(
      TASKS,
      "UNIT_TASKS",
      user({ name: "Trưởng đơn vị", role: "MANAGER" }),
      "K_CNTT"
    );
    assert.deepEqual(ids(result), ["s1", "s2"]);
    assert.equal(result.some((t) => t.id === "s3"), false, "another unit's task must not leak");
  });

  test("my scope is confined to the actor's own tasks", () => {
    const result = filterTasksByScope(TASKS, "MY_TASKS", user({ name: "Nguyễn Văn A", role: "STAFF" }));
    assert.deepEqual(ids(result), ["s1", "s3"]);
  });

  test("a manager role does not widen MY scope into the unit dataset", () => {
    const asManager = filterTasksByScope(
      TASKS,
      "MY_TASKS",
      user({ name: "Nguyễn Văn A", role: "MANAGER" })
    );
    // Same dataset as the STAFF case: role did not grant the unit's other tasks.
    assert.deepEqual(ids(asManager), ["s1", "s3"]);
  });
});
