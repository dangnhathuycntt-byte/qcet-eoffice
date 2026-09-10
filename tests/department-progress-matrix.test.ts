import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Department Progress Matrix Ergonomics Test", () => {
  const matrixPath = path.join(process.cwd(), "src/components/dashboard/department-progress-matrix.tsx");

  test("DepartmentProgressMatrix provides 3-column layout on desktop with visual breathing room", () => {
    const content = fs.readFileSync(matrixPath, "utf-8");
    assert.match(content, /lg:grid-cols-3/, "Matrix grid must support 3 columns on desktop for visual breathing room");
    assert.match(content, /tabular-nums/, "Progress percentage must use tabular-nums");
    assert.doesNotMatch(content, /text-\[8px\]|text-\[9px\]|text-\[10px\]/, "Matrix cards must not use text below 12px");
  });
});
