import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Executive Workbench UI/UX Anti-Slop Compliance", async (t) => {
  const statStripPath = path.resolve(process.cwd(), "src/components/dashboard/executive-stat-strip.tsx");
  const actionCenterPath = path.resolve(process.cwd(), "src/components/dashboard/executive-action-center.tsx");
  const dashboardZonePath = path.resolve(process.cwd(), "src/components/dashboard/zones/dashboard-zone.tsx");

  const statStripContent = fs.readFileSync(statStripPath, "utf-8");
  const actionCenterContent = fs.readFileSync(actionCenterPath, "utf-8");
  const dashboardZoneContent = fs.readFileSync(dashboardZonePath, "utf-8");

  await t.test("Criterion 1: Zero emojis in Executive components", () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert.equal(emojiRegex.test(statStripContent), false, "ExecutiveStatStrip must not contain emojis");
    assert.equal(emojiRegex.test(actionCenterContent), false, "ExecutiveActionCenter must not contain emojis");
    assert.equal(emojiRegex.test(dashboardZoneContent), false, "DashboardZone must not contain emojis");
  });

  await t.test("Criterion 2: No dark: variants (Strict Light-Only Standard)", () => {
    assert.equal(statStripContent.includes("dark:"), false, "ExecutiveStatStrip must not contain dark: variants");
    assert.equal(actionCenterContent.includes("dark:"), false, "ExecutiveActionCenter must not contain dark: variants");
    assert.equal(dashboardZoneContent.includes("dark:"), false, "DashboardZone must not contain dark: variants");
  });

  await t.test("Criterion 3: No top accent colored lines (Anti-Slop)", () => {
    assert.equal(statStripContent.includes("accentLineColor"), false, "ExecutiveStatStrip must not have accentLineColor");
    assert.equal(actionCenterContent.includes("activeTopBar"), false, "ExecutiveActionCenter must not have activeTopBar");
  });

  await t.test("Criterion 4: Semantic interactive button elements with aria-pressed and aria-label", () => {
    assert.match(statStripContent, /<button[\s\S]*?type="button"/, "ExecutiveStatStrip must render semantic button elements");
    assert.match(statStripContent, /aria-pressed=/, "ExecutiveStatStrip buttons must include aria-pressed");
    assert.match(statStripContent, /aria-label=/, "ExecutiveStatStrip buttons must include aria-label");
    assert.match(actionCenterContent, /<button[\s\S]*?type="button"/, "ExecutiveActionCenter must render semantic button cards");
    assert.match(actionCenterContent, /aria-pressed=/, "ExecutiveActionCenter cards must include aria-pressed");
    assert.match(actionCenterContent, /aria-label=/, "ExecutiveActionCenter cards must include aria-label");
  });

  await t.test("Criterion 5: Action queue pagination limit INITIAL_LIMIT = 5 and touch targets min-h-[44px]", () => {
    assert.match(actionCenterContent, /INITIAL_LIMIT\s*=\s*5/, "ExecutiveActionCenter must export INITIAL_LIMIT = 5");
    assert.match(actionCenterContent, /min-h-\[44px\]/, "Action buttons must meet min 44px touch target on mobile");
  });

  await t.test("Criterion 6: Standardized Lucide icon strokeWidth 1.5 without gray box wrapper (bg-muted/60)", () => {
    assert.match(statStripContent, /strokeWidth=\{1\.5\}/, "ExecutiveStatStrip must use strokeWidth 1.5");
    assert.equal(statStripContent.includes("bg-muted/60"), false, "ExecutiveStatStrip must not wrap icons in gray boxes");
    assert.equal(actionCenterContent.includes("bg-muted/60"), false, "ExecutiveActionCenter must not wrap icons in gray boxes");
  });

  await t.test("Criterion 7: Vietnamese typography clearance and proper font pairing", () => {
    assert.equal(dashboardZoneContent.includes("font-mono font-semibold text-xs text-primary"), false, "Phân khu badge must not use font-mono");
    assert.match(dashboardZoneContent, /font-heading font-bold/, "Dashboard title must use font-heading font-bold");
  });
});
