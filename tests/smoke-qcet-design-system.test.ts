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

      assert.equal(QCET_TOKENS.colors.dark.appBg, QCET_TOKENS.colors.light.appBg);
      assert.equal(QCET_TOKENS.colors.dark.cardBg, QCET_TOKENS.colors.light.cardBg);
      assert.equal(QCET_TOKENS.colors.dark.border, QCET_TOKENS.colors.light.border);
      assert.equal(QCET_TOKENS.colors.dark.textPrimary, QCET_TOKENS.colors.light.textPrimary);
    });

    it("defines QCET signature Sapphire Blue primary action color", () => {
      assert.equal(QCET_TOKENS.colors.light.primary, "oklch(0.42 0.18 250)");
      assert.equal(QCET_TOKENS.colors.light.accentPrimary, "#2563EB");
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
        "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
      );
      assert.equal(QCET_TOKENS.statusColors.completed.text, "text-emerald-600");

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
        "bg-amber-500/10 text-amber-600 border-amber-500/20"
      );
      assert.equal(QCET_TOKENS.statusColors.needsReview.text, "text-amber-600");

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

      assert.ok(!cssContent.includes("--background: oklch(0.12 0.018 250);"), "does not contain dark background");
      assert.ok(!cssContent.includes("--card: oklch(0.16 0.018 250);"), "does not contain dark card");
      assert.ok(!cssContent.includes("--primary: oklch(0.70 0.18 250);"), "does not contain dark primary");

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

    it("badgeVariants generates proper status variants with no dark classes", () => {
      const defaultBadge = badgeVariants({ variant: "default" });
      assert.ok(defaultBadge.includes("rounded-md"));

      const successBadge = badgeVariants({ variant: "success" });
      assert.ok(successBadge.includes("bg-emerald-50"));
      assert.ok(!successBadge.includes("dark:"), "success badge must not contain dark: classes");

      const progressBadge = badgeVariants({ variant: "progress" });
      assert.ok(progressBadge.includes("bg-blue-50"));
      assert.ok(!progressBadge.includes("dark:"), "progress badge must not contain dark: classes");

      const warningBadge = badgeVariants({ variant: "warning" });
      assert.ok(warningBadge.includes("bg-amber-50"));
      assert.ok(!warningBadge.includes("dark:"), "warning badge must not contain dark: classes");

      const sapphireBadge = badgeVariants({ variant: "sapphire" });
      assert.ok(sapphireBadge.includes("bg-blue-500/10"));
      assert.ok(sapphireBadge.includes("text-blue-600"));
      assert.ok(!sapphireBadge.includes("dark:"), "sapphire badge must not contain dark: classes");

      const emeraldBadge = badgeVariants({ variant: "emerald" });
      assert.ok(emeraldBadge.includes("bg-emerald-500/10"));
      assert.ok(emeraldBadge.includes("text-emerald-600"));
      assert.ok(!emeraldBadge.includes("dark:"), "emerald badge must not contain dark: classes");

      const amberBadge = badgeVariants({ variant: "amber" });
      assert.ok(amberBadge.includes("bg-amber-500/10"));
      assert.ok(amberBadge.includes("text-amber-600"));
      assert.ok(!amberBadge.includes("dark:"), "amber badge must not contain dark: classes");

      const roseBadge = badgeVariants({ variant: "rose" });
      assert.ok(roseBadge.includes("bg-rose-500/10"));
      assert.ok(roseBadge.includes("text-rose-600"));
      assert.ok(!roseBadge.includes("dark:"), "rose badge must not contain dark: classes");

      const violetBadge = badgeVariants({ variant: "violet" });
      assert.ok(violetBadge.includes("bg-violet-500/10"));
      assert.ok(violetBadge.includes("text-violet-600"));
      assert.ok(!violetBadge.includes("dark:"), "violet badge must not contain dark: classes");
    });

    it("drawer component contains no dark classes", () => {
      const drawerPath = path.resolve(__dirname, "../src/components/ui/drawer.tsx");
      assert.ok(fs.existsSync(drawerPath), "drawer.tsx should exist");
      const drawerContent = fs.readFileSync(drawerPath, "utf-8");
      assert.ok(!drawerContent.includes("dark:"), "drawer.tsx must not contain any dark: classes");
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
