import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  WorkbenchMobileFeed,
  formatVietnameseCurrentDate,
  getAcademicGreeting,
  getRoleChipLabel,
  formatShortDueDate,
} from "../src/components/dashboard/workbench-mobile-feed";
import {
  MobileTaskCard,
  formatMobileDueDate,
  getMobileDueBadge,
} from "../src/components/tasks/mobile-task-card";
import { TaskTableToolbar } from "../src/components/tasks/table/task-table-toolbar";
import type { SchoolTask, DashboardStats } from "../src/types/dashboard";
import type { AuthUser } from "../src/types/auth";

describe("Mobile Workbench Feed & Task Workspace", () => {
  const mockTasks: SchoolTask[] = [
    {
      id: "task-1",
      code: "NV-001",
      title: "Rà soát đề cương chi tiết học phần theo chuẩn DACUM",
      status: "NEEDS_REVIEW",
      priority: "URGENT",
      department: "Khoa Công nghệ thông tin",
      dueDate: "2026-09-09",
      progressPercent: 75,
      weight: 10,
      createdAt: "2026-08-25",
      updatedAt: "2026-09-01",
    },
    {
      id: "task-2",
      code: "NV-002",
      title: "Tổng hợp báo cáo giải ngân kinh phí đào tạo đợt 1",
      status: "IN_PROGRESS",
      priority: "HIGH",
      department: "Phòng Kế hoạch - Tài chính",
      dueDate: "2026-09-08", // overdue
      progressPercent: 40,
      weight: 15,
      createdAt: "2026-08-25",
      updatedAt: "2026-09-02",
    },
    {
      id: "task-3",
      code: "NV-003",
      title: "Chuẩn bị cơ sở vật chất năm học mới 2026-2027",
      status: "IN_PROGRESS",
      priority: "NORMAL",
      department: "Phòng Quản trị thiết bị",
      dueDate: "2026-09-20",
      progressPercent: 90,
      createdAt: "2026-08-25",
      updatedAt: "2026-09-03",
    },
  ] as unknown as SchoolTask[];

  const mockStats = {
    totalTasks: 3,
    completedTasks: 0,
    inProgressTasks: 2,
    overdueTasks: 1,
    needsReviewTasksCount: 1,
    overdueTasksCount: 1,
    totalSchoolTasks: 3,
    schoolTasksInProgress: 2,
    schoolTasksCompleted: 0,
    totalStaffTasks: 3,
    staffTasksInProgress: 2,
    staffTasksCompleted: 0,
    averageSchoolProgressPercent: 68,
  } as unknown as DashboardStats;

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

  test("1. Workbench utility functions format dates, greetings, and roles accurately", () => {
    // Vietnamese date format
    const formatted = formatVietnameseCurrentDate("2026-09-09");
    assert.match(formatted, /Thứ Tư, ngày 09\/09\/2026/);

    // Academic greeting
    const greetingWithName = getAcademicGreeting("Nguyễn Văn An");
    assert.ok(greetingWithName.includes("Thầy/Cô Nguyễn Văn An"));
    const greetingGeneric = getAcademicGreeting(null);
    assert.ok(greetingGeneric.includes("Thầy/Cô"));

    // Role chip labels
    assert.equal(getRoleChipLabel(true, false), "Ban Giám hiệu");
    assert.equal(getRoleChipLabel(false, true, "Khoa CNTT"), "Lãnh đạo Khoa CNTT");
    assert.equal(getRoleChipLabel(false, true), "Lãnh đạo đơn vị");
    assert.equal(getRoleChipLabel(false, false), "Cán bộ / Giảng viên");

    // Due date formatter
    const todayDue = formatShortDueDate("2026-09-09", "2026-09-09");
    assert.equal(todayDue.text, "Hạn hôm nay");
    assert.equal(todayDue.isToday, true);

    const pastDue = formatShortDueDate("2026-09-08", "2026-09-09");
    assert.match(pastDue.text, /Quá hạn/);
    assert.equal(pastDue.isOverdue, true);

    const futureDue = formatShortDueDate("2026-09-15", "2026-09-09");
    assert.equal(futureDue.text, "Hạn 15/09");
  });

  test("2. Mobile Attention-First Feed renders on mobile with all 4 required sections", () => {
    const html = renderToStaticMarkup(
      React.createElement(WorkbenchMobileFeed, {
        isExecutive: true,
        stats: mockStats,
        tasks: mockTasks,
        referenceDate: "2026-09-09",
      })
    );

    // Root slot
    assert.ok(html.includes('data-slot="mobile-workbench-feed"'));

    // Header with greeting, role chip, and date
    assert.ok(html.includes('data-section="mobile-workbench-header"'));
    assert.ok(html.includes('data-slot="role-chip"'));
    assert.ok(html.includes("Thầy/Cô"));
    assert.ok(html.includes("Ban Giám hiệu"));
    assert.ok(html.includes("Thứ Tư, ngày 09/09/2026"));

    // Section 1: Cần xử lý ngay
    assert.ok(html.includes('data-section="needs-attention"'));
    assert.ok(html.includes("Cần xử lý ngay"));
    assert.ok(html.includes("Hồ sơ chờ xem xét"));
    assert.ok(html.includes("Quá hạn toàn trường"));

    // Section 2: Nhiệm vụ trọng tâm
    assert.ok(html.includes('data-section="key-tasks"'));
    assert.ok(html.includes("Nhiệm vụ trọng tâm"));
    assert.ok(html.includes('data-slot="view-all-tasks-btn"'));
    assert.ok(html.includes("/tasks?scope=school"));

    // Section 3: Lịch công tác hôm nay
    assert.ok(html.includes('data-section="today-schedule"'));
    assert.ok(html.includes("Lịch công tác hôm nay"));
    assert.ok(html.includes('data-slot="view-calendar-btn"'));
    assert.ok(html.includes("/calendar"));

    // Section 4: Thông báo điều hành mới
    assert.ok(html.includes('data-section="recent-notices"'));
    assert.ok(html.includes("Thông báo điều hành mới"));
  });

  test("3. Role-aware sections: BGH vs Manager vs Staff", () => {
    // Executive (BGH)
    const bghHtml = renderToStaticMarkup(
      React.createElement(WorkbenchMobileFeed, {
        isExecutive: true,
        isManager: false,
        isStaff: false,
        stats: mockStats,
        tasks: mockTasks,
        referenceDate: "2026-09-09",
      })
    );
    assert.ok(bghHtml.includes("Ban Giám hiệu"));
    assert.ok(bghHtml.includes("Quá hạn toàn trường"));
    assert.ok(bghHtml.includes("Hồ sơ chờ xem xét"));
    assert.ok(bghHtml.includes("/tasks?scope=school"));

    // Manager
    const managerHtml = renderToStaticMarkup(
      React.createElement(WorkbenchMobileFeed, {
        isExecutive: false,
        isManager: true,
        isStaff: false,
        user: { id: "mgr-1", name: "Trần Trưởng Khoa", email: "mgr@qcet.edu.vn", role: "MANAGER", roleLabel: "Trưởng khoa", department: "Khoa Cơ khí", departmentCode: "CK" } as AuthUser,
        stats: mockStats,
        tasks: mockTasks,
        referenceDate: "2026-09-09",
      })
    );
    assert.ok(managerHtml.includes("Lãnh đạo Khoa Cơ khí"));
    assert.ok(managerHtml.includes("Quá hạn đơn vị"));
    assert.ok(managerHtml.includes("Hồ sơ chờ xem xét"));
    assert.ok(managerHtml.includes("/tasks?scope=unit"));

    // Staff
    const staffHtml = renderToStaticMarkup(
      React.createElement(WorkbenchMobileFeed, {
        isExecutive: false,
        isManager: false,
        isStaff: true,
        user: { id: "st-1", name: "Lê Văn Giảng Viên", email: "gv@qcet.edu.vn", role: "STAFF", roleLabel: "Giảng viên", department: "Khoa CNTT", departmentCode: "CNTT" } as AuthUser,
        stats: mockStats,
        tasks: mockTasks,
        referenceDate: "2026-09-09",
      })
    );
    assert.ok(staffHtml.includes("Cán bộ / Giảng viên"));
    assert.ok(staffHtml.includes("Hạn chót hôm nay"));
    assert.ok(staffHtml.includes("Chờ nộp minh chứng"));
    assert.ok(staffHtml.includes("/tasks?scope=my"));
  });

  test("4. P0-03 regression: progress 100 is not completion", () => {
    // Plan P0-03 / T03: "canonical completion must be lifecycle completion, not
    // percent". Before the fix the progress bar turned emerald at progress >= 100,
    // so a task still WAITING_APPROVAL rendered as if it were done.
    const atFullProgressNotCompleted: SchoolTask[] = [
      {
        ...mockTasks[0],
        id: "task-p0-03",
        title: "Việc đã đủ 100% nhưng còn chờ phê duyệt",
        status: "WAITING_APPROVAL",
        progressPercent: 100,
        dueDate: "2026-09-09",
      } as SchoolTask,
    ];

    const html = renderToStaticMarkup(
      React.createElement(WorkbenchMobileFeed, {
        isExecutive: true,
        stats: mockStats,
        tasks: atFullProgressNotCompleted,
        referenceDate: "2026-09-09",
      })
    );

    // Guard against a vacuous pass: the fixture must actually render.
    assert.ok(
      html.includes("Việc đã đủ 100% nhưng còn chờ phê duyệt"),
      "fixture task must render, otherwise this regression test proves nothing"
    );
    assert.equal(
      /bg-emerald-500(?![\/\w-])/.test(html),
      false,
      "a task at progress 100 that is NOT lifecycle-COMPLETED must not render the completed (emerald) progress bar"
    );
  });

  describe("Mobile Task Workspace (Sprint M1)", () => {
    describe("5. formatMobileDueDate and getMobileDueBadge helpers", () => {
      test("formats mobile due date cleanly without emoji", () => {
        assert.equal(formatMobileDueDate("2026-10-15"), "Hạn 15/10");
        assert.equal(formatMobileDueDate(undefined), "Không hạn");
      });

      test("calculates overdue badges accurately", () => {
        const badge = getMobileDueBadge("2026-09-01", "IN_PROGRESS", "2026-09-05");
        assert.ok(badge.label.includes("Quá hạn 4 ngày"));
        assert.ok(badge.className.includes("text-rose-700"));
      });

      test("calculates completed status badge accurately", () => {
        const badge = getMobileDueBadge("2026-09-01", "COMPLETED", "2026-09-05");
        assert.equal(badge.label, "Hoàn thành");
        assert.ok(badge.className.includes("text-emerald-700"));
      });
    });

    describe("6. MobileTaskCard Component Ergonomics", () => {
      test("renders task code, status badge, title, unit, and progress with clean styling", () => {
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
        // Progress percentage
        assert.ok(html.includes("72%"), "Must display progress percentage");
        // Touch manipulation and minimum 48px height target
        assert.ok(html.includes("touch-manipulation"), "Card must have touch-manipulation");
        assert.ok(html.includes("min-h-[48px]"), "Card must have min-h-[48px]");
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
        assert.ok(html.includes("Quá hạn"), "Must render overdue count chip");
        assert.ok(html.includes("Bộ lọc"), "Must render filter bottom sheet trigger button");
      });
    });
  });
});
