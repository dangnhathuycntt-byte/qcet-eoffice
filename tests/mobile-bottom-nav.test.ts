import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { MobileBottomNav } from "../src/components/navigation/mobile-bottom-nav";
import { getMobileBottomBarItems } from "../src/lib/navigation/canonical-navigation-registry";

describe("MobileBottomNav Component (4-Destination Architecture)", () => {
  const navPath = path.join(process.cwd(), "src/components/navigation/mobile-bottom-nav.tsx");

  test("MobileBottomNav is defined and exports correctly", () => {
    assert.equal(typeof MobileBottomNav, "function");
  });

  test("source file exists and contains mobile-first fixed navigation classes with safe-area padding", () => {
    assert.strictEqual(fs.existsSync(navPath), true, "mobile-bottom-nav.tsx must exist");
    const content = fs.readFileSync(navPath, "utf-8");

    // Check fixed bottom positioning and md:hidden
    assert.ok(
      content.includes("fixed bottom-0 left-0 right-0 z-50 md:hidden"),
      "Must be fixed at viewport bottom with z-50 and hidden on md+"
    );

    // Check safe area inset padding
    assert.ok(
      content.includes("pb-[max(0.5rem,env(safe-area-inset-bottom))]") ||
        content.includes("pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]") ||
        content.includes("pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"),
      "Must include safe area bottom padding"
    );

    // Check backdrop blur and card background
    assert.ok(
      content.includes("backdrop-blur-lg") && content.includes("bg-card/95"),
      "Must have backdrop blur and translucent card background"
    );
  });

  test("enforces 4-column layout with min-h-[48px] and min-w-[48px] touch targets", () => {
    const content = fs.readFileSync(navPath, "utf-8");
    assert.ok(
      content.includes("grid-cols-4"),
      "Must use 4-column grid layout for 4 canonical destinations"
    );

    const minHCount = (content.match(/min-h-\[(44|48)px\]/g) || []).length;
    const minWCount = (content.match(/min-w-\[(44|48)px\]/g) || []).length;

    assert.ok(minHCount >= 1, `Expected min-h touch targets in loop or template, found ${minHCount}`);
    assert.ok(minWCount >= 1, `Expected min-w touch targets in loop or template, found ${minWCount}`);
    assert.ok(
      content.includes("touch-manipulation"),
      "Touch targets must include touch-manipulation class"
    );
  });

  test("integrates with canonical navigation registry for 4 destinations", () => {
    const content = fs.readFileSync(navPath, "utf-8");
    assert.ok(
      content.includes("getMobileBottomBarItems") || content.includes("getMobileBottomNavItems"),
      "Must use canonical navigation registry helper"
    );

    const items = getMobileBottomBarItems();
    assert.equal(items.length, 4, "Canonical bottom bar must have exactly 4 destinations");
    assert.deepEqual(
      items.map((i) => i.id),
      ["desk", "tasks", "documents", "calendar"],
      "Canonical bottom destinations must be Tổng quan, Nhiệm vụ, Văn bản, Lịch"
    );
    assert.equal(items[0].shortLabel, "Tổng quan");
    assert.equal(items[1].shortLabel, "Nhiệm vụ");
    assert.equal(items[2].shortLabel, "Văn bản");
    assert.equal(items[3].shortLabel, "Lịch");
  });

  test("hides navigation when virtual keyboard is open", () => {
    const content = fs.readFileSync(navPath, "utf-8");
    assert.ok(
      content.includes("useVirtualKeyboard"),
      "Must use useVirtualKeyboard hook"
    );
    assert.ok(
      content.includes("isKeyboardOpen"),
      "Must check isKeyboardOpen flag"
    );
  });

  test("does not contain legacy center '+' pill button or 'Thêm' drawer tab in bottom nav", () => {
    const content = fs.readFileSync(navPath, "utf-8");
    assert.ok(
      !content.includes("handleCenterAction"),
      "Must not contain obsolete center action button"
    );
    assert.ok(
      !content.includes("qcet:open-create-task"),
      "Bottom nav must not contain create-task trigger"
    );
    assert.ok(
      !content.includes("<MobileMenuDrawer"),
      "MobileMenuDrawer should be hosted at AppShell level, not inside bottom nav"
    );
  });

  test("Anti-slop rule: 0% emojis in mobile-bottom-nav.tsx", () => {
    const content = fs.readFileSync(navPath, "utf-8");
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert.strictEqual(
      emojiRegex.test(content),
      false,
      "mobile-bottom-nav.tsx must contain zero emojis"
    );
  });

  test("Light-Only standard: zero dark: classes in mobile-bottom-nav.tsx", () => {
    const content = fs.readFileSync(navPath, "utf-8");
    assert.strictEqual(
      content.includes("dark:"),
      false,
      "mobile-bottom-nav.tsx must strictly follow Light-Only standard (0 dark: classes)"
    );
  });
});
