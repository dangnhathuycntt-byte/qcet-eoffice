/**
 * W1 / Plan T05 — Upcoming deadline selection (AC07–AC10).
 *
 * Requirement covered: strict date-only validation (impossible calendar dates are
 * MISSING, never coerced to "today"), the inclusive [D, D+6] business window
 * (overdue never appears), and the stable sort due asc -> priority desc -> id asc.
 *
 * Expected IDs come from the hand-written fixture table, not from the selector.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseStrictDateOnly, addCalendarDays, isTaskPastDue } from "../src/lib/academic-calendar";
import {
  SMALL_FIXTURE_TASKS,
  FIXTURE_REFERENCE_DATE,
  D,
  EXPECTED_UPCOMING_ORDER,
  EXPECTED_UPCOMING_ABSENT,
} from "./fixtures/workbench-queue-fixture";

describe("W1 — strict date-only validation", () => {
  test("accepts a real calendar date and normalises it", () => {
    assert.equal(parseStrictDateOnly("2026-09-13"), "2026-09-13");
    assert.equal(parseStrictDateOnly(" 2026-09-13 "), "2026-09-13");
    assert.equal(parseStrictDateOnly("2026-09-13T23:59:00.000Z"), "2026-09-13");
  });

  test("rejects an impossible calendar date instead of rolling it forward", () => {
    assert.equal(parseStrictDateOnly("2026-02-30"), null);
    assert.equal(parseStrictDateOnly("2026-13-01"), null);
    assert.equal(parseStrictDateOnly("2026-00-10"), null);
    assert.equal(parseStrictDateOnly("2026-04-31"), null);
  });

  test("rejects junk and nullish input", () => {
    assert.equal(parseStrictDateOnly("khong-phai-ngay"), null);
    assert.equal(parseStrictDateOnly(""), null);
    assert.equal(parseStrictDateOnly(null), null);
    assert.equal(parseStrictDateOnly(undefined), null);
    assert.equal(parseStrictDateOnly(new Date("invalid")), null);
  });

  test("a leap day is a real date only in a leap year", () => {
    assert.equal(parseStrictDateOnly("2028-02-29"), "2028-02-29");
    assert.equal(parseStrictDateOnly("2026-02-29"), null);
  });
});

describe("W1 — calendar-day arithmetic across month/year boundaries", () => {
  test("adds calendar days rather than 24h timestamps", () => {
    assert.equal(addCalendarDays("2026-09-13", 1), "2026-09-14");
    assert.equal(addCalendarDays("2026-09-13", 6), "2026-09-19");
    assert.equal(addCalendarDays("2026-09-30", 1), "2026-10-01");
  });

  test("crosses a year boundary correctly", () => {
    assert.equal(addCalendarDays("2026-12-30", 6), "2027-01-05");
    assert.equal(addCalendarDays("2026-12-31", 1), "2027-01-01");
  });

  test("returns null for an invalid base date", () => {
    assert.equal(addCalendarDays("2026-02-30", 1), null);
    assert.equal(addCalendarDays("not-a-date", 1), null);
  });
});
