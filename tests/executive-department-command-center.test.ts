import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import { computeExecutiveDepartmentSummaries } from "@/lib/tasks/executive-department-aggregator";
import {
  filterExecutiveDepartmentSummaries,
  getTriageFilterCounts,
  getRAGBadgeConfig,
  getPriorityBadgeConfig,
  getTaskStatusConfig,
  splitDepartmentTasks,
} from "@/components/tasks/executive-department-command-center";
import {
  VIEW_MODE_OPTIONS,
  type TaskViewMode,
} from "@/components/dashboard/unified-task-toolbar";
import {
  getDefaultViewModeForRole,
  parseViewModeParam,
} from "@/lib/unified-task-hub";

function createMockSchoolTask(
  overrides: Partial<SchoolTask> & { id: string; [key: string]: unknown }
): SchoolTask {
  return {
    title: `Nhiệm vụ kiểm thử ${overrides.id}`,
    category: "CNTT",
    categoryLabel: "Công nghệ thông tin",
    leadAssigneeName: "TS. Trần Văn Nam",
    leadDepartmentId: "KHOA_CNTT",
    leadDepartmentCode: "KHOA_CNTT",
    coAssignees: [],
    assignedDate: "2026-08-15",
    dueDate: "2026-09-15",
    status: "IN_PROGRESS",
    subTasks: [],
    totalSubTasks: 0,
    completedSubTasks: 0,
    progressPercent: 65,
    ...overrides,
  };
}

function createMockStaffTask(overrides: Partial<StaffTask> & { id: string }): StaffTask {
  return {
    title: `Công việc nội bộ ${overrides.id}`,
    assigneeName: "Nguyễn Văn A",
    status: "IN_PROGRESS",
    dueDate: "2026-09-12",
    parentSchoolTaskId: "task-parent-1",
    updatedAt: "2026-09-01",
    ...overrides,
  };
}

describe("Executive Department Command Center Component Helpers", () => {
  test("getRAGBadgeConfig returns calibrated QCET tokens for RED, AMBER, GREEN", () => {
    // RED: alert, rose palette, pulsing indicator
    const redConfig = getRAGBadgeConfig("RED");
    assert.equal(redConfig.label, "Báo động trễ");
    assert.ok(redConfig.className.includes("bg-rose-50"));
    assert.ok(redConfig.className.includes("text-rose-700"));
    assert.ok(redConfig.className.includes("border-rose-200"));
    assert.equal(redConfig.dotColor, "bg-rose-500");
    assert.strictEqual(redConfig.pulse, true, "RED alert must have pulsing dot");

    // AMBER: warning, amber palette, non-pulsing
    const amberConfig = getRAGBadgeConfig("AMBER");
    assert.equal(amberConfig.label, "Cần chú ý");
    assert.ok(amberConfig.className.includes("bg-amber-50"));
    assert.ok(amberConfig.className.includes("text-amber-700"));
    assert.ok(amberConfig.className.includes("border-amber-200"));
    assert.equal(amberConfig.dotColor, "bg-amber-500");
    assert.strictEqual(amberConfig.pulse, false);

    // GREEN: healthy, emerald palette, non-pulsing
    const greenConfig = getRAGBadgeConfig("GREEN");
    assert.equal(greenConfig.label, "Đúng hạn");
    assert.ok(greenConfig.className.includes("bg-emerald-50"));
    assert.ok(greenConfig.className.includes("text-emerald-700"));
    assert.ok(greenConfig.className.includes("border-emerald-200"));
    assert.equal(greenConfig.dotColor, "bg-emerald-500");
    assert.strictEqual(greenConfig.pulse, false);
  });

  test("getPriorityBadgeConfig chuyển đổi độ ưu tiên đúng nhãn tiếng Việt", () => {
    const high = getPriorityBadgeConfig("HIGH");
    assert.equal(high.label, "Ưu tiên cao");
    assert.ok(high.className.includes("bg-rose-50"));
    assert.ok(high.className.includes("text-rose-700"));

    const medium = getPriorityBadgeConfig("MEDIUM");
    assert.equal(medium.label, "Trung bình");
    assert.ok(medium.className.includes("bg-amber-50"));
    assert.ok(medium.className.includes("text-amber-700"));

    const low = getPriorityBadgeConfig("LOW");
    assert.equal(low.label, "Tiêu chuẩn");
    assert.ok(low.className.includes("bg-slate-50"));
  });

  test("getTaskStatusConfig maps statuses to QCET semantic labels", () => {
    const completed = getTaskStatusConfig("COMPLETED");
    assert.equal(completed.label, "Hoàn thành");
    assert.ok(completed.className.includes("emerald"));

    const inProgress = getTaskStatusConfig("IN_PROGRESS");
    assert.equal(inProgress.label, "Đang thực hiện");
    assert.ok(inProgress.className.includes("blue"));

    const pending = getTaskStatusConfig("PENDING_EXECUTIVE_APPROVAL");
    assert.equal(pending.label, "Chờ BGH duyệt");
    assert.ok(pending.className.includes("purple"));

    const blocked = getTaskStatusConfig("BLOCKED");
    assert.equal(blocked.label, "Bị nghẽn");
    assert.ok(blocked.className.includes("rose"));
  });

  test("Quick Triage Tabs drive getTriageFilterCounts and filterExecutiveDepartmentSummaries", () => {
    const taskOverdue = createMockSchoolTask({
      id: "bottleneck-task",
      leadDepartmentId: "KHOA_XD",
      dueDate: "2026-08-20",
      status: "IN_PROGRESS",
    });

    const taskPendingApproval = createMockSchoolTask({
      id: "approval-task",
      leadDepartmentId: "PHONG_HCQT",
      dueDate: "2026-09-20",
      status: "PENDING_EXECUTIVE_APPROVAL",
      progressPercent: 100,
    });

    const taskNormal = createMockSchoolTask({
      id: "normal-task",
      leadDepartmentId: "TT_TTTV",
      dueDate: "2026-09-25",
      status: "IN_PROGRESS",
      progressPercent: 80,
    });

    const summaries = computeExecutiveDepartmentSummaries([
      taskOverdue,
      taskPendingApproval,
      taskNormal,
    ]);

    // 1. Check getTriageFilterCounts
    const counts = getTriageFilterCounts(summaries);
    assert.equal(counts.all, 12, "All tab must show all 12 departments");
    assert.ok(counts.bottlenecks >= 1, "Must detect at least 1 bottleneck department");
    assert.ok(counts.pendingApproval >= 1, "Must detect at least 1 pending approval department");

    // 2. Check filterExecutiveDepartmentSummaries("ALL")
    const allFiltered = filterExecutiveDepartmentSummaries(summaries, "ALL");
    assert.equal(allFiltered.length, 12);

    // 3. Check filterExecutiveDepartmentSummaries("BOTTLENECKS")
    const bottleneckFiltered = filterExecutiveDepartmentSummaries(summaries, "BOTTLENECKS");
    assert.ok(
      bottleneckFiltered.every((s) => s.ragStatus === "RED" || s.metrics.overdue > 0),
      "Every department in bottlenecks filter must have RED status or overdue tasks"
    );
    assert.ok(
      bottleneckFiltered.some((s) => s.departmentId === "KHOA_XD"),
      "KHOA_XD must be caught in bottlenecks triage tab"
    );

    // 4. Check filterExecutiveDepartmentSummaries("PENDING_APPROVAL")
    const pendingFiltered = filterExecutiveDepartmentSummaries(summaries, "PENDING_APPROVAL");
    assert.ok(
      pendingFiltered.every((s) => s.pendingApprovalCount > 0),
      "Every department in pending approval filter must have pendingApprovalCount > 0"
    );
    assert.ok(
      pendingFiltered.some((s) => s.departmentId === "PHONG_HCQT"),
      "PHONG_HCQT must be caught in pending approval triage tab"
    );
  });

  test("splitDepartmentTasks separates School-level tasks from Unit-level tasks and subtasks", () => {
    const mockSchoolTask1 = createMockSchoolTask({
      id: "school-task-1",
      title: "Triển khai kiểm định chất lượng cấp trường",
      leadDepartmentId: "KHOA_CNTT",
      subTasks: [
        createMockStaffTask({
          id: "sub-internal-1",
          title: "Thu thập hồ sơ minh chứng tiêu chí 1",
          assigneeName: "Nguyễn Văn A",
        }),
        createMockStaffTask({
          id: "sub-internal-2",
          title: "Rà soát đề cương môn học",
          assigneeName: "Lê Văn B",
        }),
      ],
    });

    const mockUnitTask = createMockSchoolTask({
      id: "unit-task-only",
      title: "Họp chuyên môn tổ bộ môn Phần mềm",
      leadDepartmentId: "KHOA_CNTT",
      scope: "UNIT" as unknown as undefined,
    });

    const { schoolTasks, unitTasks } = splitDepartmentTasks([mockSchoolTask1, mockUnitTask]);

    // School tasks should include the school-level task
    assert.ok(schoolTasks.some((t) => t.id === "school-task-1"));
    assert.ok(!schoolTasks.some((t) => t.id === "unit-task-only"));

    // Unit tasks should include the unit-scoped task AND the subtasks
    assert.ok(unitTasks.some((t) => t.id === "unit-task-only"));
    assert.ok(unitTasks.some((t) => t.id === "sub-internal-1"));
    assert.ok(unitTasks.some((t) => t.id === "sub-internal-2"));
    assert.equal(unitTasks.length, 3);
  });
});

describe("Executive Department View Mode Integration", () => {
  test("TaskViewMode supports 'executive' mode", () => {
    const executiveMode: TaskViewMode = "executive";
    assert.equal(executiveMode, "executive");

    const execOption = VIEW_MODE_OPTIONS.find((opt) => opt.id === "executive");
    assert.ok(execOption, "VIEW_MODE_OPTIONS must include 'executive'");
    assert.equal(execOption.label, "Chỉ huy BGH");
  });

  test("getDefaultViewModeForRole gives executive view for ADMIN and table for others", () => {
    assert.equal(getDefaultViewModeForRole("ADMIN"), "executive");
    assert.equal(getDefaultViewModeForRole("MANAGER"), "table");
    assert.equal(getDefaultViewModeForRole("STAFF"), "table");
    assert.equal(getDefaultViewModeForRole(undefined), "table");
  });

  test("parseViewModeParam correctly recognizes executive query aliases", () => {
    assert.equal(parseViewModeParam("executive"), "executive");
    assert.equal(parseViewModeParam("chi-huy"), "executive");
    assert.equal(parseViewModeParam("bgh"), "executive");
    assert.equal(parseViewModeParam("command"), "executive");
  });
});
