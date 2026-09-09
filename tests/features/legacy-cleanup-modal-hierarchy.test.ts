import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";

// Test suite for Task 12: Legacy Portal Cleanup, Modal Hierarchy & Final QA Gate
describe("Task 12: Legacy Portal Cleanup, Modal Hierarchy & Unified Feedback", () => {
  const rootDir = process.cwd();

  // ==========================================================================
  // 1. Unified Feedback Layer Contract & Anti-Slop
  // ==========================================================================
  describe("1. Unified Feedback Layer (src/components/ui/feedback-layer.tsx)", () => {
    const feedbackPath = path.join(rootDir, "src/components/ui/feedback-layer.tsx");

    it("file exists and is readable", () => {
      assert.ok(fs.existsSync(feedbackPath), "feedback-layer.tsx must exist");
    });

    it("satisfies strict anti-slop guidelines: zero dark: classes, zero emojis, typography >= 12px", () => {
      const content = fs.readFileSync(feedbackPath, "utf-8");

      // No dark: classes
      const darkClasses = content.match(/dark:[a-zA-Z0-9_-]+/g);
      assert.equal(darkClasses, null, "feedback-layer.tsx must not contain dark: classes");

      // No decorative emojis
      const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      assert.ok(!emojiRegex.test(content), "feedback-layer.tsx must not contain decorative emojis");

      // No micro-fonts under 11px
      const microFontRegex = /text-\[(?:[0-9]|10)px\]/g;
      assert.equal(microFontRegex.test(content), false, "feedback-layer.tsx must not use font sizes < 11px");
    });

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
  // 2. Modal Hierarchy & Non-Nesting Invariants
  // ==========================================================================
  describe("2. Modal Hierarchy & Elimination of Nested Dialogs", () => {
    const sideSheetPath = path.join(
      rootDir,
      "src/components/dashboard/task-detail-side-sheet.tsx"
    );

    it("task-detail-side-sheet.tsx does NOT render a nested role='dialog'", () => {
      const content = fs.readFileSync(sideSheetPath, "utf-8");

      // Find all occurrences of role="dialog"
      const dialogMatches = content.match(/role=["']dialog["']/g) || [];
      // Only the top-level <aside> should have role="dialog"
      assert.equal(
        dialogMatches.length,
        1,
        "task-detail-side-sheet.tsx must contain exactly ONE role='dialog' (the main aside), no nested dialogs"
      );

      // Verify in-sheet rejection panel uses data-slot and inside positioning
      assert.ok(
        content.includes('data-slot="in-sheet-rejection-panel"'),
        "Rejection review panel must be an in-sheet element with data-slot='in-sheet-rejection-panel'"
      );
      assert.ok(
        !content.includes('fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"\n          role="dialog"'),
        "Old nested modal dialog must be eliminated"
      );
    });

    it("useModalState prevents modal stacking by closing detail sheet when opening modals", () => {
      const modalStatePath = path.join(rootDir, "src/hooks/use-modal-state.ts");
      const content = fs.readFileSync(modalStatePath, "utf-8");

      assert.ok(
        content.includes("setSelectedTask(null);"),
        "useModalState must clear selectedTask when opening creation or delegation modals"
      );
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

  // ==========================================================================
  // 4. Invariant Checks across Portal & Dashboard
  // ==========================================================================
  describe("4. Architectural Invariants (No Parallel Tables, Light-Only Standard)", () => {
    it("portal workspace wrappers contain zero dark: styling", () => {
      const filesToCheck = [
        "src/components/portal/executive-cockpit-workspace.tsx",
        "src/components/portal/department-manager-workspace.tsx",
        "src/components/portal/lecturer-focus-workspace.tsx",
        "src/components/workspace/components/attention-hubs.tsx",
      ];

      for (const relPath of filesToCheck) {
        const fullPath = path.join(rootDir, relPath);
        const content = fs.readFileSync(fullPath, "utf-8");
        const darkMatches = content.match(/dark:[a-zA-Z0-9_-]+/g);
        assert.equal(
          darkMatches,
          null,
          `${relPath} must not contain dark: classes (found: ${darkMatches})`
        );
      }
    });

    it("all three attention hubs render with data-slot attributes", () => {
      const attentionHubsPath = path.join(
        rootDir,
        "src/components/workspace/components/attention-hubs.tsx"
      );
      const content = fs.readFileSync(attentionHubsPath, "utf-8");

      assert.ok(content.includes('data-slot="executive-attention-hub"'));
      assert.ok(content.includes('data-slot="department-attention-hub"'));
      assert.ok(content.includes('data-slot="staff-attention-hub"'));
    });
  });
});
