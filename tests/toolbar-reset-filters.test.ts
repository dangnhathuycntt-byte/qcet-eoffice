import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("standalone toolbar reset clears every task-list filter", () => {
  const state = {
    search: "report",
    status: "WAITING_APPROVAL",
    deadline: "overdue",
    category: "TRAINING",
    priority: "HIGH",
    department: "CNTT",
    month: 9 as number | "ALL",
  };
  resetTaskToolbarFilters({
    onSearchChange: value => { state.search = value; },
    onStatusChange: value => { state.status = value; },
    onDeadlineChange: value => { state.deadline = value; },
    onCategoryChange: value => { state.category = value; },
    onPriorityChange: value => { state.priority = value; },
    onDepartmentChange: value => { state.department = value; },
    onMonthChange: value => { state.month = value; },
  });
  assert.deepEqual(state, {
    search: "",
    status: "all",
    deadline: "all",
    category: "ALL",
    priority: "ALL",
    department: "ALL",
    month: "ALL",
  });
});

test("both toolbar clear-all entry points use the shared full-reset handler", () => {
  const source = readFileSync(
    new URL("../src/components/dashboard/unified-task-toolbar.tsx", import.meta.url),
    "utf8"
  );
  const sharedHandlerBindings = source.match(/onClick=\{handleResetFilters\}/g) ?? [];

  assert.ok(
    source.includes("onMonthChange: handleEffectiveMonthChange, onDepartmentChange"),
    "The standalone fallback must receive the department reset callback"
  );
  assert.ok(
    sharedHandlerBindings.length >= 2,
    "Both the toolbar and advanced-filter clear-all buttons must share the full reset handler"
  );
});
