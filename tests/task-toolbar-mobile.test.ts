import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Unified Task Toolbar Mobile Ergonomics Suite", () => {
  test("unified-task-toolbar.tsx includes responsive labels for scope switcher", () => {
    const toolbarPath = path.resolve(process.cwd(), "src/components/dashboard/unified-task-toolbar.tsx");
    const content = fs.readFileSync(toolbarPath, "utf-8");
    assert.ok(content.includes("Cá nhân"));
    assert.ok(content.includes("overscroll-x-contain") || content.includes("overscroll-behavior-x"));
  });
});
