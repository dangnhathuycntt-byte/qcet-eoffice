import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const calendarModulePath = path.resolve(process.cwd(), "src/lib/academic-calendar.ts");
const {
  ACADEMIC_MONTH_ORDER,
  getAcademicMonthPeriod,
  getAcademicMonthInfo,
} = await import(`file://${calendarModulePath}`);

describe("Global Month Selector Component Invariants", () => {
  const componentPath = path.resolve(process.cwd(), "src/components/layout/global-month-selector.tsx");

  test("component file exists and exports GlobalMonthSelector", () => {
    assert.ok(fs.existsSync(componentPath), "global-month-selector.tsx must exist");
    const content = fs.readFileSync(componentPath, "utf8");
    assert.match(content, /export function GlobalMonthSelector/);
    assert.match(content, /ACADEMIC_MONTH_ORDER/);
    assert.match(content, /Popover/);
  });

  test("dashboard-zone.tsx includes GlobalMonthSelector alongside ScopeSwitcher in contextual toolbar", () => {
    const dashboardZonePath = path.resolve(process.cwd(), "src/components/dashboard/zones/dashboard-zone.tsx");
    const content = fs.readFileSync(dashboardZonePath, "utf8");
    assert.match(content, /GlobalMonthSelector/);
    assert.match(content, /ScopeSwitcher/);
  });

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
