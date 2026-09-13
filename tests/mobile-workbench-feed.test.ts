import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  WorkbenchMobileFeed,
  formatVietnameseCurrentDate,
  getAcademicGreeting,
  getRoleChipLabel,
  formatShortDueDate,
} from "../src/components/dashboard/workbench-mobile-feed";
import type { SchoolTask, DashboardStats } from "../src/types/dashboard";
import type { AuthUser } from "../src/types/auth";

describe("Mobile Workbench Attention-First Feed (/)", () => {
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

  test("1. Utility functions format dates, greetings, and roles accurately", () => {
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
    assert.ok(html.includes("Chờ phê duyệt"));
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

  test("3. Desktop KPI grid is hidden on mobile and visible on desktop in DashboardZone", () => {
    const dashboardZonePath = path.resolve(
      __dirname,
      "../src/components/dashboard/zones/dashboard-zone.tsx"
    );
    const content = fs.readFileSync(dashboardZonePath, "utf-8");

    // Must import and mount WorkbenchMobileFeed
    assert.ok(
      content.includes("WorkbenchMobileFeed"),
      "DashboardZone must import WorkbenchMobileFeed"
    );

    // Mobile container must be block sm:hidden
    assert.ok(
      content.includes('className="block sm:hidden"') ||
      content.includes("data-slot=\"mobile-workbench-feed-container\""),
      "Mobile container must have block sm:hidden"
    );

    // Desktop container must be hidden sm:block
    assert.ok(
      content.includes('className="hidden sm:block space-y-6"') ||
      content.includes("data-slot=\"desktop-workbench-container\""),
      "Desktop container must have hidden sm:block"
    );

    // ExecutiveStatStrip is inside the desktop container
    const desktopIndex = content.indexOf('data-slot="desktop-workbench-container"');
    const statStripIndex = content.indexOf("<ExecutiveStatStrip", desktopIndex);
    assert.ok(
      desktopIndex !== -1 && statStripIndex > desktopIndex,
      "ExecutiveStatStrip must be rendered inside the desktop container"
    );
  });

  test("4. Role-aware sections: BGH vs Manager vs Staff", () => {
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
    assert.ok(bghHtml.includes("Chờ phê duyệt"));
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
    assert.ok(managerHtml.includes("Chờ phê duyệt"));
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

  test("5. Zero emojis in source and rendered output", () => {
    const feedSourcePath = path.resolve(
      __dirname,
      "../src/components/dashboard/workbench-mobile-feed.tsx"
    );
    const sourceContent = fs.readFileSync(feedSourcePath, "utf-8");

    // Unicode emoji regex
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    assert.equal(
      emojiRegex.test(sourceContent),
      false,
      "workbench-mobile-feed.tsx must not contain emojis"
    );

    const html = renderToStaticMarkup(
      React.createElement(WorkbenchMobileFeed, {
        isExecutive: true,
        stats: mockStats,
        tasks: mockTasks,
        referenceDate: "2026-09-09",
      })
    );
    assert.equal(
      emojiRegex.test(html),
      false,
      "Rendered HTML must not contain emojis"
    );
  });

  test("6. Light-Only standard (strictly zero dark: classes)", () => {
    const feedSourcePath = path.resolve(
      __dirname,
      "../src/components/dashboard/workbench-mobile-feed.tsx"
    );
    const sourceContent = fs.readFileSync(feedSourcePath, "utf-8");

    assert.equal(
      sourceContent.includes("dark:"),
      false,
      "workbench-mobile-feed.tsx must not contain dark: classes"
    );

    const html = renderToStaticMarkup(
      React.createElement(WorkbenchMobileFeed, {
        isExecutive: true,
        stats: mockStats,
        tasks: mockTasks,
        referenceDate: "2026-09-09",
      })
    );
    assert.equal(
      html.includes("dark:"),
      false,
      "Rendered HTML must not contain dark: classes"
    );
  });

  test("7. Mobile ergonomics: touch targets and tabular numerals", () => {
    const html = renderToStaticMarkup(
      React.createElement(WorkbenchMobileFeed, {
        isExecutive: true,
        stats: mockStats,
        tasks: mockTasks,
        referenceDate: "2026-09-09",
      })
    );

    // Minimum touch target classes
    assert.ok(
      html.includes("min-h-[48px]"),
      "Interactive cards and buttons must specify min-h-[48px] touch targets"
    );
    assert.ok(
      html.includes("touch-manipulation"),
      "Touch manipulation class must be present for responsive tap behavior"
    );

    // Tabular numerals for dates, counts, and metrics
    assert.ok(
      html.includes("font-mono tabular-nums"),
      "Tabular numerals must be applied to counts and dates"
    );
  });

  test("5. P0-03 regression: progress 100 is not completion", () => {
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
});
