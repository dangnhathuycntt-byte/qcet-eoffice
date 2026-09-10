import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getAcademicMonthInfo,
  getAcademicYear,
  getAcademicMonthsForYear,
  isDateInAcademicMonth,
  getAdjacentAcademicMonth,
  type AcademicMonthPeriod,
} from "../src/lib/academic-calendar";

describe("Academic Calendar Logic - QCET Operational Month Cycle", () => {
  describe("getAcademicYear", () => {
    test("dates on or after 25/08 start the new academic year", () => {
      assert.equal(getAcademicYear("2026-08-25"), "2026-2027");
      assert.equal(getAcademicYear("2026-09-01"), "2026-2027");
      assert.equal(getAcademicYear("2026-12-31"), "2026-2027");
      assert.equal(getAcademicYear("2027-01-01"), "2026-2027");
      assert.equal(getAcademicYear("2027-08-24"), "2026-2027");
    });

    test("dates on or before 24/08 belong to the prior academic year", () => {
      assert.equal(getAcademicYear("2026-08-24"), "2025-2026");
      assert.equal(getAcademicYear("2026-08-01"), "2025-2026");
      assert.equal(getAcademicYear("2026-01-15"), "2025-2026");
    });

    test("handles Date objects properly", () => {
      const aug25 = new Date(2026, 7, 25); // month 7 is August in JS Date
      const aug24 = new Date(2026, 7, 24);
      assert.equal(getAcademicYear(aug25), "2026-2027");
      assert.equal(getAcademicYear(aug24), "2025-2026");
    });
  });

  describe("getAcademicMonthInfo", () => {
    test("2026-08-25 is the exact first day of Tháng 9 / 2026", () => {
      const info = getAcademicMonthInfo("2026-08-25");
      assert.equal(info.monthNumber, 9);
      assert.equal(info.monthIndexInYear, 0);
      assert.equal(info.academicYear, "2026-2027");
      assert.equal(info.startDate, "2026-08-25");
      assert.equal(info.endDate, "2026-09-24");
      assert.equal(info.label, "Tháng 9");
      assert.equal(info.shortDateSpan, "25/08 - 24/09");
      assert.equal(info.fullLabel, "Tháng 9 / 2026 (25/08 - 24/09)");
    });

    test("2026-09-24 is the exact last day of Tháng 9 / 2026", () => {
      const info = getAcademicMonthInfo("2026-09-24");
      assert.equal(info.monthNumber, 9);
      assert.equal(info.monthIndexInYear, 0);
      assert.equal(info.academicYear, "2026-2027");
      assert.equal(info.startDate, "2026-08-25");
      assert.equal(info.endDate, "2026-09-24");
      assert.equal(info.label, "Tháng 9");
      assert.equal(info.fullLabel, "Tháng 9 / 2026 (25/08 - 24/09)");
    });

    test("2026-09-25 is the start of Tháng 10 / 2026", () => {
      const info = getAcademicMonthInfo("2026-09-25");
      assert.equal(info.monthNumber, 10);
      assert.equal(info.monthIndexInYear, 1);
      assert.equal(info.academicYear, "2026-2027");
      assert.equal(info.startDate, "2026-09-25");
      assert.equal(info.endDate, "2026-10-24");
      assert.equal(info.label, "Tháng 10");
      assert.equal(info.shortDateSpan, "25/09 - 24/10");
      assert.equal(info.fullLabel, "Tháng 10 / 2026 (25/09 - 24/10)");
    });

    test("2026-12-25 transitions across calendar year boundary into Tháng 1 / 2027", () => {
      const info = getAcademicMonthInfo("2026-12-25");
      assert.equal(info.monthNumber, 1);
      assert.equal(info.monthIndexInYear, 4);
      assert.equal(info.academicYear, "2026-2027");
      assert.equal(info.startDate, "2026-12-25");
      assert.equal(info.endDate, "2027-01-24");
      assert.equal(info.label, "Tháng 1");
      assert.equal(info.shortDateSpan, "25/12 - 24/01");
      assert.equal(info.fullLabel, "Tháng 1 / 2027 (25/12 - 24/01)");
    });

    test("2027-01-24 is the last day of Tháng 1 / 2027", () => {
      const info = getAcademicMonthInfo("2027-01-24");
      assert.equal(info.monthNumber, 1);
      assert.equal(info.monthIndexInYear, 4);
      assert.equal(info.academicYear, "2026-2027");
      assert.equal(info.startDate, "2026-12-25");
      assert.equal(info.endDate, "2027-01-24");
    });

    test("2027-08-24 is the last day of Month 8 and last day of academic year 2026-2027", () => {
      const info = getAcademicMonthInfo("2027-08-24");
      assert.equal(info.monthNumber, 8);
      assert.equal(info.monthIndexInYear, 11);
      assert.equal(info.academicYear, "2026-2027");
      assert.equal(info.startDate, "2027-07-25");
      assert.equal(info.endDate, "2027-08-24");
      assert.equal(info.label, "Tháng 8");
      assert.equal(info.shortDateSpan, "25/07 - 24/08");
      assert.equal(info.fullLabel, "Tháng 8 / 2027 (25/07 - 24/08)");
    });

    test("2026-08-24 belongs to Tháng 8 / 2026 in academic year 2025-2026", () => {
      const info = getAcademicMonthInfo("2026-08-24");
      assert.equal(info.monthNumber, 8);
      assert.equal(info.monthIndexInYear, 11);
      assert.equal(info.academicYear, "2025-2026");
      assert.equal(info.startDate, "2026-07-25");
      assert.equal(info.endDate, "2026-08-24");
      assert.equal(info.fullLabel, "Tháng 8 / 2026 (25/07 - 24/08)");
    });
  });

  describe("getAcademicMonthsForYear", () => {
    test("returns 12 operational months in academic order (Month 9 -> Month 8)", () => {
      const months = getAcademicMonthsForYear("2026-2027");
      assert.equal(months.length, 12);

      const expectedMonthNumbers = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];
      assert.deepEqual(
        months.map((m) => m.monthNumber),
        expectedMonthNumbers
      );

      months.forEach((m, idx) => {
        assert.equal(m.monthIndexInYear, idx);
        assert.equal(m.academicYear, "2026-2027");
      });

      // Check first month (Month 9)
      assert.equal(months[0].label, "Tháng 9");
      assert.equal(months[0].startDate, "2026-08-25");
      assert.equal(months[0].endDate, "2026-09-24");
      assert.equal(months[0].fullLabel, "Tháng 9 / 2026 (25/08 - 24/09)");

      // Check month 1 (January)
      assert.equal(months[4].label, "Tháng 1");
      assert.equal(months[4].startDate, "2026-12-25");
      assert.equal(months[4].endDate, "2027-01-24");
      assert.equal(months[4].fullLabel, "Tháng 1 / 2027 (25/12 - 24/01)");

      // Check last month (Month 8)
      assert.equal(months[11].label, "Tháng 8");
      assert.equal(months[11].startDate, "2027-07-25");
      assert.equal(months[11].endDate, "2027-08-24");
      assert.equal(months[11].fullLabel, "Tháng 8 / 2027 (25/07 - 24/08)");
    });
  });

  describe("isDateInAcademicMonth", () => {
    test("verifies whether date falls inside academic month", () => {
      // 2026-09-06 is inside Month 9
      assert.equal(isDateInAcademicMonth("2026-09-06", 9), true);
      assert.equal(isDateInAcademicMonth("2026-09-06", 10), false);

      // Boundary tests
      assert.equal(isDateInAcademicMonth("2026-08-25", 9), true);
      assert.equal(isDateInAcademicMonth("2026-09-24", 9), true);
      assert.equal(isDateInAcademicMonth("2026-08-24", 9), false);
      assert.equal(isDateInAcademicMonth("2026-09-25", 9), false);

      // With academicYear parameter
      assert.equal(isDateInAcademicMonth("2026-09-06", 9, "2026-2027"), true);
      assert.equal(isDateInAcademicMonth("2026-09-06", 9, "2025-2026"), false);
      assert.equal(isDateInAcademicMonth("2027-01-10", 1, "2026-2027"), true);
    });
  });

  describe("getAdjacentAcademicMonth", () => {
    test("shifts forward and backward accurately across calendar and academic year boundaries", () => {
      const sep2026 = getAcademicMonthInfo("2026-09-06");

      // +1 month -> Month 10 / 2026
      const oct2026 = getAdjacentAcademicMonth(sep2026, 1);
      assert.equal(oct2026.monthNumber, 10);
      assert.equal(oct2026.academicYear, "2026-2027");
      assert.equal(oct2026.startDate, "2026-09-25");
      assert.equal(oct2026.endDate, "2026-10-24");

      // -1 month -> Month 8 / 2026 (academic year 2025-2026)
      const aug2026 = getAdjacentAcademicMonth(sep2026, -1);
      assert.equal(aug2026.monthNumber, 8);
      assert.equal(aug2026.academicYear, "2025-2026");
      assert.equal(aug2026.startDate, "2026-07-25");
      assert.equal(aug2026.endDate, "2026-08-24");

      // +4 months -> Month 1 / 2027
      const jan2027 = getAdjacentAcademicMonth(sep2026, 4);
      assert.equal(jan2027.monthNumber, 1);
      assert.equal(jan2027.academicYear, "2026-2027");
      assert.equal(jan2027.startDate, "2026-12-25");
      assert.equal(jan2027.endDate, "2027-01-24");

      // +12 months -> Month 9 / 2027
      const sep2027 = getAdjacentAcademicMonth(sep2026, 12);
      assert.equal(sep2027.monthNumber, 9);
      assert.equal(sep2027.academicYear, "2027-2028");
      assert.equal(sep2027.startDate, "2027-08-25");
      assert.equal(sep2027.endDate, "2027-09-24");
    });
  });
});
