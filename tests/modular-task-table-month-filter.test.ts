import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ACADEMIC_MONTH_ORDER, getAcademicMonthInfo } from "../src/lib/academic-calendar";

describe("ModularCascadingTaskTable Month Filter & Toolbar Ergonomics", () => {
  const toolbarPath = path.resolve(
    process.cwd(),
    "src/components/tasks/table/components/task-table-toolbar.tsx"
  );
  const tablePath = path.resolve(
    process.cwd(),
    "src/components/tasks/table/modular-cascading-task-table.tsx"
  );

  const toolbarContent = fs.readFileSync(toolbarPath, "utf-8");
  const tableContent = fs.readFileSync(tablePath, "utf-8");

  test("TaskTableToolbar defines onMonthChange and selectedAcademicMonth props", () => {
    assert.ok(
      toolbarContent.includes("selectedMonth"),
      "TaskTableToolbar must accept selectedMonth"
    );
    assert.ok(
      toolbarContent.includes("onMonthChange"),
      "TaskTableToolbar must accept onMonthChange"
    );
  });

  test("TaskTableToolbar integrates ACADEMIC_MONTH_ORDER for administrative education calendar", () => {
    assert.ok(
      toolbarContent.includes("ACADEMIC_MONTH_ORDER"),
      "TaskTableToolbar must import and use ACADEMIC_MONTH_ORDER"
    );
    assert.ok(
      toolbarContent.includes("getAcademicMonthInfo"),
      "TaskTableToolbar must use getAcademicMonthInfo"
    );
  });

  test("TaskTableToolbar provides accessible month selector with aria-label", () => {
    assert.ok(
      toolbarContent.includes('aria-label="Lọc theo tháng học kỳ"'),
      "Month selector select element must have proper aria-label for accessibility"
    );
  });

  test("ModularCascadingTaskTable exposes selectedAcademicMonth and onMonthChange props", () => {
    assert.ok(
      tableContent.includes("selectedAcademicMonth?: number | \"ALL\";"),
      "ModularCascadingTaskTableProps must accept selectedAcademicMonth"
    );
    assert.ok(
      tableContent.includes("onMonthChange?: (month: number | \"ALL\") => void;"),
      "ModularCascadingTaskTableProps must accept onMonthChange"
    );
  });

  test("ModularCascadingTaskTable uses filterTasksByAcademicMonthStrict", () => {
    assert.ok(
      tableContent.includes("filterTasksByAcademicMonthStrict"),
      "ModularCascadingTaskTable must use filterTasksByAcademicMonthStrict to scope tasks"
    );
  });

  test("All Lucide icons in toolbar and modular table strictly adhere to strokeWidth 1.5", () => {
    const strokeMatchesToolbar = toolbarContent.match(/strokeWidth=\{([^}]+)\}/g) || [];
    for (const match of strokeMatchesToolbar) {
      assert.match(
        match,
        /strokeWidth=\{1\.5\}/,
        `TaskTableToolbar must use strokeWidth={1.5}, found: ${match}`
      );
    }

    const strokeMatchesTable = tableContent.match(/strokeWidth=\{([^}]+)\}/g) || [];
    for (const match of strokeMatchesTable) {
      assert.match(
        match,
        /strokeWidth=\{1\.5\}/,
        `ModularCascadingTaskTable must use strokeWidth={1.5}, found: ${match}`
      );
    }
  });

  test("Zero dark: class variants in toolbar and table (strictly Light-Only standard)", () => {
    assert.strictEqual(
      toolbarContent.includes("dark:"),
      false,
      "TaskTableToolbar must not have dark: class variants"
    );
    assert.strictEqual(
      tableContent.includes("dark:"),
      false,
      "ModularCascadingTaskTable must not have dark: class variants"
    );
  });
});
