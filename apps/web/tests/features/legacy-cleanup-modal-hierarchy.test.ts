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

});
