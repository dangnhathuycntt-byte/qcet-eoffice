import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buttonVariants } from "../src/components/ui/button";
import { badgeVariants } from "../src/components/ui/badge";
import { Input } from "../src/components/ui/input";

describe("UI Components Ergonomics & Touch Targets", () => {
  describe("Button Component Ergonomics", () => {
    it("should have h-10, px-4, py-2, and text-sm for default size", () => {
      const defaultClasses = buttonVariants({ size: "default" });
      assert.match(defaultClasses, /\bh-10\b/, "Button default size should have h-10 (40px touch target)");
      assert.match(defaultClasses, /\bpx-4\b/, "Button default size should have px-4");
      assert.match(defaultClasses, /\bpy-2\b/, "Button default size should have py-2");
      assert.match(defaultClasses, /\btext-sm\b/, "Button default size should have text-sm (14px)");
    });

    it("should have h-8.5, rounded-lg, px-3, text-xs, and font-semibold for sm size", () => {
      const smClasses = buttonVariants({ size: "sm" });
      assert.match(smClasses, /\bh-8\.5\b/, "Button sm size should have h-8.5 (34px)");
      assert.match(smClasses, /\brounded-lg\b/, "Button sm size should have rounded-lg");
      assert.match(smClasses, /\bpx-3\b/, "Button sm size should have px-3");
      assert.match(smClasses, /\btext-xs\b/, "Button sm size should have text-xs (12px)");
      assert.match(smClasses, /\bfont-semibold\b/, "Button sm size should have font-semibold");
    });
  });

  describe("Badge Component Typography & Sizing", () => {
    it("should enforce floor >= 12px (text-xs), font-semibold, font-mono, py-1, and px-2.5", () => {
      const defaultBadge = badgeVariants({ variant: "default" });
      assert.match(defaultBadge, /\btext-xs\b/, "Badge typography floor must be text-xs (>= 12px)");
      assert.match(defaultBadge, /\bfont-semibold\b/, "Badge should have font-semibold");
      assert.match(defaultBadge, /\bfont-mono\b/, "Badge should have font-mono for clear tabular numbers");
      assert.match(defaultBadge, /\bpy-1\b/, "Badge should have py-1 vertical padding");
      assert.match(defaultBadge, /\bpx-2\.5\b/, "Badge should have px-2.5 horizontal padding");
    });
  });

  describe("Input Component Ergonomics", () => {
    it("should enforce h-10, px-3.5, py-2, and text-sm", () => {
      const html = renderToStaticMarkup(React.createElement(Input));
      assert.match(html, /\bh-10\b/, "Input should have h-10 (40px height)");
      assert.match(html, /\bpx-3\.5\b/, "Input should have px-3.5 padding");
      assert.match(html, /\bpy-2\b/, "Input should have py-2 padding");
      assert.match(html, /\btext-sm\b/, "Input should have text-sm (14px font size)");
    });
  });
});
