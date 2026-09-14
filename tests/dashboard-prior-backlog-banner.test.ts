import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SchoolTask } from "../src/types/dashboard";

describe("PriorOverdueBacklogBanner & DashboardZone Monthly Scoping", () => {
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
});
