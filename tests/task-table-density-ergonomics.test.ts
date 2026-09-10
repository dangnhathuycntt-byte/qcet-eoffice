import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Cascading Task Table Density Ergonomics Test", () => {
  const tablePath = path.join(process.cwd(), "src/components/tasks/cascading-task-table.tsx");

  test("CascadingTaskTable enforces 14px font for task titles and eliminates text-xs on table rows", () => {
    assert.ok(fs.existsSync(tablePath), "src/components/tasks/cascading-task-table.tsx must exist");
    const content = fs.readFileSync(tablePath, "utf-8");
    assert.match(content, /text-sm font-medium/, "Task titles must use text-sm (14px) font-medium");
    assert.match(content, /tabular-nums/, "Task codes and counters must use tabular-nums");
    assert.doesNotMatch(content, /<table[^>]*class="[^"]*text-xs/, "Table wrapper must not enforce text-xs globally");
    assert.doesNotMatch(content, /data-slot="cascading-task-table"[^>]*text-xs/, "Outer container must not enforce text-xs globally");
  });

  test("CascadingTaskTable supports density row heights and standard ergonomics", () => {
    const content = fs.readFileSync(tablePath, "utf-8");
    assert.match(content, /useDisplayDensity/, "Must consume useDisplayDensity hook");
    assert.match(content, /h-\[38px\]/, "Must support 38px compact row height");
    assert.match(content, /h-\[48px\]/, "Must support 48px comfortable row height");
    assert.match(content, /font-mono text-xs sm:text-\[13px\] tabular-nums text-muted-foreground/, "Task code must use standard mono styling");
    assert.match(content, /h-11 px-4 text-xs sm:text-\[12\.5px\] font-semibold uppercase tracking-wider text-muted-foreground/, "Table header must use standard h-11 ergonomic typography");
  });
});
