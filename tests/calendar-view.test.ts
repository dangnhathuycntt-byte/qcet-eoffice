import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  generateMonthGrid,
  getTasksForDate,
  formatMonthYearVi,
  getPrevMonth,
  getNextMonth,
  type CalendarDayCell,
  type CalendarTaskItem,
} from "../src/components/calendar/calendar-month-view";
import type { SchoolTask } from "../src/types/dashboard";

describe("CalendarMonthView Helpers", () => {
  test("generateMonthGrid generates 35 or 42 calendar day cells for a month", () => {
    const grid = generateMonthGrid(2026, 8); // September 2026 (0-indexed month 8)
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
    const dateObj = new Date(lastDay.dateString);
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
