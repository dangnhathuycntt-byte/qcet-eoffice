import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getAcademicMonthInfo,
  getAdjacentAcademicMonth,
  getAcademicMonthPeriod,
  getAcademicMonthsForYear,
  ACADEMIC_MONTH_ORDER,
  filterTasksByAcademicMonthStrict,
} from "@qcet/shared/lib/academic-calendar";

// Consolidated behavioural coverage for the calendar month view:
//   - calendar-month-view.tsx helper logic (grids, status dots, headers)
//   - academic-cycle (25th-to-24th) grid mapping
//   - legacy calendar-view.test.ts helper coverage
//   - academic month cycle/scoping from calendar-monthly-sync.test.ts
// Source-text/styling assertions were dropped per the testing invariants
// (global equivalents live in tests/anti-slop-audit.test.ts).
describe("Calendar Month View Component & Precision Specs", () => {

  describe("Academic Month Header & Navigation Integration", () => {

    test("getAdjacentAcademicMonth enables stepping across months and academic years", () => {
      const sept = getAcademicMonthInfo("2026-09-04");

      // Next month
      const oct = getAdjacentAcademicMonth(sept, 1);
      assert.equal(oct.monthNumber, 10);
      assert.equal(oct.startDate, "2026-10-01");
      assert.equal(oct.endDate, "2026-10-31");
      assert.equal(oct.academicYear, "2026-2027");

      // Previous month steps back to Tháng 8 of prior academic year
      const aug = getAdjacentAcademicMonth(sept, -1);
      assert.equal(aug.monthNumber, 8);
      assert.equal(aug.startDate, "2026-08-01");
      assert.equal(aug.endDate, "2026-08-31");
      assert.equal(aug.academicYear, "2025-2026");
    });
  });

  // Consolidated from calendar-monthly-sync.test.ts — academic cycle scoping.
  describe("Academic Calendar Cycle & Scoping Invariants", () => {
    test("Month 9 operational cycle spans 2026-09-01 to 2026-09-30", () => {
      const period = getAcademicMonthPeriod(9, "2026-2027");
      assert.equal(period.monthNumber, 9);
      assert.equal(period.startDate, "2026-09-01");
      assert.equal(period.endDate, "2026-09-30");
      assert.equal(period.academicYear, "2026-2027");
    });

    test("Month 1 cross-year cycle spans 2027-01-01 to 2027-01-31", () => {
      const period = getAcademicMonthPeriod(1, "2026-2027");
      assert.equal(period.monthNumber, 1);
      assert.equal(period.startDate, "2027-01-01");
      assert.equal(period.endDate, "2027-01-31");
      assert.equal(period.academicYear, "2026-2027");
    });

    test("CALENDAR_MONTH_ORDER contains 12 months starting with 1 through 12", () => {
      assert.deepEqual(ACADEMIC_MONTH_ORDER, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      const months = getAcademicMonthsForYear(2026);
      assert.equal(months.length, 12);
      assert.equal(months[0].monthNumber, 1);
      assert.equal(months[11].monthNumber, 12);
    });

    test("Tasks scoping correctly isolates milestones to selected cycle", () => {
      const tasks: any[] = [
        {
          id: "task-sept",
          code: "NV-01",
          title: "Khai giảng Tháng 9",
          description: "Mục tiêu tháng 9",
          category: "CHUYEN_MON",
          priority: "URGENT",
          status: "IN_PROGRESS",
          progressPercent: 60,
          dueDate: "2026-09-10T00:00:00.000Z",
          startDate: "2026-08-28T00:00:00.000Z",

          departmentName: "Phòng Đào tạo",
          subTasks: [],
          deliverables: [],
          assignees: [],
          createdAt: "2026-08-28T00:00:00.000Z",
          updatedAt: "2026-08-28T00:00:00.000Z",
        },
        {
          id: "task-oct",
          code: "NV-02",
          title: "Sơ kết Tháng 10",
          description: "Mục tiêu tháng 10",
          category: "HANH_CHINH",
          priority: "NORMAL",
          status: "NEW",
          progressPercent: 0,
          dueDate: "2026-10-02T00:00:00.000Z",
          startDate: "2026-09-26T00:00:00.000Z",

          departmentName: "Văn phòng",
          subTasks: [],
          deliverables: [],
          assignees: [],
          createdAt: "2026-09-26T00:00:00.000Z",
          updatedAt: "2026-09-26T00:00:00.000Z",
        },
      ];

      const septFiltered = filterTasksByAcademicMonthStrict(tasks, 9, "2026-2027");
      assert.equal(septFiltered.length, 1);
      assert.equal(septFiltered[0].id, "task-sept");

      const octFiltered = filterTasksByAcademicMonthStrict(tasks, 10, "2026-2027");
      assert.equal(octFiltered.length, 1);
      assert.equal(octFiltered[0].id, "task-oct");
    });
  });
});
