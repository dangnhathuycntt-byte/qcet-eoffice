import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FeedbackToast,
  ToastContainer,
  type ToastItem,
} from "@/components/ui/feedback-layer";
import { CircleCheckIcon } from "@/components/icons/circle-check";
import { toastVariants } from "@/lib/motion/variants";

const rootDir = process.cwd();

describe("Wave 2 - Agent E: Feedback / Toast Layer & Icon Pilot Motion Invariants", () => {
  const feedbackLayerPath = path.join(
    rootDir,
    "src/components/ui/feedback-layer.tsx"
  );
  const iconPilotPath = path.join(
    rootDir,
    "src/components/icons/circle-check.tsx"
  );

  const feedbackLayerSource = fs.readFileSync(feedbackLayerPath, "utf-8");
  const iconPilotSource = fs.readFileSync(iconPilotPath, "utf-8");

  describe("Zero framer-motion ban", () => {
    it("feedback-layer does not import framer-motion", () => {
      assert.doesNotMatch(feedbackLayerSource, /from\s+["']framer-motion["']/);
      assert.doesNotMatch(feedbackLayerSource, /from\s+["']framer-motion\//);
    });

    it("circle-check icon pilot does not import framer-motion", () => {
      assert.doesNotMatch(iconPilotSource, /from\s+["']framer-motion["']/);
      assert.doesNotMatch(iconPilotSource, /from\s+["']framer-motion\//);
    });
  });

  describe("Feedback / Toast Layer Motion Specification", () => {
    it("imports AnimatePresence from motion/react", () => {
      assert.match(
        feedbackLayerSource,
        /import\s+\{[^}]*AnimatePresence[^}]*\}\s+from\s+["']motion\/react["']/
      );
    });

    it("imports * as m from motion/react-m strictly", () => {
      assert.match(
        feedbackLayerSource,
        /import\s+\*\s+as\s+m\s+from\s+["']motion\/react-m["']/
      );
      assert.doesNotMatch(
        feedbackLayerSource,
        /import\s+\{[^}]*\bmotion\b[^}]*\}\s+from\s+["']motion\/react["']/
      );
    });

    it("imports toastVariants from @/lib/motion/variants", () => {
      assert.match(
        feedbackLayerSource,
        /import\s+\{[^}]*toastVariants[^}]*\}\s+from\s+["']@\/lib\/motion\/variants["']/
      );
    });

    it("ToastContainer wraps toast list in AnimatePresence with popLayout mode", () => {
      assert.match(
        feedbackLayerSource,
        /<AnimatePresence\s+initial=\{false\}\s+mode="popLayout">/
      );
    });

    it("FeedbackToast renders m.div with layout and toast motion contract", () => {
      assert.match(feedbackLayerSource, /<m\.div[^>]*layout/);
      assert.match(feedbackLayerSource, /variants=\{toastVariants\}/);
      assert.match(feedbackLayerSource, /exit=\{\{ opacity: 0, y: 4/);
    });

    it("preserves accessibility contracts (role=status, aria-live=polite, dismiss labels)", () => {
      assert.match(feedbackLayerSource, /role="status"/);
      assert.match(feedbackLayerSource, /aria-live="polite"/);
      assert.match(feedbackLayerSource, /aria-label="Đóng thông báo nổi"/);
      assert.match(feedbackLayerSource, /aria-label="Thông báo hệ thống"/);
    });
  });

  describe("Icon Pilot Specification", () => {
    it("uses * as m from motion/react-m without full motion import", () => {
      assert.match(
        iconPilotSource,
        /import\s+\*\s+as\s+m\s+from\s+["']motion\/react-m["']/
      );
      assert.doesNotMatch(
        iconPilotSource,
        /import\s+\{[^}]*\bmotion\b[^}]*\}\s+from\s+["']motion\/react["']/
      );
    });

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
