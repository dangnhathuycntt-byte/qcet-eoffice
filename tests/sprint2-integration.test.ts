import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NAV_ITEMS } from "../src/lib/tokens";
import { NAVIGATION_ITEMS } from "../src/components/navigation";
import {
  getInitialTaskFormData,
  validateTaskForm,
  CreateTaskFormData,
} from "../src/components/dashboard/create-task-modal";
import {
  computeSchoolTaskRollup,
  computeDashboardStats,
} from "../src/lib/dashboard-aggregator";
import { getMockDashboardPayload } from "../src/lib/mock-dashboard-data";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";

describe("Sprint 2 Integration & Navigation", () => {
  test("NAV_ITEMS routes match all implemented pages", () => {
    const paths = NAV_ITEMS.map((item) => item.href);
    assert.ok(paths.includes("/"), "contains root dashboard route");
    assert.ok(paths.includes("/tasks"), "contains tasks route");
    assert.ok(paths.includes("/calendar"), "contains calendar route");
    assert.ok(paths.includes("/org"), "contains org hierarchy route");
  });

  test("NAVIGATION_ITEMS and NAV_ITEMS stay synchronized", () => {
    const tokenRoutes = NAV_ITEMS.map((item) => item.href);
    const compRoutes = NAVIGATION_ITEMS.map((item) => item.href);
    assert.deepEqual(
      tokenRoutes,
      compRoutes,
      "token routes and component routes must match exactly"
    );

    const labels = NAVIGATION_ITEMS.map((item) => item.label);
    assert.ok(labels.includes("Quản lý công việc") || labels.includes("Dashboard"));
    assert.ok(labels.includes("Nhiệm vụ cấp Trường"));
    assert.ok(labels.includes("Lịch công tác"));
    assert.ok(labels.includes("Cơ cấu tổ chức"));
  });

  test("Route files exist in app router directory", () => {
    const rootDir = path.resolve(__dirname, "../src/app");
    const requiredFiles = [
      "page.tsx",
      "tasks/page.tsx",
      "calendar/page.tsx",
      "org/page.tsx",
    ];

    for (const file of requiredFiles) {
      const fullPath = path.join(rootDir, file);
      assert.ok(
        fs.existsSync(fullPath),
        `Route file ${file} must exist in src/app`
      );
    }
  });

  test("Task creation integration: new SchoolTask updates dashboard stats and rollup", () => {
    const payload = getMockDashboardPayload();
    const initialSchoolCount = payload.stats.totalSchoolTasks;

    const newFormData: CreateTaskFormData = {
      level: "TRUONG",
      category: "CHUYEN_DOI_SO",
      title: "Triển khai hệ thống chữ ký số tập trung QCET 2026",
      leadAssigneeName: "TS. Nguyễn Văn A",
      coAssignees: ["ThS. Trần B"],
      dueDate: "2026-10-30",
      description: "Tích hợp ký số cho toàn thể cán bộ giảng viên",
    };

    const errors = validateTaskForm(newFormData);
    assert.equal(Object.keys(errors).length, 0, "Valid form has no errors");

    const newTask: SchoolTask = {
      id: `task-integration-${Date.now()}`,
      title: newFormData.title,
      category: newFormData.category,
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: newFormData.leadAssigneeName,
      coAssignees: newFormData.coAssignees,
      assignedDate: "2026-09-04",
      dueDate: newFormData.dueDate,
      status: "IN_PROGRESS",
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 0,
    };

    const updatedTasks = [newTask, ...payload.tasks];
    const rolledUpTasks = updatedTasks.map((t) => computeSchoolTaskRollup(t));
    const newStats = computeDashboardStats(rolledUpTasks);

    assert.equal(
      newStats.totalSchoolTasks,
      initialSchoolCount + 1,
      "Total school tasks count increments by 1"
    );
    assert.equal(rolledUpTasks[0].id, newTask.id);
    assert.equal(rolledUpTasks[0].progressPercent, 0);
  });

  test("Task creation integration: new StaffTask links to SchoolTask and recalibrates progress", () => {
    const parentTask: SchoolTask = {
      id: "parent-test-1",
      title: "Nhiệm vụ cấp Trường thử nghiệm",
      category: "CNTT",
      categoryLabel: "CNTT",
      leadAssigneeName: "TS. Trần Hùng",
      coAssignees: [],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-30",
      status: "IN_PROGRESS",
      subTasks: [
        {
          id: "sub-1",
          title: "Công việc 1 đã hoàn thành",
          assigneeName: "Nguyễn Văn C",
          status: "COMPLETED",
          dueDate: "2026-09-10",
          parentSchoolTaskId: "parent-test-1",
          updatedAt: "2026-09-04",
        },
      ],
      totalSubTasks: 1,
      completedSubTasks: 1,
      progressPercent: 100,
    };

    // Initially 1/1 = 100%
    const initialRollup = computeSchoolTaskRollup(parentTask);
    assert.equal(initialRollup.progressPercent, 100);

    // Add a new subtask that is in progress
    const newSubTask: StaffTask = {
      id: "sub-2",
      title: "Công việc 2 mới khởi tạo",
      assigneeName: "Lê Văn D",
      status: "IN_PROGRESS",
      dueDate: "2026-09-25",
      parentSchoolTaskId: "parent-test-1",
      updatedAt: "2026-09-04",
    };

    const updatedParent: SchoolTask = {
      ...parentTask,
      subTasks: [...parentTask.subTasks, newSubTask],
    };

    const recalculated = computeSchoolTaskRollup(updatedParent);
    assert.equal(recalculated.totalSubTasks, 2);
    assert.equal(recalculated.completedSubTasks, 1);
    assert.equal(recalculated.progressPercent, 50);
  });
});
