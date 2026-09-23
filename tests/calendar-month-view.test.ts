import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  generateMonthGrid,
  generateAcademicMonthGrid,
  formatAcademicMonthHeader,
  getTasksForDate,
  formatMonthYearVi,
  getPrevMonth,
  getNextMonth,
  getStatusDotClass,
  getStatusLabel,
} from "../src/components/calendar/calendar-month-view";
import {
  getAcademicMonthInfo,
  getAdjacentAcademicMonth,
  getAcademicMonthPeriod,
  getAcademicMonthsForYear,
  ACADEMIC_MONTH_ORDER,
  filterTasksByAcademicMonthStrict,
} from "../src/lib/academic-calendar";
import type { SchoolTask } from "../src/types/dashboard";

// Consolidated behavioural coverage for the calendar month view:
//   - calendar-month-view.tsx helper logic (grids, status dots, headers)
//   - academic-cycle (25th-to-24th) grid mapping
//   - legacy calendar-view.test.ts helper coverage
//   - academic month cycle/scoping from calendar-monthly-sync.test.ts
// Source-text/styling assertions were dropped per the testing invariants
// (global equivalents live in tests/anti-slop-audit.test.ts).
describe("Calendar Month View Component & Precision Specs", () => {
  describe("Status Dots & Label Logic", () => {
    test("getStatusDotClass returns emerald for COMPLETED", () => {
      assert.equal(getStatusDotClass("COMPLETED"), "bg-emerald-500");
    });

    test("getStatusDotClass returns blue for IN_PROGRESS", () => {
      assert.equal(getStatusDotClass("IN_PROGRESS"), "bg-blue-500");
    });

    test("getStatusDotClass returns amber for NEW or NEEDS_REVIEW", () => {
      const newDot = getStatusDotClass("NEW");
      assert.ok(newDot.includes("amber"));
      const reviewDot = getStatusDotClass("NEEDS_REVIEW");
      assert.ok(reviewDot.includes("amber"));
    });

    test("getStatusDotClass returns rose for overdue tasks", () => {
      // Due date in the past relative to demo anchor (2026-09-04)
      const overdueDot = getStatusDotClass("IN_PROGRESS", "2026-08-30");
      assert.equal(overdueDot, "bg-rose-500");
    });

    test("getStatusLabel returns accurate Vietnamese labels", () => {
      assert.equal(getStatusLabel("COMPLETED"), "Đã hoàn thành");
      assert.equal(getStatusLabel("IN_PROGRESS"), "Đang thực hiện");
      assert.equal(getStatusLabel("NEEDS_REVIEW"), "Chờ xét duyệt");
      assert.equal(getStatusLabel("IN_PROGRESS", "2026-08-20"), "Quá hạn");
    });
  });

  describe("Month Grid Helpers", () => {
    test("generateMonthGrid generates 35 or 42 calendar day cells for a month", () => {
      const grid = generateMonthGrid(2026, 8); // September 2026
      assert.ok(grid.length >= 35);
      assert.ok(grid.length % 7 === 0);
      const septFirst = grid.find((d) => d.dateString === "2026-09-01");
      assert.ok(septFirst);
      assert.equal(septFirst?.isCurrentMonth, true);
      assert.equal(septFirst?.dayNumber, 1);
    });

    test("generateMonthGrid starts with Monday (T2) and ends on Sunday (CN)", () => {
      const grid = generateMonthGrid(2026, 8); // September 2026 starts on Tuesday (index 1 in Mon-start)
      // 2026-09-01 was a Tuesday, so first day of grid should be Monday 2026-08-31
      assert.equal(grid[0].dateString, "2026-08-31");
      assert.equal(grid[0].isCurrentMonth, false);
      // Last day of grid should be a Sunday
      const lastDay = grid[grid.length - 1];
      const dateObj = new Date(`${lastDay.dateString}T12:00:00+07:00`);
      assert.equal(dateObj.getDay(), 0); // 0 is Sunday in JS Date
    });

    test("getTasksForDate maps tasks to matching due dates", () => {
      const mockTasks: SchoolTask[] = [
        {
          id: "t1",
          title: "Báo cáo tháng 9",
          category: "BAO_CAO",
          categoryLabel: "Báo cáo",
          leadAssigneeName: "Vinh",
          coAssignees: [],
          assignedDate: "2026-09-01",
          dueDate: "2026-09-24",
          status: "IN_PROGRESS",
          subTasks: [],
          totalSubTasks: 0,
          completedSubTasks: 0,
          progressPercent: 0,
        },
      ];

      const matched = getTasksForDate(mockTasks, "2026-09-24");
      assert.equal(matched.length, 1);
      assert.equal(matched[0].title, "Báo cáo tháng 9");
    });

    test("getTasksForDate flattens subtasks with Trường/Đơn vị levels", () => {
      const mockTasks: SchoolTask[] = [
        {
          id: "t1",
          title: "Báo cáo tháng 9",
          category: "BAO_CAO",
          categoryLabel: "Báo cáo",
          leadAssigneeName: "Vinh",
          coAssignees: [],
          assignedDate: "2026-09-01",
          dueDate: "2026-09-24",
          status: "IN_PROGRESS",
          subTasks: [
            {
              id: "sub-1",
              title: "Tổng hợp số liệu CNTT",
              assigneeName: "Cường",
              status: "IN_PROGRESS",
              dueDate: "2026-09-24",
              parentSchoolTaskId: "t1",
              updatedAt: "2026-09-01",
            },
          ],
          totalSubTasks: 1,
          completedSubTasks: 0,
          progressPercent: 0,
        },
        {
          id: "t2",
          title: "Kế hoạch năm học mới",
          category: "CHUYEN_DOI_SO",
          categoryLabel: "Chuyển đổi số",
          leadAssigneeName: "Hùng",
          coAssignees: [],
          assignedDate: "2026-09-01",
          dueDate: "2026-09-30",
          status: "IN_PROGRESS",
          subTasks: [],
          totalSubTasks: 0,
          completedSubTasks: 0,
          progressPercent: 0,
        },
      ];

      const tasksOn24th = getTasksForDate(mockTasks, "2026-09-24");
      assert.equal(tasksOn24th.length, 2); // 1 SchoolTask + 1 StaffTask
      assert.equal(tasksOn24th[0].title, "Báo cáo tháng 9");
      assert.equal(tasksOn24th[0].level, "Trường");
      assert.equal(tasksOn24th[1].title, "Tổng hợp số liệu CNTT");
      assert.equal(tasksOn24th[1].level, "Đơn vị");

      const tasksOn30th = getTasksForDate(mockTasks, "2026-09-30");
      assert.equal(tasksOn30th.length, 1);
      assert.equal(tasksOn30th[0].title, "Kế hoạch năm học mới");

      const tasksOnEmptyDate = getTasksForDate(mockTasks, "2026-09-15");
      assert.equal(tasksOnEmptyDate.length, 0);
    });

    test("formatMonthYearVi formats month and year correctly", () => {
      assert.equal(formatMonthYearVi(2026, 8), "Tháng 09 / 2026");
      assert.equal(formatMonthYearVi(2026, 0), "Tháng 01 / 2026");
      assert.equal(formatMonthYearVi(2026, 11), "Tháng 12 / 2026");
    });

    test("getPrevMonth and getNextMonth handle year transitions", () => {
      const prevFromJan = getPrevMonth(2026, 0);
      assert.deepEqual(prevFromJan, { year: 2025, month: 11 });

      const nextFromDec = getNextMonth(2025, 11);
      assert.deepEqual(nextFromDec, { year: 2026, month: 0 });

      const prevNormal = getPrevMonth(2026, 8);
      assert.deepEqual(prevNormal, { year: 2026, month: 7 });

      const nextNormal = getNextMonth(2026, 8);
      assert.deepEqual(nextNormal, { year: 2026, month: 9 });
    });
  });

  describe("Gregorian Solar Calendar Grid", () => {
    test("generateAcademicMonthGrid creates grid for Tháng 9 / 2026 (01/09 - 30/09)", () => {
      const period = getAcademicMonthInfo("2026-09-04");
      const grid = generateAcademicMonthGrid(period);

      // Grid length must be multiple of 7 and at least 35
      assert.ok(grid.length >= 35);
      assert.equal(grid.length % 7, 0);

      // Starts on Monday (T2) and ends on Sunday (CN)
      assert.equal(grid[0].dayOfWeek, 1); // Monday
      assert.equal(grid[grid.length - 1].dayOfWeek, 0); // Sunday

      // Preceding day: 2026-08-31 is Monday before start, so isCurrentMonth is false
      const aug31 = grid.find((d) => d.dateString === "2026-08-31");
      assert.ok(aug31);
      assert.equal(aug31?.isCurrentMonth, false);

      // Operational start: 2026-09-01 has isCurrentMonth: true
      const sep01 = grid.find((d) => d.dateString === "2026-09-01");
      assert.ok(sep01);
      assert.equal(sep01?.isCurrentMonth, true);

      // Mid-month: 2026-09-24 and 2026-09-25 both have isCurrentMonth: true
      const sep24 = grid.find((d) => d.dateString === "2026-09-24");
      assert.ok(sep24);
      assert.equal(sep24?.isCurrentMonth, true);

      const sep25 = grid.find((d) => d.dateString === "2026-09-25");
      assert.ok(sep25);
      assert.equal(sep25?.isCurrentMonth, true);

      // Operational end: 2026-09-30 has isCurrentMonth: true
      const sep30 = grid.find((d) => d.dateString === "2026-09-30");
      assert.ok(sep30);
      assert.equal(sep30?.isCurrentMonth, true);

      // Trailing day: 2026-10-01 has isCurrentMonth: false
      const oct01 = grid.find((d) => d.dateString === "2026-10-01");
      assert.ok(oct01);
      assert.equal(oct01?.isCurrentMonth, false);

      // Exactly 30 days in active operational period for September
      const activeDays = grid.filter((d) => d.isCurrentMonth);
      assert.equal(activeDays.length, 30);
    });

    test("generateMonthGrid accepts AcademicMonthPeriod directly", () => {
      const period = getAcademicMonthInfo("2026-09-04");
      const grid = generateMonthGrid(period);

      assert.ok(grid.length >= 35);
      const activeDays = grid.filter((d) => d.isCurrentMonth);
      assert.equal(activeDays.length, 30);
      assert.equal(activeDays[0].dateString, "2026-09-01");
      assert.equal(activeDays[activeDays.length - 1].dateString, "2026-09-30");
    });

    test("handles cross-calendar-year academic month: Tháng 1 / 2027 (01/01 - 31/01)", () => {
      const period = getAcademicMonthInfo("2027-01-15");
      assert.equal(period.monthNumber, 1);
      assert.equal(period.startDate, "2027-01-01");
      assert.equal(period.endDate, "2027-01-31");

      const grid = generateAcademicMonthGrid(period);
      assert.equal(grid[0].dayOfWeek, 1); // Starts on Monday
      assert.equal(grid[grid.length - 1].dayOfWeek, 0); // Ends on Sunday

      // Preceding day: Dec 31, 2026 is Thursday before start, so isCurrentMonth is false
      const dec31 = grid.find((d) => d.dateString === "2026-12-31");
      assert.ok(dec31);
      assert.equal(dec31?.isCurrentMonth, false);

      // Jan 01 to Jan 31 are active
      const jan01 = grid.find((d) => d.dateString === "2027-01-01");
      assert.ok(jan01?.isCurrentMonth);

      const jan15 = grid.find((d) => d.dateString === "2027-01-15");
      assert.ok(jan15?.isCurrentMonth);

      const jan31 = grid.find((d) => d.dateString === "2027-01-31");
      assert.ok(jan31?.isCurrentMonth);

      const activeDays = grid.filter((d) => d.isCurrentMonth);
      assert.equal(activeDays.length, 31);
    });

    test("handles month where 1st is already Monday (zero preceding days offset)", () => {
      // 2026-06-01 was a Monday
      const period = getAcademicMonthInfo("2026-06-15");
      assert.equal(period.startDate, "2026-06-01");

      const grid = generateAcademicMonthGrid(period);
      assert.equal(grid[0].dateString, "2026-06-01");
      assert.equal(grid[0].dayOfWeek, 1); // Monday
      assert.equal(grid[0].isCurrentMonth, true);
    });
  });

  describe("Academic Month Header & Navigation Integration", () => {
    test("formatAcademicMonthHeader formats full academic label with date span and year", () => {
      const periodSep = getAcademicMonthInfo("2026-09-04");
      assert.equal(
        formatAcademicMonthHeader(periodSep),
        "Tháng 9 / 2026 (01/09 - 30/09) • Năm học 2026 - 2027"
      );

      const periodJan = getAcademicMonthInfo("2027-01-15");
      assert.equal(
        formatAcademicMonthHeader(periodJan),
        "Tháng 1 / 2027 (01/01 - 31/01) • Năm học 2026 - 2027"
      );
    });

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
