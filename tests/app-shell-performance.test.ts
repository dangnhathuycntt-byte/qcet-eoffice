import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("AppShell Performance Verification Suite (QCET-PERF-2025-01 Task 6)", () => {
  const appShellPath = path.resolve(process.cwd(), "src/components/layout/app-shell.tsx");

  test("app-shell.tsx exists and is readable", () => {
    assert.ok(fs.existsSync(appShellPath), "app-shell.tsx must exist");
  });

  test("anti-slop rule: 0% emojis in app-shell.tsx source file", () => {
    const content = fs.readFileSync(appShellPath, "utf-8");
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const matches = [...content.matchAll(emojiRegex)];
    assert.strictEqual(matches.length, 0, `Found emojis in app-shell.tsx: ${matches.map((m) => m[0]).join(", ")}`);
  });

  test("app-shell.tsx does NOT mount MobileAppInstallModal unconditionally in AppShellInner", () => {
    const content = fs.readFileSync(appShellPath, "utf-8");

    // Extract AppShellInner body
    const appShellInnerMatch = content.match(/function AppShellInner\([\s\S]*?\n\}/);
    assert.ok(appShellInnerMatch, "AppShellInner function must exist");
    const innerBody = appShellInnerMatch[0];

    // Must not have bare <MobileAppInstallModal /> inside AppShellInner
    assert.ok(
      !innerBody.includes("<MobileAppInstallModal />") && !innerBody.includes("<MobileAppInstallModal/>"),
      "AppShellInner must not unconditionally mount <MobileAppInstallModal />"
    );

    // Should mount MobileAppInstallModalContainer instead
    assert.ok(
      innerBody.includes("<MobileAppInstallModalContainer />") || innerBody.includes("<MobileAppInstallModalContainer/>"),
      "AppShellInner must mount MobileAppInstallModalContainer"
    );
  });

  test("app-shell.tsx implements MobileAppInstallModalContainer with conditional on-demand mounting", () => {
    const content = fs.readFileSync(appShellPath, "utf-8");

    // Container function check
    assert.ok(
      content.includes("function MobileAppInstallModalContainer()"),
      "MobileAppInstallModalContainer must be defined"
    );

    // Listens to qcet:open-install-modal
    assert.ok(
      content.includes('"qcet:open-install-modal"'),
      "MobileAppInstallModalContainer must listen for qcet:open-install-modal event"
    );

    // Returns null when closed (!isOpen)
    assert.ok(
      content.includes("if (!isOpen) return null;"),
      "MobileAppInstallModalContainer must return null when closed to avoid mounting"
    );

    // Passes isOpen and onClose to MobileAppInstallModal
    assert.ok(
      content.includes("isOpen={isOpen}") && content.includes("onClose="),
      "MobileAppInstallModalContainer must pass isOpen and onClose props"
    );
  });

  test("app-shell.tsx maintains ssr: false dynamic import for MobileAppInstallModal", () => {
    const content = fs.readFileSync(appShellPath, "utf-8");
    assert.ok(
      content.includes('import("@/components/pwa/mobile-app-install-modal")'),
      "Must dynamically import mobile-app-install-modal"
    );
    assert.ok(
      content.includes("{ ssr: false }"),
      "Dynamic import must retain ssr: false"
    );
  });
});
