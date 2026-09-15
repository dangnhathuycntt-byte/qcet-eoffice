import test from "node:test";
import assert from "node:assert/strict";
import { updateTaskStatus, updateTaskPriority, updateTaskDueDate } from "../src/lib/tasks/task-actions";

test("task-actions: functions exist and return structured TaskActionResult", async () => {
  assert.equal(typeof updateTaskStatus, "function");
  assert.equal(typeof updateTaskPriority, "function");
  assert.equal(typeof updateTaskDueDate, "function");

  // In test environment without mock fetch, should catch network error gracefully
  const res = await updateTaskStatus("test-id", "IN_PROGRESS");
  assert.equal(typeof res.ok, "boolean");
});
