import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  computeDepartmentHealthMatrix,
  computeExecutiveActionStats,
} from "../src/lib/executive-matrix-aggregator";
import {
  filterTasksByAcademicMonthStrict,
  computePriorOverdueBacklog,
  getAcademicYear,
} from "../src/lib/academic-calendar";
import { computeDashboardStats } from "../src/lib/dashboard-aggregator";
import type { SchoolTask } from "../src/types/dashboard";

describe("Task 2: State Management & URL Sync Integration Suite", () => {
  const hookFilePath = path.resolve(process.cwd(), "src/hooks/use-task-filters.ts");
  const hookContent = fs.readFileSync(hookFilePath, "utf-8");
  const contextFilePath = path.resolve(
    process.cwd(),
    "src/components/dashboard/dashboard-context.tsx"
  );
  const contextContent = fs.readFileSync(contextFilePath, "utf-8");

  describe("Contract and Hook Interface Verification", () => {
    test("use-task-filters imports filterTasksByAcademicMonthStrict and computePriorOverdueBacklog", () => {
      assert.ok(
        hookContent.includes("filterTasksByAcademicMonthStrict"),
        "use-task-filters must import filterTasksByAcademicMonthStrict"
      );
      assert.ok(
        hookContent.includes("computePriorOverdueBacklog"),
        "use-task-filters must import computePriorOverdueBacklog"
      );
    });

    test("TaskFiltersReturn interface declares required monthly partitioning fields", () => {
      assert.match(
        hookContent,
        /monthScopedBaseTasks:\s*SchoolTask\[\];/,
        "TaskFiltersReturn must declare monthScopedBaseTasks"
      );
      assert.match(
        hookContent,
        /priorOverdueBacklog:\s*SchoolTask\[\];/,
        "TaskFiltersReturn must declare priorOverdueBacklog"
      );
      assert.match(
        hookContent,
        /selectedAcademicMonth:\s*number\s*\|\s*"ALL";/,
        "TaskFiltersReturn must declare selectedAcademicMonth"
      );
      assert.match(
        hookContent,
        /monthlyScopedStats:\s*DashboardStats;/,
        "TaskFiltersReturn must declare monthlyScopedStats"
      );
      assert.match(
        hookContent,
        /monthlyDepartmentHealth:\s*DepartmentHealthSummary\[\];/,
        "TaskFiltersReturn must declare monthlyDepartmentHealth"
      );
      assert.match(
        hookContent,
        /monthlyExecutiveStats:\s*ExecutiveActionStats\s*\|\s*null;/,
        "TaskFiltersReturn must declare monthlyExecutiveStats"
      );
    });

    test("useTaskFilters returns monthScopedBaseTasks, priorOverdueBacklog, and monthly aliases", () => {
      assert.match(hookContent, /\bmonthScopedBaseTasks\b/);
      assert.match(hookContent, /\bpriorOverdueBacklog\b/);
      assert.match(hookContent, /\bmonthlyScopedStats:\s*displayedStats\b/);
      assert.match(hookContent, /\bmonthlyDepartmentHealth:\s*departmentHealth\b/);
      assert.match(hookContent, /\bmonthlyExecutiveStats:\s*executiveStats\b/);
    });

    test("DashboardDataContextValue exposes priorOverdueBacklog and monthScopedBaseTasks", () => {
      assert.match(
        contextContent,
        /priorOverdueBacklog\??:\s*SchoolTask\[\];/,
        "DashboardDataContextValue must expose priorOverdueBacklog"
      );
      assert.match(
        contextContent,
        /monthScopedBaseTasks\??:\s*SchoolTask\[\];/,
        "DashboardDataContextValue must expose monthScopedBaseTasks"
      );
      assert.match(
        contextContent,
        /priorOverdueBacklog:\s*dashboardState\.priorOverdueBacklog/,
        "DashboardStateProvider must pass priorOverdueBacklog to dataValue"
      );
    });
  });

  describe("Functional Partitioning, Backlog & Department Health Scoping", () => {
    const mockTasks = [
      {
        id: "task-sept-1",
        title: "Kế hoạch đào tạo Tháng 9",
        category: "DAO_TAO",
        priority: "HIGH",
        status: "COMPLETED",
        progressPercent: 100,
        dueDate: "2026-09-10T00:00:00.000Z",
        startDate: "2026-08-26T00:00:00.000Z",
        departmentId: "P_DTQLKH",
        departmentName: "Phòng Đào tạo",
        leadAssigneeName: "ThS. Đỗ Quang Trung",
        subTasks: [],
        deliverables: [],
        createdAt: "2026-08-26T00:00:00.000Z",
        updatedAt: "2026-09-10T00:00:00.000Z",
      },
      {
        id: "task-aug-overdue",
        title: "Tồn đọng tuyển sinh Tháng 8",
        category: "DAO_TAO",
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
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-20T00:00:00.000Z",
      },
      {
        id: "task-oct-future",
        title: "Kế hoạch tuần lễ CNTT Tháng 10",
        category: "CHUYEN_DOI_SO",
        priority: "MEDIUM",
        status: "IN_PROGRESS",
        progressPercent: 10,
        dueDate: "2026-10-15T00:00:00.000Z",
        startDate: "2026-09-26T00:00:00.000Z",
        departmentId: "K_CNTT",
        departmentName: "Khoa CNTT",
        leadAssigneeName: "TS. Nguyễn Ngọc Vinh",
        subTasks: [],
        deliverables: [],
        createdAt: "2026-09-26T00:00:00.000Z",
        updatedAt: "2026-09-26T00:00:00.000Z",
      },
    ] as unknown as SchoolTask[];

    const academicYear = "2026-2027";

    test("filterTasksByAcademicMonthStrict strictly scopes tasks to Month 9", () => {
      const septTasks = filterTasksByAcademicMonthStrict(mockTasks, 9, academicYear);
      assert.equal(septTasks.length, 1);
      assert.equal(septTasks[0].id, "task-sept-1");
    });

    test("computePriorOverdueBacklog identifies overdue tasks prior to Month 9 window", () => {
      const backlog = computePriorOverdueBacklog(
        mockTasks,
        9,
        academicYear,
        "2026-09-04"
      );
      assert.equal(backlog.length, 1);
      assert.equal(backlog[0].id, "task-aug-overdue");
    });

    test("computeDepartmentHealthMatrix accurately reflects scoped tasks for Month 9", () => {
      const septTasks = filterTasksByAcademicMonthStrict(mockTasks, 9, academicYear);
      const matrix = computeDepartmentHealthMatrix(septTasks, "2026-09-04");

      const dtqlkh = matrix.find((d) => d.code === "P_DTQLKH");
      assert.ok(dtqlkh, "P_DTQLKH department should exist in matrix");
      assert.equal(dtqlkh.totalTasks, 1);
      assert.equal(dtqlkh.completedTasks, 1);
      assert.equal(dtqlkh.inProgressTasks, 0);
      assert.equal(dtqlkh.overdueTasks, 0);

      const cntt = matrix.find((d) => d.code === "K_CNTT");
      assert.ok(cntt, "K_CNTT department should exist in matrix");
      assert.equal(cntt.totalTasks, 0);
      assert.equal(cntt.completedTasks, 0);
    });

    test("computeExecutiveActionStats scopes metrics to Month 9", () => {
      const septTasks = filterTasksByAcademicMonthStrict(mockTasks, 9, academicYear);
      const stats = computeExecutiveActionStats(septTasks, "2026-09-04");

      assert.equal(stats.blockedTasksCount, 0);
      assert.equal(stats.overdueTasksCount, 0);
      assert.equal(stats.strategicActiveCount, 0);
    });

    test("displayedStats reflects scoped month tasks vs empty month tasks", () => {
      const septTasks = filterTasksByAcademicMonthStrict(mockTasks, 9, academicYear);
      const septStats = computeDashboardStats(septTasks);
      assert.equal(septStats.totalSchoolTasks, 1);
      assert.equal(septStats.schoolTasksCompleted, 1);

      const emptyStats = computeDashboardStats([]);
      assert.equal(emptyStats.totalSchoolTasks, 0);
      assert.equal(emptyStats.schoolTasksCompleted, 0);
    });
  });
});
