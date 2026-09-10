import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { Viewport } from "next";

// Intercept CSS and next/font/google imports in Node runtime before importing layout
// eslint-disable-next-line @typescript-eslint/no-require-imports
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
// eslint-disable-next-line @typescript-eslint/no-require-imports
const layout = require("../src/app/layout");
const viewport: Viewport = layout.viewport;

describe("Theme Standardization & Zero-Leak Audit", () => {
  const rootDir = path.resolve(__dirname, "..");
  const srcDir = path.join(rootDir, "src");
  const globalsCssPath = path.join(srcDir, "app", "globals.css");
  const layoutPath = path.join(srcDir, "app", "layout.tsx");
  const themeProviderPath = path.join(srcDir, "components", "theme-provider.tsx");
  const themeLibPath = path.join(srcDir, "lib", "theme.ts");

  it("ensures legacy theme files are completely deleted", () => {
    assert.ok(!fs.existsSync(themeProviderPath), "theme-provider.tsx must not exist");
    assert.ok(!fs.existsSync(themeLibPath), "theme.ts must not exist");
  });

  it("ensures globals.css neutralizes dark variant and has no .dark or media query blocks", () => {
    const css = fs.readFileSync(globalsCssPath, "utf-8");
    assert.ok(
      css.includes("@custom-variant dark (&:not(*));"),
      "globals.css must neutralize dark variant with (&:not(*))"
    );
    assert.ok(
      !css.includes(".dark {") && !css.includes(".dark{") && !css.includes(".dark "),
      "globals.css must not contain .dark selectors"
    );
    assert.ok(
      !css.includes("prefers-color-scheme: dark"),
      "globals.css must not contain prefers-color-scheme: dark media queries"
    );
  });

  it("ensures layout.tsx has light className, suppressHydrationWarning for data-density, and no ThemeProvider", () => {
    const layoutContent = fs.readFileSync(layoutPath, "utf-8");
    assert.ok(layoutContent.includes('lang="vi"'), "layout.tsx must specify lang='vi'");
    assert.ok(layoutContent.includes("light"), "layout.tsx html tag must include 'light' class");
    assert.ok(
      layoutContent.includes("suppressHydrationWarning"),
      "layout.tsx must contain suppressHydrationWarning to prevent data-density hydration mismatch"
    );
    assert.ok(
      !layoutContent.includes("ThemeProvider"),
      "layout.tsx must not contain ThemeProvider"
    );
  });

  it("ensures viewport is locked to light mode with #fbfbfb themeColor", () => {
    assert.equal(viewport.colorScheme, "light", "colorScheme must be light");
    assert.equal(viewport.themeColor, "#fbfbfb", "themeColor must be #fbfbfb");
  });

  it("ensures zero useTheme and ThemeProvider references exist in src/", () => {
    function scanFiles(dir: string, extPattern: RegExp): string[] {
      const results: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...scanFiles(fullPath, extPattern));
        } else if (extPattern.test(entry.name)) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const tsFiles = scanFiles(srcDir, /\.(ts|tsx)$/);
    const useThemeMatches: string[] = [];
    const themeProviderMatches: string[] = [];
    const tailwindDarkClassRegex = /\bdark:[a-zA-Z0-9_\-\[\]]+/;
    const tailwindDarkMatches: { file: string; match: string }[] = [];

    for (const filePath of tsFiles) {
      const content = fs.readFileSync(filePath, "utf-8");
      if (content.includes("useTheme")) {
        useThemeMatches.push(filePath);
      }
      if (content.includes("ThemeProvider")) {
        themeProviderMatches.push(filePath);
      }

      // Check for Tailwind dark: utility classes
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const m = line.match(tailwindDarkClassRegex);
        if (m) {
          tailwindDarkMatches.push({
            file: `${filePath}:${i + 1}`,
            match: m[0],
          });
        }
      }
    }

    assert.equal(
      useThemeMatches.length,
      0,
      `Found useTheme in: ${useThemeMatches.join(", ")}`
    );
    assert.equal(
      themeProviderMatches.length,
      0,
      `Found ThemeProvider in: ${themeProviderMatches.join(", ")}`
    );
    assert.equal(
      tailwindDarkMatches.length,
      0,
      `Found Tailwind dark: classes in: ${JSON.stringify(tailwindDarkMatches)}`
    );
  });

  it("ensures globals.css has no forced composite layers and defines .content-auto utility", () => {
    const css = fs.readFileSync(globalsCssPath, "utf-8");
    assert.ok(
      !css.includes("transform: translateZ(0)"),
      "globals.css must not contain forced translateZ(0) composite layer"
    );
    assert.ok(
      !css.includes("will-change: transform"),
      "globals.css must not contain unneeded will-change: transform"
    );
    assert.ok(
      css.includes("content-auto") &&
        css.includes("content-visibility: auto") &&
        css.includes("contain-intrinsic-size: 1px 64px"),
      "globals.css must define .content-auto utility with content-visibility: auto and contain-intrinsic-size: 1px 64px"
    );
  });

  it("ensures Vietnamese typography tracking, line-height, and text-wrap standards in globals.css", () => {
    const css = fs.readFileSync(globalsCssPath, "utf-8");
    assert.ok(
      css.includes("letter-spacing: -0.01em;"),
      "headings must use relaxed letter-spacing: -0.01em to prevent diacritic collision"
    );
    assert.ok(
      !css.includes("letter-spacing: -0.025em;"),
      "headings must not use overly tight letter-spacing: -0.025em"
    );
    assert.ok(
      css.includes("line-height: 1.35;"),
      "headings must have line-height: 1.35"
    );
    assert.ok(
      css.includes("text-wrap: balance;"),
      "headings must maintain text-wrap: balance"
    );
    assert.ok(
      css.includes("p, td, li") && css.includes("text-wrap: pretty;"),
      "p, td, li elements must have text-wrap: pretty"
    );
  });
});

describe("Task 7: Design System Contrast & Accessibility", () => {
  it("tokens.ts uses WCAG 2.1 AA compliant status text classes (700 shades)", () => {
    const tokensPath = path.resolve(__dirname, "../src/lib/tokens.ts");
    const content = fs.readFileSync(tokensPath, "utf-8");
    assert.ok(content.includes("text-emerald-700"), "Completed status should use text-emerald-700 (5.25:1)");
    assert.ok(content.includes("text-amber-700"), "NeedsReview status should use text-amber-700 (5.02:1)");
    assert.ok(
      content.includes("Be Vietnam Pro"),
      "QCET design tokens typography must include 'Be Vietnam Pro'"
    );
  });

  it("login and portal pages provide id='main-content' for keyboard skip-link", () => {
    const loginPath = path.resolve(__dirname, "../src/app/login/page.tsx");
    const portalPath = path.resolve(__dirname, "../src/app/portal/page.tsx");

    const loginContent = fs.readFileSync(loginPath, "utf-8");
    const portalContent = fs.readFileSync(portalPath, "utf-8");

    assert.ok(loginContent.includes('id="main-content"'), "login page must contain id='main-content'");
    assert.ok(portalContent.includes('id="main-content"'), "portal page must contain id='main-content'");
  });

  it(".gitignore ignores SQLite database artifacts", () => {
    const gitignorePath = path.resolve(__dirname, "../.gitignore");
    const content = fs.readFileSync(gitignorePath, "utf-8");
    assert.ok(content.includes("*.db"), ".gitignore must ignore *.db");
    assert.ok(content.includes("dev.db"), ".gitignore must ignore dev.db");
  });
});
