import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DashboardZone } from "../src/components/dashboard/zones/dashboard-zone";

describe("DashboardZone Contract & Structure Verification", () => {
  test("DashboardZone is a memoized React component", () => {
    assert.equal(typeof DashboardZone, "object");
  });

  test("DashboardZone source file exists and adheres to size budget (< 150 lines)", () => {
    const filePath = path.resolve(__dirname, "../src/components/dashboard/zones/dashboard-zone.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    const lineCount = content.split("\n").length;
    assert.ok(lineCount < 150, `DashboardZone exceeded 150 lines: ${lineCount}`);
    assert.ok(content.includes('data-slot="zone-dashboard"'));
    assert.ok(content.includes("DashboardSituationStrip"), "Must reference DashboardSituationStrip (SITUATION section)");
    assert.ok(content.includes("UpcomingDeadlinesWidget"));
    assert.ok(content.includes("ActivityFeedWidget"));
  });

  test("DashboardZone enforces ACTION -> SITUATION -> CONTEXT section order", () => {
    const filePath = path.resolve(__dirname, "../src/components/dashboard/zones/dashboard-zone.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    const actionPos = content.indexOf('data-slot="section-action"');
    const situationPos = content.indexOf('data-slot="section-situation"');
    const contextPos = content.indexOf('data-slot="section-context"');

    assert.ok(actionPos > -1, 'Must have data-slot="section-action"');
    assert.ok(situationPos > -1, 'Must have data-slot="section-situation"');
    assert.ok(contextPos > -1, 'Must have data-slot="section-context"');
    assert.ok(actionPos < situationPos, "ACTION section must appear before SITUATION section");
    assert.ok(situationPos < contextPos, "SITUATION section must appear before CONTEXT section");
  });

  test("DashboardZone does not render ExecutiveStatStrip (replaced by DashboardSituationStrip)", () => {
    const filePath = path.resolve(__dirname, "../src/components/dashboard/zones/dashboard-zone.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    assert.equal(
      content.includes("<ExecutiveStatStrip"),
      false,
      "dashboard-zone.tsx must not render <ExecutiveStatStrip /> — use DashboardSituationStrip for SITUATION"
    );
  });

  test("DashboardZone does not contain dark: Tailwind classes (light-only standard)", () => {
    const filePath = path.resolve(__dirname, "../src/components/dashboard/zones/dashboard-zone.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    const darkMatches = content.match(/\bdark:/g) || [];
    assert.equal(darkMatches.length, 0, `Found ${darkMatches.length} dark: classes — violates light-only standard`);
  });

  test("DashboardSituationStrip source file: no dark: classes, no emoji, proper data-slot", () => {
    const filePath = path.resolve(__dirname, "../src/components/dashboard/dashboard-situation-strip.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    const darkMatches = content.match(/\bdark:/g) || [];
    assert.equal(darkMatches.length, 0, "DashboardSituationStrip must not use dark: classes");
    assert.ok(content.includes('data-slot="dashboard-situation-strip"'));
    // No emoji — check for surrogate pair range
    assert.ok(!/[\u{1F300}-\u{1F9FF}]/u.test(content), "No decorative emoji allowed");
  });

  test("PersonalWorkbench attentionOnly prop gates SmartWorkbox and context widgets", () => {
    const filePath = path.resolve(__dirname, "../src/components/dashboard/personal-workbench.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    assert.ok(content.includes("attentionOnly"), "PersonalWorkbench must declare attentionOnly prop");
    assert.ok(content.includes("!attentionOnly"), "SmartWorkbox and context widgets must be gated by !attentionOnly");
  });
});
