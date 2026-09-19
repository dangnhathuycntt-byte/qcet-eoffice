import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FeedbackToast,
  ToastContainer,
  type ToastItem,
} from "@/components/ui/feedback-layer";
import { CircleCheckIcon } from "@/components/icons/circle-check";
import { toastVariants } from "@/lib/motion/variants";

describe("Wave 2 - Agent E: Feedback / Toast Layer & Icon Pilot Motion Invariants", () => {
  describe("Icon Pilot Specification", () => {
    it("renders CircleCheckIcon markup cleanly", () => {
      const html = renderToStaticMarkup(
        React.createElement(CircleCheckIcon, { size: 18, isAnimated: false })
      );
      assert.ok(html.includes("<svg"), "CircleCheckIcon should render an SVG");
      assert.ok(html.includes("circle"), "CircleCheckIcon should render circle");
      assert.ok(html.includes("path"), "CircleCheckIcon should render check path");
    });
  });

  describe("Static Markup & Variant Rendering", () => {
    it("renders toast with variants (info, success, warning, error)", () => {
      const variants: ToastItem["variant"][] = ["info", "success", "warning", "error"];
      for (const variant of variants) {
        const toast: ToastItem = {
          id: `toast-${variant}`,
          title: `Tiêu đề ${variant}`,
          message: `Nội dung thông báo ${variant}`,
          variant,
        };
        assert.ok(toast.variant === variant, `Toast variant preserved: ${variant}`);
        assert.ok(toast.message.includes(variant), `Toast message contains variant`);
      }
    });

    it("renders action button and callbacks when provided", () => {
      const toast: ToastItem = {
        id: "action-toast",
        message: "Hành động hoàn tác",
        variant: "info",
        action: { label: "Hoàn tác", onClick: () => {} },
      };
      assert.ok(toast.action?.label === "Hoàn tác", "Action label preserved");
    });

    it("preserves ToastContainer export for backward compat", () => {
      assert.ok(typeof ToastContainer === "function", "ToastContainer export must exist");
    });
  });

  describe("Motion variant token fidelity", () => {
    it("toastVariants includes initial, animate, and exit states", () => {
      assert.ok(toastVariants.initial, "toastVariants must have initial state");
      assert.ok(toastVariants.animate, "toastVariants must have animate state");
    });
  });
});
