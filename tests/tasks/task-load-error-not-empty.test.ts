import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const tasksPagePath = path.join(ROOT_DIR, "src", "app", "tasks", "page.tsx");
const tasksErrorPath = path.join(ROOT_DIR, "src", "app", "tasks", "error.tsx");

/**
 * Plan P0-05 / T01: "Task load failure must not become empty task data:
 * error != empty."
 *
 * Regression: src/app/tasks/page.tsx used to read
 *   `getLiveDashboardData({...}).catch(() => ({ tasks: [] }))`
 * so any read failure produced a plausible-looking empty workspace instead of
 * an error, making an outage indistinguishable from "you have no tasks".
 */
describe("P0-05 task load failure is not empty data", () => {
  test("the tasks page does not swallow a load failure into an empty task list", () => {
    const source = fs.readFileSync(tasksPagePath, "utf8");

    const swallowsIntoEmptyTasks =
      /\.catch\(\s*\(\s*\)\s*=>\s*\(\s*\{\s*tasks:\s*\[\]\s*\}\s*\)\s*\)/.test(
        source
      );

    assert.equal(
      swallowsIntoEmptyTasks,
      false,
      "a failed task read must not resolve to { tasks: [] } — error is not empty"
    );
  });

  test("propagating the error is safe: the route has an error boundary", () => {
    assert.ok(
      fs.existsSync(tasksErrorPath),
      "src/app/tasks/error.tsx must exist so a thrown load failure renders an error state"
    );

    const boundary = fs.readFileSync(tasksErrorPath, "utf8");
    assert.ok(
      boundary.includes('role="alert"'),
      "the error boundary must announce itself to assistive technology"
    );
    assert.ok(
      boundary.includes("reset"),
      "the error boundary must offer a retry affordance"
    );
  });
});
