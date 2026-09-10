import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isTaskWaitingApproval,
  isActiveTaskStatus,
  isTaskOverdueOrHasOverdueSubtask,
  isTaskAssignedToUser,
  isTaskAssignedToUserOrUnit,
  computeSmartWorkboxCounts,
  computeWorkspaceTabCounts,
} from "@/lib/workspace-metrics-aggregator";
import type { SchoolTask } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";

describe("Workspace Metrics Aggregator (Unified Phase 5/6)", () => {
  const staffUser = {
    id: "user-staff-1",
    email: "staff@qcet.edu.vn",
    name: "Nguyễn Văn A",
    role: "STAFF",
    roleLabel: "Chuyên viên",
    departmentCode: "KTL",
    department: "Khoa Du lịch - Khách sạn",
  } as unknown as AuthUser;

  const sampleTasks = [
    {
      id: "task-1",
      code: "NV-01",
      title: "Soạn đề cương bài giảng",
      assignedTo: "Nguyễn Văn A",
      departmentCode: "KTL",
      department: "Khoa Du lịch - Khách sạn",
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueDate: "2026-10-15",
      progressPercent: 40,
    },
    {
      id: "task-2",
      code: "NV-02",
      title: "Báo cáo thực tập sinh viên",
      leadAssigneeName: "Nguyễn Văn A",
      departmentCode: "KTL",
      department: "Khoa Du lịch - Khách sạn",
      status: "WAITING_APPROVAL",
      priority: "NORMAL",
      dueDate: "2026-10-20",
      progressPercent: 100,
    },
    {
      id: "task-3",
      code: "NV-03",
      title: "Kế hoạch hội thảo khoa học",
      assignedTo: "Trần Thị B",
      departmentCode: "KTL",
      department: "Khoa Du lịch - Khách sạn",
      status: "IN_PROGRESS",
      priority: "URGENT",
      dueDate: "2026-09-01", // Overdue relative to 2026-09-10
      progressPercent: 10,
    },
    {
      id: "task-4",
      code: "NV-04",
      title: "Đề án nâng cấp phòng Lab",
      assignedTo: "Lê Văn C",
      departmentCode: "CNTT",
      department: "Khoa Công nghệ Thông tin",
      status: "COMPLETED",
      priority: "LOW",
      dueDate: "2026-08-30",
      progressPercent: 100,
    },
  ] as unknown as SchoolTask[];

  test("isTaskAssignedToUser matches correctly by name and ID", () => {
    assert.strictEqual(isTaskAssignedToUser(sampleTasks[0], staffUser), true);
    assert.strictEqual(isTaskAssignedToUser(sampleTasks[1], staffUser), true);
    assert.strictEqual(isTaskAssignedToUser(sampleTasks[2], staffUser), false);
    assert.strictEqual(isTaskAssignedToUser(sampleTasks[3], staffUser), false);
  });

  test("isTaskAssignedToUserOrUnit matches department code and name", () => {
    assert.strictEqual(isTaskAssignedToUserOrUnit(sampleTasks[0], staffUser), true);
    assert.strictEqual(isTaskAssignedToUserOrUnit(sampleTasks[1], staffUser), true);
    assert.strictEqual(isTaskAssignedToUserOrUnit(sampleTasks[2], staffUser), true); // Same dept
    assert.strictEqual(isTaskAssignedToUserOrUnit(sampleTasks[3], staffUser), false); // Other dept
  });

  test("computeSmartWorkboxCounts matches expectations for Staff", () => {
    const counts = computeSmartWorkboxCounts({
      tasks: sampleTasks,
      user: staffUser,
      roleScope: "my",
      referenceDate: "2026-09-10",
    });

    // 2 tasks assigned to user (task-1 active, task-2 waiting approval)
    assert.strictEqual(counts.myCount, 2);
    assert.strictEqual(counts.waitingApprovalCount, 1);
    assert.strictEqual(counts.pendingSubmissionCount, 1);
    assert.strictEqual(counts.overdueCount, 0);
  });

  test("computeSmartWorkboxCounts matches expectations for Unit scope", () => {
    const counts = computeSmartWorkboxCounts({
      tasks: sampleTasks,
      user: staffUser,
      roleScope: "unit",
      referenceDate: "2026-09-10",
    });

    // 3 tasks in KTL dept (excluding completed task-4)
    assert.strictEqual(counts.myCount, 3);
    assert.strictEqual(counts.waitingApprovalCount, 1);
    assert.strictEqual(counts.pendingSubmissionCount, 2);
    assert.strictEqual(counts.overdueCount, 1); // task-3 is overdue
  });

  test("computeWorkspaceTabCounts produces consistent tab counts", () => {
    const tabCounts = computeWorkspaceTabCounts({
      scopedTasks: sampleTasks,
      user: staffUser,
      referenceDate: "2026-09-10",
    });

    assert.strictEqual(tabCounts.all, 4);
    assert.strictEqual(tabCounts.my, 2);
    assert.strictEqual(tabCounts.waiting_approval, 1);
    assert.strictEqual(tabCounts.overdue, 1);
  });
});
