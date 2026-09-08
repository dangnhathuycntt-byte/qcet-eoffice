import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { Viewport } from "next";

// Intercept CSS and next/font/google imports in Node runtime before importing layout
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

const { viewport }: { viewport: Viewport } = require("../src/app/layout");

describe("Mobile Layout Viewport & CSS Ergonomics Suite", () => {
  test("layout.tsx viewport includes interactiveWidget: resizes-content", () => {
    assert.ok(viewport);
    assert.strictEqual(viewport.interactiveWidget, "resizes-content");
    assert.strictEqual(viewport.width, "device-width");
    assert.strictEqual(viewport.initialScale, 1);
  });

  test("globals.css contains touch-action manipulation and 16px iOS input floor", () => {
    const cssPath = path.resolve(process.cwd(), "src/app/globals.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");
    assert.ok(cssContent.includes("touch-action: manipulation"));
    assert.ok(cssContent.includes("-webkit-tap-highlight-color: transparent"));
    assert.ok(cssContent.includes("font-size: 16px !important"));
    assert.ok(cssContent.includes("touch-target-expand-44"));
  });
});
