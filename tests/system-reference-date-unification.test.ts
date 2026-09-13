import { test } from "node:test";
import assert from "node:assert/strict";
import { getSystemReferenceDate, getSystemReferenceDateStr, isTaskPastDue } from "../src/lib/unified-task-hub";
import { getSystemReferenceDate as getCanonicalReferenceDate } from "../src/lib/academic-calendar";

/**
 * Requirement (plan T03.5, contract-map D4): there must be exactly ONE system
 * reference date. `unified-task-hub` now delegates to the canonical date module
 * (`src/lib/academic-calendar.ts`), so the previous second constant ("2026-09-06")
 * is gone. The expected value follows the canonical module, which is also the
 * value the app already renders.
 */
test("getSystemReferenceDate returns consistent reference date", () => {
  const refDate = getSystemReferenceDate();
  assert.ok(refDate instanceof Date, "Must be a Date instance");

  const refStr = getSystemReferenceDateStr();
  assert.match(refStr, /^\d{4}-\d{2}-\d{2}$/, "Must be formatted as YYYY-MM-DD");
  assert.equal(refStr, "2026-09-09", "Default system reference date must match the canonical 2026-09-09");
});

test("both reference-date helpers agree on one value", () => {
  assert.equal(getSystemReferenceDateStr(), getCanonicalReferenceDate());
  assert.equal(getSystemReferenceDateStr(), "2026-09-09");
});

test("isTaskPastDue correctly flags overdue based on system reference date", () => {
  assert.equal(isTaskPastDue("2026-09-08"), true, "2026-09-08 must be past due on 2026-09-09");
  assert.equal(isTaskPastDue("2026-09-09"), false, "Today due date is not past due");
  assert.equal(isTaskPastDue("2026-09-10"), false, "Future due date is not past due");
});
