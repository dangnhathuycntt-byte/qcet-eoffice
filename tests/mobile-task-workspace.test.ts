import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MobileTaskCard,
  formatMobileDueDate,
  getMobileDueBadge,
} from "../src/components/tasks/mobile-task-card";
import { TaskTableToolbar } from "../src/components/tasks/table/task-table-toolbar";
import type { SchoolTask } from "../src/types/dashboard";

const mockTask: SchoolTask = {
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

describe("Sprint M1: Mobile Task Workspace & Task Feed", () => {
  describe("1. formatMobileDueDate and getMobileDueBadge helpers", () => {
    it("formats mobile due date cleanly without emoji", () => {
      assert.equal(formatMobileDueDate("2026-10-15"), "Hạn 15/10");
      assert.equal(formatMobileDueDate(undefined), "Không hạn");
    });

    it("calculates overdue badges accurately", () => {
      const badge = getMobileDueBadge("2026-09-01", "IN_PROGRESS", "2026-09-05");
      assert.ok(badge.label.includes("Quá hạn 4 ngày"));
      assert.ok(badge.className.includes("text-rose-700"));
    });

    it("calculates completed status badge accurately", () => {
      const badge = getMobileDueBadge("2026-09-01", "COMPLETED", "2026-09-05");
      assert.equal(badge.label, "Hoàn thành");
      assert.ok(badge.className.includes("text-emerald-700"));
    });
  });

  describe("2. MobileTaskCard Component Ergonomics", () => {
    it("renders task code, status badge, title, unit, and progress with clean styling", () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileTaskCard, {
          task: mockTask,
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
      // Progress percentage
      assert.ok(html.includes("72%"), "Must display progress percentage");
      // Touch manipulation and minimum 48px height target
      assert.ok(html.includes("touch-manipulation"), "Card must have touch-manipulation");
      assert.ok(html.includes("min-h-[48px]"), "Card must have min-h-[48px]");
    });

    it("contains zero emojis across all badges, labels, and content", () => {
      const html = renderToStaticMarkup(
        React.createElement(MobileTaskCard, {
          task: mockTask,
          onSelectTask: () => {},
        })
      );

      // Emoji regex
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      assert.ok(!emojiRegex.test(html), "MobileTaskCard must contain zero emojis");
    });
  });

  describe("3. TaskTableToolbar Mobile Ergonomics", () => {
    it("renders mobile task bar with search input, quick filter chips, and filter trigger", () => {
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
      assert.ok(html.includes("Quá hạn"), "Must render overdue count chip");
      assert.ok(html.includes("Bộ lọc"), "Must render filter bottom sheet trigger button");
    });
  });

  describe("4. Task Detail Side Sheet Mobile Full-Screen Contract", () => {
    it("implements full-screen mobile surface and sticky bottom action bar", () => {
      const sheetPath = path.resolve(
        process.cwd(),
        "src/components/dashboard/task-detail-side-sheet.tsx"
      );
      const content = fs.readFileSync(sheetPath, "utf-8");

      // Full screen on mobile: w-full max-w-none rounded-none
      assert.ok(
        content.includes("w-full max-w-none rounded-none"),
        "TaskDetailSideSheet must be full-screen on mobile screens"
      );

      // Sticky bottom bar with safe-area padding
      assert.ok(
        content.includes("safe-area-inset-bottom"),
        "TaskDetailSideSheet must have sticky bottom bar with safe-area-inset-bottom"
      );

      // Mobile Back button (< 768px)
      assert.ok(
        content.includes("Quay lại danh sách nhiệm vụ"),
        "TaskDetailSideSheet must have accessible mobile back button"
      );

      // Primary actions: Staff submission, Manager review
      assert.ok(
        content.includes("canSubmitDeliverable"),
        "Must verify Staff deliverable submission permission"
      );
      assert.ok(
        content.includes("canReview"),
        "Must verify Manager review permission"
      );
    });
  });
});
