import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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
} from "../src/lib/academic-calendar";
import type { SchoolTask } from "../src/types/dashboard";

describe("Calendar Month View Component & Precision Specs", () => {
  const componentPath = path.join(
    __dirname,
    "../src/components/calendar/calendar-month-view.tsx"
  );
  const calendarPagePath = path.join(
    __dirname,
    "../src/app/calendar/page.tsx"
  );
  const componentContent = fs.readFileSync(componentPath, "utf-8");
  const calendarPageContent = fs.readFileSync(calendarPagePath, "utf-8");

  describe("Anti-Slop Zero-Emoji Constraint", () => {
    const emojiRegex =
      /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

    test("calendar-month-view.tsx contains ZERO decorative emojis", () => {
      assert.equal(
        emojiRegex.test(componentContent),
        false,
        "calendar-month-view.tsx must not contain any emojis"
      );
    });

    test("src/app/calendar/page.tsx contains ZERO decorative emojis", () => {
      assert.equal(
        emojiRegex.test(calendarPageContent),
        false,
        "src/app/calendar/page.tsx must not contain any emojis"
      );
    });
  });

  describe("Grid & Styling Specifications", () => {
    test("uses hairline grid borders (border-border/40 or border-border/60)", () => {
      assert.ok(
        componentContent.includes("border-border/40") ||
          componentContent.includes("border-border/60"),
        "Month grid must use subtle hairline borders"
      );
    });

    test("day numbers use font-mono and tabular-nums", () => {
      assert.ok(
        componentContent.includes("font-mono"),
        "Day numbers must use font-mono"
      );
      assert.ok(
        componentContent.includes("tabular-nums"),
        "Day numbers must use tabular-nums"
      );
    });

    test("Lucide icons standardize strokeWidth to 1.5", () => {
      assert.ok(
        componentContent.includes("strokeWidth={1.5}"),
        "Lucide icons should standardize strokeWidth to 1.5"
      );
    });

    test("contains +N nhiệm vụ text format for overflow days", () => {
      assert.ok(
        componentContent.includes("nhiệm vụ"),
        "Overflow indicator must use '+N nhiệm vụ'"
      );
    });

    test("contains bottom legend with status dots and Vietnamese labels", () => {
      assert.ok(
        componentContent.includes("Hoàn thành"),
        "Legend must include 'Hoàn thành'"
      );
      assert.ok(
        componentContent.includes("Đang thực hiện"),
        "Legend must include 'Đang thực hiện'"
      );
      assert.ok(
        componentContent.includes("Chờ thực hiện") ||
          componentContent.includes("Chờ xử lý"),
        "Legend must include 'Chờ thực hiện' or 'Chờ xử lý'"
      );
      assert.ok(
        componentContent.includes("Quá hạn"),
        "Legend must include 'Quá hạn'"
      );
    });
  });

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
  });

  describe("25th-to-24th Academic Cycle Calendar Grid", () => {
    test("generateAcademicMonthGrid creates grid for Tháng 9 / 2026 (25/08 - 24/09)", () => {
      const period = getAcademicMonthInfo("2026-09-04");
      const grid = generateAcademicMonthGrid(period);

      // Grid length must be multiple of 7 and at least 35
      assert.ok(grid.length >= 35);
      assert.equal(grid.length % 7, 0);

      // Starts on Monday (T2) and ends on Sunday (CN)
      assert.equal(grid[0].dayOfWeek, 1); // Monday
      assert.equal(grid[grid.length - 1].dayOfWeek, 0); // Sunday

      // Preceding day: 2026-08-24 is Monday before start, so isCurrentMonth is false
      const aug24 = grid.find((d) => d.dateString === "2026-08-24");
      assert.ok(aug24);
      assert.equal(aug24?.isCurrentMonth, false);

      // Operational start: 2026-08-25 has isCurrentMonth: true
      const aug25 = grid.find((d) => d.dateString === "2026-08-25");
      assert.ok(aug25);
      assert.equal(aug25?.isCurrentMonth, true);

      // Mid-month: 2026-08-31 and 2026-09-01 both have isCurrentMonth: true
      const aug31 = grid.find((d) => d.dateString === "2026-08-31");
      assert.ok(aug31);
      assert.equal(aug31?.isCurrentMonth, true);

      const sep01 = grid.find((d) => d.dateString === "2026-09-01");
      assert.ok(sep01);
      assert.equal(sep01?.isCurrentMonth, true);

      // Operational end: 2026-09-24 has isCurrentMonth: true
      const sep24 = grid.find((d) => d.dateString === "2026-09-24");
      assert.ok(sep24);
      assert.equal(sep24?.isCurrentMonth, true);

      // Trailing day: 2026-09-25 has isCurrentMonth: false
      const sep25 = grid.find((d) => d.dateString === "2026-09-25");
      assert.ok(sep25);
      assert.equal(sep25?.isCurrentMonth, false);

      // Exactly 31 days in active operational period (Aug 25-31: 7 days, Sep 1-24: 24 days)
      const activeDays = grid.filter((d) => d.isCurrentMonth);
      assert.equal(activeDays.length, 31);
    });

    test("generateMonthGrid accepts AcademicMonthPeriod directly", () => {
      const period = getAcademicMonthInfo("2026-09-04");
      const grid = generateMonthGrid(period);

      assert.ok(grid.length >= 35);
      const activeDays = grid.filter((d) => d.isCurrentMonth);
      assert.equal(activeDays.length, 31);
      assert.equal(activeDays[0].dateString, "2026-08-25");
      assert.equal(activeDays[activeDays.length - 1].dateString, "2026-09-24");
    });

    test("handles cross-calendar-year academic month: Tháng 1 / 2027 (25/12 - 24/01)", () => {
      const period = getAcademicMonthInfo("2026-12-28");
      assert.equal(period.monthNumber, 1);
      assert.equal(period.startDate, "2026-12-25");
      assert.equal(period.endDate, "2027-01-24");

      const grid = generateAcademicMonthGrid(period);
      assert.equal(grid[0].dayOfWeek, 1); // Starts on Monday
      assert.equal(grid[grid.length - 1].dayOfWeek, 0); // Ends on Sunday

      // Preceding day: Dec 24, 2026 is Thursday before start, so isCurrentMonth is false
      const dec24 = grid.find((d) => d.dateString === "2026-12-24");
      assert.ok(dec24);
      assert.equal(dec24?.isCurrentMonth, false);

      // Dec 25 to Jan 24 are active
      const dec25 = grid.find((d) => d.dateString === "2026-12-25");
      assert.ok(dec25?.isCurrentMonth);

      const jan01 = grid.find((d) => d.dateString === "2027-01-01");
      assert.ok(jan01?.isCurrentMonth);

      const jan24 = grid.find((d) => d.dateString === "2027-01-24");
      assert.ok(jan24?.isCurrentMonth);

      // Jan 24 is Sunday, so grid terminates cleanly on the end of the academic period
      assert.equal(grid[grid.length - 1].dateString, "2027-01-24");
      assert.equal(grid[grid.length - 1].isCurrentMonth, true);
    });

    test("handles month where 25th is already Monday (zero preceding days offset)", () => {
      // 2027-01-25 was a Monday (Tháng 2 / 2027: 25/01 - 24/02)
      const period = getAcademicMonthInfo("2027-02-05");
      assert.equal(period.startDate, "2027-01-25");

      const grid = generateAcademicMonthGrid(period);
      assert.equal(grid[0].dateString, "2027-01-25");
      assert.equal(grid[0].dayOfWeek, 1); // Monday
      assert.equal(grid[0].isCurrentMonth, true);
    });
  });

  describe("Academic Month Header & Navigation Integration", () => {
    test("formatAcademicMonthHeader formats full academic label with date span and year", () => {
      const periodSep = getAcademicMonthInfo("2026-09-04");
      assert.equal(
        formatAcademicMonthHeader(periodSep),
        "Tháng 9 / 2026 (25/08 - 24/09) • Năm học 2026 - 2027"
      );

      const periodJan = getAcademicMonthInfo("2026-12-28");
      assert.equal(
        formatAcademicMonthHeader(periodJan),
        "Tháng 1 / 2027 (25/12 - 24/01) • Năm học 2026 - 2027"
      );
    });

    test("getAdjacentAcademicMonth enables stepping across months and academic years", () => {
      const sept = getAcademicMonthInfo("2026-09-04");

      // Next month
      const oct = getAdjacentAcademicMonth(sept, 1);
      assert.equal(oct.monthNumber, 10);
      assert.equal(oct.startDate, "2026-09-25");
      assert.equal(oct.endDate, "2026-10-24");
      assert.equal(oct.academicYear, "2026-2027");

      // Previous month steps back to Tháng 8 of prior academic year
      const aug = getAdjacentAcademicMonth(sept, -1);
      assert.equal(aug.monthNumber, 8);
      assert.equal(aug.startDate, "2026-07-25");
      assert.equal(aug.endDate, "2026-08-24");
      assert.equal(aug.academicYear, "2025-2026");
    });

    test("component includes quick reset to 'Tháng hiện tại'", () => {
      assert.ok(
        componentContent.includes("Tháng hiện tại"),
        "Component must include quick reset button labeled 'Tháng hiện tại'"
      );
      assert.ok(
        componentContent.includes("formatAcademicMonthHeader"),
        "Component must display full academic month header"
      );
    });
  });
});
