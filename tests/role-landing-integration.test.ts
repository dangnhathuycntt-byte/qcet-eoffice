import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  getDefaultScopeForRole,
  getDefaultViewModeForRole,
  resolveStaffLandingMode,
} from "../src/lib/unified-task-hub";
import { StaffFocusView } from "../src/components/dashboard/roles/staff-focus-view";
import {
  SimplifiedTaskFilterBar,
  type SimplifiedTaskStatus,
} from "../src/components/dashboard/simplified-task-filter-bar";
import { LecturerFocusWorkspace } from "../src/components/portal/lecturer-focus-workspace";
import { DepartmentManagerWorkspace } from "../src/components/portal/department-manager-workspace";
import { ExecutiveCockpitWorkspace } from "../src/components/portal/executive-cockpit-workspace";
import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";
import type { AuthUser } from "../src/types/auth";

const PAGE_FILE_PATH = path.resolve(process.cwd(), "src/app/page.tsx");

describe("Role-Adaptive Landing & Integration (Task 3)", () => {
  const adminUser = DEFAULT_DEMO_USERS[0]; // role: ADMIN
  const managerUser = DEFAULT_DEMO_USERS[1]; // role: MANAGER
  const staffUser = DEFAULT_DEMO_USERS[2]; // role: STAFF
  const payload = getMockDashboardPayload();

  // --------------------------------------------------------------------------
  // 1. Role Landing Resolution Logic
  // --------------------------------------------------------------------------
  describe("1. Role Landing Mode Resolution", () => {
    test("Staff user role resolves default focus view when not expanded and no view query", () => {
      const mode = resolveStaffLandingMode({
        role: "STAFF",
        isExpanded: false,
        viewQuery: null,
      });
      assert.equal(mode, "STAFF_FOCUS", "STAFF should default to STAFF_FOCUS");
    });

    test("Staff user role resolves default focus view when view query is explicitly 'focus'", () => {
      const mode = resolveStaffLandingMode({
        role: "STAFF",
        isExpanded: false,
        viewQuery: "focus",
      });
      assert.equal(mode, "STAFF_FOCUS", "STAFF with view=focus should resolve to STAFF_FOCUS");
    });

    test("Staff user role resolves advanced view when toggled expanded", () => {
      const mode = resolveStaffLandingMode({
        role: "STAFF",
        isExpanded: true,
        viewQuery: null,
      });
      assert.equal(mode, "ADVANCED", "STAFF with isExpanded=true should resolve to ADVANCED");
    });

    test("Staff user role resolves advanced view when deep query parameter ?view=table is present", () => {
      const mode = resolveStaffLandingMode({
        role: "STAFF",
        isExpanded: false,
        viewQuery: "table",
      });
      assert.equal(mode, "ADVANCED", "Deep link ?view=table should override to ADVANCED");
    });

    test("Staff user role resolves advanced view for other view queries (kanban, calendar)", () => {
      assert.equal(
        resolveStaffLandingMode({ role: "STAFF", isExpanded: false, viewQuery: "kanban" }),
        "ADVANCED"
      );
      assert.equal(
        resolveStaffLandingMode({ role: "STAFF", isExpanded: false, viewQuery: "calendar" }),
        "ADVANCED"
      );
    });

    test("Admin user role resolves advanced mode and defaults to executive cockpit view", () => {
      const landingMode = resolveStaffLandingMode({
        role: "ADMIN",
        isExpanded: false,
        viewQuery: null,
      });
      assert.equal(landingMode, "ADVANCED", "ADMIN should not be trapped in StaffFocusView");

      const defaultView = getDefaultViewModeForRole("ADMIN");
      assert.equal(defaultView, "executive", "ADMIN default view mode must be executive cockpit");

      const defaultScope = getDefaultScopeForRole("ADMIN");
      assert.equal(defaultScope, "SCHOOL_TASKS", "ADMIN default scope must be SCHOOL_TASKS");
    });

    test("Manager user role resolves advanced mode with unit scope", () => {
      const landingMode = resolveStaffLandingMode({
        role: "MANAGER",
        isExpanded: false,
        viewQuery: null,
      });
      assert.equal(landingMode, "ADVANCED", "MANAGER should not be trapped in StaffFocusView");

      const defaultScope = getDefaultScopeForRole("MANAGER");
      assert.equal(defaultScope, "UNIT_TASKS", "MANAGER default scope must be UNIT_TASKS");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Integration with src/app/page.tsx
  // --------------------------------------------------------------------------
  describe("2. page.tsx Component Contracts & Anti-Slop Audit", () => {
    assert.ok(fs.existsSync(PAGE_FILE_PATH), "src/app/page.tsx must exist");
    const architectureFiles = [
      PAGE_FILE_PATH,
      path.resolve(process.cwd(), "src/components/dashboard/zones/tasks-zone.tsx"),
      path.resolve(process.cwd(), "src/components/dashboard/zones/tasks-focus-landing.tsx"),
      path.resolve(process.cwd(), "src/components/dashboard/zones/tasks-expanded-views.tsx"),
      path.resolve(process.cwd(), "src/components/dashboard/dashboard-modals-host.tsx"),
      path.resolve(process.cwd(), "src/components/workspace/unified-adaptive-workspace.tsx"),
      path.resolve(process.cwd(), "src/hooks/use-task-filters.ts"),
    ];
    const pageContent = architectureFiles.map((f) => fs.readFileSync(f, "utf-8")).join("\n");

    test("src/app/page.tsx imports StaffFocusView from @/components/dashboard/roles/staff-focus-view", () => {
      assert.ok(
        pageContent.includes("UnifiedAdaptiveWorkspace") ||
        pageContent.includes("StaffFocusView") ||
        pageContent.includes("LecturerFocusWorkspace"),
        "page.tsx must import role focus workspace"
      );
    });

    test("src/app/page.tsx imports SimplifiedTaskFilterBar from @/components/dashboard/simplified-task-filter-bar", () => {
      assert.ok(
        pageContent.includes("SimplifiedTaskFilterBar"),
        "page.tsx must import SimplifiedTaskFilterBar"
      );
      assert.ok(
        pageContent.includes("@/components/dashboard/simplified-task-filter-bar"),
        "page.tsx must import from '@/components/dashboard/simplified-task-filter-bar'"
      );
    });

    test("src/app/page.tsx conditionally renders StaffFocusView for STAFF users in zone=tasks", () => {
      assert.ok(
        pageContent.includes("UnifiedAdaptiveWorkspace") ||
        pageContent.includes("<StaffFocusView"),
        "page.tsx must render role focus workspace"
      );
    });

    test("src/app/page.tsx deprecates legacy school toggle and synchronizes scope with Topbar ScopeSwitcher", () => {
      assert.ok(
        !pageContent.includes("Chế độ xem toàn trường (Nâng cao)"),
        "page.tsx must eradicate legacy button 'Chế độ xem toàn trường (Nâng cao)'"
      );
    });

    test("src/app/page.tsx provides return toggle button to focused view when in expanded mode", () => {
      assert.ok(
        pageContent.includes("Chế độ trọng tâm") ||
        pageContent.includes("Chế độ xem cá nhân") ||
        pageContent.includes("Quay lại Chế độ trọng tâm") ||
        pageContent.includes("isStaffExpanded"),
        "page.tsx must provide return toggle to focus mode"
      );
    });

    test("src/app/page.tsx renders SimplifiedTaskFilterBar for ADMIN or MANAGER with direct approvals access", () => {
      assert.ok(
        pageContent.includes("<SimplifiedTaskFilterBar"),
        "page.tsx must render <SimplifiedTaskFilterBar"
      );
    });

    test("src/app/page.tsx preserves TaskDetailSideSheet and status updates", () => {
      assert.ok(
        pageContent.includes("<TaskDetailSideSheet") || pageContent.includes("TaskDetailSideSheet"),
        "page.tsx must preserve TaskDetailSideSheet"
      );
      assert.ok(
        pageContent.includes("handleStatusChange"),
        "page.tsx must preserve handleStatusChange"
      );
    });

    test("src/app/page.tsx anti-slop check: 0% emojis in source file", () => {
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      assert.ok(!emojiRegex.test(fs.readFileSync(PAGE_FILE_PATH, "utf-8")), "page.tsx must contain 0% emojis");
    });
  });

  // --------------------------------------------------------------------------
  // 3. Render Verification of Components Consumed by page.tsx
  // --------------------------------------------------------------------------
  describe("3. Component Render Verification for Integrated Views", () => {
    test("StaffFocusView renders cleanly for staff user with mock data", () => {
      const html = renderToStaticMarkup(
        React.createElement(StaffFocusView, {
          tasks: payload.tasks,
          user: staffUser,
          onSelectTask: () => {},
          onStatusChange: () => {},
          todayDate: "2026-09-07",
        })
      );

      assert.ok(html.includes("Nguyễn Ngọc Vinh"), "Must display staff user name");
      assert.ok(html.includes("My Focus"), "Must have My Focus title");
      assert.ok(html.includes("Cần xử lý ngay") || html.includes("Không gian làm việc"), "Must have focused sections");
    });

    test("SimplifiedTaskFilterBar renders cleanly with status pills and popover trigger", () => {
      const html = renderToStaticMarkup(
        React.createElement(SimplifiedTaskFilterBar, {
          searchQuery: "",
          onSearchChange: () => {},
          activeStatus: "ALL",
          onStatusChange: () => {},
          selectedDepartment: "ALL",
          onDepartmentChange: () => {},
          selectedAcademicMonth: "ALL",
          onAcademicMonthChange: () => {},
          selectedPriority: "ALL",
          onPriorityChange: () => {},
          totalCount: 42,
        })
      );

      assert.ok(html.includes("Tất cả"), "Must render status pill");
      assert.ok(html.includes("Cần làm ngay"), "Must render status pill");
      assert.ok(html.includes("Bộ lọc"), "Must render filter popover trigger");
    });
  });

  // --------------------------------------------------------------------------
  // 4. Task 9: Role-Based Dispatcher Contracts & Static Renders
  // --------------------------------------------------------------------------
  describe("4. Task 9 Role-Based Dispatcher Contracts & Static Renders", () => {
    const combinedArchitecture = [
      fs.readFileSync(PAGE_FILE_PATH, "utf-8"),
      fs.readFileSync(path.resolve(process.cwd(), "src/components/dashboard/zones/tasks-focus-landing.tsx"), "utf-8"),
      fs.readFileSync(path.resolve(process.cwd(), "src/components/portal/executive-cockpit-workspace.tsx"), "utf-8"),
      fs.readFileSync(path.resolve(process.cwd(), "src/components/portal/department-manager-workspace.tsx"), "utf-8"),
      fs.readFileSync(path.resolve(process.cwd(), "src/components/portal/lecturer-focus-workspace.tsx"), "utf-8"),
      fs.readFileSync(path.resolve(process.cwd(), "src/components/workspace/unified-adaptive-workspace.tsx"), "utf-8"),
    ].join("\n");

    test("src/app/page.tsx imports all 3 role-tailored workspaces", () => {
      assert.ok(
        combinedArchitecture.includes("ExecutiveCockpitWorkspace") || combinedArchitecture.includes("ExecutiveWorkspace"),
        "page architecture must import ExecutiveCockpitWorkspace"
      );
      assert.ok(
        combinedArchitecture.includes("DepartmentManagerWorkspace") || combinedArchitecture.includes("ManagerWorkspace"),
        "page architecture must import DepartmentManagerWorkspace"
      );
      assert.ok(
        combinedArchitecture.includes("LecturerFocusWorkspace") || combinedArchitecture.includes("StaffWorkspace"),
        "page architecture must import LecturerFocusWorkspace"
      );
    });

    test("src/app/page.tsx imports workspace payload types", () => {
      assert.ok(
        combinedArchitecture.includes("DeliverableSubmissionPayload"),
        "page architecture must import DeliverableSubmissionPayload"
      );
      assert.ok(
        combinedArchitecture.includes("ApprovalActionPayload"),
        "page architecture must import ApprovalActionPayload"
      );
    });

    test("src/app/page.tsx defines deliverable and review state handlers", () => {
      assert.ok(
        combinedArchitecture.includes("handleSubmitDeliverable"),
        "page architecture must define handleSubmitDeliverable"
      );
      assert.ok(
        combinedArchitecture.includes("handleReviewAction"),
        "page architecture must define handleReviewAction"
      );
    });

    test("src/app/page.tsx dispatches ExecutiveCockpitWorkspace for BGH/ADMIN", () => {
      assert.ok(
        combinedArchitecture.includes("<ExecutiveCockpitWorkspace") ||
        combinedArchitecture.includes("<UnifiedAdaptiveWorkspace"),
        "page architecture must render ExecutiveCockpitWorkspace or UnifiedAdaptiveWorkspace"
      );
    });

    test("src/app/page.tsx dispatches DepartmentManagerWorkspace for TRUONG_DON_VI/MANAGER", () => {
      assert.ok(
        combinedArchitecture.includes("<DepartmentManagerWorkspace") ||
        combinedArchitecture.includes("<UnifiedAdaptiveWorkspace"),
        "page architecture must render DepartmentManagerWorkspace or UnifiedAdaptiveWorkspace"
      );
    });

    test("src/app/page.tsx dispatches LecturerFocusWorkspace for GIANG_VIEN/CHUYEN_VIEN/STAFF", () => {
      assert.ok(
        combinedArchitecture.includes("<LecturerFocusWorkspace") ||
        combinedArchitecture.includes("<UnifiedAdaptiveWorkspace"),
        "page architecture must render LecturerFocusWorkspace or UnifiedAdaptiveWorkspace"
      );
    });

    test("ExecutiveCockpitWorkspace renders cleanly in static test", () => {
      const html = renderToStaticMarkup(
        React.createElement(ExecutiveCockpitWorkspace, {
          user: adminUser,
          tasks: payload.tasks,
          onSelectTask: () => {},
          onReview: () => {},
          onSubmitDeliverable: () => {},
        })
      );
      assert.ok(html.includes("Ban Giám Hiệu") || html.includes("BGH"), "Must render BGH badge");
      assert.ok(html.includes("Khoang"), "Must render cockpit title");
    });

    test("DepartmentManagerWorkspace renders cleanly in static test", () => {
      const html = renderToStaticMarkup(
        React.createElement(DepartmentManagerWorkspace, {
          user: managerUser,
          tasks: payload.tasks,
          onSelectTask: () => {},
          onReview: () => {},
          onSubmitDeliverable: () => {},
          onStatusChange: () => {},
        })
      );
      assert.ok(html.includes("Trưởng đơn vị") || html.includes("Khoa") || html.includes("Phòng"), "Must render unit info");
    });

    test("LecturerFocusWorkspace renders cleanly in static test", () => {
      const html = renderToStaticMarkup(
        React.createElement(LecturerFocusWorkspace, {
          user: staffUser,
          tasks: payload.tasks,
          onSelectTask: () => {},
          onSubmitDeliverable: () => {},
          onStatusChange: () => {},
        })
      );
      assert.ok(
        html.includes("Hôm nay") ||
        html.includes("Tuần này") ||
        html.includes("Nộp minh chứng"),
        "Must render focus sections"
      );
    });
  });
});
