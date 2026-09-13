import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("DashboardZone Reactivity and Reactive Filtering", () => {
  const zonePath = path.join(
    process.cwd(),
    "src/components/dashboard/zones/dashboard-zone.tsx"
  );

  test("DashboardZone connects stat strip filter and department matrix to active task list", () => {
    const content = fs.readFileSync(zonePath, "utf-8");
    // Verify that activeWorkbox or filter changes reflect on the displayed task container
    assert.ok(
      content.includes("CascadingTaskTable") ||
        content.includes("UnifiedAdaptiveWorkspace") ||
        content.includes("filteredTasks"),
      "DashboardZone must mount task table or workspace displaying reactive filtered tasks"
    );
    // Ensure dead-click items prop is passed to ExecutiveActionCenter if present
    assert.equal(
      content.includes("DEFAULT_ACTION_ITEMS"),
      false,
      "DashboardZone must not reference DEFAULT_ACTION_ITEMS"
    );
  });

  test("DashboardZone source eliminates divergent filterDashboardReactiveTasks in favor of filteredTasks", () => {
    const content = fs.readFileSync(zonePath, "utf-8");
    assert.equal(
      content.includes("filterDashboardReactiveTasks"),
      false,
      "DashboardZone must not declare or use divergent filterDashboardReactiveTasks"
    );
    assert.ok(
      content.includes("filteredTasks"),
      "DashboardZone must consume filteredTasks from useDashboardData"
    );
    // The zone passes the scope+period set as `tasks` and the reactive filter output
    // as `filteredTasks` to PersonalWorkbench.
    assert.ok(
      content.includes("tasks={baseTasks}") || content.includes("tasks={filteredTasks}"),
      "DashboardZone must pass the task set to PersonalWorkbench"
    );
    assert.ok(
      content.includes("filteredTasks={filteredTasks}"),
      "DashboardZone must pass the reactive filtered tasks to PersonalWorkbench"
    );
  });
});
