import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  VIEW_MODE_OPTIONS,
  type TaskViewMode,
} from "../src/components/dashboard/unified-task-toolbar";
import {
  getDefaultViewModeForRole,
  parseViewModeParam,
} from "../src/lib/unified-task-hub";

describe("Executive Department Page & Toolbar Integration", () => {
  test("TaskViewMode supports 'executive' mode", () => {
    const executiveMode: TaskViewMode = "executive";
    assert.equal(executiveMode, "executive");

    const execOption = VIEW_MODE_OPTIONS.find((opt) => opt.id === "executive");
    assert.ok(execOption, "VIEW_MODE_OPTIONS must include 'executive'");
    assert.equal(execOption.label, "Chỉ huy BGH");
  });

  test("src/components/tasks/unified-task-toolbar.tsx exists and re-exports toolbar module", () => {
    const tasksToolbarPath = path.join(
      process.cwd(),
      "src/components/tasks/unified-task-toolbar.tsx"
    );
    assert.ok(
      fs.existsSync(tasksToolbarPath),
      "src/components/tasks/unified-task-toolbar.tsx must exist"
    );

    const content = fs.readFileSync(tasksToolbarPath, "utf-8");
    assert.ok(
      content.includes("@/components/dashboard/unified-task-toolbar"),
      "Must re-export dashboard unified-task-toolbar"
    );
  });

  test("getDefaultViewModeForRole gives executive view for ADMIN and table for others", () => {
    assert.equal(getDefaultViewModeForRole("ADMIN"), "executive");
    assert.equal(getDefaultViewModeForRole("MANAGER"), "table");
    assert.equal(getDefaultViewModeForRole("STAFF"), "table");
    assert.equal(getDefaultViewModeForRole(undefined), "table");
  });

  test("parseViewModeParam correctly recognizes executive query aliases", () => {
    assert.equal(parseViewModeParam("executive"), "executive");
    assert.equal(parseViewModeParam("chi-huy"), "executive");
    assert.equal(parseViewModeParam("bgh"), "executive");
    assert.equal(parseViewModeParam("command"), "executive");
  });

  test("src/app/page.tsx integrates ExecutiveDepartmentCommandCenter dynamically", () => {
    const pagePath = path.join(process.cwd(), "src/app/page.tsx");
    assert.ok(fs.existsSync(pagePath), "src/app/page.tsx must exist");

    const pageContent = fs.readFileSync(pagePath, "utf-8");

    // Dynamic import
    assert.ok(
      pageContent.includes("ExecutiveDepartmentCommandCenter = dynamic("),
      "Must dynamically import ExecutiveDepartmentCommandCenter"
    );
    assert.ok(
      pageContent.includes("@/components/tasks/executive-department-command-center"),
      "Must import from '@/components/tasks/executive-department-command-center'"
    );

    // Conditional rendering
    assert.ok(
      pageContent.includes('viewMode === "executive"'),
      "Must have conditional branch for viewMode === 'executive'"
    );
    assert.ok(
      pageContent.includes("<ExecutiveDepartmentCommandCenter"),
      "Must render <ExecutiveDepartmentCommandCenter"
    );

    // Task selection opens side sheet
    assert.ok(
      pageContent.includes("onSelectTask={(task) => setSelectedTask(task)}"),
      "Must wire onSelectTask to setSelectedTask"
    );

    // Role-based default view mode integration
    assert.ok(
      pageContent.includes("getDefaultViewModeForRole(user?.role)"),
      "Must use getDefaultViewModeForRole(user?.role) for initial and effect state"
    );
  });

  test("Anti-slop check: 0% decorative emojis across all modified files", () => {
    const emojiRegex =
      /[\u{1F300}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    const filesToCheck = [
      "src/components/dashboard/unified-task-toolbar.tsx",
      "src/components/tasks/unified-task-toolbar.tsx",
      "src/lib/unified-task-hub.ts",
      "src/app/page.tsx",
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.join(process.cwd(), relPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      assert.ok(!emojiRegex.test(content), `${relPath} must not contain decorative emojis`);
      assert.ok(!content.includes("�"), `${relPath} must not contain replacement characters`);
    }
  });

  test("Design system check: strokeWidth={1.5} for Lucide icons in toolbar", () => {
    const toolbarPath = path.join(
      process.cwd(),
      "src/components/dashboard/unified-task-toolbar.tsx"
    );
    const content = fs.readFileSync(toolbarPath, "utf-8");

    // Must have strokeWidth={1.5}
    assert.ok(
      content.includes("strokeWidth={1.5}"),
      "Toolbar icons must use strokeWidth={1.5}"
    );

    // No strokeWidth other than 1.5
    const invalidStrokeMatches = content.match(/strokeWidth=\{?(?!1\.5)[0-9.]+\}?/g);
    assert.equal(
      invalidStrokeMatches,
      null,
      `No invalid stroke widths allowed: ${invalidStrokeMatches}`
    );
  });
});
