// tests/viewport-accessibility.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Task 1: Mobile Viewport & Accessibility Standards", () => {
  const globalsCss = fs.readFileSync(
    path.join(process.cwd(), "src/app/globals.css"),
    "utf8"
  );
  const appShell = fs.readFileSync(
    path.join(process.cwd(), "src/components/layout/app-shell.tsx"),
    "utf8"
  );
  const appLayout = fs.readFileSync(
    path.join(process.cwd(), "src/app/layout.tsx"),
    "utf8"
  );

  it("globals.css defines overscroll-behavior-y: none on html and body", () => {
    assert.match(globalsCss, /html[\s\S]*?overscroll-behavior-y:\s*none/);
    assert.match(globalsCss, /body[\s\S]*?overscroll-behavior-y:\s*none/);
  });

  it("globals.css defines safe-area insets with 0px fallback", () => {
    assert.match(globalsCss, /env\(safe-area-inset-bottom,\s*0px\)/);
    assert.match(globalsCss, /env\(safe-area-inset-top,\s*0px\)/);
  });

  it("globals.css includes prefers-reduced-motion reset block", () => {
    assert.match(globalsCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    assert.match(globalsCss, /animation-duration:\s*0\.01ms/);
  });

  it("app-shell.tsx uses 100dvh instead of 100vh / min-h-screen", () => {
    assert.match(appShell, /min-h-\[100dvh\]/);
    assert.doesNotMatch(appShell, /min-h-screen/);
  });

  it("layout.tsx does not load redundant uncompressed /logo-qcet.png apple-touch-icon", () => {
    assert.doesNotMatch(appLayout, /<link[^>]*rel="apple-touch-icon"[^>]*href="\/logo-qcet\.png"/);
  });
});
