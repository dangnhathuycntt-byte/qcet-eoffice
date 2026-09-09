import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { SchoolTask, StaffTask, TaskStatus } from "../src/types/dashboard";
import type { AuthUser } from "../src/types/auth";
import {
  filterTasksByScope,
  applyOptimisticStatusChange,
  applyOptimisticCreateTask,
  TaskManagementWorkspace,
} from "../src/components/tasks/task-management-workspace";

describe("Unified Task Workspace Engine Consolidation (Task 2)", () => {
  const unifiedWorkspacePath = path.resolve(
    process.cwd(),
    "src/components/workspace/unified-adaptive-workspace.tsx"
  );
  const taskManagementWorkspacePath = path.resolve(
    process.cwd(),
    "src/components/tasks/task-management-workspace.tsx"
  );
  const cascadingShimPath = path.resolve(
    process.cwd(),
    "src/components/dashboard/cascading-task-table.tsx"
  );
  const tasksCascadingShimPath = path.resolve(
    process.cwd(),
    "src/components/tasks/cascading-task-table.tsx"
  );

  const sampleTasks: SchoolTask[] = [
    {
      id: "task-1",
      title: "Triển khai nền tảng E-Office",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: "ThS. Nguyễn Văn A",
      coAssignees: ["Trần Thị B"],
      leadDepartmentCode: "CNTT",
      department: "Trung tâm CNTT-TT",
      departmentCode: "CNTT",
      assignedDate: "2026-09-01",
      dueDate: "2026-09-30",
      status: "IN_PROGRESS",
      subTasks: [
        {
          id: "sub-1-1",
          title: "Thiết lập hạ tầng máy chủ",
          assigneeName: "Lê Văn C",
          departmentCode: "CNTT",
          department: "Trung tâm CNTT-TT",
          status: "IN_PROGRESS",
          dueDate: "2026-09-15",
          parentSchoolTaskId: "task-1",
          updatedAt: "2026-09-02",
        },
      ],
      totalSubTasks: 1,
      completedSubTasks: 0,
      progressPercent: 0,
    },
  ];

  test("TaskManagementWorkspace serves as forwarding facade to UnifiedAdaptiveWorkspace", () => {
    const tmwContent = fs.readFileSync(taskManagementWorkspacePath, "utf-8");

    assert.ok(
      tmwContent.includes("UnifiedAdaptiveWorkspace"),
      "TaskManagementWorkspace must mount UnifiedAdaptiveWorkspace"
    );
    assert.ok(
      typeof TaskManagementWorkspace === "function",
      "TaskManagementWorkspace must export a valid React component function"
    );
  });

  test("UnifiedAdaptiveWorkspace integrates both Table and Kanban engines", () => {
    const uawContent = fs.readFileSync(unifiedWorkspacePath, "utf-8");

    assert.ok(
      uawContent.includes("ModularCascadingTaskTable"),
      "UnifiedAdaptiveWorkspace must integrate ModularCascadingTaskTable"
    );
    assert.ok(
      uawContent.includes("TaskKanbanBoard"),
      "UnifiedAdaptiveWorkspace must integrate TaskKanbanBoard"
    );
    assert.ok(
      uawContent.includes("viewMode === \"table\""),
      "UnifiedAdaptiveWorkspace must conditionally render table view"
    );
    assert.ok(
      uawContent.includes("<TaskKanbanBoard"),
      "UnifiedAdaptiveWorkspace must conditionally render kanban view"
    );
  });

  test("Cascading task table files act as thin compatibility shims to ModularCascadingTaskTable", () => {
    const dashShim = fs.readFileSync(cascadingShimPath, "utf-8");
    const taskShim = fs.readFileSync(tasksCascadingShimPath, "utf-8");

    assert.ok(
      dashShim.includes("@/components/tasks/cascading-task-table"),
      "dashboard/cascading-task-table.tsx must re-export from tasks/cascading-task-table"
    );
    assert.ok(
      taskShim.includes("ModularCascadingTaskTable"),
      "tasks/cascading-task-table.tsx must render ModularCascadingTaskTable"
    );
  });

  test("Optimistic mutations maintain data integrity and recalculate rollups", () => {
    // 1. Status change on subtask
    const updatedTasks = applyOptimisticStatusChange(
      sampleTasks,
      "sub-1-1",
      "COMPLETED"
    );

    assert.strictEqual(
      updatedTasks[0].subTasks?.[0].status,
      "COMPLETED",
      "Subtask status should be updated to COMPLETED"
    );
    assert.strictEqual(
      updatedTasks[0].completedSubTasks,
      1,
      "Completed subtasks count must increment to 1"
    );
    assert.strictEqual(
      updatedTasks[0].progressPercent,
      100,
      "Progress percent must recalculate to 100%"
    );

    // 2. Add new subtask
    const tasksWithSub = applyOptimisticCreateTask(sampleTasks, {
      title: "Kiểm thử bảo mật",
      category: "CHUYEN_DOI_SO",
      leadAssigneeName: "Lê Văn C",
      coAssignees: [],
      description: "Kiểm tra bảo mật hệ thống",
      dueDate: "2026-09-25",
      level: "DON_VI",
      parentTaskId: "task-1",
    });

    assert.strictEqual(
      tasksWithSub[0].subTasks?.length,
      2,
      "New subtask should be appended to parent task"
    );
    assert.strictEqual(
      tasksWithSub[0].subTasks?.[0].title,
      "Kiểm thử bảo mật"
    );
  });

  test("Light-only and zero-emoji compliance in workspace files", () => {
    const files = [
      unifiedWorkspacePath,
      taskManagementWorkspacePath,
      cascadingShimPath,
      tasksCascadingShimPath,
    ];

    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      assert.strictEqual(
        content.includes("dark:"),
        false,
        `File ${path.basename(file)} must not contain dark: classes`
      );
      assert.strictEqual(
        emojiRegex.test(content),
        false,
        `File ${path.basename(file)} must contain 0 decorative emojis`
      );
    }
  });
});
