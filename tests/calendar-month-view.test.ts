import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  generateMonthGrid,
  getTasksForDate,
  formatMonthYearVi,
  getPrevMonth,
  getNextMonth,
  getStatusDotClass,
  getStatusLabel,
} from "../src/components/calendar/calendar-month-view";
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
});
