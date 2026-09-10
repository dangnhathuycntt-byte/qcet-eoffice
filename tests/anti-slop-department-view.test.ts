import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Department Task View Anti-Slop Audit", () => {
  const targetFiles = [
    "src/lib/department-task-aggregator.ts",
    "src/components/dashboard/department-grouped-task-view.tsx",
  ];

  test("Zero decorative emojis in new department view files", () => {
    const emojiRegex =
      /[\u{1F300}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    for (const relPath of targetFiles) {
      const fullPath = path.join(process.cwd(), relPath);
      assert.ok(fs.existsSync(fullPath), `File must exist: ${relPath}`);
      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        assert.ok(
          !emojiRegex.test(line),
          `Found decorative emoji in ${relPath}:${idx + 1}: ${line}`
        );
      });
    }
  });

  test("Contains font-mono and tabular-nums for numeric metrics", () => {
    const viewPath = path.join(
      process.cwd(),
      "src/components/dashboard/department-grouped-task-view.tsx"
    );
    const content = fs.readFileSync(viewPath, "utf-8");
    assert.ok(content.includes("tabular-nums"), "Must use tabular-nums for numbers");
    assert.ok(content.includes("font-mono"), "Must use font-mono for metrics and codes");
  });

  test("Lucide icons use strokeWidth={1.5} or consistent styling", () => {
    const viewPath = path.join(
      process.cwd(),
      "src/components/dashboard/department-grouped-task-view.tsx"
    );
    const content = fs.readFileSync(viewPath, "utf-8");
    assert.ok(content.includes("strokeWidth={1.5}"), "Icons must use strokeWidth 1.5");
  });
});
