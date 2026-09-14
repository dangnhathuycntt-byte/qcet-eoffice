import test, { describe } from "node:test";
import assert from "node:assert/strict";
import manifest from "../src/app/manifest";
import { INSTITUTION_CONFIG } from "../src/config/institution";
import {
  useVirtualKeyboard,
  scrollActiveInputIntoView,
} from "@/hooks/use-virtual-keyboard";
import type { Viewport, Metadata } from "next";

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

// Safely load layout exports
const layout = require("../src/app/layout");
const viewport: Viewport = layout.viewport;
const metadata: Metadata = layout.metadata;

describe("Mobile Viewport & PWA Standards Verification", () => {
  test("Mobile configuration meets Apple HIG and PWA standards", () => {
    const pwa = manifest();
    assert.equal(pwa.display, "standalone");
    assert.equal(viewport.viewportFit, "cover");
    assert.equal(viewport.initialScale, 1);
    assert.ok(
      viewport.maximumScale === 1 || viewport.maximumScale === 5,
      "maximumScale must allow standard 1 or accessible zoom 5"
    );
    assert.equal(viewport.width, "device-width");
  });

  test("PWA manifest has valid QCET branding and icons", () => {
    const pwa = manifest();
    // Assert against the canonical institution config rather than a hardcoded
    // literal, so a legitimate rename cannot silently invalidate this test.
    const expectedName = `${INSTITUTION_CONFIG.shortName} E-Office - ${INSTITUTION_CONFIG.abbreviatedName}`;
    assert.equal(pwa.name, expectedName, "PWA name must reflect the canonical QCET institution branding");
    assert.equal(pwa.short_name, "QCET E-Office");
    assert.ok(
      pwa.description?.includes("QCET"),
      "Description must reference QCET"
    );
    assert.equal(pwa.orientation, "portrait-primary");
    assert.ok(
      pwa.start_url === "/" || pwa.start_url === "/?source=pwa",
      "start_url must be root or with pwa tracking parameter"
    );

    // Icons validation
    assert.ok(Array.isArray(pwa.icons), "Icons must be an array");
    const icon192 = pwa.icons?.find((icon) => icon.sizes === "192x192");
    const icon512 = pwa.icons?.find((icon) => icon.sizes === "512x512");
    const maskableIcon = pwa.icons?.find((icon) => icon.purpose === "maskable");

    assert.ok(icon192, "Must include 192x192 icon for standard PWA installation");
    assert.ok(icon512, "Must include 512x512 icon for splash screen display");
    assert.ok(maskableIcon, "Must include maskable icon for Android adaptive icons");
  });

  test("Apple Web App metadata conforms to iOS HIG standalone requirements", () => {
    assert.ok(metadata.appleWebApp, "Must configure appleWebApp metadata");
    assert.ok(typeof metadata.appleWebApp === "object", "appleWebApp must be an object");
    assert.equal(metadata.appleWebApp.capable, true);
    assert.equal(metadata.appleWebApp.statusBarStyle, "default");
    assert.equal(metadata.appleWebApp.title, "QCET E-Office");
  });

  test("Viewport themeColor is configured for pure light mode", () => {
    assert.equal(viewport.colorScheme, "light", "colorScheme must be light");
    assert.equal(viewport.themeColor, "#fbfbfb", "themeColor must be #fbfbfb");
  });

  test("Viewport configures interactiveWidget so the virtual keyboard resizes content", () => {
    assert.ok(viewport);
    assert.strictEqual(viewport.interactiveWidget, "resizes-content");
    assert.strictEqual(viewport.width, "device-width");
    assert.strictEqual(viewport.initialScale, 1);
  });

  test("useVirtualKeyboard hook exports a valid contract for keyboard offset guards", () => {
    assert.strictEqual(typeof useVirtualKeyboard, "function");
    assert.strictEqual(typeof scrollActiveInputIntoView, "function");
  });
});
