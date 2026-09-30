import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buttonVariants } from "../src/components/ui/button";
import { badgeVariants } from "../src/components/ui/badge";
import { Input } from "../src/components/ui/input";

describe("UI Components Ergonomics & Touch Targets", () => {
  describe("Button Component Ergonomics", () => {
    it("should have h-11, px-3.5, py-1.5, and text-sm for default size", () => {
      const defaultClasses = buttonVariants({ size: "default" });
      assert.match(defaultClasses, /\bh-11\b/, "Button default size should have h-11 (44px touch target)");
      assert.match(defaultClasses, /\bpx-3\.5\b/, "Button default size should have px-3.5");
      assert.match(defaultClasses, /\bpy-1\.5\b/, "Button default size should have py-1.5");
      assert.ok(defaultClasses.includes("sm:h-8.5"), "Desktop button height must be 34px");
      assert.match(defaultClasses, /\btext-sm\b/, "Button default size should have text-sm (14px)");
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
});
