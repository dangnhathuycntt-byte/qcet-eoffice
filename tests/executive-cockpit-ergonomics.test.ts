import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Executive Cockpit Ergonomics Test", () => {
  const statStripPath = path.join(
    process.cwd(),
    "src/components/dashboard/executive-stat-strip.tsx"
  );
  const actionCenterPath = path.join(
    process.cwd(),
    "src/components/dashboard/executive-action-center.tsx"
  );

  test("ExecutiveStatStrip uses tabular-nums and >= 12px typography floors", () => {
    const content = fs.readFileSync(statStripPath, "utf-8");
    assert.match(content, /tabular-nums/, "Stat values must use tabular-nums");
    assert.match(
      content,
      /text-2xl sm:text-3xl font-bold/,
      "Stat values must be text-2xl/3xl font-bold"
    );
    assert.match(
      content,
      /text-xs sm:text-sm font-semibold text-foreground\/90/,
      "Card title must be text-xs sm:text-sm font-semibold text-foreground/90"
    );
    assert.match(
      content,
      /text-xs sm:text-\[13px\] font-medium text-muted-foreground/,
      "Subtext must be text-xs sm:text-[13px] font-medium text-muted-foreground"
    );
    assert.match(
      content,
      /text-xs font-semibold/,
      "Badge must be text-xs font-semibold"
    );
    assert.doesNotMatch(
      content,
      /text-\[8px\]|text-\[9px\]|text-\[10px\]|text-\[11px\]/,
      "Stat strip must not contain text below 12px"
    );
  });

  test("ExecutiveActionCenter action cards have comfortable height and accessible buttons", () => {
    const content = fs.readFileSync(actionCenterPath, "utf-8");
    assert.match(
      content,
      /min-h-\[64px\]/,
      "Action cards must have min-h-[64px]"
    );
    assert.match(
      content,
      /p-3\.5/,
      "Action cards must have padding p-3.5"
    );
    assert.match(
      content,
      /text-sm font-semibold text-foreground/,
      "Action card title must be text-sm font-semibold text-foreground"
    );
    assert.match(
      content,
      /text-xs sm:text-\[13px\] text-muted-foreground/,
      "Action card metadata must be text-xs sm:text-[13px] text-muted-foreground"
    );
    assert.match(
      content,
      /h-8\.5|h-9/,
      "Action center buttons must be at least h-8.5 or h-9"
    );
    assert.match(
      content,
      /size="sm"/,
      "Action center buttons must use size='sm'"
    );
    assert.match(
      content,
      /px-3 text-xs font-semibold/,
      "Action center buttons must use px-3 text-xs font-semibold"
    );
    assert.doesNotMatch(
      content,
      /text-\[8px\]|text-\[9px\]|text-\[10px\]|text-\[11px\]/,
      "Action center must not contain text below 12px"
    );
  });
});
