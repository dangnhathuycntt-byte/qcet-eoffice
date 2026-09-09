import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { formatDepartmentLabel, resolveDepartment } from "../src/components/layout/scope-switcher";
import { QCET_DEPARTMENTS } from "../src/components/org/organization-tree";

describe("ScopeSwitcher Ergonomics & Zero-Hardcode Suite", () => {
  const filePath = path.join(process.cwd(), "src/components/layout/scope-switcher.tsx");

  test("scope-switcher.tsx exists and is readable", () => {
    assert.strictEqual(fs.existsSync(filePath), true);
  });

  test("scope-switcher.tsx does NOT hardcode Khoa CNTT as a static button", () => {
    const content = fs.readFileSync(filePath, "utf-8");
    // Should not contain hardcoded exclusion `dept.code !== "K_CNTT"`
    assert.ok(
      !content.includes('dept.code !== "K_CNTT"'),
      "Must not exclude K_CNTT from standard departments list"
    );
    // Should not have a static JSX button hardcoded for K_CNTT
    assert.ok(
      !content.includes('handleSelectScope("unit", "K_CNTT")'),
      "Must not have hardcoded handleSelectScope for K_CNTT in trigger list"
    );
  });

  test("formatDepartmentLabel outputs clean non-truncating labels", () => {
    const cntt = QCET_DEPARTMENTS.find((d) => d.code === "K_CNTT");
    assert.ok(cntt);
    const label = formatDepartmentLabel(cntt);
    assert.strictEqual(label, "Khoa Công nghệ thông tin");
  });

  test("scope-switcher.tsx incorporates search filter input for departments", () => {
    const content = fs.readFileSync(filePath, "utf-8");
    assert.ok(
      content.includes("searchQuery") || content.includes("Search"),
      "Must include searchable filter input in popover"
    );
  });
});
