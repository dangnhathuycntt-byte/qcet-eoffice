import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getAllowedTaskLevelsForRole,
  getDefaultTaskLevelForRole,
} from "../src/components/dashboard/create-task-modal";
import { canAssignUnitTask } from "../src/lib/role-task-filter";

describe("Role-based Task Modal Helpers", () => {
  test("ADMIN can create both TRUONG and DON_VI tasks", () => {
    const levels = getAllowedTaskLevelsForRole("ADMIN");
    assert.deepEqual(levels, ["TRUONG", "DON_VI"]);
    assert.equal(getDefaultTaskLevelForRole("ADMIN"), "TRUONG");
  });

  test("MANAGER can only create DON_VI tasks", () => {
    const levels = getAllowedTaskLevelsForRole("MANAGER");
    assert.deepEqual(levels, ["DON_VI"]);
    assert.equal(getDefaultTaskLevelForRole("MANAGER"), "DON_VI");
  });

  test("STAFF has no allowed task creation levels", () => {
    const levels = getAllowedTaskLevelsForRole("STAFF");
    assert.deepEqual(levels, []);
    assert.equal(getDefaultTaskLevelForRole("STAFF"), "DON_VI");
  });

  test("Delegation permissions for CascadingTaskTable match role capabilities", () => {
    assert.equal(canAssignUnitTask("ADMIN"), true);
    assert.equal(canAssignUnitTask("MANAGER"), true);
    assert.equal(canAssignUnitTask("STAFF"), false);
  });
});

