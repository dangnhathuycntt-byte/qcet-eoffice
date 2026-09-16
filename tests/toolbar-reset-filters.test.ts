import { test } from "node:test";
import assert from "node:assert/strict";
import { resetTaskToolbarFilters } from "../src/components/dashboard/unified-task-toolbar";

test("clear all uses a single atomic reset without queuing individual filter navigations", () => {
  const calls: string[] = [];
  resetTaskToolbarFilters({
    onResetFilters: () => calls.push("reset"),
    onSearchChange: () => calls.push("search"),
    onTabChange: () => calls.push("tab"),
    onStatusChange: () => calls.push("status"),
    onDeadlineChange: () => calls.push("deadline"),
    onCategoryChange: () => calls.push("category"),
    onPriorityChange: () => calls.push("priority"),
    onMonthChange: () => calls.push("month"),
  });
  assert.deepEqual(calls, ["reset"]);
});

test("standalone toolbar reset also clears explicit status and deadline controls", () => {
  const state = { search: "report", status: "WAITING_APPROVAL", deadline: "overdue" };
  resetTaskToolbarFilters({
    onSearchChange: value => { state.search = value; },
    onStatusChange: value => { state.status = value; },
    onDeadlineChange: value => { state.deadline = value; },
  });
  assert.deepEqual(state, { search: "", status: "all", deadline: "all" });
});
