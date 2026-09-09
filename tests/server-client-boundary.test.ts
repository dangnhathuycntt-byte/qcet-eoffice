import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Task 2: Server / Client Boundary Audit & Direct Server Reads", () => {
  const rootDir = process.cwd();

  const pagePath = path.join(rootDir, "src/app/page.tsx");
  const tasksPagePath = path.join(rootDir, "src/app/tasks/page.tsx");
  const dashboardPagePath = path.join(rootDir, "src/app/dashboard/page.tsx");
  const hubClientPath = path.join(
    rootDir,
    "src/components/dashboard/unified-task-hub-client.tsx"
  );
  const tasksClientPath = path.join(
    rootDir,
    "src/app/tasks/tasks-page-client.tsx"
  );

  it("1. src/app/page.tsx is a Server Component with direct server reads", () => {
    assert.ok(fs.existsSync(pagePath), "src/app/page.tsx must exist");
    const content = fs.readFileSync(pagePath, "utf-8");

    // Must NOT have 'use client'
    assert.ok(
      !content.includes('"use client"') && !content.includes("'use client'"),
      "src/app/page.tsx must be a Server Component (no 'use client')"
    );

    // Must call canonical server service directly
    assert.ok(
      content.includes("getLiveDashboardData"),
      "src/app/page.tsx must call getLiveDashboardData directly"
    );
    assert.ok(
      content.includes("@/lib/server/dashboard-service"),
      "src/app/page.tsx must import from @/lib/server/dashboard-service"
    );

    // Must render UnifiedTaskHubClient with initialData
    assert.ok(
      content.includes("<UnifiedTaskHubClient"),
      "src/app/page.tsx must render UnifiedTaskHubClient"
    );
    assert.ok(
      content.includes("initialData={initialData}"),
      "src/app/page.tsx must pass initialData to UnifiedTaskHubClient"
    );

    // Must maintain dynamic imports for zones
    assert.ok(
      content.includes('import dynamic from "next/dynamic"'),
      "src/app/page.tsx must dynamically import heavy zones"
    );
    assert.ok(
      content.includes('import("@/components/dashboard/zones/calendar-zone")'),
      "src/app/page.tsx must dynamically split CalendarZone"
    );

    // Must maintain canonical redirect
    assert.ok(
      content.includes('zoneParam === "tasks"'),
      "src/app/page.tsx must check zoneParam === 'tasks'"
    );
    assert.ok(
      content.includes('"/tasks"'),
      "src/app/page.tsx must redirect to /tasks"
    );
  });

  it("2. src/app/tasks/page.tsx is a Server Component with direct server reads", () => {
    assert.ok(fs.existsSync(tasksPagePath), "src/app/tasks/page.tsx must exist");
    const content = fs.readFileSync(tasksPagePath, "utf-8");

    // Must NOT have 'use client'
    assert.ok(
      !content.includes('"use client"') && !content.includes("'use client'"),
      "src/app/tasks/page.tsx must be a Server Component (no 'use client')"
    );

    // Must call canonical server service directly
    assert.ok(
      content.includes("getLiveDashboardData"),
      "src/app/tasks/page.tsx must call getLiveDashboardData directly"
    );

    // Must pass initialTasks to client island
    assert.ok(
      content.includes("initialTasks={tasks}"),
      "src/app/tasks/page.tsx must pass initialTasks to TasksPageClient"
    );

    // Must satisfy line budget (< 30 lines)
    const lineCount = content.trim().split("\n").length;
    assert.ok(
      lineCount < 30,
      `src/app/tasks/page.tsx must be concise (< 30 lines), got ${lineCount}`
    );
  });

  it("3. src/app/dashboard/page.tsx is a Server Component redirecting to /", () => {
    assert.ok(
      fs.existsSync(dashboardPagePath),
      "src/app/dashboard/page.tsx must exist"
    );
    const content = fs.readFileSync(dashboardPagePath, "utf-8");

    assert.ok(
      !content.includes('"use client"') && !content.includes("'use client'"),
      "src/app/dashboard/page.tsx must be a Server Component (no 'use client')"
    );
    assert.ok(
      content.includes('redirect("/")'),
      "src/app/dashboard/page.tsx must redirect to /"
    );
  });

  it("4. Client islands retain interactive responsibilities", () => {
    assert.ok(
      fs.existsSync(hubClientPath),
      "unified-task-hub-client.tsx must exist"
    );
    const hubContent = fs.readFileSync(hubClientPath, "utf-8");
    assert.ok(
      hubContent.includes('"use client"'),
      "unified-task-hub-client.tsx must be a Client Component"
    );
    assert.ok(
      hubContent.includes("DashboardStateProvider"),
      "unified-task-hub-client.tsx must wrap with DashboardStateProvider"
    );
    assert.ok(
      hubContent.includes("initialData={initialData}"),
      "unified-task-hub-client.tsx must supply initialData to provider"
    );

    assert.ok(
      fs.existsSync(tasksClientPath),
      "tasks-page-client.tsx must exist"
    );
    const tasksContent = fs.readFileSync(tasksClientPath, "utf-8");
    assert.ok(
      tasksContent.includes('"use client"'),
      "tasks-page-client.tsx must be a Client Component"
    );
    assert.ok(
      tasksContent.includes("TaskManagementWorkspace"),
      "tasks-page-client.tsx must mount TaskManagementWorkspace"
    );
    assert.ok(
      tasksContent.includes("initialTasks={initialTasks}"),
      "tasks-page-client.tsx must pass initialTasks"
    );
  });

  it("5. Zero dark: CSS classes across all modified components", () => {
    const filesToCheck = [
      pagePath,
      tasksPagePath,
      dashboardPagePath,
      hubClientPath,
      tasksClientPath,
    ];

    for (const filePath of filesToCheck) {
      const content = fs.readFileSync(filePath, "utf-8");
      assert.ok(
        !content.includes("dark:"),
        `${filePath} must not contain dark: classes`
      );
    }
  });

  it("6. Zero decorative emojis across all modified components", () => {
    const emojiRegex =
      /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    const filesToCheck = [
      pagePath,
      tasksPagePath,
      dashboardPagePath,
      hubClientPath,
      tasksClientPath,
    ];

    for (const filePath of filesToCheck) {
      const content = fs.readFileSync(filePath, "utf-8");
      assert.ok(
        !emojiRegex.test(content),
        `${filePath} must not contain decorative emojis`
      );
    }
  });
});
