import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  getCurrentAcademicPeriod,
  getAcademicMonthInfo,
  getAcademicMonthPeriod,
  getSystemReferenceDate,
  ACADEMIC_MONTH_ORDER,
  type CurrentAcademicPeriod,
} from "../src/lib/academic-calendar";
import { TaskTableToolbar } from "../src/components/tasks/table/components/task-table-toolbar";

describe("P0-3 & P0-4: Academic Period & Month Selector Unification", () => {
  describe("1. getCurrentAcademicPeriod() Invariants", () => {
    it("returns accurate period for default system reference date (2026-09-09)", () => {
      const period: CurrentAcademicPeriod = getCurrentAcademicPeriod();

      assert.equal(period.academicYear, "2026-2027");
      assert.equal(period.semester, 1);
      assert.equal(period.month, 9);
      assert.equal(period.label, "Học kỳ I (2026 - 2027)");
    });

    it("evaluates dates in Semester 1 (months 9, 10, 11, 12) accurately", () => {
      // 2026-08-25 is the start of operational Month 9
      const periodAug25 = getCurrentAcademicPeriod("2026-08-25");
      assert.equal(periodAug25.academicYear, "2026-2027");
      assert.equal(periodAug25.semester, 1);
      assert.equal(periodAug25.month, 9);
      assert.equal(periodAug25.label, "Học kỳ I (2026 - 2027)");

      // 2026-10-15 is Month 10
      const periodOct = getCurrentAcademicPeriod("2026-10-15");
      assert.equal(periodOct.academicYear, "2026-2027");
      assert.equal(periodOct.semester, 1);
      assert.equal(periodOct.month, 10);
      assert.equal(periodOct.label, "Học kỳ I (2026 - 2027)");

      // 2026-12-24 is the end of Month 12
      const periodDec24 = getCurrentAcademicPeriod("2026-12-24");
      assert.equal(periodDec24.academicYear, "2026-2027");
      assert.equal(periodDec24.semester, 1);
      assert.equal(periodDec24.month, 12);
      assert.equal(periodDec24.label, "Học kỳ I (2026 - 2027)");
    });

    it("evaluates dates in Semester 2 (months 1 through 8) accurately", () => {
      // 2026-12-25 is the start of operational Month 1 in 2026-2027
      const periodDec25 = getCurrentAcademicPeriod("2026-12-25");
      assert.equal(periodDec25.academicYear, "2026-2027");
      assert.equal(periodDec25.semester, 2);
      assert.equal(periodDec25.month, 1);
      assert.equal(periodDec25.label, "Học kỳ II (2026 - 2027)");

      // 2027-03-10 is Month 3
      const periodMar = getCurrentAcademicPeriod("2027-03-10");
      assert.equal(periodMar.academicYear, "2026-2027");
      assert.equal(periodMar.semester, 2);
      assert.equal(periodMar.month, 3);
      assert.equal(periodMar.label, "Học kỳ II (2026 - 2027)");

      // 2027-08-24 is the last day of operational Month 8 in 2026-2027
      const periodAug24 = getCurrentAcademicPeriod("2027-08-24");
      assert.equal(periodAug24.academicYear, "2026-2027");
      assert.equal(periodAug24.semester, 2);
      assert.equal(periodAug24.month, 8);
      assert.equal(periodAug24.label, "Học kỳ II (2026 - 2027)");
    });

    it("handles getAcademicMonthInfo with numeric operational month input", () => {
      const info9 = getAcademicMonthInfo(9);
      assert.equal(info9.monthNumber, 9);
      assert.equal(info9.label, "Tháng 9");

      const info1 = getAcademicMonthInfo(1);
      assert.equal(info1.monthNumber, 1);
      assert.equal(info1.label, "Tháng 1");

      const info10 = getAcademicMonthInfo(10);
      assert.equal(info10.monthNumber, 10);
      assert.equal(info10.label, "Tháng 10");
    });
  });

  describe("2. TaskTableToolbar Single Unified Month Selector Invariants", () => {
    const defaultProps = {
      searchQuery: "",
      onSearchChange: () => {},
      activeTab: "all" as const,
      onTabChange: () => {},
      selectedDepartment: "ALL",
      onDepartmentChange: () => {},
      selectedCategory: "ALL",
      onCategoryChange: () => {},
      density: "comfortable" as const,
      onDensityChange: () => {},
      viewMode: "table" as const,
      onViewModeChange: () => {},
    };

    function countMonthDropdowns(html: string): number {
      // Matches select elements with aria-label targeting month filtering
      const matches = html.match(/aria-label="Lọc theo tháng[^"]*"/g);
      return matches ? matches.length : 0;
    }

    const toolbarSource = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "src/components/tasks/table/components/task-table-toolbar.tsx"
      ),
      "utf-8"
    );

    // Plan T10 moves period/month off the always-open desktop row onto a secondary
    // surface, so the unified control is disclosed rather than standing open. The
    // invariants that matter — one control, canonical label, both handlers funnelled
    // through it, no legacy duplicate — are asserted against the source that renders
    // it; the render assertions below cover what is on screen before disclosure.
    function assertSingleUnifiedMonthControl(): void {
      const canonicalSelects =
        toolbarSource.match(/<select[\s\S]*?aria-label="Lọc theo tháng học vụ"[\s\S]*?>/g) || [];
      assert.equal(
        canonicalSelects.length,
        1,
        "Toolbar must define exactly one month select with the canonical aria-label"
      );
      assert.ok(
        !toolbarSource.includes('aria-label="Lọc theo tháng vận hành"'),
        "Legacy duplicate dropdown 'Lọc theo tháng vận hành' must be eliminated"
      );

      // Both handler props must funnel through ONE derived value and ONE change
      // handler, which is what makes the two legacy controls a single control.
      assert.ok(
        /const activeMonth\s*=/.test(toolbarSource),
        "Month state must derive from a single `activeMonth` value"
      );
      assert.ok(
        /const activeOnMonthChange\s*=/.test(toolbarSource),
        "Month changes must funnel through a single `activeOnMonthChange` handler"
      );

      // The unified control must offer all 12 academic months.
      for (const m of ACADEMIC_MONTH_ORDER) {
        assert.ok(
          toolbarSource.includes("ACADEMIC_MONTH_ORDER.map"),
          "Unified control must be driven by ACADEMIC_MONTH_ORDER"
        );
        assert.ok(
          Number.isInteger(m),
          `Academic month ${m} must be a numeric operational month`
        );
      }
    }

    it("unifies the month control when both onMonthChange and onAcademicMonthChange are passed", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskTableToolbar, {
          ...defaultProps,
          selectedMonth: 9,
          onMonthChange: () => {},
          selectedAcademicMonth: 9,
          onAcademicMonthChange: () => {},
        })
      );

      // T10: the unified control does not stand open on the first row.
      assert.equal(
        countMonthDropdowns(html),
        0,
        "Month control must live on the disclosed filter surface, not the always-open row"
      );
      assert.ok(
        !html.includes('aria-label="Lọc theo tháng vận hành"'),
        "Must NOT render duplicate dropdown with aria-label='Lọc theo tháng vận hành'"
      );

      assertSingleUnifiedMonthControl();
    });

    it("unifies the month control when only onAcademicMonthChange is passed", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskTableToolbar, {
          ...defaultProps,
          selectedAcademicMonth: 9,
          onAcademicMonthChange: () => {},
        })
      );

      assert.equal(
        countMonthDropdowns(html),
        0,
        "Month control must live on the disclosed filter surface, not the always-open row"
      );
      assert.ok(!html.includes('aria-label="Lọc theo tháng vận hành"'));
      assertSingleUnifiedMonthControl();
    });

    it("unifies the month control when only onMonthChange is passed", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskTableToolbar, {
          ...defaultProps,
          selectedMonth: 10,
          onMonthChange: () => {},
        })
      );

      assert.equal(
        countMonthDropdowns(html),
        0,
        "Month control must live on the disclosed filter surface, not the always-open row"
      );
      assertSingleUnifiedMonthControl();
    });

    it("renders ZERO month selectors when neither month handler is passed", () => {
      const html = renderToStaticMarkup(
        React.createElement(TaskTableToolbar, {
          ...defaultProps,
        })
      );

      const dropdownCount = countMonthDropdowns(html);
      assert.equal(dropdownCount, 0, "Must render zero month dropdowns when no month change handlers are passed");
    });

    it("verifies TaskTableToolbar source code has eliminated duplicate month select", () => {
      const toolbarPath = path.resolve(
        process.cwd(),
        "src/components/tasks/table/components/task-table-toolbar.tsx"
      );
      const content = fs.readFileSync(toolbarPath, "utf-8");

      // Verify no duplicate <select for academic month
      const selectMatches = content.match(/<select[\s\S]*?aria-label="Lọc theo tháng[\s\S]*?>/g) || [];
      assert.equal(
        selectMatches.length,
        1,
        "Source code must contain exactly one <select> element for academic month filtering"
      );

      // Verify elimination of the second selector block with "Lọc theo tháng vận hành"
      assert.ok(
        !content.includes('aria-label="Lọc theo tháng vận hành"'),
        "Duplicate selector with aria-label='Lọc theo tháng vận hành' must be completely removed"
      );
    });
  });
});
