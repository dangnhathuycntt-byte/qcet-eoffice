import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isRouteActive, resolveBreadcrumb } from "../src/lib/navigation/active-matcher";
import { NAV_ITEMS } from "../src/lib/navigation/nav-config";

describe("Navigation Active Matcher & Breadcrumb Resolution Suite", () => {
  test("isRouteActive: matches exact pathnames correctly", () => {
    assert.strictEqual(isRouteActive("/", "/"), true);
    assert.strictEqual(isRouteActive("/calendar", "/calendar"), true);
    assert.strictEqual(isRouteActive("/tasks", "/tasks"), true);
    assert.strictEqual(isRouteActive("/documents", "/documents"), true);
    assert.strictEqual(isRouteActive("/notifications", "/notifications"), true);
    assert.strictEqual(isRouteActive("/org", "/org"), true);
  });

  test("isRouteActive: matches dynamic subroutes", () => {
    assert.strictEqual(isRouteActive("/tasks", "/tasks/task-123"), true);
    assert.strictEqual(isRouteActive("/documents", "/documents/doc-abc"), true);
    assert.strictEqual(isRouteActive("/org", "/org/department-1"), true);
    // Should NOT falsely match prefix that isn't subroute
    assert.strictEqual(isRouteActive("/tasks", "/tasks-archive"), false);
  });

  test("isRouteActive: supports route aliases", () => {
    assert.strictEqual(isRouteActive("/tasks", "/unit-tasks", null, ["/unit-tasks"]), true);
    assert.strictEqual(isRouteActive("/tasks", "/unit-tasks/detail", null, ["/unit-tasks"]), true);
  });

  test("isRouteActive: handles root '/' override by query parameters", () => {
    const calendarParams = new URLSearchParams("view=calendar");
    assert.strictEqual(isRouteActive("/", "/", calendarParams), false);
    assert.strictEqual(isRouteActive("/calendar", "/", calendarParams), true);

    const taskParams = new URLSearchParams("zone=tasks");
    assert.strictEqual(isRouteActive("/", "/", taskParams), false);
    assert.strictEqual(isRouteActive("/tasks", "/", taskParams), true);
  });

  test("isRouteActive: handles query parameters in target href", () => {
    const params = new URLSearchParams("tab=inbox");
    assert.strictEqual(isRouteActive("/documents?tab=inbox", "/documents", params), true);
    assert.strictEqual(isRouteActive("/documents?tab=sent", "/documents", params), false);
  });

  test("resolveBreadcrumb: maps routes and query states to clean Vietnamese titles", () => {
    assert.deepStrictEqual(resolveBreadcrumb("/"), ["QCET E-Office", "Bàn làm việc"]);
    assert.deepStrictEqual(resolveBreadcrumb("/calendar"), ["QCET E-Office", "Lịch công tác"]);
    assert.deepStrictEqual(resolveBreadcrumb("/notifications"), ["QCET E-Office", "Thông báo điều hành"]);
    assert.deepStrictEqual(resolveBreadcrumb("/documents"), ["QCET E-Office", "Văn bản & Công văn"]);
    assert.deepStrictEqual(resolveBreadcrumb("/tasks"), ["QCET E-Office", "Nhiệm vụ cấp Trường"]);
    assert.deepStrictEqual(resolveBreadcrumb("/org"), ["QCET E-Office", "Cơ cấu tổ chức & Danh bạ"]);
    assert.deepStrictEqual(resolveBreadcrumb("/settings"), ["QCET E-Office", "Cài đặt hệ thống"]);
  });

  test("NAV_ITEMS: defines clean canonical items without duplicates", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);
    const uniqueHrefs = new Set(hrefs);
    assert.strictEqual(hrefs.length, uniqueHrefs.size, "NAV_ITEMS must contain zero duplicate hrefs");
    assert.ok(NAV_ITEMS.length >= 5, "Must have comprehensive navigation set");
  });

  test("Anti-slop check: 0% emojis in src/lib/navigation/ source files", () => {
    const navDir = path.join(process.cwd(), "src/lib/navigation");
    const files = fs.readdirSync(navDir);
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    for (const file of files) {
      if (file.endsWith(".ts") || file.endsWith(".tsx")) {
        const content = fs.readFileSync(path.join(navDir, file), "utf-8");
        assert.ok(!emojiRegex.test(content), `Emoji found in ${file}`);
      }
    }
  });
});
