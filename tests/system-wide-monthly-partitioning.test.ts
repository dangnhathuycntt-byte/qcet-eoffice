import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  getAcademicMonthInfo,
  getAcademicMonthPeriod,
  getAcademicMonthsForYear,
  getAcademicYear,
  isDateInAcademicMonth,
  filterTasksByAcademicMonthStrict,
  computePriorOverdueBacklog,
  computeMonthPartitionBucket,
  ACADEMIC_MONTH_ORDER,
} from "../src/lib/academic-calendar";
import { CANONICAL_ROUTES } from "../src/lib/navigation/canonical-navigation-registry";
import { SEMESTER_GROUPS } from "../src/components/layout/global-month-selector";
import {
  formatAcademicMonthHeader,
  generateAcademicMonthGrid,
} from "../src/components/calendar/calendar-month-view";
import { computeDepartmentHealthMatrix } from "../src/lib/executive-matrix-aggregator";
import type { SchoolTask } from "../src/types/dashboard";

describe("System-Wide Monthly Partitioning Full Verification & Regression Suite", () => {
  // Sample multi-month mock tasks for comprehensive lifecycle assertions
  const sampleTasks: SchoolTask[] = [
    {
      id: "task-aug-overdue",
      code: "NV-AUG-01",
      title: "Nhiệm vụ tuyển sinh tồn đọng Tháng 8",
      description: "Chưa hoàn tất công tác tuyển sinh đợt 1",
      category: "HANH_CHINH",
      priority: "URGENT",
      status: "IN_PROGRESS",
      progressPercent: 40,
      dueDate: "2026-08-20T00:00:00.000Z",
      startDate: "2026-08-01T00:00:00.000Z",
      departmentId: "P_DTQLKH",
      departmentName: "Phòng Đào tạo",
      leadAssigneeName: "ThS. Đỗ Quang Trung",
      subTasks: [],
      deliverables: [],
      assignees: [],
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-20T00:00:00.000Z",
    } as unknown as SchoolTask,
    {
      id: "task-aug-completed",
      code: "NV-AUG-02",
      title: "Tổng kết công tác hè năm học trước",
      description: "Đã nghiệm thu",
      category: "HANH_CHINH",
      priority: "HIGH",
      status: "COMPLETED",
      progressPercent: 100,
      dueDate: "2026-08-15T00:00:00.000Z",
      startDate: "2026-08-01T00:00:00.000Z",
      departmentId: "P_DTQLKH",
      departmentName: "Phòng Đào tạo",
      leadAssigneeName: "ThS. Đỗ Quang Trung",
      subTasks: [],
      deliverables: [],
      assignees: [],
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-15T00:00:00.000Z",
    } as unknown as SchoolTask,
    {
      id: "task-sept-main",
      code: "NV-SEP-01",
      title: "Khai giảng và tổ chức giảng dạy Học kỳ I",
      description: "Trọng tâm Tháng 9 năm học 2026-2027",
      category: "CHUYEN_MON",
      priority: "URGENT",
      status: "IN_PROGRESS",
      progressPercent: 65,
      dueDate: "2026-09-18T00:00:00.000Z",
      startDate: "2026-08-26T00:00:00.000Z",
      departmentId: "P_DTQLKH",
      departmentName: "Phòng Đào tạo",
      leadAssigneeName: "ThS. Đỗ Quang Trung",
      subTasks: [
        {
          id: "sub-sep-1",
          taskId: "task-sept-main",
          title: "In ấn chương trình và biểu mẫu",
          status: "COMPLETED",
          dueDate: "2026-09-02T00:00:00.000Z",
          assignedToDepartmentId: "P_DTQLKH",
          assignedToDepartmentName: "Phòng Đào tạo",
          createdAt: "2026-08-26T00:00:00.000Z",
          updatedAt: "2026-09-02T00:00:00.000Z",
        },
        {
          id: "sub-sep-2",
          taskId: "task-sept-main",
          title: "Họp triển khai khối giảng viên",
          status: "IN_PROGRESS",
          dueDate: "2026-09-15T00:00:00.000Z",
          assignedToDepartmentId: "P_DTQLKH",
          assignedToDepartmentName: "Phòng Đào tạo",
          createdAt: "2026-08-26T00:00:00.000Z",
          updatedAt: "2026-09-05T00:00:00.000Z",
        },
        {
          id: "sub-oct-future",
          taskId: "task-sept-main",
          title: "Sơ kết tháng đầu kỳ học (Tháng 10)",
          status: "TODO",
          dueDate: "2026-10-08T00:00:00.000Z",
          assignedToDepartmentId: "P_DTQLKH",
          assignedToDepartmentName: "Phòng Đào tạo",
          createdAt: "2026-08-26T00:00:00.000Z",
          updatedAt: "2026-08-26T00:00:00.000Z",
        },
      ],
      deliverables: [],
      assignees: [],
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-09-05T00:00:00.000Z",
    } as unknown as SchoolTask,
    {
      id: "task-sept-done",
      code: "NV-SEP-02",
      title: "Cập nhật tài khoản người dùng đầu năm",
      description: "Hoàn tất bàn giao tài khoản LMS",
      category: "CNTT",
      priority: "HIGH",
      status: "COMPLETED",
      progressPercent: 100,
      dueDate: "2026-09-10T00:00:00.000Z",
      startDate: "2026-08-27T00:00:00.000Z",
      departmentId: "K_CNTT",
      departmentName: "Khoa CNTT",
      leadAssigneeName: "TS. Nguyễn Ngọc Vinh",
      subTasks: [],
      deliverables: [],
      assignees: [],
      createdAt: "2026-08-27T00:00:00.000Z",
      updatedAt: "2026-09-10T00:00:00.000Z",
    } as unknown as SchoolTask,
    {
      id: "task-oct-target",
      code: "NV-OCT-01",
      title: "Hội thảo chuyển đổi số giáo dục nghề nghiệp",
      description: "Sự kiện Tháng 10",
      category: "CHUYEN_DOI_SO",
      priority: "NORMAL",
      status: "IN_PROGRESS",
      progressPercent: 20,
      dueDate: "2026-10-16T00:00:00.000Z",
      startDate: "2026-09-28T00:00:00.000Z",
      departmentId: "K_CNTT",
      departmentName: "Khoa CNTT",
      leadAssigneeName: "TS. Nguyễn Ngọc Vinh",
      subTasks: [],
      deliverables: [],
      assignees: [],
      createdAt: "2026-09-25T00:00:00.000Z",
      updatedAt: "2026-09-28T00:00:00.000Z",
    } as unknown as SchoolTask,
  ];

  // ---------------------------------------------------------------------------
  // 1. Academic calendar calculations strictly follow day 25 to day 24 (UTC+7)
  // ---------------------------------------------------------------------------
  describe("1. Academic Calendar Operational Cycle (Day 25 to Day 24 UTC+7)", () => {
    test("August 24 23:59:59 (UTC+7) belongs to Month 8 of 2025-2026", () => {
      const info = getAcademicMonthInfo(new Date("2026-08-24T16:59:59.000Z")); // 23:59:59 UTC+7
      assert.equal(info.monthNumber, 8);
      assert.equal(info.academicYear, "2025-2026");

      const infoStr = getAcademicMonthInfo("2026-08-24");
      assert.equal(infoStr.monthNumber, 8);
      assert.equal(infoStr.academicYear, "2025-2026");
    });

    test("August 25 00:00:00 (UTC+7) marks exact start of Month 9 and 2026-2027 academic year", () => {
      const info = getAcademicMonthInfo("2026-08-25");
      assert.equal(info.monthNumber, 9);
      assert.equal(info.academicYear, "2026-2027");

      const infoUtc7 = getAcademicMonthInfo(new Date("2026-08-24T17:00:00.000Z")); // 00:00:00 UTC+7 on Aug 25
      assert.equal(infoUtc7.monthNumber, 9);
      assert.equal(infoUtc7.academicYear, "2026-2027");
    });

    test("September 24 23:59:59 (UTC+7) marks exact end of Month 9", () => {
      const info = getAcademicMonthInfo("2026-09-24");
      assert.equal(info.monthNumber, 9);
      assert.equal(info.academicYear, "2026-2027");

      const infoUtc7 = getAcademicMonthInfo(new Date("2026-09-24T16:59:59.000Z")); // 23:59:59 UTC+7 on Sep 24
      assert.equal(infoUtc7.monthNumber, 9);
      assert.equal(infoUtc7.academicYear, "2026-2027");
    });

    test("September 25 00:00:00 (UTC+7) marks exact start of Month 10", () => {
      const info = getAcademicMonthInfo("2026-09-25");
      assert.equal(info.monthNumber, 10);
      assert.equal(info.academicYear, "2026-2027");

      const infoUtc7 = getAcademicMonthInfo(new Date("2026-09-24T17:00:00.000Z")); // 00:00:00 UTC+7 on Sep 25
      assert.equal(infoUtc7.monthNumber, 10);
      assert.equal(infoUtc7.academicYear, "2026-2027");
    });

    test("Cross-year boundary: December 25 marks start of Month 1 (Học kỳ II)", () => {
      const info = getAcademicMonthInfo("2026-12-25");
      assert.equal(info.monthNumber, 1);
      assert.equal(info.academicYear, "2026-2027");

      const period = getAcademicMonthPeriod(1, "2026-2027");
      assert.equal(period.startDate, "2026-12-25");
      assert.equal(period.endDate, "2027-01-24");
      assert.equal(period.shortDateSpan, "25/12 - 24/01");
    });

    test("Academic year end: August 24 2027 marks end of Month 8 of 2026-2027", () => {
      const info = getAcademicMonthInfo("2027-08-24");
      assert.equal(info.monthNumber, 8);
      assert.equal(info.academicYear, "2026-2027");

      const period = getAcademicMonthPeriod(8, "2026-2027");
      assert.equal(period.startDate, "2027-07-25");
      assert.equal(period.endDate, "2027-08-24");
    });

    test("isDateInAcademicMonth strictly adheres to boundary limits", () => {
      assert.equal(isDateInAcademicMonth("2026-08-25", 9, "2026-2027"), true);
      assert.equal(isDateInAcademicMonth("2026-09-24", 9, "2026-2027"), true);
      assert.equal(isDateInAcademicMonth("2026-08-24", 9, "2026-2027"), false);
      assert.equal(isDateInAcademicMonth("2026-09-25", 9, "2026-2027"), false);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Academic year month order is [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8]
  // ---------------------------------------------------------------------------
  describe("2. Academic Year Month Sequence & Semester Invariants", () => {
    test("ACADEMIC_MONTH_ORDER constant is strictly ordered from 9 through 8", () => {
      assert.deepEqual(
        ACADEMIC_MONTH_ORDER,
        [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8],
        "Academic month order must start in September (9) and terminate in August (8)"
      );
      assert.equal(ACADEMIC_MONTH_ORDER.length, 12);
    });

    test("getAcademicMonthsForYear produces 12 sequential periods beginning with Month 9", () => {
      const months = getAcademicMonthsForYear("2026-2027");
      assert.equal(months.length, 12);

      const monthNumbers = months.map((m) => m.monthNumber);
      assert.deepEqual(monthNumbers, [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8]);

      assert.equal(months[0].monthNumber, 9);
      assert.equal(months[0].startDate, "2026-08-25");
      assert.equal(months[0].endDate, "2026-09-24");

      assert.equal(months[11].monthNumber, 8);
      assert.equal(months[11].startDate, "2027-07-25");
      assert.equal(months[11].endDate, "2027-08-24");
    });

    test("SEMESTER_GROUPS partitions all 12 operational months without omissions or overlaps", () => {
      assert.equal(SEMESTER_GROUPS.length, 3);
      assert.deepEqual(SEMESTER_GROUPS[0].months, [9, 10, 11, 12]);
      assert.deepEqual(SEMESTER_GROUPS[1].months, [1, 2, 3, 4, 5]);
      assert.deepEqual(SEMESTER_GROUPS[2].months, [6, 7, 8]);

      const flattened = SEMESTER_GROUPS.flatMap((g) => g.months);
      assert.deepEqual(flattened, [...ACADEMIC_MONTH_ORDER]);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Universal Monthly Bar / Contextual Action Bar renders 12-month switcher
  // ---------------------------------------------------------------------------
  describe("3. Universal Monthly Bar & Contextual Action Bar Architecture", () => {
    test("Canonical routes include all core partitioned zones: desk, calendar, tasks, documents", () => {
      const zoneIds = CANONICAL_ROUTES.map((r) => r.id);
      assert.ok(zoneIds.includes("desk"), "Route 'desk' must exist");
      assert.ok(zoneIds.includes("calendar"), "Route 'calendar' must exist");
      assert.ok(zoneIds.includes("tasks"), "Route 'tasks' must exist");
      assert.ok(zoneIds.includes("documents"), "Route 'documents' must exist");
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Dashboard stats strictly partition tasks by month without data bleed
  // ---------------------------------------------------------------------------
  describe("4. Dashboard Stats Partitioning & Prior Overdue Backlog Isolation", () => {
    test("filterTasksByAcademicMonthStrict strictly scopes tasks to Month 9 with zero data bleed", () => {
      const septTasks = filterTasksByAcademicMonthStrict(sampleTasks, 9, "2026-2027");

      // Only task-sept-main and task-sept-done belong to Month 9
      assert.equal(septTasks.length, 2);
      const ids = septTasks.map((t) => t.id);
      assert.ok(ids.includes("task-sept-main"));
      assert.ok(ids.includes("task-sept-done"));
      assert.ok(!ids.includes("task-aug-overdue"), "August overdue task must not bleed into Month 9 active tasks");
      assert.ok(!ids.includes("task-aug-completed"), "August completed task must not bleed into Month 9");
      assert.ok(!ids.includes("task-oct-target"), "October task must not bleed into Month 9");
    });

    test("filterTasksByAcademicMonthStrict scopes tasks to Month 10", () => {
      const octTasks = filterTasksByAcademicMonthStrict(sampleTasks, 10, "2026-2027");
      assert.equal(octTasks.length, 2);
      const octIds = octTasks.map((t) => t.id);
      assert.ok(octIds.includes("task-oct-target"));
      assert.ok(octIds.includes("task-sept-main"), "Multi-month task with Month 10 subtask must qualify");

      // Verify that in Month 10 view, task-sept-main only includes Month 10 subtask
      const septInOct = octTasks.find((t) => t.id === "task-sept-main");
      assert.equal(septInOct?.subTasks?.length, 1);
      assert.equal(septInOct?.subTasks?.[0].id, "sub-oct-future");
    });

    test("filterTasksByAcademicMonthStrict returns all tasks when month === ALL", () => {
      const allTasks = filterTasksByAcademicMonthStrict(sampleTasks, "ALL", "2026-2027");
      assert.equal(allTasks.length, 5);
    });

    test("computePriorOverdueBacklog identifies unfinished tasks due prior to Month 9", () => {
      const backlog = computePriorOverdueBacklog(sampleTasks, 9, "2026-2027", "2026-09-04");
      assert.equal(backlog.length, 1);
      assert.equal(backlog[0].id, "task-aug-overdue");
      assert.equal(backlog[0].status, "IN_PROGRESS");
    });

    test("computePriorOverdueBacklog excludes completed prior tasks", () => {
      const backlog = computePriorOverdueBacklog(sampleTasks, 9, "2026-2027", "2026-09-04");
      assert.ok(!backlog.some((t) => t.id === "task-aug-completed"));
    });

    test("computeMonthPartitionBucket produces mathematically sound monthly stats", () => {
      const bucket = computeMonthPartitionBucket(sampleTasks, 9, "2026-2027", "2026-09-04");

      assert.equal(bucket.monthNumber, 9);
      assert.equal(bucket.academicYear, "2026-2027");
      assert.equal(bucket.tasks.length, 2);
      assert.equal(bucket.priorOverdueBacklog.length, 1);

      // Stats assertions
      assert.equal(bucket.stats.totalTasks, 2);
      assert.equal(bucket.stats.completedTasks, 1);
      assert.equal(bucket.stats.inProgressTasks, 1);
      assert.equal(bucket.stats.overdueTasks, 0);
      assert.equal(bucket.stats.completionRate, 50);
    });

    test("computeDepartmentHealthMatrix isolates department statistics to selected month", () => {
      const septTasks = filterTasksByAcademicMonthStrict(sampleTasks, 9, "2026-2027");
      const matrix = computeDepartmentHealthMatrix(septTasks, "2026-09-04");

      const daoTao = matrix.find((d) => d.code === "P_DTQLKH");
      assert.ok(daoTao);
      // 1 parent task + 2 in-period subtasks = 3 items tracked
      assert.equal(daoTao?.totalTasks, 3);
      assert.equal(daoTao?.inProgressTasks, 2);
      assert.equal(daoTao?.completedTasks, 1);

      const cntt = matrix.find((d) => d.code === "K_CNTT");
      assert.ok(cntt);
      assert.equal(cntt?.totalTasks, 1);
      assert.equal(cntt?.completedTasks, 1);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. PriorOverdueBacklogBanner renders when overdue backlog exists, hidden on ALL
  // ---------------------------------------------------------------------------
  describe("5. PriorOverdueBacklogBanner Rendering & Visibility Rules", () => {
    test("PriorOverdueBacklogBanner renders alert banner when overdue backlog exists", async () => {
      const { PriorOverdueBacklogBanner } = await import(
        "../src/components/dashboard/prior-overdue-backlog-banner"
      );

      const backlogTasks: SchoolTask[] = [sampleTasks[0]];
      const markup = renderToStaticMarkup(
        React.createElement(PriorOverdueBacklogBanner, {
          tasks: backlogTasks,
          selectedMonth: 9,
        })
      );

      assert.ok(markup.includes('data-slot="prior-overdue-backlog-banner"'));
      assert.ok(markup.includes("Có 1 nhiệm vụ tồn đọng/trễ hạn từ các kỳ trước cần xử lý"));
      assert.ok(markup.includes("Xem danh sách"));
      assert.ok(markup.includes("Xem và xử lý nhiệm vụ tồn đọng"));
      assert.ok(markup.includes("border-amber-300") || markup.includes("amber-50"));
    });

    test("PriorOverdueBacklogBanner returns empty string (null) when selectedMonth === ALL", async () => {
      const { PriorOverdueBacklogBanner } = await import(
        "../src/components/dashboard/prior-overdue-backlog-banner"
      );

      const markup = renderToStaticMarkup(
        React.createElement(PriorOverdueBacklogBanner, {
          tasks: [sampleTasks[0]],
          selectedMonth: "ALL",
        })
      );

      assert.equal(markup, "");
    });

    test("PriorOverdueBacklogBanner returns empty string when tasks array is empty", async () => {
      const { PriorOverdueBacklogBanner } = await import(
        "../src/components/dashboard/prior-overdue-backlog-banner"
      );

      const markup = renderToStaticMarkup(
        React.createElement(PriorOverdueBacklogBanner, {
          tasks: [],
          selectedMonth: 9,
        })
      );

      assert.equal(markup, "");
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Cascading task table renders prior overdue backlog and operational period
  // ---------------------------------------------------------------------------
  describe("6. CascadingTaskTable Backlog & Period Indicator Invariants", () => {
    test("CascadingTaskTable renders operational period indicator in table header for Month 9", async () => {
      const { CascadingTaskTable } = await import("../src/components/tasks/cascading-task-table");

      const markup = renderToStaticMarkup(
        React.createElement(CascadingTaskTable, {
          tasks: [sampleTasks[2]],
          selectedAcademicMonth: 9,
        })
      );

      assert.match(markup, /Kỳ vận hành Tháng 9/);
      assert.match(markup, /25\/08 - 24\/09\/2026/);
      assert.match(markup, /1 nhiệm vụ/);
    });

    test("CascadingTaskTable renders Toàn năm học when selectedAcademicMonth === ALL", async () => {
      const { CascadingTaskTable } = await import("../src/components/tasks/cascading-task-table");

      const markup = renderToStaticMarkup(
        React.createElement(CascadingTaskTable, {
          tasks: [sampleTasks[2]],
          selectedAcademicMonth: "ALL",
        })
      );

      assert.match(markup, /Toàn năm học/);
    });

    test("CascadingTaskTable renders Prior Overdue Backlog section when month !== ALL and backlog exists", async () => {
      const { CascadingTaskTable } = await import("../src/components/tasks/cascading-task-table");

      const markup = renderToStaticMarkup(
        React.createElement(CascadingTaskTable, {
          tasks: [sampleTasks[2]],
          selectedAcademicMonth: 9,
          priorOverdueBacklog: [sampleTasks[0]],
        })
      );

      assert.match(markup, /TỒN ĐỌNG KỲ TRƯỚC \(1\)/);
      assert.match(markup, /Prior Overdue Backlog/);
      assert.match(markup, /Nhiệm vụ tuyển sinh tồn đọng Tháng 8/);
      assert.ok(markup.includes("border-amber-300"));
      assert.ok(markup.includes("bg-amber-50"));
    });

    test("CascadingTaskTable hides Prior Overdue Backlog section when selectedAcademicMonth === ALL", async () => {
      const { CascadingTaskTable } = await import("../src/components/tasks/cascading-task-table");

      const markup = renderToStaticMarkup(
        React.createElement(CascadingTaskTable, {
          tasks: [sampleTasks[2]],
          selectedAcademicMonth: "ALL",
          priorOverdueBacklog: [sampleTasks[0]],
        })
      );

      assert.ok(!markup.includes("TỒN ĐỌNG KỲ TRƯỚC"));
      assert.ok(!markup.includes("Prior Overdue Backlog"));
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Calendar view synchronizes with selected academic month
  // ---------------------------------------------------------------------------
  describe("7. Calendar View Synchronization & Operational Boundaries", () => {
    test("generateAcademicMonthGrid correctly tags operational cycle days as isCurrentMonth", () => {
      const period = getAcademicMonthPeriod(9, "2026-2027");
      const grid = generateAcademicMonthGrid(period);

      // Start of cycle: 2026-08-25
      const startCell = grid.find((cell) => cell.dateString === "2026-08-25");
      assert.ok(startCell, "Start cell 2026-08-25 must exist in calendar grid");
      assert.equal(startCell?.isCurrentMonth, true, "2026-08-25 must be tagged within active cycle");

      // End of cycle: 2026-09-24
      const endCell = grid.find((cell) => cell.dateString === "2026-09-24");
      assert.ok(endCell, "End cell 2026-09-24 must exist in calendar grid");
      assert.equal(endCell?.isCurrentMonth, true, "2026-09-24 must be tagged within active cycle");

      // Day before start: 2026-08-24
      const outsideCell = grid.find((cell) => cell.dateString === "2026-08-24");
      if (outsideCell) {
        assert.equal(outsideCell.isCurrentMonth, false, "2026-08-24 must be tagged outside active cycle");
      }
    });

    test("formatAcademicMonthHeader formats full Vietnamese cycle headline", () => {
      const period = getAcademicMonthPeriod(9, "2026-2027");
      const header = formatAcademicMonthHeader(period);

      assert.match(header, /Tháng 9 \/ 2026/);
      assert.match(header, /25\/08 - 24\/09/);
      assert.match(header, /Năm học 2026 - 2027/);
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Zero-leak subtask filtering properly scopes subtasks & deliverables
  // ---------------------------------------------------------------------------
  describe("8. Zero-Leak Subtask & Deliverable Monthly Scoping", () => {
    test("filterTasksByAcademicMonthStrict prunes subtasks due outside selected month", () => {
      const septTasks = filterTasksByAcademicMonthStrict(sampleTasks, 9, "2026-2027");
      const septTask = septTasks.find((t) => t.id === "task-sept-main");
      assert.ok(septTask);

      // Originally had 3 subtasks: sub-sep-1 (due 09-02), sub-sep-2 (due 09-15), sub-oct-future (due 10-08)
      // When strictly partitioned to Month 9, sub-oct-future must be pruned
      assert.equal(septTask?.subTasks?.length, 2);
      const subIds = septTask?.subTasks?.map((s) => s.id) || [];
      assert.ok(subIds.includes("sub-sep-1"));
      assert.ok(subIds.includes("sub-sep-2"));
      assert.ok(!subIds.includes("sub-oct-future"), "Future month subtask must be pruned in Month 9 view");

      // Check updated subtask count counters
      assert.equal(septTask?.totalSubTasks, 2);
      assert.equal(septTask?.completedSubTasks, 1);
    });

    test("CascadingTaskTable tags subtasks due in active cycle with Hạn trong kỳ badge", async () => {
      const { CascadingTaskTable } = await import("../src/components/tasks/cascading-task-table");

      const markup = renderToStaticMarkup(
        React.createElement(CascadingTaskTable, {
          tasks: [sampleTasks[2]],
          selectedAcademicMonth: 9,
        })
      );

      // Should render badge highlighting in-cycle subtasks
      assert.match(markup, /Hạn trong kỳ T9/);
    });
  });

});
