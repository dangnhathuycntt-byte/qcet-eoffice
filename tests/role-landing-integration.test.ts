import { test, describe } from "node:test";
import assert from "node:assert/strict";
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
