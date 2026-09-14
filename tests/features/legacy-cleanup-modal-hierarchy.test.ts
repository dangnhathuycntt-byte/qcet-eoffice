import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";

// Test suite for Task 12: Legacy Portal Cleanup, Modal Hierarchy & Final QA Gate
describe("Task 12: Legacy Portal Cleanup, Modal Hierarchy & Unified Feedback", () => {
  // ==========================================================================
  // 1. Unified Feedback Layer Contract
  // ==========================================================================
  describe("1. Unified Feedback Layer (src/components/ui/feedback-layer.tsx)", () => {
    it("exports required components and hooks", async () => {
      const mod = await import("@/components/ui/feedback-layer");
      assert.ok(typeof mod.InlineAlertBanner === "function", "InlineAlertBanner must be a component function");
      assert.ok(typeof mod.FormValidationSummary === "function", "FormValidationSummary must be a component function");
      assert.ok(typeof mod.FeedbackToast === "function", "FeedbackToast must be a component function");
      assert.ok(typeof mod.ToastContainer === "function", "ToastContainer must be a component function");
      assert.ok(typeof mod.FeedbackProvider === "function", "FeedbackProvider must be a component function");
      assert.ok(typeof mod.useFeedback === "function", "useFeedback hook must be exported");
    });

    it("FormValidationSummary returns null when error list is empty", async () => {
      const mod = await import("@/components/ui/feedback-layer");
      const renderedEmpty = mod.FormValidationSummary({ errors: [] });
      assert.equal(renderedEmpty, null, "FormValidationSummary should return null when errors are empty");
    });

    it("InlineAlertBanner assigns correct ARIA roles per variant", async () => {
      const mod = await import("@/components/ui/feedback-layer");

      const infoBanner = mod.InlineAlertBanner({
        variant: "info",
        title: "Thông tin",
        children: "Hệ thống đang hoạt động bình thường",
      });
      assert.equal(infoBanner.props.role, "status", "info variant must use role=status");

      const errorBanner = mod.InlineAlertBanner({
        variant: "error",
        title: "Lỗi",
        children: "Thao tác thất bại",
      });
      assert.equal(errorBanner.props.role, "alert", "error variant must use role=alert");

      const warningBanner = mod.InlineAlertBanner({
        variant: "warning",
        title: "Cảnh báo",
        children: "Minh chứng cần chỉnh sửa",
      });
      assert.equal(warningBanner.props.role, "alert", "warning variant must use role=alert");

      const successBanner = mod.InlineAlertBanner({
        variant: "success",
        title: "Thành công",
        children: "Đã phê duyệt",
      });
      assert.equal(successBanner.props.role, "status", "success variant must use role=status");
    });
  });

  // ==========================================================================
  // 3. Legacy Portal Workspaces & Canonical Attention Hubs
  // ==========================================================================
  describe("3. Legacy Portal Clean Shims & Attention Hubs Delegation", () => {
    it("workspace index exports ExecutiveAttentionHub, DepartmentAttentionHub, StaffAttentionHub", async () => {
      const workspaceMod = await import("@/components/workspace");
      assert.ok(
        typeof workspaceMod.ExecutiveAttentionHub === "function",
        "ExecutiveAttentionHub must be exported"
      );
      assert.ok(
        typeof workspaceMod.DepartmentAttentionHub === "function",
        "DepartmentAttentionHub must be exported"
      );
      assert.ok(
        typeof workspaceMod.StaffAttentionHub === "function",
        "StaffAttentionHub must be exported"
      );
    });

    it("executive-cockpit-workspace exports ExecutiveAttentionHub and delegates cleanly", async () => {
      const execMod = await import("@/components/portal/executive-cockpit-workspace");
      assert.ok(
        typeof execMod.ExecutiveAttentionHub === "function",
        "executive-cockpit-workspace must export ExecutiveAttentionHub"
      );
      assert.ok(
        typeof execMod.ExecutiveCockpitWorkspace === "function",
        "executive-cockpit-workspace must export ExecutiveCockpitWorkspace"
      );
      // Pure calculations and constants remain intact
      assert.ok(Array.isArray(execMod.EMPTY_TASKS), "EMPTY_TASKS array must be exported");
    });

    it("department-manager-workspace exports DepartmentAttentionHub and delegates cleanly", async () => {
      const deptMod = await import("@/components/portal/department-manager-workspace");
      assert.ok(
        typeof deptMod.DepartmentAttentionHub === "function",
        "department-manager-workspace must export DepartmentAttentionHub"
      );
      assert.ok(
        typeof deptMod.DepartmentManagerWorkspace === "function",
        "department-manager-workspace must export DepartmentManagerWorkspace"
      );
      // Legacy backwards compatibility preserved
      assert.ok(
        typeof deptMod.LegacyDepartmentManagerWorkspace === "function",
        "LegacyDepartmentManagerWorkspace must be preserved"
      );
    });

    it("lecturer-focus-workspace exports StaffAttentionHub and delegates cleanly", async () => {
      const lectMod = await import("@/components/portal/lecturer-focus-workspace");
      assert.ok(
        typeof lectMod.StaffAttentionHub === "function",
        "lecturer-focus-workspace must export StaffAttentionHub"
      );
      assert.ok(
        typeof lectMod.LecturerFocusWorkspace === "function",
        "lecturer-focus-workspace must export LecturerFocusWorkspace"
      );
      // Helper calculations preserved
      assert.ok(
        typeof lectMod.getDaysRemaining === "function",
        "getDaysRemaining must be preserved"
      );
      assert.ok(
        typeof lectMod.sortStaffTasks === "function",
        "sortStaffTasks must be preserved"
      );
      assert.ok(
        typeof lectMod.renderStatusBadge === "function",
        "renderStatusBadge must be preserved"
      );
    });
  });

});
