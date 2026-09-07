import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TasksFocusLanding } from "../src/components/dashboard/zones/tasks-focus-landing";
import { TasksExpandedViews } from "../src/components/dashboard/zones/tasks-expanded-views";
import { TasksZone } from "../src/components/dashboard/zones/tasks-zone";

describe("Tasks Zone Decomposed Contracts & Size Verification", () => {
  test("TasksFocusLanding, TasksExpandedViews, and TasksZone are memoized React components", () => {
    assert.equal(typeof TasksFocusLanding, "object");
    assert.equal(typeof TasksExpandedViews, "object");
    assert.equal(typeof TasksZone, "object");
  });

  test("Sub-files adhere to the <= 350 lines strict modularity threshold", () => {
    const files = [
      "../src/components/dashboard/zones/tasks-focus-landing.tsx",
      "../src/components/dashboard/zones/tasks-expanded-views.tsx",
      "../src/components/dashboard/zones/tasks-zone.tsx",
    ];

    for (const rel of files) {
      const full = path.resolve(__dirname, rel);
      const lines = fs.readFileSync(full, "utf-8").split("\n").length;
      assert.ok(lines <= 350, `File ${rel} exceeded 350 lines: found ${lines}`);
    }
  });
});
