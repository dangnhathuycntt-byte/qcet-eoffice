import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { canAssignUnitTask } from "../src/lib/role-task-filter";

describe("Role-based Task Modal Helpers", () => {

  test("Delegation permissions for CascadingTaskTable match role capabilities", () => {
    assert.equal(canAssignUnitTask("ADMIN"), true);
    assert.equal(canAssignUnitTask("MANAGER"), true);
    assert.equal(canAssignUnitTask("STAFF"), false);
  });
});

