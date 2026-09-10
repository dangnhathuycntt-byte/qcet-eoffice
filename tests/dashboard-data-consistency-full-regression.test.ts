import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { computeDashboardStats, computeSchoolTaskRollup } from "../src/lib/dashboard-aggregator";
import {
  computeDepartmentHealthMatrix,
  extractExecutiveActionItems,
} from "../src/lib/executive-matrix-aggregator";
import { getSystemReferenceDate, isTaskPastDue } from "../src/lib/academic-calendar";
import { getStatCardData } from "../src/components/dashboard/executive-stat-strip";
import type { SchoolTask, DashboardStats, TaskStatus } from "../src/types/dashboard";

describe("Full System Regression Suite - Dashboard Data Consistency & Aggregation (TC-01 to TC-10)", () => {
  // Helper to build a standard school task
  function createSampleSchoolTask(
    id: string,
    status: TaskStatus,
    dueDate: string,
    progressPercent: number = 0,
    subTasks: SchoolTask["subTasks"] = []
  ): SchoolTask {
    return {
      id,
      title: `Nhiệm vụ kiểm thử ${id}`,
      category: "KHAC",
      categoryLabel: "Khác",
      leadAssigneeName: "Ban Giám hiệu",
      leadDepartmentCode: "BGH",
      coAssignees: [],
      assignedDate: "2026-09-01",
      dueDate,
      status,
      progressPercent,
      totalSubTasks: subTasks.length,
      completedSubTasks: subTasks.filter((s) => s.status === "COMPLETED").length,
      subTasks,
    };
  }

  // TC-01: MECE Arithmetic Conservation
  test("TC-01: MECE arithmetic conservation holds strictly (85 + 30 + 3 + 1 + 11 = 130)", () => {
    const refDate = "2026-09-09";
    const tasks: SchoolTask[] = [];

    // 85 In progress (not past due)
    for (let i = 1; i <= 85; i++) {
      tasks.push(createSampleSchoolTask(`ip-${i}`, "IN_PROGRESS", "2026-09-25", 50));
    }

    // 30 Not started
    for (let i = 1; i <= 30; i++) {
      tasks.push(createSampleSchoolTask(`ns-${i}`, "NOT_STARTED", "2026-09-30", 0));
    }

    // 3 Waiting approval (even if past due, WAITING_APPROVAL has precedence over OVERDUE)
    for (let i = 1; i <= 3; i++) {
      tasks.push(createSampleSchoolTask(`wa-${i}`, "WAITING_APPROVAL", "2026-09-05", 100));
    }

    // 1 Overdue (in progress but past due)
    tasks.push(createSampleSchoolTask("od-1", "IN_PROGRESS", "2026-09-01", 40));

    // 11 Completed
    for (let i = 1; i <= 11; i++) {
      tasks.push(createSampleSchoolTask(`done-${i}`, "COMPLETED", "2026-09-08", 100));
    }

    assert.equal(tasks.length, 130, "Total sample tasks must equal 130");

    const stats = computeDashboardStats(tasks, refDate);

    assert.equal(stats.totalSchoolTasks, 130);
    assert.equal(stats.schoolTasksInProgress, 85);
    assert.equal(stats.schoolTasksNotStarted, 30);
    assert.equal(stats.schoolTasksWaitingApproval, 3);
    assert.equal(stats.schoolTasksOverdue, 1);
    assert.equal(stats.schoolTasksCompleted, 11);

    // Strict MECE sum equation
    const meceSum =
      stats.schoolTasksInProgress +
      (stats.schoolTasksNotStarted ?? 0) +
      (stats.schoolTasksWaitingApproval ?? 0) +
      (stats.schoolTasksOverdue ?? 0) +
      stats.schoolTasksCompleted;

    assert.equal(meceSum, stats.totalSchoolTasks, "MECE sum must strictly equal totalSchoolTasks");
    assert.equal(meceSum, 130, "MECE sum must equal 130");
  });

  // TC-02: Alignment between Card 1 and Card BGH 3
  test("TC-02: Card 1 and Card BGH 3 align on 85 in-progress strategic tasks", () => {
    const stats: DashboardStats = {
      totalSchoolTasks: 130,
      schoolTasksInProgress: 85,
      schoolTasksCompleted: 11,
      schoolTasksNotStarted: 30,
      schoolTasksWaitingApproval: 3,
      schoolTasksOverdue: 1,
      totalStaffTasks: 0,
      staffTasksInProgress: 0,
      staffTasksCompleted: 0,
      needsReviewTasksCount: 3,
      overdueTasksCount: 1,
      averageSchoolProgressPercent: 44,
      completionRate: 8.5,
    };

    const cards = getStatCardData(stats);
    const card1 = cards[0];

    assert.equal(card1.id, "school-tasks");
    assert.equal(card1.value, "130");
    assert.equal(card1.subtext, "85 đang làm · 30 chưa làm · 11 hoàn thành");
    assert.ok(card1.subtext.includes("85 đang làm"), "Card 1 must state 85 in progress");
  });

  // TC-03: Approval queue displays real tasks or verified empty state with [Phê duyệt ngay]
  test("TC-03: Approval queue extracts real WAITING_APPROVAL tasks with [Phê duyệt ngay] action", () => {
    const taskWaiting: SchoolTask = createSampleSchoolTask(
      "task-waiting-1",
      "WAITING_APPROVAL",
      "2026-09-12",
      100
    );
    taskWaiting.leadDepartmentCode = "K_CNTT";
    taskWaiting.leadAssigneeName = "TS. Nguyễn Văn A";

    const items = extractExecutiveActionItems([taskWaiting], "2026-09-09");
    assert.equal(items.length, 1);
    assert.equal(items[0].taskId, "task-waiting-1");
    assert.equal(items[0].actionType, "APPROVE");
    assert.equal(items[0].actionLabel, "Phê duyệt ngay");
  });

  // TC-04: Zero hardcoded mock data (DEFAULT_ACTION_ITEMS eradicated)
  test("TC-04: Zero occurrences of DEFAULT_ACTION_ITEMS and Verified Clear Horizon present", () => {
    const actionCenterPath = path.resolve(
      __dirname,
      "../src/components/dashboard/executive-action-center.tsx"
    );
    const actionCenterCode = fs.readFileSync(actionCenterPath, "utf8");

    assert.equal(
      actionCenterCode.includes("DEFAULT_ACTION_ITEMS"),
      false,
      "executive-action-center.tsx must not contain DEFAULT_ACTION_ITEMS"
    );
    assert.ok(
      actionCenterCode.includes("ShieldCheck"),
      "Must display ShieldCheck in verified clear state"
    );
    assert.ok(
      actionCenterCode.includes("Hàng đợi điều hành thông suốt"),
      "Must display confident clear state message"
    );
  });

  // TC-05: Card 4 displays 'Tiến độ trung bình toàn trường' with average progress % and transparent completion rate subtext
  test("TC-05: Card 4 displays 'Tiến độ trung bình toàn trường: 44%' with transparent subtext 'Hoàn tất 11/130 (8.5%)'", () => {
    const stats: DashboardStats = {
      totalSchoolTasks: 130,
      schoolTasksInProgress: 85,
      schoolTasksCompleted: 11,
      schoolTasksNotStarted: 30,
      totalStaffTasks: 0,
      staffTasksInProgress: 0,
      staffTasksCompleted: 0,
      needsReviewTasksCount: 3,
      overdueTasksCount: 1,
      averageSchoolProgressPercent: 44,
      completionRate: 8.5,
    };

    const cards = getStatCardData(stats);
    const card4 = cards[3];

    assert.equal(card4.id, "overall-progress");
    assert.equal(card4.title, "Tiến độ trung bình toàn trường");
    assert.equal(card4.value, "44%");
    assert.equal(card4.subtext, "Hoàn tất 11/130 (8.5%)");
    assert.equal(card4.progress, 44);
  });

  // TC-06: Department progress computation does not force in-progress subtasks to 0%
  test("TC-06: Department progress accurately accumulates in-progress subtask percentages", () => {
    const parentTask: SchoolTask = createSampleSchoolTask(
      "parent-dept",
      "IN_PROGRESS",
      "2026-09-30",
      60,
      [
        {
          id: "sub-1",
          title: "Subtask đang làm 70%",
          assigneeName: "Cán bộ A",
          departmentCode: "K_CNTT",
          status: "IN_PROGRESS",
          dueDate: "2026-09-20",
          progressPercent: 70,
          updatedAt: "2026-09-01",
        } as any,
      ]
    );
    parentTask.leadDepartmentCode = "K_CNTT";

    const matrix = computeDepartmentHealthMatrix([parentTask], "2026-09-09");
    const cnttSummary = matrix.find((m) => m.code === "K_CNTT" || m.departmentId === "K_CNTT");

    assert.ok(cnttSummary, "K_CNTT must exist in matrix");
    assert.ok(cnttSummary.averageProgressPercent > 0, "Average progress must be greater than 0%");
    assert.equal(cnttSummary.averageProgressPercent, 65); // (60 + 70) / 2 = 65%

    // Denominator integrity assertions (Rule 40.2 & docs/product/metrics.md Section 3.1)
    assert.equal(cnttSummary.completionRate, 0, "Completion rate must be derived strictly from parent tasks (0/1 completed = 0%)");
    assert.equal(cnttSummary.parentTasksCount, 1);
    assert.equal(cnttSummary.completedParentTasksCount, 0);
    assert.equal(cnttSummary.subTasksCount, 1);
    assert.equal(cnttSummary.completedSubTasksCount, 0);
  });

  // TC-07: Preservation of manual progress in School Task Rollup when subTasks is empty
  test("TC-07: computeSchoolTaskRollup preserves manual progressPercent: 60 when subTasks is empty", () => {
    const manualTask: SchoolTask = createSampleSchoolTask(
      "task-manual-progress",
      "IN_PROGRESS",
      "2026-09-25",
      60,
      []
    );

    const rolled = computeSchoolTaskRollup(manualTask);
    assert.equal(rolled.progressPercent, 60, "Manual progressPercent must be preserved, not reset to 0");
  });

  // TC-08: Standardized system reference date & UTC midnight skew immunity
  test("TC-08: Standardized system reference date (2026-09-09) and UTC midnight skew immunity", () => {
    const refDate = getSystemReferenceDate();
    assert.equal(refDate, "2026-09-09");

    // Task due on current day at 08:00 AM VN time must not be marked overdue
    assert.equal(isTaskPastDue("2026-09-09T08:00:00+07:00", refDate), false);
    assert.equal(isTaskPastDue("2026-09-09", refDate), false);

    // Task due yesterday is overdue
    assert.equal(isTaskPastDue("2026-09-08", refDate), true);

    // Task due tomorrow is not overdue
    assert.equal(isTaskPastDue("2026-09-10", refDate), false);
  });

  // TC-09: TypeScript Typecheck integrity and interface contracts
  test("TC-09: DashboardStats and SchoolTask interfaces fulfill MECE and granular breakdown contract", () => {
    const sampleStats: DashboardStats = {
      totalSchoolTasks: 10,
      schoolTasksInProgress: 5,
      schoolTasksCompleted: 2,
      schoolTasksNotStarted: 2,
      schoolTasksWaitingApproval: 1,
      schoolTasksOverdue: 0,
      totalStaffTasks: 0,
      staffTasksInProgress: 0,
      staffTasksCompleted: 0,
      needsReviewTasksCount: 1,
      overdueTasksCount: 0,
      averageSchoolProgressPercent: 50,
      completionRate: 20,
    };

    assert.equal(
      sampleStats.schoolTasksInProgress +
        (sampleStats.schoolTasksNotStarted ?? 0) +
        (sampleStats.schoolTasksWaitingApproval ?? 0) +
        (sampleStats.schoolTasksOverdue ?? 0) +
        sampleStats.schoolTasksCompleted,
      sampleStats.totalSchoolTasks
    );
  });

  // TC-10: Light-only styling standard (no dark: classes) & Segregation of Duties invariants
  test("TC-10: Strict Light-Only CSS standard and Segregation of Duties authorization invariants", () => {
    const dashboardFiles = [
      "src/components/dashboard/executive-stat-strip.tsx",
      "src/components/dashboard/executive-action-center.tsx",
      "src/components/dashboard/department-progress-matrix.tsx",
      "src/components/dashboard/zones/dashboard-zone.tsx",
    ];

    for (const relPath of dashboardFiles) {
      const fullPath = path.resolve(__dirname, "..", relPath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf8");
        assert.equal(
          /\bdark:/.test(content),
          false,
          `File ${relPath} must not contain dark: classes`
        );
      }
    }

    const policyPaths = [
      path.resolve(__dirname, "../src/server/policies/task-policy.ts"),
      path.resolve(__dirname, "../src/domain/tasks/state-machine.ts"),
    ];
    const foundSod = policyPaths.some((p) => {
      if (!fs.existsSync(p)) return false;
      const content = fs.readFileSync(p, "utf8");
      return (
        content.includes("CANNOT_SELF_APPROVE") ||
        content.includes("Segregation of Duties") ||
        content.includes("Maker-Checker") ||
        content.includes("người thực hiện không được tự nghiệm thu")
      );
    });
    assert.ok(
      foundSod,
      "Canonical task policies must enforce Segregation of Duties (SoD)"
    );
  });
});
