import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getCategoryBadgeConfig } from "../src/components/tasks/cascading-task-table";

test("tasks page has no duplicate in-page breadcrumb navigation", () => {
  const tasksPagePath = path.resolve(process.cwd(), "src/app/tasks/page.tsx");
  const content = fs.readFileSync(tasksPagePath, "utf-8");
  assert.equal(
    content.includes('aria-label="Breadcrumb"'),
    false,
    "Page body must not duplicate topbar breadcrumb"
  );
});

test("cascading-task-table uses neutral category tags without rainbow pastel pills", () => {
  const categories = [
    "CNTT",
    "ATTT",
    "CHUYEN_DOI_SO",
    "TRUYEN_THONG",
    "THU_VIEN",
    "BAO_CAO",
    "KHAC",
  ];

  for (const cat of categories) {
    const config = getCategoryBadgeConfig(cat);
    assert.ok(
      config.className.includes("bg-secondary") &&
        config.className.includes("text-muted-foreground"),
      `Category ${cat} should use neutral academic badge styling (bg-secondary text-muted-foreground)`
    );
    assert.ok(
      !config.className.includes("bg-indigo-") &&
        !config.className.includes("bg-sky-") &&
        !config.className.includes("bg-rose-") &&
        !config.className.includes("bg-teal-"),
      `Category ${cat} must not use rainbow pastel pill colors`
    );
  }
});
