import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cn } from "../src/lib/utils";
import { DESIGN_TOKENS, NAV_ITEMS } from "../src/lib/tokens";
import { buttonVariants } from "../src/components/ui/button";
import { badgeVariants } from "../src/components/ui/badge";
import { NAVIGATION_ITEMS } from "../src/components/navigation";

describe("Smoke Test Suite", () => {
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

  describe("Design System Tokens", () => {
    it("has correct Warm-Paper light palette tokens", () => {
      assert.equal(DESIGN_TOKENS.light.background, "#F9F8F6");
      assert.equal(DESIGN_TOKENS.light.foreground, "#141312");
      assert.equal(DESIGN_TOKENS.light.primary, "#E05D38");
      assert.equal(DESIGN_TOKENS.light.card, "#FFFFFF");
      assert.equal(DESIGN_TOKENS.light.border, "#E8E4DC");
    });

    it("has correct Terracotta dark palette tokens", () => {
      assert.equal(DESIGN_TOKENS.dark.background, "#0E0D0C");
      assert.equal(DESIGN_TOKENS.dark.foreground, "#F5F3EF");
      assert.equal(DESIGN_TOKENS.dark.primary, "#E56A47");
      assert.equal(DESIGN_TOKENS.dark.card, "#171614");
      assert.equal(DESIGN_TOKENS.dark.border, "#2B2824");
    });

    it("has exact radius and typography specifications", () => {
      assert.equal(DESIGN_TOKENS.radius, "0.875rem");
      assert.ok(DESIGN_TOKENS.fonts.sans.includes("Plus Jakarta Sans"));
      assert.ok(DESIGN_TOKENS.fonts.sans.includes("Inter"));
      assert.ok(DESIGN_TOKENS.fonts.mono.includes("JetBrains Mono"));
    });

    it("globals.css contains the required CSS variables matching tokens", () => {
      const cssPath = path.resolve(__dirname, "../src/app/globals.css");
      assert.ok(fs.existsSync(cssPath), "globals.css should exist");
      const cssContent = fs.readFileSync(cssPath, "utf-8");

      assert.ok(cssContent.includes("--background: #F9F8F6;"), "CSS contains light background");
      assert.ok(cssContent.includes("--primary: #E05D38;"), "CSS contains light primary");
      assert.ok(cssContent.includes("--card: #FFFFFF;"), "CSS contains light card");
      assert.ok(cssContent.includes("--border: #E8E4DC;"), "CSS contains light border");
      assert.ok(cssContent.includes("--radius: 0.875rem;"), "CSS contains 0.875rem radius");

      assert.ok(cssContent.includes("--background: #0E0D0C;"), "CSS contains dark background");
      assert.ok(cssContent.includes("--primary: #E56A47;"), "CSS contains dark primary");
      assert.ok(cssContent.includes("--card: #171614;"), "CSS contains dark card");
      assert.ok(cssContent.includes("--border: #2B2824;"), "CSS contains dark border");

      assert.ok(cssContent.includes("Plus Jakarta Sans"), "CSS contains Plus Jakarta Sans font");
      assert.ok(cssContent.includes("JetBrains Mono"), "CSS contains JetBrains Mono font");
    });
  });

  describe("Base UI Component Variants", () => {
    it("buttonVariants generates proper terracotta and outline styles", () => {
      const defaultButton = buttonVariants({ variant: "default" });
      assert.ok(defaultButton.includes("bg-primary"));
      assert.ok(defaultButton.includes("text-primary-foreground"));
      assert.ok(defaultButton.includes("rounded-xl"));

      const outlineButton = buttonVariants({ variant: "outline" });
      assert.ok(outlineButton.includes("border-border"));
      assert.ok(outlineButton.includes("bg-card"));

      const iconButton = buttonVariants({ size: "icon" });
      assert.ok(iconButton.includes("size-10"));
    });

    it("badgeVariants generates proper status variants", () => {
      const defaultBadge = badgeVariants({ variant: "default" });
      assert.ok(defaultBadge.includes("bg-primary"));

      const successBadge = badgeVariants({ variant: "success" });
      assert.ok(successBadge.includes("bg-emerald-500/10"));

      const destructiveBadge = badgeVariants({ variant: "destructive" });
      assert.ok(destructiveBadge.includes("text-destructive"));
    });
  });

  describe("Navigation Configuration", () => {
    it("defines required navigation items for Phase 1 E-Office in tokens and component", () => {
      const tokenRoutes = NAV_ITEMS.map((item) => item.href);
      const compRoutes = NAVIGATION_ITEMS.map((item) => item.href);

      assert.deepEqual(tokenRoutes, compRoutes, "token routes and component routes match");

      assert.ok(compRoutes.includes("/"), "includes home dashboard");
      assert.ok(compRoutes.includes("/tasks"), "includes tasks route");
      assert.ok(compRoutes.includes("/calendar"), "includes calendar route");
      assert.ok(compRoutes.includes("/org"), "includes org route");
      assert.ok(compRoutes.includes("/notifications"), "includes notifications route");

      NAVIGATION_ITEMS.forEach((item) => {
        assert.ok(item.label.length > 0, `Item ${item.href} has a label`);
        assert.ok(item.icon, `Item ${item.href} has an icon`);
      });
    });
  });
});
