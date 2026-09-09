import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import manifest from "../src/app/manifest";
import type { Viewport, Metadata } from "next";

// Intercept CSS and next/font/google imports in Node runtime before importing layout
const Module = require("module");
const origRequire = Module.prototype.require;
Module.prototype.require = function (id: string) {
  if (typeof id === "string" && id.endsWith(".css")) return {};
  if (id === "next/font/google") {
    return {
      Be_Vietnam_Pro: () => ({ variable: "--font-sans" }),
      Plus_Jakarta_Sans: () => ({ variable: "--font-heading" }),
      JetBrains_Mono: () => ({ variable: "--font-mono" }),
    };
  }
  return origRequire.apply(this, arguments);
};

// Safely load layout exports
const layout = require("../src/app/layout");
const viewport: Viewport = layout.viewport;
const metadata: Metadata = layout.metadata;

describe("Mobile Viewport & PWA Standards Verification", () => {
  test("Mobile configuration meets Apple HIG and PWA standards", () => {
    const pwa = manifest();
    assert.equal(pwa.display, "standalone");
    assert.equal(viewport.viewportFit, "cover");
    assert.equal(viewport.initialScale, 1);
    assert.ok(
      viewport.maximumScale === 1 || viewport.maximumScale === 5,
      "maximumScale must allow standard 1 or accessible zoom 5"
    );
    assert.equal(viewport.width, "device-width");
  });

  test("PWA manifest has valid QCET branding and icons", () => {
    const pwa = manifest();
    assert.equal(pwa.name, "QCET E-Office - Hệ thống Điều hành Văn phòng Điện tử");
    assert.equal(pwa.short_name, "QCET E-Office");
    assert.ok(
      pwa.description?.includes("Trường Cao đẳng Kỹ thuật Quy Nhơn (QCET)"),
      "Description must reference Quy Nhon College of Engineering and Technology (QCET)"
    );
    assert.equal(pwa.orientation, "portrait-primary");
    assert.equal(pwa.start_url, "/");

    // Icons validation
    assert.ok(Array.isArray(pwa.icons), "Icons must be an array");
    const icon192 = pwa.icons?.find((icon) => icon.sizes === "192x192");
    const icon512 = pwa.icons?.find((icon) => icon.sizes === "512x512");
    const maskableIcon = pwa.icons?.find((icon) => icon.purpose === "maskable");

    assert.ok(icon192, "Must include 192x192 icon for standard PWA installation");
    assert.ok(icon512, "Must include 512x512 icon for splash screen display");
    assert.ok(maskableIcon, "Must include maskable icon for Android adaptive icons");
  });

  test("Apple Web App metadata conforms to iOS HIG standalone requirements", () => {
    assert.ok(metadata.appleWebApp, "Must configure appleWebApp metadata");
    assert.ok(typeof metadata.appleWebApp === "object", "appleWebApp must be an object");
    assert.equal(metadata.appleWebApp.capable, true);
    assert.equal(metadata.appleWebApp.statusBarStyle, "default");
    assert.equal(metadata.appleWebApp.title, "QCET E-Office");
  });

  test("Viewport themeColor is configured for pure light mode", () => {
    assert.equal(viewport.colorScheme, "light", "colorScheme must be light");
    assert.equal(viewport.themeColor, "#fbfbfb", "themeColor must be #fbfbfb");
  });

  test("Global CSS specifies safe area insets and mobile ergonomics", () => {
    const globalsCssPath = path.resolve(__dirname, "../src/app/globals.css");
    const content = fs.readFileSync(globalsCssPath, "utf-8");

    assert.ok(
      content.includes("safe-area-inset-top") || content.includes("env(safe-area-inset"),
      "globals.css must support safe area insets"
    );
    assert.ok(
      content.includes("overscroll-behavior-y") || content.includes("touch-action") || content.includes("pb-safe"),
      "globals.css should define mobile touch / scroll / safe area classes"
    );
  });

  test("ScopeSwitcher complies with min 44x44px touch targets on mobile", () => {
    const switcherPath = path.resolve(__dirname, "../src/components/layout/scope-switcher.tsx");
    const content = fs.readFileSync(switcherPath, "utf-8");

    // Close button must have min 44x44
    assert.ok(
      content.includes("min-h-[44px]") && content.includes("min-w-[44px]"),
      "ScopeSwitcher close button must enforce min-h-[44px] and min-w-[44px] touch target"
    );

    // Subordinate units combobox items must enforce min 44px height
    assert.ok(
      content.includes("Đơn vị trực thuộc") && content.includes("min-h-[44px]"),
      "Subordinate units combobox items must enforce min-h-[44px]"
    );

    // Primary items have min 48px height
    assert.ok(
      content.includes("min-h-[48px]"),
      "Main scope selection buttons must enforce min-h-[48px] touch target"
    );
  });

  test("MobileBottomNav complies with 4 touch points and safe area handling", () => {
    const navPath = path.resolve(__dirname, "../src/components/layout/mobile-bottom-nav.tsx");
    const content = fs.readFileSync(navPath, "utf-8");

    assert.ok(
      content.includes("grid grid-cols-4"),
      "MobileBottomNav must render 4 distinct touch points"
    );
    assert.ok(
      content.includes("safe-area-inset-bottom"),
      "MobileBottomNav must account for safe-area-inset-bottom"
    );
    assert.ok(
      content.includes("min-h-[44px]") || content.includes("min-w-[44px]") || content.includes("h-14"),
      "MobileBottomNav items must satisfy Apple HIG touch target guidelines"
    );
  });

  test("BottomSheet wrapper is integrated with Vaul for touch-gesture dismissal", () => {
    const bottomSheetPath = path.resolve(__dirname, "../src/components/ui/bottom-sheet.tsx");
    const content = fs.readFileSync(bottomSheetPath, "utf-8");

    assert.ok(content.includes('from "vaul"'), "BottomSheet must wrap vaul drawer primitives");
    assert.ok(
      content.includes("safe-area-inset-bottom"),
      "BottomSheet must include safe-area-inset-bottom padding"
    );
  });
});
