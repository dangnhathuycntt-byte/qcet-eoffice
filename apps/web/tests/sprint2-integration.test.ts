import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  computeSchoolTaskRollup,
} from "../src/lib/dashboard-aggregator";
import type { SchoolTask, StaffTask } from "@qcet/contracts/types/dashboard";

describe("Sprint 2 Integration & Navigation", () => {

  test("Route files exist in app router directory", () => {
    const rootDir = path.resolve(__dirname, "../src/app");
    const requiredFiles = [
      "page.tsx",
      "tasks/page.tsx",
      "meetings/page.tsx",
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

  test("next.config.ts configures backwards-compatible redirects for legacy routes", async () => {
    const { default: nextConfig } = await import("../next.config");
    assert.ok(typeof nextConfig.redirects === "function", "redirects function exists");
    const redirects = await nextConfig.redirects();
    const dashboardRedirect = redirects.find((r: any) => r.source === "/dashboard");
    assert.ok(dashboardRedirect, "Must redirect /dashboard");
    assert.strictEqual(dashboardRedirect.permanent, true);

    const unitTasksRedirect = redirects.find((r: any) => r.source === "/unit-tasks");
    assert.ok(unitTasksRedirect, "Must redirect /unit-tasks");
    assert.strictEqual(unitTasksRedirect.destination, "/tasks?scope=unit");
    assert.strictEqual(unitTasksRedirect.permanent, true);
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
