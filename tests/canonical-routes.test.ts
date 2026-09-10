import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CANONICAL_ROUTES,
  getRouteByPath,
  getSidebarNavItems,
  getMobileBottomNavItems,
  getMobileDrawerItems,
} from "../src/lib/navigation/canonical-navigation-registry.js";
import { isRouteActive } from "../src/lib/navigation/active-matcher.js";

describe("Canonical Routes & IA Alignment Suite (Task 1)", () => {
  test("Canonical navigation registry defines single canonical routes for Desk and Tasks", () => {
    const desk = CANONICAL_ROUTES.find((r) => r.id === "desk");
    assert.ok(desk, "Desk route must exist");
    assert.equal(desk.href, "/", "Desk must point to root '/'");
    assert.equal(desk.label, "Bàn làm việc");
    assert.ok(desk.aliases?.includes("/dashboard"), "Desk must alias /dashboard");

    const tasks = CANONICAL_ROUTES.find((r) => r.id === "tasks");
    assert.ok(tasks, "Tasks route must exist");
    assert.equal(tasks.href, "/tasks", "Tasks must point to '/tasks'");
    assert.ok(tasks.aliases?.includes("/unit-tasks"), "Tasks must alias /unit-tasks");
    assert.ok(tasks.aliases?.includes("/?zone=tasks"), "Tasks must alias /?zone=tasks");
  });

  test("getRouteByPath resolves canonical routes and legacy aliases correctly", () => {
    assert.equal(getRouteByPath("/")?.id, "desk");
    assert.equal(getRouteByPath("/dashboard")?.id, "desk");
    assert.equal(getRouteByPath("/tasks")?.id, "tasks");
    assert.equal(getRouteByPath("/unit-tasks")?.id, "tasks");
  });

  test("Active matcher marks / active for root and /dashboard, and /tasks for tasks and /unit-tasks", () => {
    assert.equal(isRouteActive("/", "/"), true);
    assert.equal(isRouteActive("/", "/dashboard"), true);
    assert.equal(isRouteActive("/tasks", "/tasks"), true);
    assert.equal(isRouteActive("/tasks", "/unit-tasks"), true);

    // / with zone=tasks activates /tasks
    const searchParamsTasks = new URLSearchParams("zone=tasks");
    assert.equal(isRouteActive("/tasks", "/", searchParamsTasks), true);
    assert.equal(isRouteActive("/", "/", searchParamsTasks), false);
  });

  test("Canonical navigation registry points to canonical / and /tasks", () => {
    const deskRoute = CANONICAL_ROUTES.find((r) => r.id === "desk");
    assert.ok(deskRoute, "Desk route must exist");
    assert.equal(deskRoute.href, "/", "Workbench must point to '/'");
    assert.equal(deskRoute.label, "Bàn làm việc");

    const tasksRoute = CANONICAL_ROUTES.find((r) => r.id === "tasks");
    assert.ok(tasksRoute, "Tasks route must exist");
    assert.equal(tasksRoute.href, "/tasks", "Tasks must point to '/tasks'");
    assert.equal(tasksRoute.label, "Quản lý nhiệm vụ");

    const sidebarItems = getSidebarNavItems();
    const deskItem = sidebarItems.find((item) => item.id === "desk" || item.href === "/");
    assert.ok(deskItem, "Item 'Bàn làm việc' must exist in sidebar items");
    assert.equal(deskItem.href, "/");

    const taskItem = sidebarItems.find((item) => item.id === "tasks" || item.href === "/tasks");
    assert.ok(taskItem, "Item 'Nhiệm vụ' must exist in sidebar items");
    assert.equal(taskItem.href, "/tasks");

    // Must NOT have /dashboard or /unit-tasks as main hrefs
    const dashboardHref = sidebarItems.find((item) => item.href === "/dashboard");
    assert.equal(dashboardHref, undefined, "Sidebar items must not contain /dashboard as main href");

    const unitTasksHref = sidebarItems.find((item) => item.href === "/unit-tasks");
    assert.equal(unitTasksHref, undefined, "Sidebar items must not contain /unit-tasks as main href");
  });

  test("Mobile bottom bar items point to canonical / and /tasks", () => {
    const bottomItems = getMobileBottomNavItems();
    const desk = bottomItems.find((i) => i.id === "desk");
    assert.ok(desk);
    assert.equal(desk.href, "/");

    const tasks = bottomItems.find((i) => i.id === "tasks");
    assert.ok(tasks);
    assert.equal(tasks.href, "/tasks");
  });

  test("src/app/dashboard/page.tsx redirects to /", () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), "src/app/dashboard/page.tsx"),
      "utf-8"
    );
    assert.ok(
      content.includes('redirect("/")') || content.includes("redirect('/')"),
      "Dashboard page must redirect to '/'"
    );
  });

  test("src/app/unit-tasks/page.tsx redirects to /tasks?scope=unit", () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), "src/app/unit-tasks/page.tsx"),
      "utf-8"
    );
    assert.ok(
      content.includes("/tasks?${params.toString()}") || content.includes("/tasks?scope=unit"),
      "unit-tasks must redirect to /tasks with scope=unit"
    );
  });

  test("src/app/page.tsx redirects zone=tasks to /tasks", () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), "src/app/page.tsx"),
      "utf-8"
    );
    assert.ok(
      content.includes('zoneParam === "tasks"'),
      "page.tsx must detect zoneParam === tasks"
    );
    assert.ok(
      content.includes("/tasks"),
      "page.tsx must redirect to /tasks"
    );
  });

  test("src/app/tasks/page.tsx supports scope=school|unit|my with role-based fallbacks", () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), "src/app/tasks/page.tsx"),
      "utf-8"
    );
    assert.ok(content.includes('searchParams.get("scope")'), "tasks page must read scope search param");
    assert.ok(content.includes("school"), "tasks page must support school scope");
    assert.ok(content.includes("unit"), "tasks page must support unit scope");
    assert.ok(content.includes("my"), "tasks page must support my scope");
    assert.ok(content.includes("<TaskManagementWorkspace"), "tasks page must render TaskManagementWorkspace");
  });
});
