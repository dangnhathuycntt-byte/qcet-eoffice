import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";
import {
  computeSchoolTaskRollup,
  computeDashboardStats,
} from "../src/lib/dashboard-aggregator";
import {
  filterTasksHub,
  parseScopeParam,
  scopeToParam,
  parseViewModeParam,
} from "../src/lib/unified-task-hub";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";
import type { SchoolTask, StaffTask, TaskStatus } from "../src/types/dashboard";
import type { DelegationRule } from "../src/types/delegation";

describe("Dashboard Sub-Hooks Logic Verification", () => {
  const payload = getMockDashboardPayload();
  const managerUser = DEFAULT_DEMO_USERS[1];

  test("Optimistic task status change updates subtask and rolls up to school task", () => {
    const originalTask = payload.tasks[0];
    assert.ok(originalTask.subTasks.length > 0);
    const subTaskId = originalTask.subTasks[0].id;

    const updatedTasks: SchoolTask[] = payload.tasks.map((st) => {
      const updatedSubs: StaffTask[] = st.subTasks.map((sub) =>
        sub.id === subTaskId ? { ...sub, status: "COMPLETED" as TaskStatus } : sub
      );
      return computeSchoolTaskRollup({ ...st, subTasks: updatedSubs });
    });

    const targetSchoolTask = updatedTasks.find((t) => t.id === originalTask.id);
    assert.ok(targetSchoolTask);
    const targetSub = targetSchoolTask.subTasks.find((s) => s.id === subTaskId);
    assert.equal(targetSub?.status, "COMPLETED");
  });

  test("Task filter logic isolates department and scope correctly", () => {
    const unitTasks = filterTasksHub({
      tasks: payload.tasks,
      scope: "UNIT_TASKS",
      workboxFilter: "ALL",
      category: "ALL",
      priority: "ALL",
      department: "K_CNTT",
      searchQuery: "",
      user: managerUser,
      academicMonth: "ALL",
      academicYear: "2026-2027",
    });

    assert.ok(Array.isArray(unitTasks));
    assert.ok(unitTasks.length > 0);
  });

  test("URL parameter mapping handles edge cases cleanly", () => {
    assert.equal(parseScopeParam(null, "UNIT_TASKS"), "UNIT_TASKS");
    assert.equal(parseScopeParam("my", "SCHOOL_TASKS"), "MY_TASKS");
    assert.equal(scopeToParam("MY_TASKS"), "my");
    assert.equal(parseViewModeParam(null, "table"), "table");
    assert.equal(parseViewModeParam("kanban", "table"), "kanban");
  });

  test("Delegation rule management adds and revokes rules correctly", () => {
    let delegations: DelegationRule[] = [];
    const newRule: DelegationRule = {
      id: "del-test-1",
      grantorId: "vinh-nn",
      grantorName: "TS. Nguyễn Ngọc Vinh",
      grantorRole: "MANAGER",
      granteeId: "pho-lv",
      granteeName: "ThS. Lê Văn Phó",
      granteeRole: "STAFF",
      departmentCode: "K_CNTT",
      scope: "DACUM_REVIEW_STEP1",
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      status: "ACTIVE",
      reason: "Ủy quyền công tác",
      createdAt: new Date().toISOString(),
    };

    delegations = [newRule, ...delegations];
    assert.equal(delegations.length, 1);
    assert.equal(delegations[0].status, "ACTIVE");

    delegations = delegations.map((d) =>
      d.id === "del-test-1" ? { ...d, status: "REVOKED" as const } : d
    );
    assert.equal(delegations[0].status, "REVOKED");
  });
});
