import test from "node:test";
import assert from "node:assert/strict";
import { getSystemReferenceDate, isTaskPastDue } from "../src/lib/academic-calendar";

test("getSystemReferenceDate returns standard 2026-09-09 default", () => {
  const ref = getSystemReferenceDate();
  assert.equal(ref, "2026-09-09");
});

test("isTaskPastDue compares lexicographical ISO dates accurately without UTC midnight skew", () => {
  const ref = "2026-09-09";
  // Due before reference date -> overdue
  assert.equal(isTaskPastDue("2026-09-08", ref), true);
  assert.equal(isTaskPastDue("2026-09-08T17:00:00.000Z", ref), true);

  // Due on reference date -> not overdue yet during the day
  assert.equal(isTaskPastDue("2026-09-09", ref), false);
  assert.equal(isTaskPastDue("2026-09-09T00:00:00.000Z", ref), false);

  // Due in future -> not overdue
  assert.equal(isTaskPastDue("2026-09-10", ref), false);

  // Null/empty date -> not overdue
  assert.equal(isTaskPastDue(null, ref), false);
  assert.equal(isTaskPastDue(undefined, ref), false);
});

test("isTaskPastDue handles Date instances and default reference date correctly", () => {
  // Using Date instances
  assert.equal(isTaskPastDue(new Date("2026-09-08T12:00:00.000Z"), "2026-09-09"), true);
  assert.equal(isTaskPastDue(new Date("2026-09-09T08:00:00.000Z"), "2026-09-09"), false);
  assert.equal(isTaskPastDue(new Date("2026-09-10T00:00:00.000Z"), "2026-09-09"), false);

  // Invalid date instance
  assert.equal(isTaskPastDue(new Date("invalid"), "2026-09-09"), false);

  // Default reference date (which defaults to 2026-09-09)
  assert.equal(isTaskPastDue("2026-09-08"), true);
  assert.equal(isTaskPastDue("2026-09-09"), false);
  assert.equal(isTaskPastDue("2026-09-10"), false);
});

test("getSystemReferenceDate respects NEXT_PUBLIC_REFERENCE_DATE env variable", () => {
  const originalEnv = process.env.NEXT_PUBLIC_REFERENCE_DATE;
  try {
    process.env.NEXT_PUBLIC_REFERENCE_DATE = "2026-10-15";
    assert.equal(getSystemReferenceDate(), "2026-10-15");
  } finally {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_REFERENCE_DATE = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_REFERENCE_DATE;
    }
  }
});

