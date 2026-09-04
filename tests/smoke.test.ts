import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cn } from "../src/lib/utils";
import { twentyTokens, NAV_ITEMS } from "../src/lib/tokens";
import { buttonVariants } from "../src/components/ui/button";
import { badgeVariants } from "../src/components/ui/badge";
import { NAVIGATION_ITEMS } from "../src/components/navigation";

describe("Twenty Design System Smoke Test Suite", () => {
  describe("Utility function: cn()", () => {
    it("merges regular class names cleanly", () => {
      const result = cn("text-sm", "font-bold");
      assert.equal(result, "text-sm font-bold");
    });

    it("handles conditional classes and falsy values", () => {
      const isTrue = true;
      const isFalse = false;
      const result = cn(
        "base-class",
        isTrue && "active-class",
        isFalse && "inactive-class",
        null,
        undefined
      );
      assert.equal(result, "base-class active-class");
    });

    it("resolves conflicting Tailwind utility classes correctly", () => {
      const result = cn("px-2 py-1 bg-red-500", "px-4 bg-blue-500");
      assert.equal(result, "py-1 px-4 bg-blue-500");
    });
  });

  describe("Twenty Design System Tokens (Light-Mode Prioritized)", () => {
    it("defines clean canvas and card background tokens", () => {
      assert.equal(twentyTokens.colors.light.appBg, "#FBFBFB");
      assert.equal(twentyTokens.colors.light.cardBg, "#FFFFFF");
      assert.equal(twentyTokens.colors.light.border, "#E4E4E7");
      assert.equal(twentyTokens.colors.light.textPrimary, "#09090B");
    });

    it("defines Twenty signature solid action surface (charcoal/black)", () => {
      assert.equal(twentyTokens.colors.light.accentPrimary, "#18181B");
      assert.equal(twentyTokens.colors.light.accentForeground, "#FFFFFF");
    });

    it("defines status badge palette with soft pastel fills", () => {
      assert.equal(twentyTokens.statusColors.completed.bg, "#ECFDF5");
      assert.equal(twentyTokens.statusColors.completed.text, "#047857");
      assert.equal(twentyTokens.statusColors.inProgress.bg, "#EFF6FF");
      assert.equal(twentyTokens.statusColors.inProgress.text, "#1D4ED8");
      assert.equal(twentyTokens.statusColors.needsReview.bg, "#FFFBEB");
      assert.equal(twentyTokens.statusColors.needsReview.text, "#B45309");
      assert.equal(twentyTokens.statusColors.new.bg, "#FEF2F2");
      assert.equal(twentyTokens.statusColors.new.text, "#B91C1C");
    });

    it("defines 8px card and 6px control radius", () => {
      assert.equal(twentyTokens.radius.card, "0.5rem"); // 8px
      assert.equal(twentyTokens.radius.control, "0.375rem"); // 6px
    });

    it("globals.css contains Twenty CSS variables matching tokens", () => {
      const cssPath = path.resolve(__dirname, "../src/app/globals.css");
      assert.ok(fs.existsSync(cssPath), "globals.css should exist");
      const cssContent = fs.readFileSync(cssPath, "utf-8");

      assert.ok(cssContent.includes("--background: #FBFBFB;"), "CSS contains light background");
      assert.ok(cssContent.includes("--card: #FFFFFF;"), "CSS contains light card");
      assert.ok(cssContent.includes("--border: #E4E4E7;"), "CSS contains light border");
      assert.ok(cssContent.includes("--primary: #18181B;"), "CSS contains Twenty black primary");
      assert.ok(cssContent.includes("--radius: 0.5rem;"), "CSS contains 0.5rem radius");
    });
  });

  describe("Base UI Component Variants", () => {
    it("buttonVariants generates proper Twenty solid action styles", () => {
      const defaultButton = buttonVariants({ variant: "default" });
      assert.ok(defaultButton.includes("bg-primary"));
      assert.ok(defaultButton.includes("text-primary-foreground"));
      assert.ok(defaultButton.includes("rounded-md"));

      const outlineButton = buttonVariants({ variant: "outline" });
      assert.ok(outlineButton.includes("border-border"));
      assert.ok(outlineButton.includes("bg-card"));
    });

    it("badgeVariants generates proper status variants with 6px radius", () => {
      const defaultBadge = badgeVariants({ variant: "default" });
      assert.ok(defaultBadge.includes("rounded-md"));

      const successBadge = badgeVariants({ variant: "success" });
      assert.ok(successBadge.includes("bg-emerald-50"));

      const progressBadge = badgeVariants({ variant: "progress" });
      assert.ok(progressBadge.includes("bg-blue-50"));
    });
  });

  describe("Navigation Configuration", () => {
    it("defines required navigation items for Phase 1 E-Office", () => {
      const tokenRoutes = NAV_ITEMS.map((item) => item.href);
      const compRoutes = NAVIGATION_ITEMS.map((item) => item.href);

      assert.deepEqual(tokenRoutes, compRoutes, "token routes and component routes match");
      assert.ok(compRoutes.includes("/"), "includes home dashboard");
      assert.ok(compRoutes.includes("/tasks"), "includes tasks route");
    });
  });
});
