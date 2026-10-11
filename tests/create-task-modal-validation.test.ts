import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getAllowedTaskLevelsForRole } from "../src/domain/tasks/create-task-policy";

describe("Create Task Modal Constraints & Helpers", () => {

  test("Allowed task levels per role", () => {
    assert.deepEqual(getAllowedTaskLevelsForRole("ADMIN"), ["TRUONG", "DON_VI"]);
    assert.deepEqual(getAllowedTaskLevelsForRole("MANAGER"), ["DON_VI"]);
    assert.deepEqual(getAllowedTaskLevelsForRole("STAFF"), []);
  });
});
