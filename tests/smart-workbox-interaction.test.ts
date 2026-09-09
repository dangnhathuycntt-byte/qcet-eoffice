import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  UniversalActionQueue,
  type UniversalActionQueueProps,
} from "../src/components/workspace/components/universal-action-queue";
import {
  getActiveFilterSummary,
  getWorkboxDisplayLabel,
} from "../src/components/workspace/components/active-filter-breadcrumb";
import {
  filterDisplayedTasks,
} from "../src/components/workspace/unified-adaptive-workspace";
import type { SchoolTask } from "../src/types/dashboard";
import type { AuthUser } from "../src/types/auth";

describe("Smart Workbox & Linear-Style Interaction (Phase 6)", () => {
  const mockTasks = [
    {
      id: "task-1",
      title: "Triển khai tuyển sinh đợt 1",
      description: "Mô tả tuyển sinh",
      status: "WAITING_APPROVAL",
      priority: "HIGH",
      dueDate: "2026-10-15",
      leadAssigneeName: "Trưởng phòng Đào tạo",
      progressPercent: 80,
      department: "Phòng Đào tạo",
      departmentCode: "DAO_TAO",
      academicMonth: 10,
      requiresReview: true,
    },
    {
      id: "task-2",
      title: "Báo cáo kiểm định chất lượng",
      description: "Nộp báo cáo kiểm định",
      status: "IN_PROGRESS",
      priority: "URGENT",
      dueDate: "2026-03-01", // overdue past ref date
      leadAssigneeName: "Nguyễn Văn A",
      progressPercent: 30,
      department: "Phòng Khảo thí",
      departmentCode: "KHAO_THI",
      academicMonth: 3,
    },
    {
      id: "task-3",
      title: "Cập nhật tài liệu giảng dạy",
      description: "Tài liệu môn học",
      status: "COMPLETED",
      priority: "NORMAL",
      dueDate: "2026-09-01",
      leadAssigneeName: "Nguyễn Văn A",
      progressPercent: 100,
      department: "Khoa CNTT",
      departmentCode: "CNTT",
      academicMonth: 9,
    },
  ] as unknown as SchoolTask[];

  const mockUser = {
    id: "usr-1",
    name: "Nguyễn Văn A",
    email: "nva@qcet.edu.vn",
    role: "MANAGER" as const,
    roleLabel: "Trưởng phòng",
    department: "Phòng Khảo thí",
    departmentCode: "KHAO_THI",
    departmentName: "Phòng Khảo thí",
  } as unknown as AuthUser;

  test("getWorkboxDisplayLabel translates machine keys to friendly localized titles", () => {
    assert.equal(getWorkboxDisplayLabel("my_pending_approval"), "Chờ tôi duyệt");
    assert.equal(getWorkboxDisplayLabel("my_pending_submission"), "Chờ nộp báo cáo");
    assert.equal(getWorkboxDisplayLabel("my_tasks"), "Việc của tôi");
    assert.equal(getWorkboxDisplayLabel("waiting_approval"), "Chờ duyệt");
    assert.equal(getWorkboxDisplayLabel("pending_submission"), "Chờ nộp BC");
    assert.equal(getWorkboxDisplayLabel("URGENT_OVERDUE"), "URGENT_OVERDUE");
  });

  test("getActiveFilterSummary formats workbox filter label properly", () => {
    const summary = getActiveFilterSummary({
      workbox: "my_pending_approval",
    });
    assert.equal(summary.length, 1);
    assert.equal(summary[0], "Hộp việc: Chờ tôi duyệt");
  });

  test("filterDisplayedTasks correctly filters for approvals and submissions", () => {
    // 1. Approvals
    const approvals = filterDisplayedTasks({
      tasks: mockTasks,
      workbox: "my_pending_approval",
      user: mockUser,
    });
    assert.equal(approvals.length, 1);
    assert.equal(approvals[0].id, "task-1");

    // 2. My tasks
    const myTasks = filterDisplayedTasks({
      tasks: mockTasks,
      workbox: "my_tasks",
      user: mockUser,
    });
    assert.equal(myTasks.length, 2); // task-2 and task-3 are assigned to Nguyễn Văn A

    // 3. Overdue
    const overdue = filterDisplayedTasks({
      tasks: mockTasks,
      workbox: "overdue",
      user: mockUser,
    });
    assert.ok(overdue.some((t) => t.id === "task-2"));
  });

  test("UniversalActionQueue renders smart action cards and quick canvas filter buttons", () => {
    const html = renderToStaticMarkup(
      React.createElement(UniversalActionQueue, {
        actionQueue: {
          pendingApprovals: [
            {
              task: mockTasks[0],
              submittedBy: "Nguyễn Văn B",
              submittedAt: "2026-09-08",
              complianceScore: 92,
            },
          ],
          myPendingSubmissions: [
            {
              task: mockTasks[1],
              dueDate: mockTasks[1].dueDate,
              isOverdue: true,
            },
          ],
        },
        scope: "unit",
        onSelectTask: () => {},
        onFilterCanvas: () => {},
      })
    );

    assert.ok(html.includes("Hàng đợi thẩm định"));
    assert.ok(html.includes("Nhiệm vụ cần nộp hồ sơ minh chứng"));
    assert.ok(html.includes("Xem trên bảng")); // Quick filter canvas CTA
  });
});
