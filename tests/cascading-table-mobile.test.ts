// tests/cascading-table-mobile.test.ts
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { useSwipeAction } from "@/hooks/use-swipe-action";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

describe("Cascading Task Table Mobile Dual-Mode Suite", () => {
  test("cascading-task-table.tsx implements dual-mode with desktop table and mobile card feed", () => {
    const tablePath = path.resolve(process.cwd(), "src/components/tasks/cascading-task-table.tsx");
    const content = fs.readFileSync(tablePath, "utf-8");
    assert.ok(content.includes("hidden md:block"));
    assert.ok(content.includes("md:hidden"));
    assert.ok(content.includes("Duyệt nhanh"));
    assert.ok(!content.includes("group-hover:opacity-100")); // Mobile actions must not depend on hover
  });

  test("useSwipeAction hook exports valid contract", () => {
    assert.strictEqual(typeof useSwipeAction, "function");
  });

  test("usePullToRefresh hook exports valid contract", () => {
    assert.strictEqual(typeof usePullToRefresh, "function");
  });
});
