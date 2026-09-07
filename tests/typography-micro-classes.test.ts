import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC_DIR = path.resolve(process.cwd(), "src");
const FORBIDDEN_CLASS_REGEX = /\btext-\[(?:8|9|10|11)(?:\.[0-9]+)?px\]/g;
const BASELINE_VIOLATIONS = 0;

function getSourceFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getSourceFiles(fullPath, fileList);
    } else if (/\.(tsx|ts|jsx|js|css)$/.test(file)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe("Typography Floor Linter Test Suite (WCAG & Ergonomics)", () => {
  test("Scan src/ for forbidden micro-typography classes (< 12px)", () => {
    const files = getSourceFiles(SRC_DIR);
    const violations: Array<{ file: string; line: number; match: string }> = [];

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      lines.forEach((lineText, lineIdx) => {
        const matches = lineText.match(FORBIDDEN_CLASS_REGEX);
        if (matches) {
          matches.forEach((m) => {
            violations.push({
              file: path.relative(process.cwd(), filePath),
              line: lineIdx + 1,
              match: m,
            });
          });
        }
      });
    }

    console.log(`Current micro-typography violations: ${violations.length} (target: 0)`);

    if (violations.length > 0) {
      const summary = violations
        .slice(0, 20)
        .map((v) => `  - ${v.file}:${v.line} uses forbidden class "${v.match}"`)
        .join("\n");
      const extra =
        violations.length > 20 ? `\n  ... and ${violations.length - 20} more.` : "";
      assert.fail(
        `Found ${violations.length} forbidden micro-typography violations (< 12px):\n${summary}${extra}`
      );
    }

    assert.strictEqual(
      violations.length,
      0,
      "Codebase must contain exactly 0 forbidden micro-typography classes (< 12px)"
    );
  });
});
