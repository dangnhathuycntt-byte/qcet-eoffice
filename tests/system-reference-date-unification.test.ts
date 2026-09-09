import { test } from "node:test";
import assert from "node:assert/strict";
import { getSystemReferenceDate, getSystemReferenceDateStr, isTaskPastDue } from "../src/lib/unified-task-hub";

test("getSystemReferenceDate returns consistent reference date", () => {
  const refDate = getSystemReferenceDate();
  assert.ok(refDate instanceof Date, "Must be a Date instance");

  const refStr = getSystemReferenceDateStr();
  assert.match(refStr, /^\d{4}-\d{2}-\d{2}$/, "Must be formatted as YYYY-MM-DD");
  assert.equal(refStr, "2026-09-06", "Default system reference date must match 2026-09-06");
});

test("isTaskPastDue correctly flags overdue based on system reference date", () => {
  assert.equal(isTaskPastDue("2026-09-05"), true, "2026-09-05 must be past due on 2026-09-06");
  assert.equal(isTaskPastDue("2026-09-06"), false, "Today due date is not past due");
  assert.equal(isTaskPastDue("2026-09-10"), false, "Future due date is not past due");
});
