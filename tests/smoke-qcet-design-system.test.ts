import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cn } from "../src/lib/utils";
import { QCET_TOKENS, qcetTokens, twentyTokens, NAV_ITEMS } from "../src/lib/tokens";
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

  describe("QCET Design System Tokens (Light & Dark OKLCH)", () => {
    it("defines clean OKLCH canvas and card background tokens", () => {
      assert.equal(QCET_TOKENS.colors.light.appBg, "oklch(0.985 0.003 250)");
      assert.equal(QCET_TOKENS.colors.light.cardBg, "oklch(1 0 0)");
      assert.equal(QCET_TOKENS.colors.light.border, "oklch(0.915 0.006 250)");
      assert.equal(QCET_TOKENS.colors.light.textPrimary, "oklch(0.145 0.015 250)");

      assert.equal(QCET_TOKENS.colors.dark.appBg, "oklch(0.12 0.018 250)");
      assert.equal(QCET_TOKENS.colors.dark.cardBg, "oklch(0.16 0.018 250)");
      assert.equal(QCET_TOKENS.colors.dark.border, "oklch(0.24 0.015 250)");
      assert.equal(QCET_TOKENS.colors.dark.textPrimary, "oklch(0.98 0.003 250)");
    });

    it("defines QCET signature Sapphire Blue primary action color", () => {
      assert.equal(QCET_TOKENS.colors.light.primary, "oklch(0.42 0.18 250)");
      assert.equal(QCET_TOKENS.colors.light.accentPrimary, "#2563EB");
      assert.equal(QCET_TOKENS.colors.dark.primary, "oklch(0.70 0.18 250)");
    });

    it("defines authentic task status colors with tailwind classes and OKLCH", () => {
      // In Progress: Sapphire Blue
      assert.equal(QCET_TOKENS.statusColors.inProgress.name, "Sapphire Blue");
      assert.equal(
        QCET_TOKENS.statusColors.inProgress.classes,
        "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
      );

      // Completed: Emerald Green
      assert.equal(QCET_TOKENS.statusColors.completed.name, "Emerald Green");
      assert.equal(
        QCET_TOKENS.statusColors.completed.classes,
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      );

      // Overdue: Crimson Rose
      assert.equal(QCET_TOKENS.statusColors.overdue.name, "Crimson Rose");
      assert.equal(
        QCET_TOKENS.statusColors.overdue.classes,
        "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
      );

      // Needs Review: Warm Amber
      assert.equal(QCET_TOKENS.statusColors.needsReview.name, "Warm Amber");
      assert.equal(
        QCET_TOKENS.statusColors.needsReview.classes,
        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
      );

      // New: Purple Violet
      assert.equal(QCET_TOKENS.statusColors.new.name, "Purple Violet");
      assert.equal(
        QCET_TOKENS.statusColors.new.classes,
        "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20"
      );
    });

    it("defines 0.75rem (12px) card radius and 0.5rem (8px) control radius", () => {
      assert.equal(QCET_TOKENS.radius.card, "0.75rem"); // 12px
      assert.equal(QCET_TOKENS.radius.control, "0.5rem"); // 8px
    });

    it("defines shadow token utilities for card, hover, premium, and glow", () => {
      assert.equal(QCET_TOKENS.shadows.card, "shadow-card");
      assert.equal(QCET_TOKENS.shadows.cardHover, "shadow-card-hover");
      assert.equal(QCET_TOKENS.shadows.premium, "shadow-premium");
      assert.equal(QCET_TOKENS.shadows.glowPrimary, "shadow-glow-primary");
    });

    it("provides backward-compatible aliases for tokens", () => {
      assert.equal(qcetTokens, QCET_TOKENS);
      assert.equal(twentyTokens, QCET_TOKENS);
    });

    it("globals.css contains QCET OKLCH CSS variables and styling classes", () => {
      const cssPath = path.resolve(__dirname, "../src/app/globals.css");
      assert.ok(fs.existsSync(cssPath), "globals.css should exist");
      const cssContent = fs.readFileSync(cssPath, "utf-8");

      assert.ok(cssContent.includes("--background: oklch(0.985 0.003 250);"), "contains light background");
      assert.ok(cssContent.includes("--card: oklch(1 0 0);"), "contains light card");
      assert.ok(cssContent.includes("--border: oklch(0.915 0.006 250);"), "contains light border");
      assert.ok(cssContent.includes("--primary: oklch(0.42 0.18 250);"), "contains QCET Sapphire Blue primary");
      assert.ok(cssContent.includes("--muted: oklch(0.965 0.005 250);"), "contains light muted");

      assert.ok(cssContent.includes("--background: oklch(0.12 0.018 250);"), "contains dark background");
      assert.ok(cssContent.includes("--card: oklch(0.16 0.018 250);"), "contains dark card");
      assert.ok(cssContent.includes("--primary: oklch(0.70 0.18 250);"), "contains dark primary");

      // Check shadow utilities
      assert.ok(cssContent.includes(".shadow-card {"), "contains .shadow-card");
      assert.ok(cssContent.includes(".shadow-card-hover {"), "contains .shadow-card-hover");
      assert.ok(cssContent.includes(".shadow-premium {"), "contains .shadow-premium");
      assert.ok(cssContent.includes(".shadow-glow-primary {"), "contains .shadow-glow-primary");

      // Check utilities
      assert.ok(cssContent.includes(".thin-scrollbar"), "contains .thin-scrollbar");
      assert.ok(cssContent.includes(".tabular-nums"), "contains .tabular-nums");
      assert.ok(cssContent.includes(".glass-card"), "contains .glass-card");
      assert.ok(cssContent.includes(".glass-panel"), "contains .glass-panel");
    });

    it("globals.css defines diffuse executive elevation tokens and no purple AI slop gradients", () => {
      const cssPath = path.resolve(__dirname, "../src/app/globals.css");
      const css = fs.readFileSync(cssPath, "utf-8");
      assert.ok(css.includes("--shadow-card"), "Must define --shadow-card");
      assert.ok(css.includes("--shadow-subtle"), "Must define --shadow-subtle");
      assert.ok(css.includes("--shadow-dropdown"), "Must define --shadow-dropdown");
      assert.ok(!css.includes("linear-gradient(135deg, #a855f7"), "Must not contain purple AI slop gradients");
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
      assert.ok(outlineButton.includes("border-border"));
      assert.ok(outlineButton.includes("bg-card"));

      const premiumButton = buttonVariants({ variant: "premium" });
      assert.ok(premiumButton.includes("bg-gradient-to-r"));
      assert.ok(premiumButton.includes("shadow-card"));

      const iconSmButton = buttonVariants({ size: "icon-sm" });
      assert.ok(iconSmButton.includes("size-8"));
    });

    it("badgeVariants generates proper status variants", () => {
      const defaultBadge = badgeVariants({ variant: "default" });
      assert.ok(defaultBadge.includes("rounded-md"));

      const successBadge = badgeVariants({ variant: "success" });
      assert.ok(successBadge.includes("bg-emerald-50"));

      const progressBadge = badgeVariants({ variant: "progress" });
      assert.ok(progressBadge.includes("bg-blue-50"));

      const sapphireBadge = badgeVariants({ variant: "sapphire" });
      assert.ok(sapphireBadge.includes("bg-blue-500/10"));
      assert.ok(sapphireBadge.includes("text-blue-600"));

      const emeraldBadge = badgeVariants({ variant: "emerald" });
      assert.ok(emeraldBadge.includes("bg-emerald-500/10"));
      assert.ok(emeraldBadge.includes("text-emerald-600"));

      const amberBadge = badgeVariants({ variant: "amber" });
      assert.ok(amberBadge.includes("bg-amber-500/10"));
      assert.ok(amberBadge.includes("text-amber-600"));

      const roseBadge = badgeVariants({ variant: "rose" });
      assert.ok(roseBadge.includes("bg-rose-500/10"));
      assert.ok(roseBadge.includes("text-rose-600"));

      const violetBadge = badgeVariants({ variant: "violet" });
      assert.ok(violetBadge.includes("bg-violet-500/10"));
      assert.ok(violetBadge.includes("text-violet-600"));
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
      assert.ok(compRoutes.includes("/tasks"), "includes tasks route");
      assert.ok(compRoutes.includes("/unit-tasks"), "includes unit-tasks route");
      assert.ok(compRoutes.includes("/calendar"), "includes calendar route");
      assert.ok(compRoutes.includes("/org"), "includes org route");
    });
  });
});
