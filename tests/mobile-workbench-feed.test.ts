import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MobileTaskCard,
  formatMobileDueDate,
  getMobileDueBadge,
} from "../src/components/tasks/mobile-task-card";
import { TaskTableToolbar } from "../src/components/tasks/table/components/task-table-toolbar";
import type { SchoolTask } from "../src/types/dashboard";

describe("Mobile Workbench Feed & Task Workspace", () => {

  const mockTaskCardTask: SchoolTask = {
    id: "task-001",
    code: "NV-001",
    title: "Xây dựng kế hoạch tuyển sinh 2026",
    description: "Chi tiết kế hoạch tuyển sinh đợt 1 năm học 2026",
    status: "IN_PROGRESS",
    priority: "HIGH",
    dueDate: "2026-10-15",
    startDate: "2026-09-01",
    progressPercent: 72,
    totalSubTasks: 4,
    completedSubTasks: 2,
    department: "Phòng Đào tạo",
    departmentCode: "DAO_TAO",
    leadAssigneeName: "Nguyễn Văn A",
    assignedDate: "2026-09-01",
    coAssignees: [],
    subTasks: [],
    academicMonth: 10,
    category: "CNTT",
    categoryLabel: "Đào tạo",
  };

  describe("Mobile Task Workspace (Sprint M1)", () => {
    describe("5. formatMobileDueDate and getMobileDueBadge helpers", () => {
      test("formats mobile due date cleanly without emoji", () => {
        assert.equal(formatMobileDueDate("2026-10-15"), "Hạn 15/10");
        assert.equal(formatMobileDueDate(undefined), "Không hạn");
      });

      test("calculates overdue badges accurately", () => {
        const badge = getMobileDueBadge("2026-09-01", "IN_PROGRESS", "2026-09-05");
        assert.ok(badge.label.includes("Trễ hạn 4 ngày"));
        assert.ok(badge.className.includes("text-destructive"));
      });

      test("calculates completed status badge accurately", () => {
        const badge = getMobileDueBadge("2026-09-01", "COMPLETED", "2026-09-05");
        assert.equal(badge.label, "Hoàn thành");
        assert.ok(badge.className.includes("text-emerald-700"));
      });
    });

    describe("6. MobileTaskCard Component Ergonomics", () => {
      test("renders task code, status badge, title, unit and assignee with clean styling", () => {
        const html = renderToStaticMarkup(
          React.createElement(MobileTaskCard, {
            task: mockTaskCardTask,
            onSelectTask: () => {},
          })
        );

        // Task code
        assert.ok(html.includes("NV-001"), "Must display task code NV-001");
        // Title
        assert.ok(html.includes("Xây dựng kế hoạch tuyển sinh 2026"), "Must display task title");
        // Department and Assignee
        assert.ok(html.includes("Phòng Đào tạo"), "Must display department");
        assert.ok(html.includes("Nguyễn Văn A"), "Must display assignee name");
        // Thẻ compact không hiện phần trăm tiến độ (xem 89122fe8): hạn và trạng thái đủ cho danh sách di động
        assert.ok(!html.includes("72%"), "Compact card must not repeat the progress percentage");
        // Touch manipulation; hàng một dòng 40px (bỏ mức 48px theo yêu cầu thu gọn mobile)
        assert.ok(html.includes("touch-manipulation"), "Card must have touch-manipulation");
        assert.ok(html.includes("min-h-12"), "Card must be a 48px one-line row (min-h-12), like Linear mobile Projects");
      });
    });

    describe("7. TaskTableToolbar Mobile Ergonomics", () => {
      test("renders mobile task bar with search input, quick filter chips, and filter trigger", () => {
        const html = renderToStaticMarkup(
          React.createElement(TaskTableToolbar, {
            searchQuery: "",
            onSearchChange: () => {},
            activeTab: "all",
            onTabChange: () => {},
            totalTasksCount: 25,
            pillCounts: {
              all: 25,
              my_tasks: 8,
              review: 3,
              overdue: 2,
            },
          })
        );

        // Mobile task bar (< md)
        assert.ok(html.includes("md:hidden"), "Must contain mobile-specific section");
        assert.ok(html.includes("Tất cả"), "Must render all count chip");
        assert.ok(html.includes("(25)"), "Must render all count value");
        assert.ok(html.includes("Của tôi"), "Must render my tasks count chip");
        assert.ok(html.includes("Chờ duyệt"), "Must render pending review count chip");
        assert.ok(html.includes("Trễ hạn"), "Must render overdue count chip");
        assert.ok(html.includes("Bộ lọc"), "Must render filter bottom sheet trigger button");
      });
    });
  });
});
