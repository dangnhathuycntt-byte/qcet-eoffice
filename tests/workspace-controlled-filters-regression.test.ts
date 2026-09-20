import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SearchParamsContext, PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import {
  UnifiedAdaptiveWorkspace,
  UnifiedAdaptiveWorkspaceControlled,
} from "../src/components/workspace/unified-adaptive-workspace";
import { TaskManagementWorkspace } from "../src/components/tasks/task-management-workspace";
import type { UseWorkspaceQueryReturn } from "../src/hooks/use-workspace-query";
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

function renderWorkspaceWithUrl(
  element: React.ReactElement,
  searchParamsString = ""
): string {
  const searchParams = new URLSearchParams(searchParamsString);
  return renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: mockRouter },
      React.createElement(
        PathnameContext.Provider,
        { value: "/" },
        React.createElement(
          SearchParamsContext.Provider,
          { value: searchParams },
          element
        )
      )
    )
  );
}

describe("Controlled Filters Regression Suite (#24 Single Owner & Prop Priority)", () => {
  const testUser: AuthUser = {
    id: "user-test-vinh",
    name: "KS. Nguyễn Ngọc Vinh",
    email: "vinh.nn@qcet.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên QTM",
    department: "Phòng Quản trị mạng",
    departmentCode: "QTM",
  };

  const adminUser: AuthUser = {
    id: "user-admin",
    name: "TS. Admin",
    email: "admin@qcet.edu.vn",
    role: "ADMIN",
    roleLabel: "Ban Giám Hiệu",
    department: "Ban Giám Hiệu",
    departmentCode: "BGH",
  };

  const mockTasks: SchoolTask[] = [
    // Overdue task in QTM
    {
      id: "task-overdue-qtm",
      code: "NV-001",
      title: "Cập nhật hạ tầng mạng Core Switch",
      department: "Phòng Quản trị mạng",
      departmentCode: "QTM",
      assignedTo: "KS. Nguyễn Ngọc Vinh",
      leadAssigneeId: "user-test-vinh",
      leadAssigneeName: "KS. Nguyễn Ngọc Vinh",
      dueDate: "2026-09-01",
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
    // Completed task in QTM
    {
      id: "task-completed-qtm",
      code: "NV-002",
      title: "Bảo trì định kỳ máy chủ email",
      department: "Phòng Quản trị mạng",
      departmentCode: "QTM",
      assignedTo: "KS. Nguyễn Ngọc Vinh",
      leadAssigneeId: "user-test-vinh",
      leadAssigneeName: "KS. Nguyễn Ngọc Vinh",
      dueDate: "2026-09-01",
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
    // In-progress task in ĐT (Phòng Đào tạo)
    {
      id: "task-dt-approval",
      code: "NV-003",
      title: "Đề xuất mua sắm thiết bị tường lửa",
      department: "Phòng Đào tạo",
      departmentCode: "DT",
      assignedTo: "ThS. Đào Tạo",
      leadAssigneeId: "user-dt",
      leadAssigneeName: "ThS. Đào Tạo",
      dueDate: "2026-09-30",
      status: "WAITING_APPROVAL",
      priority: "URGENT",
      category: "CNTT",
      categoryLabel: "Công nghệ thông tin",
      progressPercent: 80,
      totalSubTasks: 0,
      completedSubTasks: 0,
      coAssignees: [],
      assignedDate: "2026-09-05",
      subTasks: [],
    },
  ];

  describe("1. isOverdueOnly Controlled Semantics", () => {
    test("isOverdueOnly=false must be respected even when URL has attention=overdue", () => {
      // URL has ?attention=overdue, but caller explicitly passes isOverdueOnly={false}
      const html = renderWorkspaceWithUrl(
        React.createElement(UnifiedAdaptiveWorkspace, {
          user: adminUser,
          tasks: mockTasks,
          isOverdueOnly: false,
          onSelectTask: () => {},
        }),
        "attention=overdue"
      );

      // All tasks should be rendered because isOverdueOnly=false overrides URL attention=overdue
      assert.ok(
        html.includes("Bảo trì định kỳ máy chủ email"),
        "Completed task must be visible when isOverdueOnly is controlled to false"
      );
      assert.ok(
        html.includes("Đề xuất mua sắm thiết bị tường lửa"),
        "Approval task must be visible when isOverdueOnly is controlled to false"
      );
      assert.ok(
        html.includes("Cập nhật hạ tầng mạng Core Switch"),
        "Overdue task must also be visible"
      );
    });

    test("isOverdueOnly=true renders only active overdue tasks", () => {
      const html = renderWorkspaceWithUrl(
        React.createElement(UnifiedAdaptiveWorkspace, {
          user: adminUser,
          tasks: mockTasks,
          isOverdueOnly: true,
          onSelectTask: () => {},
        })
      );

      assert.ok(
        html.includes("Cập nhật hạ tầng mạng Core Switch"),
        "Active overdue task must be visible"
      );
      assert.ok(
        !html.includes("Bảo trì định kỳ máy chủ email"),
        "Completed task must NOT be visible when isOverdueOnly=true"
      );
    });
  });

  describe("2. searchQuery Controlled Semantics", () => {
    test("searchQuery='' (empty string) must be respected and not overwritten by URL ?q=core", () => {
      // URL has search query, but caller forces searchQuery=""
      const html = renderWorkspaceWithUrl(
        React.createElement(UnifiedAdaptiveWorkspace, {
          user: adminUser,
          tasks: mockTasks,
          searchQuery: "",
          onSelectTask: () => {},
        }),
        "q=core"
      );

      // Because searchQuery is explicitly "", it should not filter to only "Core Switch"
      assert.ok(
        html.includes("Bảo trì định kỳ máy chủ email"),
        "All tasks must be visible when searchQuery is controlled empty string"
      );
      assert.ok(
        html.includes("Đề xuất mua sắm thiết bị tường lửa"),
        "All tasks must be visible when searchQuery is controlled empty string"
      );
    });

    test("searchQuery='tường lửa' narrows display to matching task regardless of URL", () => {
      const html = renderWorkspaceWithUrl(
        React.createElement(UnifiedAdaptiveWorkspace, {
          user: adminUser,
          tasks: mockTasks,
          searchQuery: "tường lửa",
          onSelectTask: () => {},
        }),
        "q=something_else"
      );

      assert.ok(
        html.includes("Đề xuất mua sắm thiết bị tường lửa"),
        "Matching task must be rendered"
      );
      assert.ok(
        !html.includes("Bảo trì định kỳ máy chủ email"),
        "Non-matching task must NOT be rendered"
      );
    });
  });

  describe("3. selectedDepartment Controlled Semantics", () => {
    test("selectedDepartment='QTM' filters to QTM department regardless of URL", () => {
      const html = renderWorkspaceWithUrl(
        React.createElement(UnifiedAdaptiveWorkspace, {
          user: adminUser,
          tasks: mockTasks,
          scope: "unit",
          selectedDepartment: "QTM",
          onSelectTask: () => {},
        }),
        "dept=DT"
      );

      assert.ok(
        html.includes("Cập nhật hạ tầng mạng Core Switch"),
        "QTM task must be visible"
      );
      assert.ok(
        html.includes("Bảo trì định kỳ máy chủ email"),
        "QTM completed task must be visible"
      );
      assert.ok(
        !html.includes("Đề xuất mua sắm thiết bị tường lửa"),
        "DT task must not be visible when controlled to QTM"
      );
    });

    test("selectedDepartment=undefined delegates to uncontrolled state/URL", () => {
      const html = renderWorkspaceWithUrl(
        React.createElement(UnifiedAdaptiveWorkspace, {
          user: adminUser,
          tasks: mockTasks,
          scope: "unit",
          selectedDepartment: undefined,
          onSelectTask: () => {},
        }),
        "scope=unit&dept=DT"
      );

      // In uncontrolled mode with ?dept=DT, DT task should be visible
      assert.ok(
        html.includes("Đề xuất mua sắm thiết bị tường lửa"),
        "DT task must be visible via URL query in uncontrolled mode"
      );
    });
  });

  describe("4. activeWorkbox Controlled Semantics", () => {
    test("activeWorkbox='my_pending_approval' filters to approval queue", () => {
      const html = renderWorkspaceWithUrl(
        React.createElement(UnifiedAdaptiveWorkspace, {
          user: adminUser,
          tasks: mockTasks,
          activeWorkbox: "my_pending_approval",
          onSelectTask: () => {},
        }),
        "attention=overdue"
      );

      assert.ok(
        html.includes("Đề xuất mua sắm thiết bị tường lửa"),
        "Approval task must be visible"
      );
      assert.ok(
        !html.includes("Bảo trì định kỳ máy chủ email"),
        "Non-approval task must NOT be visible"
      );
    });

    test("activeWorkbox='ALL' overrides URL attention=overdue", () => {
      const html = renderWorkspaceWithUrl(
        React.createElement(UnifiedAdaptiveWorkspace, {
          user: adminUser,
          tasks: mockTasks,
          activeWorkbox: "ALL",
          isOverdueOnly: false,
          onSelectTask: () => {},
        }),
        "attention=overdue"
      );

      assert.ok(html.includes("Cập nhật hạ tầng mạng Core Switch"));
      assert.ok(html.includes("Bảo trì định kỳ máy chủ email"));
      assert.ok(html.includes("Đề xuất mua sắm thiết bị tường lửa"));
    });
  });

  describe("5. TaskManagementWorkspace Forwarding & Controlled Mode (#24 Single Owner)", () => {
    test("routes to UnifiedAdaptiveWorkspaceControlled when workspaceQuery is provided", () => {
      const dummyWorkspaceQuery: UseWorkspaceQueryReturn = {
        queryState: {
          scope: "school",
          status: "ALL",
          view: "table",
          month: 9,
        },
        setScope: () => {},
        setUnit: () => {},
        setDept: () => {},
        setStatus: () => {},
        setSearchQuery: () => {},
        setPeriod: () => {},
        setView: () => {},
        setPriority: () => {},
        setCategory: () => {},
        setDeadline: () => {},
        setSelectedTask: () => {},
        setAttention: () => {},
        resetFilters: () => {},
        updateWorkspaceQuery: () => {},
      };

      const html = renderWorkspaceWithUrl(
        React.createElement(TaskManagementWorkspace, {
          user: adminUser,
          tasks: mockTasks,
          workspaceQuery: dummyWorkspaceQuery,
          selectedDepartment: "QTM",
          scope: "unit",
          onSelectTask: () => {},
        })
      );

      assert.ok(
        html.includes("data-slot=\"unified-adaptive-workspace\""),
        "UnifiedAdaptiveWorkspaceControlled rendered correctly through TaskManagementWorkspace facade"
      );
      assert.ok(
        html.includes("Cập nhật hạ tầng mạng Core Switch"),
        "QTM task is visible"
      );
      assert.ok(
        !html.includes("Đề xuất mua sắm thiết bị tường lửa"),
        "DT task is filtered out by controlled selectedDepartment='QTM'"
      );
    });
  });
});
