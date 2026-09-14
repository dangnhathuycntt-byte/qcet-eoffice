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
} from "../src/components/tasks/task-management-workspace";

describe("TaskManagementWorkspace Unit & Integration Suite", () => {
  const workspacePath = path.resolve(
    process.cwd(),
    "src/components/tasks/task-management-workspace.tsx"
  );
  const tasksPagePath = path.resolve(
    process.cwd(),
    "src/app/tasks/page.tsx"
  );
  const unitTasksPagePath = path.resolve(
    process.cwd(),
    "src/app/unit-tasks/page.tsx"
  );
  const tasksErrorPath = path.resolve(
    process.cwd(),
    "src/app/tasks/error.tsx"
  );
  const unitTasksErrorPath = path.resolve(
    process.cwd(),
    "src/app/unit-tasks/error.tsx"
  );

  const sampleTasks: SchoolTask[] = [
    {
      id: "task-school-1",
      title: "Triển khai hệ thống E-Office toàn trường",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: "ThS. Nguyễn Văn A",
      coAssignees: [],
      leadDepartmentCode: "CNTT",
      department: "Trung tâm CNTT-TT",
      departmentCode: "CNTT",
      assignedDate: "2026-09-01",
      dueDate: "2026-09-30",
      status: "IN_PROGRESS",
      subTasks: [
        {
          id: "sub-1-1",
          title: "Thiết lập máy chủ cơ sở dữ liệu",
          assigneeName: "Lê Văn B",
          departmentCode: "CNTT",
          department: "Trung tâm CNTT-TT",
          status: "NOT_STARTED",
          dueDate: "2026-09-10",
          parentSchoolTaskId: "task-school-1",
          updatedAt: "2026-09-02",
        },
        {
          id: "sub-1-2",
          title: "Soạn thảo văn bản hướng dẫn sử dụng",
          assigneeName: "Trần Thị C",
          departmentCode: "TCHC",
          department: "Phòng Tổ chức - Hành chính",
          status: "IN_PROGRESS",
          dueDate: "2026-09-15",
          parentSchoolTaskId: "task-school-1",
          updatedAt: "2026-09-03",
        },
      ],
      totalSubTasks: 2,
      completedSubTasks: 0,
      progressPercent: 0,
    },
    {
      id: "task-school-2",
      title: "Tổ chức tuần lễ sinh hoạt công dân đầu khóa",
      category: "TRUYEN_THONG",
      categoryLabel: "Truyền thông",
      leadAssigneeName: "ThS. Phạm Văn D",
      coAssignees: [],
      leadDepartmentCode: "CTSV",
      department: "Phòng Công tác sinh viên",
      departmentCode: "CTSV",
      assignedDate: "2026-09-01",
      dueDate: "2026-09-20",
      status: "IN_PROGRESS",
      subTasks: [
        {
          id: "sub-2-1",
          title: "Lập danh sách sinh viên tham dự",
          assigneeName: "Phạm Văn D",
          departmentCode: "CTSV",
          department: "Phòng Công tác sinh viên",
          status: "COMPLETED",
          dueDate: "2026-09-05",
          parentSchoolTaskId: "task-school-2",
          updatedAt: "2026-09-05",
        },
      ],
      totalSubTasks: 1,
      completedSubTasks: 1,
      progressPercent: 100,
    },
  ];

  test("filterTasksByScope: returns all tasks for school scope", () => {
    const user: AuthUser = {
      id: "u-cntt",
      name: "Nguyễn Văn A",
      email: "a@qcet.edu.vn",
      role: "MANAGER",
      roleLabel: "Trưởng phòng",
      department: "Trung tâm CNTT-TT",
      departmentCode: "CNTT",
    };

    const schoolResult = filterTasksByScope(sampleTasks, "school", user);
    assert.strictEqual(schoolResult.length, 2);
  });

  test("filterTasksByScope: filters tasks and subtasks for unit scope based on department", () => {
    const cnttUser: AuthUser = {
      id: "u-cntt",
      name: "Nguyễn Văn A",
      email: "a@qcet.edu.vn",
      role: "MANAGER",
      roleLabel: "Trưởng phòng",
      department: "Trung tâm CNTT-TT",
      departmentCode: "CNTT",
    };

    const unitResult = filterTasksByScope(sampleTasks, "unit", cnttUser);
    // Should include task-school-1 (matching CNTT)
    assert.strictEqual(unitResult.length, 1);
    assert.strictEqual(unitResult[0].id, "task-school-1");
    // Subtasks should be filtered or retained correctly
    const subIds = unitResult[0].subTasks?.map((s) => s.id) || [];
    assert.ok(subIds.includes("sub-1-1"));
  });

  test("applyOptimisticStatusChange: updates subtask status and recalculates rollup", () => {
    const updated = applyOptimisticStatusChange(
      sampleTasks,
      "sub-1-1",
      "COMPLETED"
    );
    const parent = updated.find((t) => t.id === "task-school-1");
    assert.ok(parent);
    const sub = parent?.subTasks?.find((s) => s.id === "sub-1-1");
    assert.strictEqual(sub?.status, "COMPLETED");
    // Rollup progress: 1 of 2 completed = 50%
    assert.strictEqual(parent?.completedSubTasks, 1);
    assert.strictEqual(parent?.progressPercent, 50);
  });

  test("applyOptimisticStatusChange: updates school task status directly", () => {
    const updated = applyOptimisticStatusChange(
      sampleTasks,
      "task-school-1",
      "COMPLETED"
    );
    const task = updated.find((t) => t.id === "task-school-1");
    assert.strictEqual(task?.status, "COMPLETED");
  });

  test("applyOptimisticCreateTask: appends new school task or adds subtask", () => {
    const newSchoolTask = applyOptimisticCreateTask(
      sampleTasks,
      {
        title: "Xây dựng cổng thông tin tuyển sinh",
        level: "TRUONG",
        category: "CNTT",
        leadAssigneeName: "Nguyễn Văn A",
        coAssignees: [],
        description: "Triển khai cổng tuyển sinh",
        dueDate: "2026-10-15",
      },
      "2026-09-09"
    );

    assert.strictEqual(newSchoolTask.length, 3);
    assert.strictEqual(
      newSchoolTask[0].title,
      "Xây dựng cổng thông tin tuyển sinh"
    );

    const newSubTaskResult = applyOptimisticCreateTask(
      sampleTasks,
      {
        title: "Tạo biểu mẫu đăng ký dự thi",
        level: "DON_VI",
        category: "CNTT",
        parentTaskId: "task-school-1",
        leadAssigneeName: "Lê Văn B",
        coAssignees: [],
        description: "Soạn thảo biểu mẫu điện tử",
        dueDate: "2026-09-12",
      },
      "2026-09-09"
    );

    const targetParent = newSubTaskResult.find(
      (t) => t.id === "task-school-1"
    );
    assert.strictEqual(targetParent?.subTasks?.length, 3);
    assert.strictEqual(
      targetParent?.subTasks?.[0].title,
      "Tạo biểu mẫu đăng ký dự thi"
    );
  });

  test("Anti-slop & Light-Only hygiene: zero dark: classes and zero decorative emojis", () => {
    const files = [
      workspacePath,
      tasksPagePath,
      unitTasksPagePath,
      tasksErrorPath,
      unitTasksErrorPath,
    ];

    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

    for (const file of files) {
      assert.ok(fs.existsSync(file), `File ${file} must exist`);
      const content = fs.readFileSync(file, "utf-8");

      assert.strictEqual(
        content.includes("dark:"),
        false,
        `File ${path.basename(file)} must have 0 dark: classes (Light-Only Standard)`
      );

      assert.strictEqual(
        emojiRegex.test(content),
        false,
        `File ${path.basename(file)} must contain 0 decorative emojis`
      );

      // Typography floor check: no text-[10px] or text-[9px] or text-[8px]
      assert.strictEqual(
        /text-\[(8|9|10|11)px\]/.test(content),
        false,
        `File ${path.basename(file)} must adhere to typography floor >= 12px`
      );
    }
  });

  test("TaskManagementWorkspace integrates required components and API endpoints", () => {
    const content = fs.readFileSync(workspacePath, "utf-8");

    // Integrates both views
    assert.ok(
      content.includes("ModularCascadingTaskTable"),
      "Must import ModularCascadingTaskTable"
    );
    assert.ok(
      content.includes("TaskKanbanBoard"),
      "Must import TaskKanbanBoard"
    );

    // Integrates modals
    assert.ok(
      content.includes("CreateTaskModal"),
      "Must import CreateTaskModal"
    );
    assert.ok(
      content.includes("TaskDetailSideSheet"),
      "Must import TaskDetailSideSheet"
    );

    // Live API endpoints wired
    assert.ok(
      content.includes("PATCH") && content.includes("/api/tasks/"),
      "Must call PATCH /api/tasks/${taskId} for status mutations"
    );
    assert.ok(
      content.includes("POST") && content.includes("/api/tasks"),
      "Must call POST /api/tasks for task creation"
    );
    assert.ok(
      content.includes("/api/dashboard/overview"),
      "Must call /api/dashboard/overview for data fetching/refresh"
    );
    assert.ok(
      content.includes("/api/notifications/push/test"),
      "Must call urge notification endpoint"
    );

    // Optimistic state rollback
    assert.ok(
      content.includes("previousData"),
      "Must capture previousData snapshot for rollback on error"
    );
  });

  test("TasksPage and UnitTasksPage deduplicate into TaskManagementWorkspace", () => {
    const tasksContent = fs.readFileSync(tasksPagePath, "utf-8");
    const unitTasksContent = fs.readFileSync(unitTasksPagePath, "utf-8");

    assert.ok(
      tasksContent.includes('<TaskManagementWorkspace scope="school"'),
      "TasksPage must mount TaskManagementWorkspace with scope='school'"
    );
    assert.ok(
      (unitTasksContent.includes('permanentRedirect') || unitTasksContent.includes('redirect')) &&
        unitTasksContent.includes('/tasks') &&
        unitTasksContent.includes('scope'),
      "UnitTasksPage must canonically redirect to /tasks with scope=unit"
    );

    // Both pages should be concise (< 30 lines)
    const tasksLineCount = tasksContent.split("\n").length;
    const unitTasksLineCount = unitTasksContent.split("\n").length;

    assert.ok(
      tasksLineCount < 30,
      `TasksPage should be concise, but has ${tasksLineCount} lines`
    );
    assert.ok(
      unitTasksLineCount < 30,
      `UnitTasksPage should be concise, but has ${unitTasksLineCount} lines`
    );
  });

  test("Error boundaries exist and provide retry button", () => {
    const tasksErrorContent = fs.readFileSync(tasksErrorPath, "utf-8");
    const unitTasksErrorContent = fs.readFileSync(unitTasksErrorPath, "utf-8");

    assert.ok(
      tasksErrorContent.includes("use client"),
      "tasks/error.tsx must be a client component"
    );
    assert.ok(
      tasksErrorContent.includes("reset"),
      "tasks/error.tsx must provide reset callback"
    );

    assert.ok(
      unitTasksErrorContent.includes("use client"),
      "unit-tasks/error.tsx must be a client component"
    );
    assert.ok(
      unitTasksErrorContent.includes("reset"),
      "unit-tasks/error.tsx must provide reset callback"
    );
  });

  test("P0-05: Task load failure must not become empty task data: error != empty", () => {
    const source = fs.readFileSync(tasksPagePath, "utf8");

    const swallowsIntoEmptyTasks =
      /\.catch\(\s*\(\s*\)\s*=>\s*\(\s*\{\s*tasks:\s*\[\]\s*\}\s*\)\s*\)/.test(
        source
      );

    assert.equal(
      swallowsIntoEmptyTasks,
      false,
      "a failed task read must not resolve to { tasks: [] } — error is not empty"
    );

    const boundary = fs.readFileSync(tasksErrorPath, "utf8");
    assert.ok(
      boundary.includes('role="alert"'),
      "the error boundary must announce itself to assistive technology"
    );
    assert.ok(
      boundary.includes("reset"),
      "the error boundary must offer a retry affordance"
    );
  });
});
