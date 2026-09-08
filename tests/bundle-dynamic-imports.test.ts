// tests/bundle-dynamic-imports.test.ts
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Bundle Dynamic Imports Verification Suite", () => {
  test("app-shell.tsx uses next/dynamic for heavy overlays", () => {
    const appShellPath = path.resolve(process.cwd(), "src/components/layout/app-shell.tsx");
    const content = fs.readFileSync(appShellPath, "utf-8");
    assert.ok(content.includes('import dynamic from "next/dynamic"'));
    assert.ok(content.includes('import("@/components/pwa/mobile-app-install-modal")'));
    assert.ok(content.includes('import("@/components/pwa/push-onboarding-sheet")'));
  });

  test("app-topbar.tsx dynamically imports UserProfileModal", () => {
    const topbarPath = path.resolve(process.cwd(), "src/components/layout/app-topbar.tsx");
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(content.includes('import dynamic from "next/dynamic"'));
    assert.ok(content.includes('import("@/components/auth/user-profile-modal")'));
  });

  test("page.tsx dynamically splits CalendarZone, OrgZone, DocumentsZone", () => {
    const pagePath = path.resolve(process.cwd(), "src/app/page.tsx");
    const content = fs.readFileSync(pagePath, "utf-8");
    assert.ok(content.includes('import dynamic from "next/dynamic"'));
    assert.ok(content.includes('import("@/components/dashboard/zones/calendar-zone")'));
    assert.ok(content.includes('import("@/components/dashboard/zones/org-zone")'));
    assert.ok(content.includes('import("@/components/dashboard/zones/documents-zone")'));
  });
});
