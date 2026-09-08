import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { MobileBottomNav } from "../src/components/layout/mobile-bottom-nav";

describe("MobileBottomNav Component", () => {
  const navPath = path.join(process.cwd(), "src/components/layout/mobile-bottom-nav.tsx");

  test("MobileBottomNav is defined and exports correctly", () => {
    assert.equal(typeof MobileBottomNav, "function");
  });

  test("source file exists and contains mobile-first fixed navigation classes", () => {
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

  test("all 5 navigation items have at least 44px min-h and min-w touch targets (standardized to 48px)", () => {
    const content = fs.readFileSync(navPath, "utf-8");
    const minHCount = (content.match(/min-h-\[(44|48)px\]/g) || []).length;
    const minWCount = (content.match(/min-w-\[(44|48)px\]/g) || []).length;

    assert.ok(minHCount >= 5, `Expected at least 5 min-h touch targets, found ${minHCount}`);
    assert.ok(minWCount >= 5, `Expected at least 5 min-w touch targets, found ${minWCount}`);
  });

  test("integrates MobileMenuDrawer for item 5 ('Thêm')", () => {
    const content = fs.readFileSync(navPath, "utf-8");
    assert.ok(
      content.includes("<MobileMenuDrawer"),
      "Must render MobileMenuDrawer"
    );
    assert.ok(
      content.includes("setMenuOpen(true)"),
      "Item 5 must trigger setMenuOpen(true)"
    );
    assert.ok(
      content.includes("Thêm"),
      "Must have 'Thêm' label for 5th item"
    );
  });

  test("implements center action pill with unified create-task dispatching", () => {
    const content = fs.readFileSync(navPath, "utf-8");
    assert.ok(
      content.includes("handleCenterAction"),
      "Must define handleCenterAction handler"
    );
    assert.ok(
      content.includes("qcet:open-create-task"),
      "Center action must trigger qcet:open-create-task"
    );
    assert.ok(
      !content.includes("qcet:open-briefing-modal"),
      "Must not contain orphaned qcet:open-briefing-modal"
    );
    assert.ok(
      !content.includes("Zap"),
      "Must not contain gaming Zap icon"
    );
    assert.ok(
      content.includes("bg-primary"),
      "Center button must use bg-primary"
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
});
