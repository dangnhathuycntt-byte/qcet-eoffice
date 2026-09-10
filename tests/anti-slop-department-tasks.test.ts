import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Department Task Organization Anti-Slop & Design System Audit", () => {
  const targetFiles = [
    "src/lib/department-task-aggregator.ts",
    "src/components/dashboard/department-grouped-task-view.tsx",
    "src/components/dashboard/unified-task-toolbar.tsx",
    "src/lib/unified-task-hub.ts",
  ];

  test("Zero decorative emojis in all new and updated department task files", () => {
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

  test("Lucide icons in department view use strokeWidth={1.5}", () => {
    const viewPath = path.join(
      process.cwd(),
      "src/components/dashboard/department-grouped-task-view.tsx"
    );
    assert.ok(fs.existsSync(viewPath), "department-grouped-task-view.tsx must exist");
    const content = fs.readFileSync(viewPath, "utf-8");
    assert.ok(
      content.includes("strokeWidth={1.5}"),
      "Lucide icons in department-grouped-task-view.tsx must explicitly use strokeWidth={1.5}"
    );

    // Verify all Lucide icon usages specify strokeWidth={1.5}
    const iconNames = [
      "Building2",
      "ChevronDown",
      "ChevronRight",
      "UserCheck",
      "Plus",
      "ArrowUpRight",
      "Maximize2",
      "Minimize2",
    ];

    for (const icon of iconNames) {
      const iconTagRegex = new RegExp(`<${icon}[^>]*>`, "g");
      const matches = content.match(iconTagRegex);
      if (matches) {
        for (const match of matches) {
          assert.ok(
            match.includes("strokeWidth={1.5}"),
            `Icon <${icon}> missing strokeWidth={1.5}: ${match}`
          );
        }
      }
    }
  });

  test("Contains font-mono and tabular-nums for numeric metrics and department codes", () => {
    const viewPath = path.join(
      process.cwd(),
      "src/components/dashboard/department-grouped-task-view.tsx"
    );
    const content = fs.readFileSync(viewPath, "utf-8");
    assert.ok(
      content.includes("tabular-nums"),
      "Must use tabular-nums for numeric metrics and dates"
    );
    assert.ok(
      content.includes("font-mono"),
      "Must use font-mono for metrics, codes, and badges"
    );
  });

  test("RAG alert classes and visual indicators present in component", () => {
    const viewPath = path.join(
      process.cwd(),
      "src/components/dashboard/department-grouped-task-view.tsx"
    );
    const content = fs.readFileSync(viewPath, "utf-8");

    // RED alert classes (rose / red)
    assert.ok(
      content.includes("rose-50") && content.includes("rose-700") && content.includes("rose-500"),
      "Component must contain RED RAG alert styling (rose tokens)"
    );
    assert.ok(
      content.includes("animate-pulse"),
      "Component must contain animated pulse for critical RED RAG warnings"
    );

    // AMBER warning classes (amber / yellow)
    assert.ok(
      content.includes("amber-50") && content.includes("amber-700") && content.includes("amber-500"),
      "Component must contain AMBER RAG warning styling (amber tokens)"
    );

    // GREEN normal classes (emerald / green)
    assert.ok(
      content.includes("emerald-50") && content.includes("emerald-700") && content.includes("emerald-500"),
      "Component must contain GREEN RAG normal styling (emerald tokens)"
    );

    // RAG badge and reason display
    assert.ok(
      content.includes("RAGBadge"),
      "Component must define and render RAGBadge component"
    );
  });
});
