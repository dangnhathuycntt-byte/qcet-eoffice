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
import {
  parseStrictDateOnly,
  addCalendarDays,
  selectUpcomingDeadlines,
  isTaskPastDue,
} from "../src/lib/academic-calendar";
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

describe("W1 — upcoming window [D, D+6] over the shared fixture", () => {
  const result = selectUpcomingDeadlines(SMALL_FIXTURE_TASKS, FIXTURE_REFERENCE_DATE);

  test("selects exactly the hand-written order", () => {
    assert.deepEqual(
      result.items.map((t) => t.id),
      EXPECTED_UPCOMING_ORDER
    );
  });

  test("excludes every id the fixture marks absent", () => {
    const ids = new Set(result.items.map((t) => t.id));
    for (const id of EXPECTED_UPCOMING_ABSENT) {
      assert.equal(ids.has(id), false, `${id} must not appear in upcoming`);
    }
  });

  test("D is included and is NOT overdue", () => {
    assert.equal(result.items.some((t) => t.id === "q14"), true);
    assert.equal(isTaskPastDue(D.today, FIXTURE_REFERENCE_DATE), false);
  });

  test("D-1 / D-3 (overdue) are excluded", () => {
    const ids = new Set(result.items.map((t) => t.id));
    assert.equal(ids.has("q04"), false, "q04 due D-1 must not appear");
    assert.equal(ids.has("q06"), false, "q06 due D-3 must not appear");
  });

  test("D+6 is included, D+7 is excluded", () => {
    const ids = new Set(result.items.map((t) => t.id));
    assert.equal(ids.has("q12"), true, "q12 due D+6 must appear");
    assert.equal(ids.has("q13"), false, "q13 due D+7 must not appear");
  });

  test("invalid and impossible dates stay missing, never coerced to today", () => {
    const ids = new Set(result.items.map((t) => t.id));
    assert.equal(ids.has("q09"), false, "q09 invalid due date must not appear");
    assert.equal(ids.has("q09b"), false, "q09b impossible calendar date must not appear");
    assert.equal(parseStrictDateOnly("2026-02-30"), null);
  });

  test("completed and cancelled rows are excluded", () => {
    const ids = new Set(result.items.map((t) => t.id));
    assert.equal(ids.has("q07"), false, "completed q07 must not appear");
    assert.equal(ids.has("q08"), false, "cancelled q08 must not appear");
  });

  test("total equals the full window size, preview is the first five rows", () => {
    assert.equal(result.total, EXPECTED_UPCOMING_ORDER.length);
    assert.equal(result.preview.length, 5);
    assert.deepEqual(
      result.preview.map((t) => t.id),
      EXPECTED_UPCOMING_ORDER.slice(0, 5)
    );
  });

  test("sort is stable: due asc, then priority desc, then id asc", () => {
    const dueOf = (id: string) => SMALL_FIXTURE_TASKS.find((t) => t.id === id)!.dueDate;
    const dueOrder = result.items.map((t) => dueOf(t.id));
    const sortedDue = [...dueOrder].sort();
    assert.deepEqual(dueOrder, sortedDue, "rows must be ordered by due date ascending");

    const tie = result.items.filter((t) => dueOf(t.id) === D.plus3).map((t) => t.id);
    assert.deepEqual(tie, ["q02", "q01", "q11"], "same-day tie: q02 HIGH, then q01/q11 by id");
  });
});

describe("W1 — upcoming window across a year boundary", () => {
  const row = (id: string, dueDate: string, priority = "NORMAL") => ({
    id,
    title: id,
    dueDate,
    status: "IN_PROGRESS",
    priority,
  });

  test("window end crosses from December into January", () => {
    const rows = [
      row("past", "2026-12-29"),
      row("today", "2026-12-30"),
      row("edge", "2027-01-05"),
      row("outside", "2027-01-06"),
    ];
    const result = selectUpcomingDeadlines(rows, "2026-12-30", { previewLimit: 5 });
    assert.deepEqual(
      result.items.map((r) => r.id),
      ["today", "edge"]
    );
  });

  test("an invalid reference date yields an empty selection, not a crash", () => {
    const result = selectUpcomingDeadlines([row("a", "2026-09-13")], "2026-02-30");
    assert.deepEqual(result, { items: [], total: 0, preview: [] });
  });
});
