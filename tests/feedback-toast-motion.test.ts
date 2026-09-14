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
      const variants: ToastItem["variant"][] = [
        "info",
        "success",
        "warning",
        "error",
      ];

      for (const variant of variants) {
        const toast: ToastItem = {
          id: `toast-${variant}`,
          title: `Tiêu đề ${variant}`,
          message: `Nội dung thông báo ${variant}`,
          variant,
        };

        const html = renderToStaticMarkup(
          React.createElement(FeedbackToast, {
            toast,
            onDismiss: () => {},
          })
        );

        assert.ok(
          html.includes(`Nội dung thông báo ${variant}`),
          `Toast ${variant} should render message`
        );
        assert.ok(
          html.includes(`role="status"`),
          `Toast ${variant} must have role=status`
        );
        assert.ok(
          html.includes(`aria-live="polite"`),
          `Toast ${variant} must have aria-live=polite`
        );
      }
    });

    it("renders action button and callbacks when provided", () => {
      const toast: ToastItem = {
        id: "action-toast",
        message: "Hành động hoàn tác",
        variant: "info",
        action: {
          label: "Hoàn tác",
          onClick: () => {},
        },
      };

      const html = renderToStaticMarkup(
        React.createElement(FeedbackToast, {
          toast,
          onDismiss: () => {},
        })
      );

      assert.ok(html.includes("Hoàn tác"), "Should render action button label");
    });

    it("renders ToastContainer with multiple toasts", () => {
      const toasts: ToastItem[] = [
        { id: "1", message: "Thông báo 1", variant: "info" },
        { id: "2", message: "Thông báo 2", variant: "success" },
      ];

      const html = renderToStaticMarkup(
        React.createElement(ToastContainer, {
          toasts,
          onDismiss: () => {},
        })
      );

      assert.ok(html.includes("Thông báo 1"));
      assert.ok(html.includes("Thông báo 2"));
      assert.ok(html.includes('aria-label="Thông báo hệ thống"'));
    });
  });

  describe("Motion variant token fidelity", () => {
    it("toastVariants includes initial, animate, and exit states", () => {
      assert.ok(toastVariants.initial, "toastVariants must have initial state");
      assert.ok(toastVariants.animate, "toastVariants must have animate state");
      assert.ok(toastVariants.exit, "toastVariants must have exit state");
    });
  });
});
