import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buttonVariants } from "../src/components/ui/button";
import { badgeVariants } from "../src/components/ui/badge";
import { Input } from "../src/components/ui/input";
import { UserAvatar } from "../src/components/ui/user-avatar";
import { InlineAlert } from "../src/components/ui/inline-alert";
import { Tabs, TabsList, TabsTrigger } from "../src/components/ui/tabs";
import { getInitials } from "../src/lib/utils";

describe("UI Components Ergonomics & Touch Targets", () => {
  describe("Button Component Ergonomics", () => {
    it("should have h-9 (36px mobile), px-3.5, py-1.5, and text-sm for default size", () => {
      const defaultClasses = buttonVariants({ size: "default" });
      assert.match(defaultClasses, /\bh-9\b/, "Button default size should be h-9 (36px) on mobile");
      assert.match(defaultClasses, /\bpx-3\.5\b/, "Button default size should have px-3.5");
      assert.match(defaultClasses, /\bpy-1\.5\b/, "Button default size should have py-1.5");
      assert.ok(defaultClasses.includes("sm:h-8.5"), "Desktop button height must be 34px");
      assert.match(defaultClasses, /\btext-sm\b/, "Button default size should have text-sm (14px)");
      assert.ok(defaultClasses.includes("motion-reduce:transition-none"), "Button must respect motion-reduce");
    });

    // Số đo nút của Linear (DOM linear.app 14/10/2026): cao 28px, lề ngang 10px, chữ 12px đậm 500
    it("should have h-7, rounded-lg, px-2.5, text-xs, and font-medium for sm size", () => {
      const smClasses = buttonVariants({ size: "sm" });
      assert.match(smClasses, /\bh-7\b/, "Button sm size should have h-7 (28px)");
      assert.match(smClasses, /\brounded-lg\b/, "Button sm size should have rounded-lg");
      assert.match(smClasses, /\bpx-2\.5\b/, "Button sm size should have px-2.5 (10px như Linear)");
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
    it("should enforce h-10 (40px mobile), px-3.5, py-2, and text-sm", () => {
      const html = renderToStaticMarkup(React.createElement(Input));
      assert.match(html, /\bh-10\b/, "Input should have h-10 (40px mobile height)");
      assert.match(html, /\bpx-3\.5\b/, "Input should have px-3.5 padding");
      assert.match(html, /\bpy-2\b/, "Input should have py-2 padding");
      assert.ok(html.includes("sm:h-9"), "Desktop input height must be 36px");
      assert.match(html, /\btext-sm\b/, "Input should have text-sm (14px font size)");
    });

    // globals.css ép ô nhập trên điện thoại về 16px (chống iPhone phóng trang) trừ ô có data-large-text; ô tên hộp Tạo cuộc họp
    // từng bị ép từ 20px xuống 16px (22/10/2026)
    it("title variant keeps its 20px phone size out of the 16px input rule", () => {
      assert.match(renderToStaticMarkup(React.createElement(Input, { variant: "title" })), /data-large-text="true"/);
      assert.doesNotMatch(renderToStaticMarkup(React.createElement(Input)), /data-large-text/);
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
  });

  describe("Tabs Component", () => {
    it("gắn data-horizontal trên gốc để biến thể chiều cao h-7/h-8 của TabsList có hiệu lực", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          Tabs,
          { value: "a" },
          React.createElement(TabsList, { size: "sm" }, React.createElement(TabsTrigger, { value: "a" }, "A"))
        )
      );
      assert.match(html, /data-slot="tabs"[^>]*data-horizontal=""/);
      assert.ok(html.includes("group-data-horizontal/tabs:h-7"), "TabsList sm cao 28px");
      assert.doesNotMatch(html, /\sdata-vertical=/, "Tabs ngang không gắn data-vertical");
    });
  });
});
