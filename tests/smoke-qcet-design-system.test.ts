import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cn } from "../src/lib/utils";
import { QCET_TOKENS, qcetTokens, NAV_ITEMS } from "../src/lib/tokens";
import { buttonVariants, Button } from "../src/components/ui/button";
import { badgeVariants, Badge } from "../src/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter } from "../src/components/ui/card";
import { Drawer } from "../src/components/ui/drawer";
import { Progress, ProgressTrack, ProgressIndicator } from "../src/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants } from "../src/components/ui/tabs";
import { NAVIGATION_ITEMS } from "../src/components/navigation";

describe("QCET Design System Smoke Test Suite", () => {
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

  describe("QCET Design System Tokens (Light-only semantic tokens)", () => {
    it("defines semantic canvas and card background tokens", () => {
      assert.equal(QCET_TOKENS.colors.light.appBg, "var(--background)");
      assert.equal(QCET_TOKENS.colors.light.cardBg, "var(--card)");
      assert.equal(QCET_TOKENS.colors.light.border, "var(--border)");
      assert.equal(QCET_TOKENS.colors.light.textPrimary, "var(--foreground)");

      assert.equal(QCET_TOKENS.colors.dark.appBg, QCET_TOKENS.colors.light.appBg);
      assert.equal(QCET_TOKENS.colors.dark.cardBg, QCET_TOKENS.colors.light.cardBg);
      assert.equal(QCET_TOKENS.colors.dark.border, QCET_TOKENS.colors.light.border);
      assert.equal(QCET_TOKENS.colors.dark.textPrimary, QCET_TOKENS.colors.light.textPrimary);
    });

    it("defines neutral primary action token", () => {
      assert.equal(QCET_TOKENS.colors.light.primary, "var(--primary)");
      assert.equal(QCET_TOKENS.colors.light.accentPrimary, "var(--primary)");
      assert.equal(QCET_TOKENS.colors.dark.primary, QCET_TOKENS.colors.light.primary);
    });

    it("defines authentic task status colors with tailwind classes and OKLCH", () => {
      // In Progress: Sapphire Blue
      assert.equal(QCET_TOKENS.statusColors.inProgress.name, "Sapphire Blue");
      assert.equal(
        QCET_TOKENS.statusColors.inProgress.classes,
        "bg-blue-500/10 text-blue-600 border-blue-500/20"
      );
      assert.equal(QCET_TOKENS.statusColors.inProgress.text, "text-blue-600");

      // Completed: Emerald Green
      assert.equal(QCET_TOKENS.statusColors.completed.name, "Emerald Green");
      assert.equal(
        QCET_TOKENS.statusColors.completed.classes,
        "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
      );
      assert.equal(QCET_TOKENS.statusColors.completed.text, "text-emerald-700");

      // Overdue: Crimson Rose
      assert.equal(QCET_TOKENS.statusColors.overdue.name, "Crimson Rose");
      assert.equal(
        QCET_TOKENS.statusColors.overdue.classes,
        "bg-rose-500/10 text-rose-600 border-rose-500/20"
      );
      assert.equal(QCET_TOKENS.statusColors.overdue.text, "text-rose-600");

      // Needs Review: Warm Amber
      assert.equal(QCET_TOKENS.statusColors.needsReview.name, "Warm Amber");
      assert.equal(
        QCET_TOKENS.statusColors.needsReview.classes,
        "bg-amber-500/10 text-amber-700 border-amber-500/20"
      );
      assert.equal(QCET_TOKENS.statusColors.needsReview.text, "text-amber-700");

      // New: Purple Violet
      assert.equal(QCET_TOKENS.statusColors.new.name, "Purple Violet");
      assert.equal(
        QCET_TOKENS.statusColors.new.classes,
        "bg-violet-500/10 text-violet-600 border-violet-500/20"
      );
      assert.equal(QCET_TOKENS.statusColors.new.text, "text-violet-600");

      // Assert zero dark: classes in any status color
      Object.values(QCET_TOKENS.statusColors).forEach((status) => {
        assert.ok(!status.classes.includes("dark:"), `Status ${status.name} classes should not contain dark:`);
        assert.ok(!status.text.includes("dark:"), `Status ${status.name} text should not contain dark:`);
      });
    });

    it("defines 16px panel radius and 12px control radius", () => {
      assert.equal(QCET_TOKENS.radius.card, "1rem"); // 16px
      assert.equal(QCET_TOKENS.radius.control, "0.75rem"); // 12px
    });

    it("defines shadow token utilities for card, hover, premium, and glow", () => {
      assert.equal(QCET_TOKENS.shadows.card, "shadow-none");
      assert.equal(QCET_TOKENS.shadows.cardHover, "shadow-none");
      assert.equal(QCET_TOKENS.shadows.premium, "shadow-none");
      assert.equal(QCET_TOKENS.shadows.glowPrimary, "shadow-none");
    });

    it("provides backward-compatible aliases for tokens", () => {
      assert.equal(qcetTokens, QCET_TOKENS);
    });

  });

  describe("Brand Asset Verification", () => {
    it("public/logo-qcet.png exists and is non-empty", () => {
      const logoPath = path.resolve(__dirname, "../public/logo-qcet.png");
      assert.ok(fs.existsSync(logoPath), "logo-qcet.png must exist in public directory");
      const stat = fs.statSync(logoPath);
      assert.ok(stat.size > 10000, `logo-qcet.png must be non-empty (size: ${stat.size} bytes)`);
    });
  });

  describe("Base UI Component Variants", () => {
    it("buttonVariants generates proper primary action styles", () => {
      const defaultButton = buttonVariants({ variant: "default" });
      assert.ok(defaultButton.includes("bg-primary"));
      assert.ok(defaultButton.includes("text-primary-foreground"));

      const outlineButton = buttonVariants({ variant: "outline" });
      assert.ok(outlineButton.includes("border-0"));
      assert.ok(outlineButton.includes("bg-secondary"));

      const premiumButton = buttonVariants({ variant: "premium" });
      assert.ok(premiumButton.includes("bg-primary"));
      assert.ok(!premiumButton.includes("bg-gradient-to-r"));

      const iconSmButton = buttonVariants({ size: "icon-sm" });
      assert.ok(iconSmButton.includes("sm:size-7"));
    });

    it("badgeVariants generates proper status variants with no dark classes", () => {
      const defaultBadge = badgeVariants({ variant: "default" });
      assert.ok(defaultBadge.includes("rounded-sm"));

      // Biến thể trạng thái: nền pastel 10% + chữ đậm đủ tương phản (không dùng dark:)
      const tinted: Array<[string, string, string]> = [
        ["success", "bg-emerald-500/10", "text-emerald-700"],
        ["progress", "bg-blue-500/10", "text-blue-600"],
        ["warning", "bg-amber-500/10", "text-amber-700"],
        ["sapphire", "bg-blue-500/10", "text-blue-600"],
        ["emerald", "bg-emerald-500/10", "text-emerald-700"],
        ["amber", "bg-amber-500/10", "text-amber-700"],
        ["rose", "bg-rose-500/10", "text-rose-600"],
        ["violet", "bg-violet-500/10", "text-violet-600"],
      ];
      for (const [variant, bg, text] of tinted) {
        const classes = badgeVariants({ variant: variant as any });
        assert.ok(classes.includes(bg), `${variant} badge must use ${bg}`);
        assert.ok(classes.includes(text), `${variant} badge must use ${text}`);
        assert.ok(!classes.includes("dark:"), `${variant} badge must not contain dark: classes`);
      }
    });

    it("exports all new and overhauled Base UI components cleanly", () => {
      assert.equal(typeof Card, "function");
      assert.equal(typeof CardHeader, "function");
      assert.equal(typeof CardTitle, "function");
      assert.equal(typeof CardDescription, "function");
      assert.equal(typeof CardAction, "function");
      assert.equal(typeof CardContent, "function");
      assert.equal(typeof CardFooter, "function");
      assert.equal(typeof Badge, "function");
      assert.ok(typeof Button === "function" || typeof Button === "object");
      assert.equal(typeof Drawer, "function");
      assert.equal(typeof Progress, "function");
      assert.equal(typeof ProgressTrack, "function");
      assert.equal(typeof ProgressIndicator, "function");
      assert.equal(typeof Tabs, "function");
      assert.equal(typeof TabsList, "function");
      assert.equal(typeof TabsTrigger, "function");
      assert.equal(typeof TabsContent, "function");
      assert.equal(typeof tabsListVariants, "function");
    });
  });

  describe("Navigation Configuration", () => {
    it("defines required navigation items for Phase 1 E-Office", () => {
      const tokenRoutes = NAV_ITEMS.map((item) => item.href);
      const compRoutes = NAVIGATION_ITEMS.map((item) => item.href);

      assert.deepEqual(tokenRoutes, compRoutes, "token routes and component routes match");
      assert.ok(compRoutes.includes("/"), "includes home dashboard");
      assert.ok(compRoutes.includes("/org"), "includes org route");
      assert.ok(compRoutes.includes("/dashboard"), "includes dashboard route");
      assert.ok(compRoutes.includes("/notifications"), "includes notifications route");
    });

    it("navigation items have no decorative emojis", () => {
      NAVIGATION_ITEMS.forEach((item) => {
        assert.match(
          item.label,
          /^[\p{L}\p{N}\s\-\/&]+$/u,
          `Item label ${item.label} must not contain emojis`
        );
      });
    });
  });
});
