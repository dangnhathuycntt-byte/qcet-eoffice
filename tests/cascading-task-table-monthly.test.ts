import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SchoolTask } from "../src/types/dashboard";

describe("CascadingTaskTable Monthly Partitioning & Prior Overdue Backlog", () => {
  const componentPath = path.resolve(
    process.cwd(),
    "src/components/tasks/cascading-task-table.tsx"
  );

  test("cascading-task-table.tsx strictly adheres to Light-Only Tailwind standards", () => {
    assert.ok(fs.existsSync(componentPath), "cascading-task-table.tsx must exist");
    const content = fs.readFileSync(componentPath, "utf8");
    assert.ok(!content.includes("dark:"), "Must NOT contain dark: classes");
    assert.ok(!content.includes("ThemeProvider"), "Must NOT use ThemeProvider");
  });

  test("source code consumes selectedAcademicMonth and priorOverdueBacklog", () => {
    const content = fs.readFileSync(componentPath, "utf8");
    assert.match(content, /selectedAcademicMonth/);
    assert.match(content, /priorOverdueBacklog/);
    assert.match(content, /TỒN ĐỌNG KỲ TRƯỚC/);
    assert.match(content, /Prior Overdue Backlog/);
  });

  const mockTasks: SchoolTask[] = [
    {
      id: "task-sept-1",
      title: "Triển khai hệ thống xác thực tập trung SSO",
      category: "CNTT",
      categoryLabel: "CNTT",
      leadAssigneeName: "Trần Hùng",
      coAssignees: ["Nguyễn Ngọc Vinh"],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-20",
      status: "IN_PROGRESS",
      progressPercent: 50,
      totalSubTasks: 2,
      completedSubTasks: 1,
      subTasks: [
        {
          id: "sub-1",
          title: "Cấu hình SAML 2.0 IdP",
          assigneeName: "Nguyễn Ngọc Vinh",
          status: "COMPLETED",
          dueDate: "2026-09-10",
          parentSchoolTaskId: "task-sept-1",
          updatedAt: "2026-09-05",
        },
        {
          id: "sub-2",
          title: "Kiểm thử tải hệ thống",
          assigneeName: "Trần Hùng",
          status: "IN_PROGRESS",
          dueDate: "2026-10-15",
          parentSchoolTaskId: "task-sept-1",
          updatedAt: "2026-09-08",
        },
      ],
    },
  ];

  const mockPriorBacklog: SchoolTask[] = [
    {
      id: "backlog-1",
      title: "Báo cáo an toàn thông tin tháng 8 chưa nghiệm thu",
      category: "ATTT",
      categoryLabel: "An toàn thông tin",
      leadAssigneeName: "Mai Đinh Thị Xuân",
      coAssignees: [],
      assignedDate: "2026-08-01",
      dueDate: "2026-08-20",
      status: "IN_PROGRESS",
      progressPercent: 30,
      totalSubTasks: 0,
      completedSubTasks: 0,
      subTasks: [],
    },
    {
      id: "backlog-2",
      title: "Nâng cấp cơ sở dữ liệu thư viện số",
      category: "THU_VIEN",
      categoryLabel: "Thư viện",
      leadAssigneeName: "Lê Hoàng Long",
      coAssignees: [],
      assignedDate: "2026-08-10",
      dueDate: "2026-08-22",
      status: "IN_PROGRESS",
      progressPercent: 70,
      totalSubTasks: 0,
      completedSubTasks: 0,
      subTasks: [],
    },
  ];

  test("renders monthly indicator in table header for specific month and ALL", async () => {
    const { CascadingTaskTable } = await import("@/components/tasks/cascading-task-table");

    // Month 9
    const markupMonth9 = renderToStaticMarkup(
      React.createElement(CascadingTaskTable, {
        tasks: mockTasks,
        selectedAcademicMonth: 9,
      })
    );
    assert.match(markupMonth9, /Kỳ vận hành Tháng 9/);
    assert.match(markupMonth9, /25\/08 - 24\/09\/2026/);
    assert.match(markupMonth9, /1 nhiệm vụ/);

    // Month ALL
    const markupAll = renderToStaticMarkup(
      React.createElement(CascadingTaskTable, {
        tasks: mockTasks,
        selectedAcademicMonth: "ALL",
      })
    );
    assert.match(markupAll, /Toàn năm học/);
  });

  test("renders Prior Overdue Backlog section when month !== ALL and backlog exists", async () => {
    const { CascadingTaskTable } = await import("@/components/tasks/cascading-task-table");

    const markup = renderToStaticMarkup(
      React.createElement(CascadingTaskTable, {
        tasks: mockTasks,
        selectedAcademicMonth: 9,
        priorOverdueBacklog: mockPriorBacklog,
      })
    );

    // Section title and count
    assert.match(markup, /TỒN ĐỌNG KỲ TRƯỚC \(2\)/);
    assert.match(markup, /Prior Overdue Backlog/);

    // Amber/rose warning styling
    assert.ok(markup.includes("border-amber-300"), "Must have amber border styling");
    assert.ok(markup.includes("bg-amber-50"), "Must have amber ground styling");

    // Renders both backlog tasks
    assert.match(markup, /Báo cáo an toàn thông tin tháng 8 chưa nghiệm thu/);
    assert.match(markup, /Nâng cấp cơ sở dữ liệu thư viện số/);
    assert.match(markup, /Mai Đinh Thị Xuân/);
  });

  test("does NOT render Prior Overdue Backlog section when selectedAcademicMonth is ALL", async () => {
    const { CascadingTaskTable } = await import("@/components/tasks/cascading-task-table");

    const markup = renderToStaticMarkup(
      React.createElement(CascadingTaskTable, {
        tasks: mockTasks,
        selectedAcademicMonth: "ALL",
        priorOverdueBacklog: mockPriorBacklog,
      })
    );

    assert.ok(!markup.includes("TỒN ĐỌNG KỲ TRƯỚC"));
    assert.ok(!markup.includes("Prior Overdue Backlog"));
  });

  test("does NOT render Prior Overdue Backlog section when backlog is empty", async () => {
    const { CascadingTaskTable } = await import("@/components/tasks/cascading-task-table");

    const markup = renderToStaticMarkup(
      React.createElement(CascadingTaskTable, {
        tasks: mockTasks,
        selectedAcademicMonth: 9,
        priorOverdueBacklog: [],
      })
    );

    assert.ok(!markup.includes("TỒN ĐỌNG KỲ TRƯỚC"));
    assert.ok(!markup.includes("Prior Overdue Backlog"));
  });

  test("subtasks indicate whether they are due within active academic month (zero-leak)", async () => {
    const { CascadingTaskTable } = await import("@/components/tasks/cascading-task-table");

    const markup = renderToStaticMarkup(
      React.createElement(CascadingTaskTable, {
        tasks: mockTasks,
        selectedAcademicMonth: 9,
      })
    );

    // sub-1 is due 2026-09-10 (inside Month 9: 25/08 - 24/09), sub-2 is due 2026-10-15 (Month 10)
    assert.match(markup, /Hạn trong kỳ T9|Trong kỳ/);
  });
});
