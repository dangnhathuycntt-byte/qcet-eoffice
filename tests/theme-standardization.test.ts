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

  it("ensures layout.tsx has light className, no suppressHydrationWarning, and no ThemeProvider", () => {
    const layoutContent = fs.readFileSync(layoutPath, "utf-8");
    assert.ok(layoutContent.includes('lang="vi"'), "layout.tsx must specify lang='vi'");
    assert.ok(layoutContent.includes("light"), "layout.tsx html tag must include 'light' class");
    assert.ok(
      !layoutContent.includes("suppressHydrationWarning"),
      "layout.tsx must not contain suppressHydrationWarning"
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
});
