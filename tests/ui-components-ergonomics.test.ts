import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buttonVariants } from "../src/components/ui/button";
import { badgeVariants } from "../src/components/ui/badge";
import { Input } from "../src/components/ui/input";
import { UserAvatar } from "../src/components/ui/user-avatar";
import { QuickEntry } from "../src/components/ui/quick-entry";
import { BulkActionBar } from "../src/components/ui/bulk-action-bar";
import { InlineAlert } from "../src/components/ui/inline-alert";
import { Spinner } from "../src/components/ui/spinner";
import { Progress } from "../src/components/ui/progress";
import { getInitials } from "../src/lib/utils";

describe("UI Components Ergonomics & Touch Targets", () => {
  describe("Button Component Ergonomics", () => {
    it("should have h-11, px-3.5, py-1.5, and text-sm for default size", () => {
      const defaultClasses = buttonVariants({ size: "default" });
      assert.match(defaultClasses, /\bh-11\b/, "Button default size should have h-11 (44px touch target)");
      assert.match(defaultClasses, /\bpx-3\.5\b/, "Button default size should have px-3.5");
      assert.match(defaultClasses, /\bpy-1\.5\b/, "Button default size should have py-1.5");
      assert.ok(defaultClasses.includes("sm:h-8.5"), "Desktop button height must be 34px");
      assert.match(defaultClasses, /\btext-sm\b/, "Button default size should have text-sm (14px)");
      assert.ok(defaultClasses.includes("motion-reduce:transition-none"), "Button must respect motion-reduce");
    });

    it("should have h-7, rounded-lg, px-3, text-xs, and font-medium for sm size", () => {
      const smClasses = buttonVariants({ size: "sm" });
      assert.match(smClasses, /\bh-7\b/, "Button sm size should have h-7 (28px)");
      assert.match(smClasses, /\brounded-lg\b/, "Button sm size should have rounded-lg");
      assert.match(smClasses, /\bpx-3\b/, "Button sm size should have px-3");
      assert.match(smClasses, /\btext-xs\b/, "Button sm size should have text-xs (12px)");
      assert.match(smClasses, /\bfont-medium\b/, "Button sm size should have font-medium");
    });
  });

  describe("Badge Component Typography & Sizing", () => {
    it("should enforce floor >= 12px (text-xs), font-medium, tabular-nums, py-0.5, and px-2", () => {
      const defaultBadge = badgeVariants({ variant: "default" });
      assert.match(defaultBadge, /\btext-xs\b/, "Badge typography floor must be text-xs (>= 12px)");
      assert.match(defaultBadge, /\bfont-medium\b/, "Badge should have font-medium");
      assert.match(defaultBadge, /\btabular-nums\b/, "Badge should have tabular-nums for clear tabular numbers");
      assert.match(defaultBadge, /\bpy-0\.5\b/, "Badge should have py-0.5 vertical padding");
      assert.match(defaultBadge, /\bpx-2\b/, "Badge should have px-2 horizontal padding");
      assert.ok(defaultBadge.includes("motion-reduce:transition-none"), "Badge must respect motion-reduce");
    });
  });

  describe("Input Component Ergonomics", () => {
    it("should enforce h-12, px-3.5, py-2, and text-sm", () => {
      const html = renderToStaticMarkup(React.createElement(Input));
      assert.match(html, /\bh-12\b/, "Input should have h-12 (48px mobile height)");
      assert.match(html, /\bpx-3\.5\b/, "Input should have px-3.5 padding");
      assert.match(html, /\bpy-2\b/, "Input should have py-2 padding");
      assert.ok(html.includes("sm:h-9"), "Desktop input height must be 36px");
      assert.match(html, /\btext-sm\b/, "Input should have text-sm (14px font size)");
    });
  });

  describe("UserAvatar & Initials Standards", () => {
    it("should correctly extract Vietnamese and single-word initials", () => {
      assert.equal(getInitials("Đặng Nhật Huy"), "ĐH");
      assert.equal(getInitials("Lê Văn Thí"), "LT");
      assert.equal(getInitials("Nguyễn Văn An"), "NA");
      assert.equal(getInitials("Huy"), "HU");
      assert.equal(getInitials(""), "QC");
      assert.equal(getInitials(null), "QC");
    });

    it("should render circular, shadowless avatar with accessible metadata", () => {
      const html = renderToStaticMarkup(React.createElement(UserAvatar, { name: "Đặng Nhật Huy", size: "sm" }));
      assert.match(html, /\brounded-full\b/, "Avatar must be rounded-full");
      assert.match(html, /\bsize-5\b/, "Avatar sm must have size-5 (20px)");
      assert.ok(!html.includes("shadow-"), "Avatar must be shadowless on flat surfaces");
      assert.ok(html.includes("Đặng Nhật Huy"), "Avatar root should have accessible name attribute");
    });

    it("should gracefully handle unassigned personnel with neutral fallback", () => {
      const html = renderToStaticMarkup(React.createElement(UserAvatar, { name: "Chưa phân công", size: "xs" }));
      assert.match(html, /\bsize-4\b/, "Avatar xs must have size-4 (16px)");
      assert.match(html, /\brounded-full\b/, "Avatar must be rounded-full");
      assert.ok(html.includes("<svg"), "Unassigned avatar should render neutral User icon");
    });
  });

  describe("Accessible Focus & Touch Target Standards (Lượt 7 Remediation)", () => {
    it("QuickEntry should have accessible aria-labels, focus-visible states, and touch padding", () => {
      const html = renderToStaticMarkup(
        React.createElement(QuickEntry, {
          defaultValue: "Nhiệm vụ mới",
          onSave: () => {},
        })
      );
      assert.ok(html.includes('aria-label="Lưu (Enter)"'), "Save button must have aria-label");
      assert.ok(html.includes('aria-label="Hủy (Esc)"'), "Cancel button must have aria-label");
      assert.ok(html.includes("focus-visible:outline-2"), "Buttons must have focus-visible ring");
      assert.ok(html.includes("before:-inset-2"), "Buttons must expand touch targets with pseudo before padding");
    });

    it("BulkActionBar should have accessible aria-labels and high-contrast focus rings on dark background", () => {
      const html = renderToStaticMarkup(
        React.createElement(BulkActionBar, {
          selectedCount: 3,
          totalCount: 10,
          onSelectAllPages: () => {},
          onClearSelection: () => {},
          actions: [{ label: "Chuyển giao", onClick: () => {} }],
        })
      );
      assert.ok(html.includes('aria-label="Chọn tất cả 10 mục"'), "Select all button must have aria-label");
      assert.ok(html.includes('aria-label="Bỏ chọn tất cả"'), "Clear button must have aria-label");
      assert.ok(html.includes("focus-visible:ring-2"), "Buttons on dark surface must have focus-visible ring");
    });

    it("InlineAlert should have accessible focus-visible states and expanded touch target on action button", () => {
      const html = renderToStaticMarkup(
        React.createElement(InlineAlert, {
          actionLabel: "Thử lại",
          onAction: () => {},
          children: "Đã có lỗi xảy ra",
        })
      );
      assert.ok(html.includes('aria-label="Thử lại"'), "Action button must have aria-label");
      assert.ok(html.includes("focus-visible:outline-2"), "Action button must have focus-visible");
      assert.ok(html.includes("before:-inset-2"), "Action button must expand touch area");
    });

    it("Spinner and Progress should adhere to motion-reduce standards", () => {
      const spinnerHtml = renderToStaticMarkup(React.createElement(Spinner));
      assert.ok(spinnerHtml.includes("motion-reduce:animate-none"), "Spinner must disable animation on motion-reduce");

      const progressHtml = renderToStaticMarkup(React.createElement(Progress, { value: 50 }));
      assert.ok(progressHtml.includes("motion-reduce:transition-none"), "Progress must disable transitions on motion-reduce");
    });
  });
});
