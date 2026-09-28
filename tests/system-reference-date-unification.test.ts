import { test } from "node:test";
import assert from "node:assert/strict";
import { getSystemReferenceDate, getSystemReferenceDateStr, isTaskPastDue } from "../src/lib/unified-task-hub";
import { getSystemReferenceDate as getCanonicalReferenceDate } from "../src/lib/academic-calendar";

/**
 * Requirement (plan T03.5, contract-map D4): there must be exactly ONE system
 * reference date. `unified-task-hub` now delegates to the canonical date module
 * (`src/lib/academic-calendar.ts`), so the previous second constant ("2026-09-06")
 * is gone. The expected value follows the canonical module — which returns the
 * actual ICT date (or NEXT_PUBLIC_REFERENCE_DATE if set).
 */
test("getSystemReferenceDate returns consistent reference date", () => {
  const refDate = getSystemReferenceDate();
  assert.ok(refDate instanceof Date, "Must be a Date instance");

  const refStr = getSystemReferenceDateStr();
  assert.match(refStr, /^\d{4}-\d{2}-\d{2}$/, "Must be formatted as YYYY-MM-DD");
  // Must agree with canonical module — no hardcoded date
  assert.equal(refStr, getCanonicalReferenceDate(), "unified-task-hub must delegate to academic-calendar");
});

test("both reference-date helpers agree on one value", () => {
  const canonical = getCanonicalReferenceDate();
  assert.equal(getSystemReferenceDateStr(), canonical, "Str helper must match canonical");
});

test("isTaskPastDue correctly flags overdue based on system reference date", () => {
  // Compute yesterday/today/tomorrow dynamically from the live reference date
  const refStr = getSystemReferenceDateStr();
  const ref = new Date(refStr + "T00:00:00+07:00");
  const yesterday = new Date(ref.getTime() - 86_400_000);
  const tomorrow = new Date(ref.getTime() + 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  assert.equal(isTaskPastDue(fmt(yesterday)), true, `${fmt(yesterday)} must be past due on ${refStr}`);
  assert.equal(isTaskPastDue(refStr), false, "Today due date is not past due");
  assert.equal(isTaskPastDue(fmt(tomorrow)), false, "Future due date is not past due");
});
