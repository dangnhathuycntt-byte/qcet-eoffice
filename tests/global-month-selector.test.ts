import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { getAcademicMonthPeriod, getAcademicMonthInfo } from "../src/lib/academic-calendar";

describe("Global Month Selector Component Invariants", () => {

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
