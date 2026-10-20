import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateSubtaskDueDate } from "../src/hooks/use-create-task-form";

describe("Stream Form UX Interactions Regression Suite", () => {
  describe("Task 4: Form Close Contract, Snapshot Dirty Checking, and DRI Validation", () => {

    it("validates that subtask dueDate cannot exceed parent task dueDate", () => {
      const parentDueDate = "2026-10-15";
      assert.strictEqual(validateSubtaskDueDate(parentDueDate, "2026-10-10"), true);
      assert.strictEqual(validateSubtaskDueDate(parentDueDate, "2026-10-15"), true);
      assert.strictEqual(validateSubtaskDueDate(parentDueDate, "2026-10-16"), false);
      assert.strictEqual(validateSubtaskDueDate(parentDueDate, "2026-11-01"), false);
    });
  });
});
