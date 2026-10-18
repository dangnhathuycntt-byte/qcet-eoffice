import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { ICT_TIME_ZONE, toIctDateTimeParts, formatIsoDate, formatDisplayDate, formatCompactDate, formatTime, formatDateTime, formatRelativeDate, daysUntil, RELATIVE_NEAR_TERM_MAX_DAYS } from "../src/lib/format";
import { getSystemReferenceDate } from "@qcet/shared/lib/academic-calendar";

describe("C19 — date/time formatting utilities (src/lib/format)", () => {

  it("resolves a Date to ICT calendar parts (UTC+7) rather than UTC slicing", () => {
    // 17:30 UTC is 00:30 ICT on the next day.
    const instant = new Date("2026-09-24T17:30:00Z");
    assert.equal(formatIsoDate(instant), "2026-09-25");
    assert.equal(formatDisplayDate(instant), "25/09/2026");
  });

  it("emits 24-hour time and date+time (vocabulary §G.1)", () => {
    // 01:30 UTC is 08:30 ICT.
    assert.equal(formatTime(new Date("2026-09-25T01:30:00Z")), "08:30");
    assert.equal(formatDateTime(new Date("2026-09-25T01:30:00Z")), "25/09/2026 08:30");
    assert.equal(formatDateTime("2026-09-25T08:30"), "25/09/2026 08:30");
    assert.equal(formatTime("2026-09-25T08:30"), "08:30");
  });

  it("rejects out-of-range components instead of rendering a fabricated date", () => {
    // Shape-valid but calendar-impossible values must fall back rather than render.
    assert.equal(toIctDateTimeParts("2026-13-40"), null);
    assert.equal(toIctDateTimeParts("2026-09-00"), null);
    assert.equal(formatDisplayDate("2026-13-40"), "-");
    assert.equal(formatIsoDate("2026-09-00"), "-");
    assert.equal(formatDisplayDate("2026-02-30"), "-");
    assert.equal(formatCompactDate("2026-13-40"), "-");
    assert.equal(formatRelativeDate("2026-13-40", "2026-09-09"), "-");
    // Naive datetime with out-of-range time components fails the same way.
    assert.equal(formatDateTime("2026-09-25T25:99"), "-");
    assert.equal(formatTime("2026-09-25T24:00"), "-");
    // A valid value of the same shape still parses (no over-rejection).
    assert.notEqual(toIctDateTimeParts("2026-09-25"), null);
    assert.equal(formatDisplayDate("2026-09-25"), "25/09/2026");
  });

  it("falls back when a date-only value is passed to a time renderer (no misleading 00:00)", () => {
    // A DB date-only value (e.g. dueDate 'YYYY-MM-DD') carries no time-of-day.
    assert.equal(formatTime("2026-09-25"), "-");
    assert.equal(formatDateTime("2026-09-25"), "-");
    // A genuine ICT-midnight instant does carry a time-of-day and still renders 00:00.
    const midnightIct = new Date("2026-09-24T17:00:00Z"); // 00:00 ICT on 25/09
    assert.equal(formatTime(midnightIct), "00:00");
    assert.equal(formatDateTime(midnightIct), "25/09/2026 00:00");
    // Date-only helpers remain unaffected by the time-bearing distinction.
    assert.equal(formatIsoDate("2026-09-25"), "2026-09-25");
    assert.equal(formatDisplayDate("2026-09-25"), "25/09/2026");
  });

  it("applies the bounded relative-date rule against an explicit reference (vocabulary §G.2)", () => {
    const ref = "2026-09-09";
    assert.equal(formatRelativeDate("2026-09-09", ref), "Hôm nay");
    assert.equal(formatRelativeDate("2026-09-10", ref), "Ngày mai");
    assert.equal(formatRelativeDate("2026-09-11", ref), "Còn 2 ngày");
    assert.equal(formatRelativeDate("2026-09-12", ref), "Còn 3 ngày");
    // Bounded: from 4 days out the absolute dd/MM/yyyy date is shown, not a count.
    assert.equal(formatRelativeDate("2026-09-13", ref), "13/09/2026");
    assert.equal(formatRelativeDate("2026-10-09", ref), "09/10/2026");
    // Past due.
    assert.equal(formatRelativeDate("2026-09-08", ref), "Trễ hạn 1 ngày");
    assert.equal(formatRelativeDate("2026-09-07", ref), "Trễ hạn 2 ngày");
  });

  it("defaults the relative reference to the canonical system reference date", () => {
    const sysRef = getSystemReferenceDate();
    assert.equal(formatRelativeDate(sysRef), "Hôm nay");
    assert.equal(daysUntil(sysRef), 0);
    assert.equal(formatRelativeDate(null), "-");
  });
});
