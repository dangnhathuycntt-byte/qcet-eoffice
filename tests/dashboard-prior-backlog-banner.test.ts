import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SchoolTask } from "../src/types/dashboard";

describe("PriorOverdueBacklogBanner & DashboardZone Monthly Scoping", () => {
  const bannerPath = path.resolve(
    process.cwd(),
    "src/components/dashboard/prior-overdue-backlog-banner.tsx"
  );
  const zonePath = path.resolve(
    process.cwd(),
    "src/components/dashboard/zones/dashboard-zone.tsx"
  );

  test("PriorOverdueBacklogBanner file exists and strictly adheres to Light-Only Tailwind rules", () => {
    assert.ok(fs.existsSync(bannerPath), "prior-overdue-backlog-banner.tsx must exist");
    const content = fs.readFileSync(bannerPath, "utf8");
    assert.ok(!content.includes("dark:"), "Must NOT contain dark: classes");
    assert.ok(!content.includes("ThemeProvider"), "Must NOT use ThemeProvider");
  });

  test("DashboardZone strictly adheres to Light-Only Tailwind rules", () => {
    const content = fs.readFileSync(zonePath, "utf8");
    assert.ok(!content.includes("dark:"), "Must NOT contain dark: classes");
    assert.ok(!content.includes("ThemeProvider"), "Must NOT use ThemeProvider");
  });

  test("PriorOverdueBacklogBanner renders null when selectedMonth is ALL or tasks is empty", async () => {
    const { PriorOverdueBacklogBanner } = await import(
      "@/components/dashboard/prior-overdue-backlog-banner"
    );

    const mockTasks: SchoolTask[] = [
      {
        id: "task-overdue-1",
        title: "Kế hoạch tuyển sinh bổ sung Đợt 1",
        department: "P_DAO_TAO",
        status: "IN_PROGRESS",
        priority: "HIGH",
        dueDate: "2026-08-20",
        progress: 40,
        subTasks: [],
        deliverables: [],
        weight: 1,
      } as any,
    ];

    // 1. Should render null when selectedMonth is "ALL"
    const markupAll = renderToStaticMarkup(
      React.createElement(PriorOverdueBacklogBanner, {
        tasks: mockTasks,
        selectedMonth: "ALL",
      })
    );
    assert.equal(markupAll, "");

    // 2. Should render null when tasks is empty
    const markupEmpty = renderToStaticMarkup(
      React.createElement(PriorOverdueBacklogBanner, {
        tasks: [],
        selectedMonth: 9,
      })
    );
    assert.equal(markupEmpty, "");
  });

  test("PriorOverdueBacklogBanner renders alert banner with warning styling and task counts", async () => {
    const { PriorOverdueBacklogBanner } = await import(
      "@/components/dashboard/prior-overdue-backlog-banner"
    );

    const mockTasks: SchoolTask[] = [
      {
        id: "task-overdue-1",
        title: "Báo cáo kiểm định chất lượng CTĐT",
        department: "P_DBCL",
        status: "IN_PROGRESS",
        priority: "URGENT",
        dueDate: "2026-08-15",
        progress: 30,
        subTasks: [],
        deliverables: [],
        weight: 2,
      } as any,
      {
        id: "task-overdue-2",
        title: "Nâng cấp hạ tầng LMS học kỳ I",
        department: "TT_CNTT",
        status: "IN_PROGRESS",
        priority: "HIGH",
        dueDate: "2026-08-24",
        progress: 60,
        subTasks: [],
        deliverables: [],
        weight: 1,
      } as any,
    ];

    const markup = renderToStaticMarkup(
      React.createElement(PriorOverdueBacklogBanner, {
        tasks: mockTasks,
        selectedMonth: 9,
        monthPeriod: {
          monthNumber: 9,
          monthIndexInYear: 0,
          academicYear: "2026-2027",
          startDate: "2026-08-25",
          endDate: "2026-09-24",
          label: "Tháng 9",
          fullLabel: "Tháng 9 / 2026 (25/08 - 24/09)",
          shortDateSpan: "25/08 - 24/09",
        },
      })
    );

    assert.ok(markup.includes('data-slot="prior-overdue-backlog-banner"'));
    assert.ok(markup.includes("Có 2 nhiệm vụ tồn đọng/trễ hạn từ các kỳ trước cần xử lý"));
    assert.ok(markup.includes("Xem danh sách"));
    assert.ok(markup.includes("Xem và xử lý nhiệm vụ tồn đọng"));
    assert.ok(markup.includes("Tháng 9"));
  });

  test("DashboardZone imports PriorOverdueBacklogBanner and connects monthly partitioned states", () => {
    const content = fs.readFileSync(zonePath, "utf8");
    assert.match(content, /PriorOverdueBacklogBanner/);
    assert.match(content, /selectedAcademicMonth/);
    assert.match(content, /priorOverdueBacklog/);
    assert.match(content, /displayedStats/);
    assert.match(content, /KỲ VẬN HÀNH THÁNG/);

    // Verify size budget (< 150 lines)
    const lineCount = content.split("\n").length;
    assert.ok(lineCount < 150, `DashboardZone exceeded 150 lines: ${lineCount}`);
  });
});
