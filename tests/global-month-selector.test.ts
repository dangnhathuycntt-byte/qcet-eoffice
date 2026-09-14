import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  ACADEMIC_MONTH_ORDER,
  getAcademicMonthPeriod,
  getAcademicMonthInfo,
} from "../src/lib/academic-calendar";

describe("Global Month Selector Component Invariants", () => {
  test("academic calendar defines 12 operational months in correct order", () => {
    assert.deepEqual(ACADEMIC_MONTH_ORDER, [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test("semester groups cover all 12 operational months without duplication", () => {
    const semester1 = [9, 10, 11, 12];
    const semester2 = [1, 2, 3, 4, 5];
    const summer = [6, 7, 8];

    const combined = [...semester1, ...semester2, ...summer];
    assert.equal(combined.length, 12);
    assert.deepEqual(combined, [...ACADEMIC_MONTH_ORDER]);
  });

  test("operational month date spans conform to 25 to 24 cycle", () => {
    const period9 = getAcademicMonthPeriod(9, "2026-2027");
    assert.equal(period9.shortDateSpan, "25/08 - 24/09");
    assert.equal(period9.startDate, "2026-08-25");
    assert.equal(period9.endDate, "2026-09-24");

    const period1 = getAcademicMonthPeriod(1, "2026-2027");
    assert.equal(period1.shortDateSpan, "25/12 - 24/01");
    assert.equal(period1.startDate, "2026-12-25");
    assert.equal(period1.endDate, "2027-01-24");

    const period8 = getAcademicMonthPeriod(8, "2026-2027");
    assert.equal(period8.shortDateSpan, "25/07 - 24/08");
    assert.equal(period8.startDate, "2027-07-25");
    assert.equal(period8.endDate, "2027-08-24");
  });
});
