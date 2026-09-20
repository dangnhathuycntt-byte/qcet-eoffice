import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SearchParamsContext, PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import {
  UnifiedAdaptiveWorkspace,
  filterDisplayedTasks,
  isTaskOverdueOrHasOverdueSubtask,
  isTaskWaitingApproval,
} from "../src/components/workspace/unified-adaptive-workspace";
import { getSystemReferenceDate } from "../src/lib/academic-calendar";
import type { SchoolTask } from "../src/types/dashboard";
import type { AuthUser } from "../src/types/auth";

const mockRouter = {
  push: () => {},
  replace: () => {},
  prefetch: () => {},
  back: () => {},
  forward: () => {},
  refresh: () => {},
};

function renderWorkspace(element: React.ReactElement): string {
  return renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: mockRouter },
      React.createElement(
        PathnameContext.Provider,
        { value: "/" },
        React.createElement(
          SearchParamsContext.Provider,
          { value: new URLSearchParams() },
          element
        )
      )
    )
  );
}

describe("Canonical Filter Engine & Workbox/Overdue Consistency", () => {
  const testUser: AuthUser = {
    id: "user-test-vinh",
    name: "KS. Nguyễn Ngọc Vinh",
    email: "vinh.nn@qcet.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên QTM",
    department: "Phòng Quản trị mạng",
    departmentCode: "QTM",
  };

  const otherUser: AuthUser = {
    id: "user-test-other",
    name: "TS. Lê Hoàng",
    email: "hoang.le@qcet.edu.vn",
    role: "MANAGER",
    roleLabel: "Trưởng phòng Đào tạo",
    department: "Phòng Đào tạo",
    departmentCode: "ĐT",
  };

  const refDate = "2026-09-09"; // Canonical reference date for mock test suite

  // Sample tasks fixture covering all conditions
  const mockTasks: SchoolTask[] = [
    // Task 1: Overdue active task assigned to user
    {
      id: "task-overdue-user",
      code: "NV-001",
      title: "Cập nhật hạ tầng mạng Core Switch",
      department: "Phòng Quản trị mạng",
      departmentCode: "QTM",
      assignedTo: "KS. Nguyễn Ngọc Vinh",
      leadAssigneeId: "user-test-vinh",
      leadAssigneeName: "KS. Nguyễn Ngọc Vinh",
      dueDate: "2026-09-01", // Before refDate (overdue)
      status: "IN_PROGRESS",
      priority: "HIGH",
      category: "CNTT",
      categoryLabel: "CNTT",
      progressPercent: 40,
      totalSubTasks: 0,
      completedSubTasks: 0,
      coAssignees: [],
      assignedDate: "2026-09-01",
      subTasks: [],
    },
    // Task 2: Overdue task but COMPLETED (must be excluded from overdue)
    {
      id: "task-overdue-completed",
      code: "NV-002",
      title: "Bảo trì định kỳ máy chủ email",
      department: "Phòng Quản trị mạng",
      departmentCode: "QTM",
      assignedTo: "KS. Nguyễn Ngọc Vinh",
      leadAssigneeId: "user-test-vinh",
      leadAssigneeName: "KS. Nguyễn Ngọc Vinh",
      dueDate: "2026-09-01", // Before refDate
      status: "COMPLETED",
      priority: "NORMAL",
      category: "CNTT",
      categoryLabel: "CNTT",
      progressPercent: 100,
      totalSubTasks: 0,
      completedSubTasks: 0,
      coAssignees: [],
      assignedDate: "2026-09-01",
      subTasks: [],
    },
    // Task 3: Future due date, but has an UNCOMPLETED OVERDUE SUBTASK
    {
      id: "task-parent-future-subtask-overdue",
      code: "NV-003",
      title: "Triển khai hệ thống xác thực tập trung SSO",
      department: "Phòng Quản trị mạng",
      departmentCode: "QTM",
      assignedTo: "KS. Nguyễn Ngọc Vinh",
      leadAssigneeId: "user-test-vinh",
      leadAssigneeName: "KS. Nguyễn Ngọc Vinh",
      dueDate: "2026-09-25", // Future parent due date
      status: "IN_PROGRESS",
      priority: "HIGH",
      category: "ATTT",
      categoryLabel: "ATTT",
      progressPercent: 30,
      totalSubTasks: 1,
      completedSubTasks: 0,
      coAssignees: [],
      assignedDate: "2026-09-01",
      subTasks: [
        {
          id: "subtask-overdue-1",
          title: "Cấu hình Radius Server",
          status: "IN_PROGRESS",
          dueDate: "2026-09-02", // Overdue subtask!
          assignedTo: "KS. Nguyễn Ngọc Vinh",
          assigneeName: "KS. Nguyễn Ngọc Vinh",
          assigneeId: "user-test-vinh",
          updatedAt: "2026-09-02",
        },
      ],
    },
    // Task 4: Parent completed, subtask overdue (parent is COMPLETED, so must be excluded)
    {
      id: "task-parent-completed-subtask-overdue",
      code: "NV-004",
      title: "Hoàn tất bàn giao thiết bị phòng LAB",
      department: "Phòng Quản trị mạng",
      departmentCode: "QTM",
      assignedTo: "KS. Nguyễn Ngọc Vinh",
      leadAssigneeName: "KS. Nguyễn Ngọc Vinh",
      dueDate: "2026-09-25",
      status: "COMPLETED",
      priority: "LOW",
      category: "CNTT",
      categoryLabel: "CNTT",
      progressPercent: 100,
      totalSubTasks: 1,
      completedSubTasks: 0,
      coAssignees: [],
      assignedDate: "2026-09-01",
      subTasks: [
        {
          id: "subtask-overdue-2",
          title: "Kiểm kê serial thiết bị",
          status: "IN_PROGRESS",
          dueDate: "2026-09-01",
          assigneeName: "KS. Nguyễn Ngọc Vinh",
          updatedAt: "2026-09-01",
        },
      ],
    },
    // Task 5: Task in WAITING_APPROVAL status
    {
      id: "task-approval-parent",
      code: "NV-005",
      title: "Đề xuất mua sắm thiết bị tường lửa thế hệ mới",
      department: "Phòng Quản trị mạng",
      departmentCode: "QTM",
      assignedTo: "KS. Nguyễn Ngọc Vinh",
      leadAssigneeName: "KS. Nguyễn Ngọc Vinh",
      dueDate: "2026-09-20",
      status: "WAITING_APPROVAL",
      priority: "URGENT",
      category: "CNTT",
      categoryLabel: "CNTT",
      progressPercent: 90,
      totalSubTasks: 0,
      completedSubTasks: 0,
      coAssignees: [],
      assignedDate: "2026-09-01",
      subTasks: [],
    },
    // Task 6: Task in IN_PROGRESS, but has subtask in WAITING_APPROVAL
    {
      id: "task-approval-subtask",
      code: "NV-006",
      title: "Nâng cấp cổng thông tin đào tạo",
      department: "Phòng Đào tạo",
      departmentCode: "ĐT",
      assignedTo: "TS. Lê Hoàng",
      leadAssigneeName: "TS. Lê Hoàng",
      dueDate: "2026-09-20",
      status: "IN_PROGRESS",
      priority: "NORMAL",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      progressPercent: 60,
      totalSubTasks: 1,
      completedSubTasks: 0,
      coAssignees: [],
      assignedDate: "2026-09-01",
      subTasks: [
        {
          id: "subtask-approval-1",
          title: "Duyệt đề cương môn học mới",
          status: "WAITING_APPROVAL",
          dueDate: "2026-09-15",
          assignedTo: "TS. Lê Hoàng",
          assigneeName: "TS. Lê Hoàng",
          updatedAt: "2026-09-15",
        },
      ],
    },
    // Task 7: Regular active task assigned to OTHER user with NO subtasks for testUser
    {
      id: "task-other-user",
      code: "NV-007",
      title: "Tổ chức hội đồng thi tốt nghiệp",
      department: "Phòng Đào tạo",
      departmentCode: "ĐT",
      assignedTo: "TS. Lê Hoàng",
      leadAssigneeId: "user-test-other",
      leadAssigneeName: "TS. Lê Hoàng",
      dueDate: "2026-09-28",
      status: "IN_PROGRESS",
      priority: "HIGH",
      category: "BAO_CAO",
      categoryLabel: "Báo cáo",
      progressPercent: 50,
      totalSubTasks: 0,
      completedSubTasks: 0,
      coAssignees: [],
      assignedDate: "2026-09-01",
      subTasks: [],
    },
    // Task 8: Task assigned to other user, but has a subtask assigned to testUser
    {
      id: "task-other-parent-user-subtask",
      code: "NV-008",
      title: "Kiểm định chất lượng chương trình đào tạo",
      department: "Phòng Đào tạo",
      departmentCode: "ĐT",
      assignedTo: "TS. Lê Hoàng",
      leadAssigneeId: "user-test-other",
      leadAssigneeName: "TS. Lê Hoàng",
      dueDate: "2026-09-30",
      status: "IN_PROGRESS",
      priority: "HIGH",
      category: "BAO_CAO",
      categoryLabel: "Báo cáo",
      progressPercent: 20,
      totalSubTasks: 1,
      completedSubTasks: 0,
      coAssignees: [],
      assignedDate: "2026-09-01",
      subTasks: [
        {
          id: "subtask-user-assigned",
          title: "Hỗ trợ kỹ thuật phần mềm kiểm định",
          status: "IN_PROGRESS",
          dueDate: "2026-09-25",
          assignedTo: "KS. Nguyễn Ngọc Vinh",
          assigneeName: "KS. Nguyễn Ngọc Vinh",
          assigneeId: "user-test-vinh",
          updatedAt: "2026-09-01",
        },
      ],
    },
  ];

  describe("Requirement 2b & 4: Overdue filter with isTaskPastDue and subtask propagation", () => {
    test("isTaskOverdueOrHasOverdueSubtask identifies overdue parent tasks", () => {
      const task1 = mockTasks.find((t) => t.id === "task-overdue-user")!;
      assert.equal(isTaskOverdueOrHasOverdueSubtask(task1, refDate), true);
    });

    test("isTaskOverdueOrHasOverdueSubtask excludes completed parent tasks even if dueDate is past", () => {
      const task2 = mockTasks.find((t) => t.id === "task-overdue-completed")!;
      assert.equal(isTaskOverdueOrHasOverdueSubtask(task2, refDate), false);
    });

    test("isTaskOverdueOrHasOverdueSubtask identifies uncompleted subtask overdue when parent is not completed", () => {
      const task3 = mockTasks.find((t) => t.id === "task-parent-future-subtask-overdue")!;
      assert.equal(isTaskOverdueOrHasOverdueSubtask(task3, refDate), true);
    });

    test("isTaskOverdueOrHasOverdueSubtask excludes parent if parent is completed, even if subtask had past dueDate", () => {
      const task4 = mockTasks.find((t) => t.id === "task-parent-completed-subtask-overdue")!;
      assert.equal(isTaskOverdueOrHasOverdueSubtask(task4, refDate), false);
    });

    test("When currentOverdue = true, only overdue tasks are included and completed tasks are excluded", () => {
      const filtered = filterDisplayedTasks({
        tasks: mockTasks,
        overdue: true,
        user: testUser,
        referenceDate: refDate,
      });

      const filteredIds = filtered.map((t) => t.id);
      // Expected included: task-overdue-user and task-parent-future-subtask-overdue
      assert.ok(filteredIds.includes("task-overdue-user"), "Overdue parent task must be included");
      assert.ok(
        filteredIds.includes("task-parent-future-subtask-overdue"),
        "Task with overdue subtask must be included"
      );

      // Expected excluded:
      assert.ok(
        !filteredIds.includes("task-overdue-completed"),
        "Completed task must be excluded even if dueDate is past"
      );
      assert.ok(
        !filteredIds.includes("task-parent-completed-subtask-overdue"),
        "Completed task with subtask must be excluded"
      );
      assert.ok(
        !filteredIds.includes("task-approval-parent"),
        "Non-overdue approval task must be excluded"
      );
      assert.ok(
        !filteredIds.includes("task-other-user"),
        "Non-overdue other user task must be excluded"
      );

      assert.equal(filtered.length, 2, "Only exactly 2 overdue tasks should match");
    });
  });

  describe("Requirement 3 & 5: Workbox filtering", () => {
    test("When currentWorkbox = 'my_pending_approval', tasks without approval status are excluded", () => {
      const filtered = filterDisplayedTasks({
        tasks: mockTasks,
        workbox: "my_pending_approval",
        user: testUser,
      });

      const filteredIds = filtered.map((t) => t.id);

      // Must include task with parent WAITING_APPROVAL
      assert.ok(
        filteredIds.includes("task-approval-parent"),
        "Task with status WAITING_APPROVAL must be included"
      );
      // Must include task with subtask WAITING_APPROVAL
      assert.ok(
        filteredIds.includes("task-approval-subtask"),
        "Task with subtask in WAITING_APPROVAL must be included"
      );

      // Tasks without approval status must be excluded
      assert.ok(!filteredIds.includes("task-overdue-user"), "IN_PROGRESS task must be excluded");
      assert.ok(!filteredIds.includes("task-overdue-completed"), "COMPLETED task must be excluded");
      assert.ok(!filteredIds.includes("task-other-user"), "Standard active task must be excluded");
      assert.ok(
        !filteredIds.includes("task-parent-future-subtask-overdue"),
        "Standard task must be excluded"
      );

      assert.equal(filtered.length, 2, "Only exactly 2 approval tasks should match");
    });

    test("When currentWorkbox = 'review', behaves identically to 'my_pending_approval'", () => {
      const filtered = filterDisplayedTasks({
        tasks: mockTasks,
        workbox: "review",
        user: testUser,
      });

      const filteredIds = filtered.map((t) => t.id);
      assert.ok(filteredIds.includes("task-approval-parent"));
      assert.ok(filteredIds.includes("task-approval-subtask"));
      assert.equal(filtered.length, 2);
    });

    test("When currentWorkbox = 'my_tasks', only tasks assigned to the user or having subtasks assigned to user are included", () => {
      const filtered = filterDisplayedTasks({
        tasks: mockTasks,
        workbox: "my_tasks",
        user: testUser,
      });

      const filteredIds = filtered.map((t) => t.id);

      // Direct assignment
      assert.ok(filteredIds.includes("task-overdue-user"), "Directly assigned task must be included");
      assert.ok(filteredIds.includes("task-overdue-completed"), "Assigned completed task included in my_tasks");
      assert.ok(filteredIds.includes("task-parent-future-subtask-overdue"), "Directly assigned task included");
      assert.ok(filteredIds.includes("task-parent-completed-subtask-overdue"), "Directly assigned task included");
      assert.ok(filteredIds.includes("task-approval-parent"), "Directly assigned task included");

      // Subtask assigned to user
      assert.ok(
        filteredIds.includes("task-other-parent-user-subtask"),
        "Task where subtask is assigned to user must be included in my_tasks"
      );

      // Unassigned tasks
      assert.ok(
        !filteredIds.includes("task-approval-subtask"),
        "Task assigned exclusively to other user must be excluded"
      );
      assert.ok(
        !filteredIds.includes("task-other-user"),
        "Task assigned to other user must be excluded"
      );

      assert.equal(filtered.length, 6, "Must match all 6 user-linked tasks");
    });

    test("When currentWorkbox = 'my_pending_submission', filters to active tasks assigned to user/unit", () => {
      const filtered = filterDisplayedTasks({
        tasks: mockTasks,
        workbox: "my_pending_submission",
        user: testUser,
      });

      const filteredIds = filtered.map((t) => t.id);

      // Active and assigned to user/unit (QTM)
      assert.ok(filteredIds.includes("task-overdue-user"), "Active task in QTM included");
      assert.ok(
        filteredIds.includes("task-parent-future-subtask-overdue"),
        "Active task in QTM included"
      );
      assert.ok(
        filteredIds.includes("task-other-parent-user-subtask"),
        "Task with active subtask assigned to user included"
      );

      // Excludes completed tasks
      assert.ok(!filteredIds.includes("task-overdue-completed"), "Completed task excluded");
      assert.ok(
        !filteredIds.includes("task-parent-completed-subtask-overdue"),
        "Completed task excluded"
      );

      // Excludes task of other unit not assigned to user
      assert.ok(
        !filteredIds.includes("task-other-user"),
        "Task of other unit and user excluded"
      );
    });

    test("When currentWorkbox = 'overdue', filters only overdue tasks", () => {
      const filtered = filterDisplayedTasks({
        tasks: mockTasks,
        workbox: "overdue",
        user: testUser,
        referenceDate: refDate,
      });

      const filteredIds = filtered.map((t) => t.id);
      assert.ok(filteredIds.includes("task-overdue-user"));
      assert.ok(filteredIds.includes("task-parent-future-subtask-overdue"));
      assert.equal(filtered.length, 2);
    });

    test("When currentWorkbox = 'ALL' and currentOverdue = false, all scoped tasks are displayed", () => {
      const filtered = filterDisplayedTasks({
        tasks: mockTasks,
        workbox: "ALL",
        overdue: false,
        user: testUser,
      });

      assert.equal(
        filtered.length,
        mockTasks.length,
        "All tasks must be displayed when workbox is ALL and overdue is false"
      );
    });
  });

  describe("UnifiedAdaptiveWorkspace Component Integration", () => {
    test("renders correctly with activeWorkbox='my_pending_approval'", () => {
      const html = renderWorkspace(
        React.createElement(UnifiedAdaptiveWorkspace, {
          user: testUser,
          tasks: mockTasks,
          activeWorkbox: "my_pending_approval",
          onSelectTask: () => {},
        })
      );

      assert.ok(
        html.includes("data-slot=\"unified-adaptive-workspace\""),
        "Workspace container rendered"
      );
      assert.ok(
        html.includes("Đề xuất mua sắm thiết bị tường lửa"),
        "Approval task must be visible"
      );
      assert.ok(
        !html.includes("Bảo trì định kỳ máy chủ email"),
        "Non-approval completed task must not be visible"
      );
    });

    test("renders correctly with isOverdueOnly=true", () => {
      const html = renderWorkspace(
        React.createElement(UnifiedAdaptiveWorkspace, {
          user: testUser,
          tasks: mockTasks,
          isOverdueOnly: true,
          onSelectTask: () => {},
        })
      );

      assert.ok(
        html.includes("Cập nhật hạ tầng mạng Core Switch"),
        "Overdue task must be visible"
      );
      assert.ok(
        !html.includes("Bảo trì định kỳ máy chủ email"),
        "Completed task must not be visible in overdue view"
      );
    });

    test("renders all tasks when activeWorkbox='ALL' and isOverdueOnly=false", () => {
      const html = renderWorkspace(
        React.createElement(UnifiedAdaptiveWorkspace, {
          user: testUser,
          tasks: mockTasks,
          activeWorkbox: "ALL",
          isOverdueOnly: false,
          onSelectTask: () => {},
        })
      );

      assert.ok(html.includes("Cập nhật hạ tầng mạng Core Switch"));
      assert.ok(html.includes("Bảo trì định kỳ máy chủ email"));
      assert.ok(html.includes("Đề xuất mua sắm thiết bị tường lửa"));
    });

    test("zero emojis in rendered markup", () => {
      const html = renderWorkspace(
        React.createElement(UnifiedAdaptiveWorkspace, {
          user: testUser,
          tasks: mockTasks,
          activeWorkbox: "my_pending_approval",
          onSelectTask: () => {},
        })
      );
      const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
      assert.ok(!emojiRegex.test(html), "Rendered markup must be 100% free of emojis");
    });
  });
});
