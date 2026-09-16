import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getAcademicMonthInfo,
  getAcademicYear,
  getCalendarYear,
  getAcademicMonthsForYear,
  isDateInAcademicMonth,
  getAdjacentAcademicMonth,
  getQuarterPeriod,
  getQuarterFromMonth,
  isDateInQuarter,
  isLeapYear,
  getDaysInMonth,
  type AcademicMonthPeriod,
} from "../src/lib/academic-calendar";

describe("Gregorian Solar Calendar & Time Period Engine Suite", () => {
  describe("1. Calendar Year & Academic Year Invariants", () => {
    test("Calendar Year runs strictly 01/01 to 31/12", () => {
      assert.equal(getCalendarYear("2026-01-01"), 2026);
      assert.equal(getCalendarYear("2026-08-31"), 2026);
      assert.equal(getCalendarYear("2026-09-01"), 2026);
      assert.equal(getCalendarYear("2026-12-31"), 2026);
      assert.equal(getCalendarYear("2027-01-01"), 2027);
    });

    test("Academic Year begins on 01/09 and ends on 31/08", () => {
      assert.equal(getAcademicYear("2026-09-01"), "2026-2027");
      assert.equal(getAcademicYear("2026-12-31"), "2026-2027");
      assert.equal(getAcademicYear("2027-01-01"), "2026-2027");
      assert.equal(getAcademicYear("2027-08-31"), "2026-2027");
      assert.equal(getAcademicYear("2026-08-31"), "2025-2026");
    });

    test("handles Date objects properly in ICT timezone", () => {
      const sep01 = new Date(2026, 8, 1); // month 8 is September in JS Date
      const aug31 = new Date(2026, 7, 31);
      assert.equal(getAcademicYear(sep01), "2026-2027");
      assert.equal(getAcademicYear(aug31), "2025-2026");
    });
  });

  describe("2. Solar Month Periods (Day 01 to End of Month)", () => {
    test("Tháng 9 begins on 01/09 and ends on 30/09 (both 24/09 and 25/09 stay in Tháng 9)", () => {
      const start = getAcademicMonthInfo("2026-09-01");
      assert.equal(start.monthNumber, 9);
      assert.equal(start.startDate, "2026-09-01");
      assert.equal(start.endDate, "2026-09-30");
      assert.equal(start.nextPeriodStartDate, "2026-10-01");
      assert.equal(start.shortDateSpan, "01/09 - 30/09");
      assert.equal(start.label, "Tháng 9");

      // Days 24 and 25 must remain strictly inside Tháng 9
      const day24 = getAcademicMonthInfo("2026-09-24");
      assert.equal(day24.monthNumber, 9);
      const day25 = getAcademicMonthInfo("2026-09-25");
      assert.equal(day25.monthNumber, 9);

      const end = getAcademicMonthInfo("2026-09-30");
      assert.equal(end.monthNumber, 9);
    });

    test("Tháng 10 begins on 01/10 and ends on 31/10", () => {
      const info = getAcademicMonthInfo("2026-10-15");
      assert.equal(info.monthNumber, 10);
      assert.equal(info.startDate, "2026-10-01");
      assert.equal(info.endDate, "2026-10-31");
      assert.equal(info.shortDateSpan, "01/10 - 31/10");
    });

    test("Tháng 12 begins on 01/12 and ends on 31/12 (Year end transition)", () => {
      const info = getAcademicMonthInfo("2026-12-31");
      assert.equal(info.monthNumber, 12);
      assert.equal(info.calendarYear, 2026);
      assert.equal(info.startDate, "2026-12-01");
      assert.equal(info.endDate, "2026-12-31");
      assert.equal(info.nextPeriodStartDate, "2027-01-01");
    });

    test("Tháng 1 begins on 01/01 and ends on 31/01 (New Year start)", () => {
      const info = getAcademicMonthInfo("2027-01-01");
      assert.equal(info.monthNumber, 1);
      assert.equal(info.calendarYear, 2027);
      assert.equal(info.startDate, "2027-01-01");
      assert.equal(info.endDate, "2027-01-31");
    });

    test("Tháng 8 begins on 01/08 and ends on 31/08", () => {
      const info = getAcademicMonthInfo("2027-08-31");
      assert.equal(info.monthNumber, 8);
      assert.equal(info.startDate, "2027-08-01");
      assert.equal(info.endDate, "2027-08-31");
      assert.equal(info.shortDateSpan, "01/08 - 31/08");
    });
  });

  describe("3. Leap Year & February Calculation", () => {
    test("Correctly identifies leap years", () => {
      assert.equal(isLeapYear(2024), true, "2024 is a leap year");
      assert.equal(isLeapYear(2026), false, "2026 is not a leap year");
      assert.equal(isLeapYear(2028), true, "2028 is a leap year");
      assert.equal(isLeapYear(2000), true, "2000 is a leap year");
      assert.equal(isLeapYear(1900), false, "1900 is not a leap year");
    });

    test("February days in non-leap year (2026) ends on 28/02", () => {
      assert.equal(getDaysInMonth(2026, 2), 28);
      const feb2026 = getAcademicMonthInfo("2026-02-15");
      assert.equal(feb2026.startDate, "2026-02-01");
      assert.equal(feb2026.endDate, "2026-02-28");
      assert.equal(feb2026.shortDateSpan, "01/02 - 28/02");
    });

    test("February days in leap year (2024, 2028) ends on 29/02", () => {
      assert.equal(getDaysInMonth(2024, 2), 29);
      const feb2024 = getAcademicMonthInfo("2024-02-29");
      assert.equal(feb2024.startDate, "2024-02-01");
      assert.equal(feb2024.endDate, "2024-02-29");
      assert.equal(feb2024.shortDateSpan, "01/02 - 29/02");

      assert.equal(getDaysInMonth(2028, 2), 29);
      const feb2028 = getAcademicMonthInfo("2028-02-01");
      assert.equal(feb2028.endDate, "2028-02-29");
    });
  });

  describe("4. Quarters (Quý) Definition & Mapping", () => {
    test("Quý 1 covers Tháng 1–3 (01/01 - 31/03)", () => {
      const q1 = getQuarterPeriod(1, 2026);
      assert.equal(q1.quarter, 1);
      assert.equal(q1.startDate, "2026-01-01");
      assert.equal(q1.endDate, "2026-03-31");
      assert.equal(q1.nextQuarterStartDate, "2026-04-01");
      assert.deepEqual(q1.months, [1, 2, 3]);

      assert.equal(getQuarterFromMonth(1), 1);
      assert.equal(getQuarterFromMonth(2), 1);
      assert.equal(getQuarterFromMonth(3), 1);
    });

    test("Quý 2 covers Tháng 4–6 (01/04 - 30/06)", () => {
      const q2 = getQuarterPeriod(2, 2026);
      assert.equal(q2.quarter, 2);
      assert.equal(q2.startDate, "2026-04-01");
      assert.equal(q2.endDate, "2026-06-30");
      assert.deepEqual(q2.months, [4, 5, 6]);

      assert.equal(getQuarterFromMonth(4), 2);
      assert.equal(getQuarterFromMonth(5), 2);
      assert.equal(getQuarterFromMonth(6), 2);
    });

    test("Quý 3 covers Tháng 7–9 (01/07 - 30/09)", () => {
      const q3 = getQuarterPeriod(3, 2026);
      assert.equal(q3.quarter, 3);
      assert.equal(q3.startDate, "2026-07-01");
      assert.equal(q3.endDate, "2026-09-30");
      assert.deepEqual(q3.months, [7, 8, 9]);

      assert.equal(getQuarterFromMonth(7), 3);
      assert.equal(getQuarterFromMonth(8), 3);
      assert.equal(getQuarterFromMonth(9), 3);
    });

    test("Quý 4 covers Tháng 10–12 (01/10 - 31/12)", () => {
      const q4 = getQuarterPeriod(4, 2026);
      assert.equal(q4.quarter, 4);
      assert.equal(q4.startDate, "2026-10-01");
      assert.equal(q4.endDate, "2026-12-31");
      assert.equal(q4.nextQuarterStartDate, "2027-01-01");
      assert.deepEqual(q4.months, [10, 11, 12]);

      assert.equal(getQuarterFromMonth(10), 4);
      assert.equal(getQuarterFromMonth(11), 4);
      assert.equal(getQuarterFromMonth(12), 4);
    });

    test("isDateInQuarter matches dates accurately", () => {
      assert.equal(isDateInQuarter("2026-01-01", 1), true);
      assert.equal(isDateInQuarter("2026-03-31", 1), true);
      assert.equal(isDateInQuarter("2026-04-01", 1), false);
      assert.equal(isDateInQuarter("2026-09-30", 3), true);
      assert.equal(isDateInQuarter("2026-10-01", 4), true);
    });
  });

  describe("5. 12 Months Generation & Adjacent Navigation", () => {
    test("getAcademicMonthsForYear returns 12 solar months", () => {
      const months = getAcademicMonthsForYear(2026);
      assert.equal(months.length, 12);
      assert.equal(months[0].monthNumber, 1);
      assert.equal(months[0].startDate, "2026-01-01");
      assert.equal(months[0].endDate, "2026-01-31");

      assert.equal(months[11].monthNumber, 12);
      assert.equal(months[11].startDate, "2026-12-01");
      assert.equal(months[11].endDate, "2026-12-31");
    });

    test("isDateInAcademicMonth correctly matches solar dates", () => {
      assert.equal(isDateInAcademicMonth("2026-09-01", 9), true);
      assert.equal(isDateInAcademicMonth("2026-09-24", 9), true);
      assert.equal(isDateInAcademicMonth("2026-09-25", 9), true);
      assert.equal(isDateInAcademicMonth("2026-09-30", 9), true);
      assert.equal(isDateInAcademicMonth("2026-10-01", 9), false);
    });

    test("getAdjacentAcademicMonth steps forward and backward cleanly", () => {
      const sep = getAcademicMonthInfo("2026-09-15");
      const oct = getAdjacentAcademicMonth(sep, 1);
      assert.equal(oct.monthNumber, 10);
      assert.equal(oct.startDate, "2026-10-01");

      const dec = getAcademicMonthInfo("2026-12-15");
      const jan = getAdjacentAcademicMonth(dec, 1);
      assert.equal(jan.monthNumber, 1);
      assert.equal(jan.calendarYear, 2027);
      assert.equal(jan.startDate, "2027-01-01");
    });
  });
});
