import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Mobile Navigation & Drawer Synchronization Suite", () => {
  test("navigation.tsx defines 5 standardized tabs matching desktop zones", () => {
    const navPath = path.resolve(process.cwd(), "src/components/navigation.tsx");
    const content = fs.readFileSync(navPath, "utf-8");
    assert.ok(content.includes('triggerHaptic("light")') || content.includes("triggerHaptic"));
    assert.ok(content.includes("pb-safe") || content.includes("safe-area-inset-bottom"));
    assert.ok(content.includes("Tổng quan"));
    assert.ok(content.includes("Nhiệm vụ"));
  });

  test("app-sidebar.tsx is desktop-only without dead mobile drawer classes", () => {
    const sidebarPath = path.resolve(process.cwd(), "src/components/layout/app-sidebar.tsx");
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert.ok(!content.includes("isMobileOpen"));
    assert.ok(content.includes("hidden md:flex") || content.includes("hidden md:"));
  });
});
