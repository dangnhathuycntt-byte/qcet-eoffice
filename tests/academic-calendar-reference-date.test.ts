import test from "node:test";
import assert from "node:assert/strict";
import { getSystemReferenceDate, isTaskPastDue } from "../src/lib/academic-calendar";

test("getSystemReferenceDate returns current ICT date when env var is unset", () => {
  const originalEnv = process.env.NEXT_PUBLIC_REFERENCE_DATE;
  delete process.env.NEXT_PUBLIC_REFERENCE_DATE;
  try {
    const ref = getSystemReferenceDate();
    const expectedToday = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date());
    assert.equal(ref, expectedToday);
  } finally {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_REFERENCE_DATE = originalEnv;
    }
  }
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
  const originalEnv = process.env.NEXT_PUBLIC_REFERENCE_DATE;
  delete process.env.NEXT_PUBLIC_REFERENCE_DATE;
  try {
    // Using Date instances
    assert.equal(isTaskPastDue(new Date("2026-09-08T12:00:00.000Z"), "2026-09-09"), true);
    assert.equal(isTaskPastDue(new Date("2026-09-09T08:00:00.000Z"), "2026-09-09"), false);
    assert.equal(isTaskPastDue(new Date("2026-09-10T00:00:00.000Z"), "2026-09-09"), false);

    // Invalid date instance
    assert.equal(isTaskPastDue(new Date("invalid"), "2026-09-09"), false);

    // Explicit reference date instead of relying on default
    assert.equal(isTaskPastDue("2026-09-08", "2026-09-09"), true);
    assert.equal(isTaskPastDue("2026-09-09", "2026-09-09"), false);
    assert.equal(isTaskPastDue("2026-09-10", "2026-09-09"), false);
  } finally {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_REFERENCE_DATE = originalEnv;
    }
  }
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

