import { test, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveScopeDetails } from "../src/components/layout/scope-switcher";

describe("Scope Switcher Mobile Adaptation Suite", () => {
  it("resolveScopeDetails correctly formats short label and trigger label for mobile view", () => {
    const mockUser = {
      id: "user_gv_1",
      name: "ThS. Lê Văn Phó",
      email: "lvpho@caothang.edu.vn",
      role: "LECTURER" as const,
      title: "Giảng viên",
      department: "Khoa Công nghệ Thông tin",
      departmentCode: "K_CNTT",
    };

    const details = resolveScopeDetails("unit", "K_CNTT", mockUser);
    assert.equal(details.scope, "unit");
    assert.equal(details.shortLabel, "Khoa CNTT");
    assert.ok(
      details.triggerLabel.includes("Khoa CNTT") ||
      details.triggerLabel.includes("Khoa Công nghệ thông tin")
    );

    const schoolDetails = resolveScopeDetails("school", null, {
      ...mockUser,
      role: "BGH" as const,
    });
    assert.equal(schoolDetails.scope, "school");
    assert.equal(schoolDetails.shortLabel, "Toàn trường");

    const myDetails = resolveScopeDetails("my", null, mockUser);
    assert.equal(myDetails.scope, "my");
    assert.equal(myDetails.shortLabel, "Cá nhân");
  });

  it("scope-switcher.tsx integrates BottomSheet for mobile and popover for desktop", () => {
    const filePath = path.resolve(process.cwd(), "src/components/layout/scope-switcher.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Zero emojis check (anti-slop rule)
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert.ok(!emojiRegex.test(content), "ScopeSwitcher must contain 0% emojis");

    // BottomSheet imports and usage
    assert.ok(content.includes("BottomSheet"), "Must import BottomSheet");
    assert.ok(content.includes("BottomSheetContent"), "Must use BottomSheetContent");
    assert.ok(content.includes("useIsMobile"), "Must implement useIsMobile hook for responsive breakpoint");

    // Desktop popover check
    assert.ok(content.includes("!isMobile"), "Must restrict desktop popover to !isMobile");
    assert.ok(content.includes("hidden sm:inline"), "Must provide responsive trigger label visibility");
  });

  it("app-shell.tsx integrates MobileBottomNav and bottom spacing pb-[calc(56px+env(safe-area-inset-bottom,0px)+12px)] md:pb-8", () => {
    const filePath = path.resolve(process.cwd(), "src/components/layout/app-shell.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    assert.ok(content.includes("MobileBottomNav"), "AppShell must import MobileBottomNav");
    assert.ok(
      content.includes("pb-[calc(56px+env(safe-area-inset-bottom,0px)+12px)] md:pb-8"),
      "AppShell must apply pb-[calc(56px+env(safe-area-inset-bottom,0px)+12px)] md:pb-8 for safe bottom nav clearance"
    );
    assert.ok(content.includes("flex md:hidden"), "MobileBottomNav must only render on mobile screens");
  });
});
