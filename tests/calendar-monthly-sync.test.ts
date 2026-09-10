import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getAcademicMonthPeriod,
  getAcademicMonthsForYear,
  getAcademicMonthInfo,
  ACADEMIC_MONTH_ORDER,
  filterTasksByAcademicMonthStrict,
} from "../src/lib/academic-calendar";
import {
  formatAcademicMonthHeader,
  generateAcademicMonthGrid,
  getTasksForDate,
} from "../src/components/calendar/calendar-month-view";
import type { SchoolTask } from "../src/types/dashboard";

describe("Calendar Monthly Integration & Sync Suite", () => {
  const calendarZonePath = path.resolve(
    process.cwd(),
    "src/components/dashboard/zones/calendar-zone.tsx"
  );
  const calendarMonthViewPath = path.resolve(
    process.cwd(),
    "src/components/calendar/calendar-month-view.tsx"
  );
  const calendarPagePath = path.resolve(
    process.cwd(),
    "src/app/calendar/page.tsx"
  );

  describe("1. Academic Calendar Cycle & Scoping Invariants", () => {
    test("Month 9 operational cycle spans 2026-08-25 to 2026-09-24", () => {
      const period = getAcademicMonthPeriod(9, "2026-2027");
      assert.equal(period.monthNumber, 9);
      assert.equal(period.startDate, "2026-08-25");
      assert.equal(period.endDate, "2026-09-24");
      assert.equal(period.academicYear, "2026-2027");
    });

    test("Month 1 cross-year cycle spans 2026-12-25 to 2027-01-24", () => {
      const period = getAcademicMonthPeriod(1, "2026-2027");
      assert.equal(period.monthNumber, 1);
      assert.equal(period.startDate, "2026-12-25");
      assert.equal(period.endDate, "2027-01-24");
      assert.equal(period.academicYear, "2026-2027");
    });

    test("ACADEMIC_MONTH_ORDER contains 12 months starting with 9 through 8", () => {
      assert.deepEqual(ACADEMIC_MONTH_ORDER, [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8]);
      const months = getAcademicMonthsForYear("2026-2027");
      assert.equal(months.length, 12);
      assert.equal(months[0].monthNumber, 9);
      assert.equal(months[11].monthNumber, 8);
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
          departmentId: "P_DTQLKH",
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
          departmentId: "P_VP",
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

  describe("2. Calendar Grid Operational Cycle Mapping", () => {
    test("generateAcademicMonthGrid marks operational cycle cells as isCurrentMonth", () => {
      const period = getAcademicMonthPeriod(9, "2026-2027");
      const cells = generateAcademicMonthGrid(period);

      // Verify start of cycle
      const startCell = cells.find((c) => c.dateString === "2026-08-25");
      assert.ok(startCell, "2026-08-25 must exist in grid");
      assert.equal(startCell?.isCurrentMonth, true, "2026-08-25 is within Tháng 9 cycle");

      // Verify end of cycle
      const endCell = cells.find((c) => c.dateString === "2026-09-24");
      assert.ok(endCell, "2026-09-24 must exist in grid");
      assert.equal(endCell?.isCurrentMonth, true, "2026-09-24 is within Tháng 9 cycle");

      // Verify cell outside cycle
      const outsideCell = cells.find((c) => c.dateString === "2026-08-24");
      if (outsideCell) {
        assert.equal(outsideCell.isCurrentMonth, false, "2026-08-24 is outside Tháng 9 cycle");
      }
    });

    test("formatAcademicMonthHeader formats full Vietnamese cycle header", () => {
      const period = getAcademicMonthPeriod(9, "2026-2027");
      const header = formatAcademicMonthHeader(period);
      assert.match(header, /Tháng 9 \/ 2026/);
      assert.match(header, /25\/08 - 24\/09/);
      assert.match(header, /Năm học 2026 - 2027/);
    });
  });

  describe("3. Calendar Month View Component Source Verification", () => {
    test("calendar-month-view.tsx supports selectedAcademicMonth and onAcademicMonthChange", () => {
      const content = fs.readFileSync(calendarMonthViewPath, "utf8");
      assert.match(content, /selectedAcademicMonth\?:/);
      assert.match(content, /onAcademicMonthChange\?:/);
      assert.match(content, /onPeriodChange\?:/);
    });

    test("calendar-month-view.tsx synchronizes date focus when period updates", () => {
      const content = fs.readFileSync(calendarMonthViewPath, "utf8");
      assert.match(content, /setSelectedDate/);
      assert.match(content, /period\.startDate/);
    });
  });

  describe("4. Calendar Zone Integration & Month Switcher", () => {
    test("calendar-zone.tsx integrates selectedAcademicMonth and handleAcademicMonthChange", () => {
      const content = fs.readFileSync(calendarZonePath, "utf8");
      assert.match(content, /selectedAcademicMonth/);
      assert.match(content, /handleAcademicMonthChange/);
      assert.match(content, /monthlyTaskCounts/);
    });

    test("calendar-zone.tsx renders month switcher strip with ACADEMIC_MONTH_ORDER", () => {
      const content = fs.readFileSync(calendarZonePath, "utf8");
      assert.match(content, /ACADEMIC_MONTH_ORDER/);
      assert.match(content, /getAcademicMonthPeriod/);
    });

    test("calendar-zone.tsx wires two-way onPeriodChange sync to handleAcademicMonthChange", () => {
      const content = fs.readFileSync(calendarZonePath, "utf8");
      assert.match(content, /onPeriodChange/);
      assert.match(content, /handleAcademicMonthChange\(newPeriod\.monthNumber\)/);
    });
  });

  describe("5. URL & Page Redirect Synchronization", () => {
    test("src/app/calendar/page.tsx forwards searchParams to maintain ?month=", () => {
      const content = fs.readFileSync(calendarPagePath, "utf8");
      assert.match(content, /useSearchParams/);
      assert.match(content, /zone/);
    });
  });

  describe("6. Anti-Slop, Zero-Emoji & Light-Only Invariants", () => {
    test("calendar-zone.tsx contains zero emojis and no dark: classes", () => {
      const content = fs.readFileSync(calendarZonePath, "utf8");
      assert.doesNotMatch(content, /[\u{1F300}-\u{1FAFF}]/u, "Zero emojis allowed in calendar-zone.tsx");
      assert.doesNotMatch(content, /\bdark:/, "No dark: classes allowed");
      assert.doesNotMatch(content, /ThemeProvider/, "No ThemeProvider allowed");
    });

    test("calendar-month-view.tsx contains zero emojis and no dark: classes", () => {
      const content = fs.readFileSync(calendarMonthViewPath, "utf8");
      assert.doesNotMatch(content, /[\u{1F300}-\u{1FAFF}]/u, "Zero emojis allowed in calendar-month-view.tsx");
      assert.doesNotMatch(content, /\bdark:/, "No dark: classes allowed");
      assert.doesNotMatch(content, /ThemeProvider/, "No ThemeProvider allowed");
    });
  });
});
