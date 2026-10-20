import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cn } from "../src/lib/utils";
import { buttonVariants, Button } from "../src/components/ui/button";
import { badgeVariants, Badge } from "../src/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter } from "../src/components/ui/card";
import { Progress, ProgressTrack, ProgressIndicator } from "../src/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants } from "../src/components/ui/tabs";

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

      const successBadge = badgeVariants({ variant: "success" });
      assert.ok(successBadge.includes("bg-secondary"));
      assert.ok(!successBadge.includes("dark:"), "success badge must not contain dark: classes");

      const progressBadge = badgeVariants({ variant: "progress" });
      assert.ok(progressBadge.includes("bg-secondary"));
      assert.ok(!progressBadge.includes("dark:"), "progress badge must not contain dark: classes");

      const warningBadge = badgeVariants({ variant: "warning" });
      assert.ok(warningBadge.includes("bg-secondary"));
      assert.ok(!warningBadge.includes("dark:"), "warning badge must not contain dark: classes");

      const sapphireBadge = badgeVariants({ variant: "sapphire" });
      assert.ok(sapphireBadge.includes("bg-secondary"));
      assert.ok(sapphireBadge.includes("text-foreground"));
      assert.ok(!sapphireBadge.includes("dark:"), "sapphire badge must not contain dark: classes");

      const emeraldBadge = badgeVariants({ variant: "emerald" });
      assert.ok(emeraldBadge.includes("bg-secondary"));
      assert.ok(emeraldBadge.includes("text-foreground"));
      assert.ok(!emeraldBadge.includes("dark:"), "emerald badge must not contain dark: classes");

      const amberBadge = badgeVariants({ variant: "amber" });
      assert.ok(amberBadge.includes("bg-secondary"));
      assert.ok(amberBadge.includes("text-foreground"));
      assert.ok(!amberBadge.includes("dark:"), "amber badge must not contain dark: classes");

      const roseBadge = badgeVariants({ variant: "rose" });
      assert.ok(roseBadge.includes("bg-secondary"));
      assert.ok(roseBadge.includes("text-foreground"));
      assert.ok(!roseBadge.includes("dark:"), "rose badge must not contain dark: classes");

      const violetBadge = badgeVariants({ variant: "violet" });
      assert.ok(violetBadge.includes("bg-secondary"));
      assert.ok(violetBadge.includes("text-foreground"));
      assert.ok(!violetBadge.includes("dark:"), "violet badge must not contain dark: classes");
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
});
