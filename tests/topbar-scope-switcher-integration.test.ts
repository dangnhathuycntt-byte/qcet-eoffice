import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Topbar ScopeSwitcher Integration (app-topbar.tsx)", () => {
  const topbarPath = path.join(process.cwd(), "src/components/layout/app-topbar.tsx");

  test("app-topbar.tsx exists and is readable", () => {
    assert.strictEqual(fs.existsSync(topbarPath), true, "app-topbar.tsx must exist");
  });

  test("app-topbar.tsx imports ScopeSwitcher from @/components/layout/scope-switcher", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.match(
      content,
      /import\s+\{\s*ScopeSwitcher\s*\}\s+from\s+["']@\/components\/layout\/scope-switcher["']/,
      "Must import ScopeSwitcher from '@/components/layout/scope-switcher'"
    );
  });

  test("app-topbar.tsx encloses ScopeSwitcher within a React Suspense boundary", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.match(
      content,
      /<(?:React\.)?Suspense[^>]*>[\s\S]*?<ScopeSwitcher[\s\S]*?\/>[\s\S]*?<\/(?:React\.)?Suspense>/,
      "ScopeSwitcher must be enclosed within a Suspense boundary for safe client navigation"
    );
    assert.ok(
      content.includes("animate-pulse") && content.includes("w-44"),
      "Suspense fallback must have an accessible pulse skeleton fallback"
    );
  });

  test("app-topbar.tsx positions ScopeSwitcher next to breadcrumbs with separator", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(
      content.includes("TopbarBreadcrumbs"),
      "Topbar must contain TopbarBreadcrumbs"
    );
    assert.ok(
      content.includes("bg-border/60"),
      "Topbar must include subtle vertical border separator"
    );
    const breadcrumbIndex = content.indexOf("TopbarBreadcrumbs");
    const scopeSwitcherIndex = content.indexOf("<ScopeSwitcher");
    assert.ok(
      breadcrumbIndex !== -1 && scopeSwitcherIndex !== -1 && breadcrumbIndex < scopeSwitcherIndex,
      "TopbarBreadcrumbs must precede ScopeSwitcher in layout flow"
    );
  });

  test("app-topbar.tsx maintains responsive layout constraints", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(
      content.includes("truncate max-w-[120px] sm:max-w-none"),
      "Breadcrumbs should truncate safely on smaller mobile screens"
    );
  });

  test("Anti-slop rule: 0% emojis in app-topbar.tsx", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert.strictEqual(
      emojiRegex.test(content),
      false,
      "app-topbar.tsx must contain zero emojis"
    );
  });
});
