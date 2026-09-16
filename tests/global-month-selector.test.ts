import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  CALENDAR_MONTH_ORDER,
  getAcademicMonthPeriod,
  getAcademicMonthInfo,
} from "../src/lib/academic-calendar";

describe("Global Month Selector Component Invariants", () => {
  test("calendar defines 12 months in correct solar order (1 through 12)", () => {
    assert.deepEqual(CALENDAR_MONTH_ORDER, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  test("semester groups cover all 12 operational months without duplication", () => {
    const semester1 = [9, 10, 11, 12];
    const semester2 = [1, 2, 3, 4, 5];
    const summer = [6, 7, 8];

    const combined = [...semester1, ...semester2, ...summer];
    assert.equal(combined.length, 12);
    assert.deepEqual(new Set(combined), new Set(CALENDAR_MONTH_ORDER));
  });

  test("solar month date spans conform to day 01 to end of month cycle", () => {
    const period9 = getAcademicMonthPeriod(9, "2026-2027");
    assert.equal(period9.shortDateSpan, "01/09 - 30/09");
    assert.equal(period9.startDate, "2026-09-01");
    assert.equal(period9.endDate, "2026-09-30");

    const period1 = getAcademicMonthPeriod(1, "2026-2027");
    assert.equal(period1.shortDateSpan, "01/01 - 31/01");
    assert.equal(period1.startDate, "2027-01-01");
    assert.equal(period1.endDate, "2027-01-31");

    const period8 = getAcademicMonthPeriod(8, "2026-2027");
    assert.equal(period8.shortDateSpan, "01/08 - 31/08");
    assert.equal(period8.startDate, "2027-08-01");
    assert.equal(period8.endDate, "2027-08-31");
  });
});
