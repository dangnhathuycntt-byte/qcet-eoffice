import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("ExecutiveActionCenter UI & Empty State Suite", () => {
  const actionCenterPath = path.join(
    process.cwd(),
    "src/components/dashboard/executive-action-center.tsx"
  );
  const dashboardZonePath = path.join(
    process.cwd(),
    "src/components/dashboard/zones/dashboard-zone.tsx"
  );
  const useTaskFiltersPath = path.join(
    process.cwd(),
    "src/hooks/use-task-filters.ts"
  );

  test("ExecutiveActionCenter contains zero hardcoded DEFAULT_ACTION_ITEMS", () => {
    const content = fs.readFileSync(actionCenterPath, "utf8");
    assert.equal(
      content.includes("DEFAULT_ACTION_ITEMS ="),
      false,
      "executive-action-center.tsx must not define DEFAULT_ACTION_ITEMS"
    );
    assert.equal(
      content.includes("DEFAULT_ACTION_ITEMS"),
      false,
      "executive-action-center.tsx must not reference DEFAULT_ACTION_ITEMS anywhere"
    );
    assert.equal(
      content.includes("action-pending-1"),
      false,
      "Mock action items must be completely removed"
    );
  });

  test("ExecutiveActionCenter implements Verified Clear Horizon empty state with ShieldCheck", () => {
    const content = fs.readFileSync(actionCenterPath, "utf8");
    assert.ok(
      content.includes("ShieldCheck"),
      "executive-action-center.tsx must import and use ShieldCheck from lucide-react"
    );
    assert.ok(
      content.includes("Hàng đợi điều hành thông suốt"),
      "executive-action-center.tsx must show confident empty state heading"
    );
    assert.ok(
      content.includes("Không có nhiệm vụ cần phê duyệt hoặc đôn đốc trực tiếp"),
      "executive-action-center.tsx must show informative empty state subtext"
    );
    assert.ok(
      content.includes("Verified Clear") || content.includes("thông suốt"),
      "executive-action-center.tsx must display verified clear indicator"
    );
  });

  test("ExecutiveActionCenter adheres to Light-Only standard (no dark: variants)", () => {
    const content = fs.readFileSync(actionCenterPath, "utf8");
    const darkVariantRegex = /\bdark:/;
    assert.equal(
      darkVariantRegex.test(content),
      false,
      "executive-action-center.tsx must not contain any dark: Tailwind classes"
    );
  });

  test("ExecutiveActionCenter contains zero emojis", () => {
    const content = fs.readFileSync(actionCenterPath, "utf8");
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      assert.ok(
        !emojiRegex.test(lines[i]),
        `Emoji found at line ${i + 1} in executive-action-center.tsx: ${lines[i].trim()}`
      );
    }
  });

  test("DashboardZone wires real executiveActionItems and onAction to ExecutiveActionCenter", () => {
    const content = fs.readFileSync(dashboardZonePath, "utf8");
    assert.ok(
      content.includes("items={executiveActionItems}"),
      "DashboardZone must pass executiveActionItems to ExecutiveActionCenter"
    );
    assert.ok(
      content.includes("onAction={(actionType, item)") ||
        content.includes("onAction={"),
      "DashboardZone must connect onAction callback"
    );
  });

  test("use-task-filters derives executiveActionItems directly from real tasks", () => {
    const content = fs.readFileSync(useTaskFiltersPath, "utf8");
    assert.ok(
      content.includes("extractExecutiveActionItems"),
      "use-task-filters must use extractExecutiveActionItems"
    );
    assert.ok(
      content.includes("executiveActionItems"),
      "use-task-filters must export executiveActionItems"
    );
  });
});
