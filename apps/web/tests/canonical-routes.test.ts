import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_ROUTES,
  getRouteByPath,
  getSidebarNavItems,
  getMobileBottomNavItems,
  getMobileDrawerItems,
  resolveCanonicalHref,
} from "../src/lib/navigation/canonical-navigation-registry.js";
import { isRouteActive, isTaskDetailPath, isTaskSubPagePath } from "../src/lib/navigation/active-matcher.js";

describe("Canonical Routes & IA Alignment Suite (Task 1)", () => {
  test("Canonical navigation registry has no Tổng quan route and a single canonical Tasks route", () => {
    // Bỏ Tổng quan 19/10/2026: `/` và `/dashboard` chuyển tới /tasks, không còn mục nào trỏ về `/`
    assert.equal(CANONICAL_ROUTES.some((r) => r.id === "desk" || r.href === "/"), false);

    const tasks = CANONICAL_ROUTES.find((r) => r.id === "tasks");
    assert.ok(tasks, "Tasks route must exist");
    assert.equal(tasks.href, "/tasks", "Tasks must point to '/tasks'");
    assert.ok(tasks.aliases?.includes("/unit-tasks"), "Tasks must alias /unit-tasks");
    assert.ok(tasks.aliases?.includes("/?zone=tasks"), "Tasks must alias /?zone=tasks");
  });

  test("getRouteByPath resolves canonical routes and legacy aliases correctly", () => {
    assert.equal(getRouteByPath("/"), undefined);
    assert.equal(getRouteByPath("/tasks")?.id, "tasks");
    assert.equal(getRouteByPath("/unit-tasks")?.id, "tasks");
    assert.equal(getRouteByPath("/notifications")?.id, "inbox");
    // `/dashboard` chuyển tới /tasks như redirect ở next.config.ts
    assert.equal(resolveCanonicalHref("/dashboard"), "/tasks");
    assert.equal(getRouteByPath(resolveCanonicalHref("/dashboard"))?.id, "tasks");
  });

  test("Active matcher marks /tasks for tasks and /unit-tasks", () => {
    assert.equal(isRouteActive("/tasks", "/tasks"), true);
    assert.equal(isRouteActive("/tasks", "/unit-tasks"), true);

    // / with zone=tasks activates /tasks
    const searchParamsTasks = new URLSearchParams("zone=tasks");
    assert.equal(isRouteActive("/tasks", "/", searchParamsTasks), true);
    assert.equal(isRouteActive("/", "/", searchParamsTasks), false);
  });

  test("Canonical navigation registry points to canonical /tasks", () => {
    const tasksRoute = CANONICAL_ROUTES.find((r) => r.id === "tasks");
    assert.ok(tasksRoute, "Tasks route must exist");
    assert.equal(tasksRoute.href, "/tasks", "Tasks must point to '/tasks'");
    assert.equal(tasksRoute.label, "Nhiệm vụ");

    const sidebarItems = getSidebarNavItems();
    assert.equal(sidebarItems.find((item) => item.href === "/"), undefined, "Sidebar items must not contain '/'");

    const taskItem = sidebarItems.find((item) => item.id === "tasks" || item.href === "/tasks");
    assert.ok(taskItem, "Item 'Nhiệm vụ' must exist in sidebar items");
    assert.equal(taskItem.href, "/tasks");

    // Must NOT have /dashboard or /unit-tasks as main hrefs
    const dashboardHref = sidebarItems.find((item) => item.href === "/dashboard");
    assert.equal(dashboardHref, undefined, "Sidebar items must not contain /dashboard as main href");

    const unitTasksHref = sidebarItems.find((item) => item.href === "/unit-tasks");
    assert.equal(unitTasksHref, undefined, "Sidebar items must not contain /unit-tasks as main href");
  });

  test("Mobile bottom bar items match canonical destinations and paths", () => {
    const bottomItems = getMobileBottomNavItems();
    assert.equal(bottomItems.length, 4, "Mobile bottom bar must have 4 primary destinations");

    const tasks = bottomItems.find((i) => i.id === "tasks");
    assert.ok(tasks, "Bottom items must include tasks");
    assert.equal(tasks.href, "/tasks");

    const calendar = bottomItems.find((i) => i.id === "meetings");
    assert.ok(calendar, "Bottom items must include meetings");
    assert.equal(calendar.href, "/meetings");

    const inbox = bottomItems.find((i) => i.id === "inbox");
    assert.ok(inbox, "Bottom items must include inbox");
    assert.equal(inbox.href, "/inbox");

    const docs = bottomItems.find((i) => i.id === "documents");
    assert.ok(docs, "Bottom items must include documents");
    assert.equal(docs.href, "/documents");
  });

});

describe("Nhận diện trang chi tiết nhiệm vụ", () => {
  test("/tasks/[id] là chi tiết; trang con tĩnh dưới /tasks dùng layout trang thường", () => {
    assert.equal(isTaskDetailPath("/tasks/cmv59mo6d000lvioh2fm0435u"), true);
    assert.equal(isTaskDetailPath("/tasks/cmv59mo6d000lvioh2fm0435u?subtaskId=x"), true);
    assert.equal(isTaskDetailPath("/tasks/unit-requests"), false);
    assert.equal(isTaskDetailPath("/tasks/templates/"), false);
    assert.equal(isTaskDetailPath("/tasks"), false);
    assert.equal(isTaskDetailPath(null), false);
    assert.equal(isTaskSubPagePath("/tasks/templates"), true);
    assert.equal(isTaskSubPagePath("/tasks/unit-requests/"), true);
    assert.equal(isTaskSubPagePath("/tasks/cmv59mo6d000lvioh2fm0435u"), false);
  });
});
