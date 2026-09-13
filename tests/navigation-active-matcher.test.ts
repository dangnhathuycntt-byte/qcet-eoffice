import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isRouteActive, normalizePath, resolveBreadcrumb } from "../src/lib/navigation/active-matcher";
import { CANONICAL_ROUTES } from "../src/lib/navigation/canonical-navigation-registry";
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

  test("isRouteActive: accurately activates root '/' when no query parameter is present", () => {
    assert.equal(isRouteActive("/", "/", null), true);
    assert.equal(isRouteActive("/tasks", "/", null), false);
    assert.equal(isRouteActive("/calendar", "/", null), false);
  });

  test("isRouteActive: root '/' exact match vs subpaths", () => {
    assert.equal(isRouteActive("/", "/"), true);
    assert.equal(isRouteActive("/", "/tasks"), false);
    assert.equal(isRouteActive("/", "/calendar"), false);
    assert.equal(isRouteActive("/", "/settings"), false);
    assert.equal(isRouteActive("/", "/tasks/123"), false);
  });

  test("isRouteActive: boundary check prevents subroute collision", () => {
    assert.equal(isRouteActive("/tasks", "/tasks/task-001"), true);
    assert.equal(isRouteActive("/tasks", "/tasks-archive"), false);
    assert.equal(isRouteActive("/documents", "/documents-audit"), false);
    assert.equal(isRouteActive("/org", "/organization"), false);
  });

  test("isRouteActive: respects query parameter ?zone=tasks on root '/'", () => {
    const params = new URLSearchParams("zone=tasks");
    assert.equal(isRouteActive("/", "/", params), false);
    assert.equal(isRouteActive("/tasks", "/", params), true);
  });

  test("isRouteActive: query-aware zone matching on root '/' across all canonical zones", () => {
    assert.equal(isRouteActive("/calendar", "/", new URLSearchParams("zone=calendar")), true);
    assert.equal(isRouteActive("/calendar", "/", new URLSearchParams("view=calendar")), true);
    assert.equal(isRouteActive("/calendar", "/", new URLSearchParams("view=month")), true);
    assert.equal(isRouteActive("/documents", "/", new URLSearchParams("zone=documents")), true);
    assert.equal(isRouteActive("/org", "/", new URLSearchParams("zone=org")), true);
    assert.equal(isRouteActive("/", "/", new URLSearchParams("zone=documents")), false);
    assert.equal(isRouteActive("/", "/", new URLSearchParams("zone=org")), false);
  });

  test("isRouteActive & normalizePath: clean parameter normalization and trailing slashes", () => {
    assert.equal(normalizePath("/tasks/"), "/tasks");
    assert.equal(normalizePath("/tasks///"), "/tasks");
    assert.equal(normalizePath("/tasks?tab=1"), "/tasks");
    assert.equal(normalizePath("/tasks#header"), "/tasks");
    assert.equal(normalizePath(""), "/");
    assert.equal(normalizePath("/"), "/");

    // Route matching with trailing slashes
    assert.equal(isRouteActive("/tasks/", "/tasks"), true);
    assert.equal(isRouteActive("/tasks", "/tasks/"), true);
    assert.equal(isRouteActive("/tasks/", "/tasks/task-001/"), true);
    assert.equal(isRouteActive("/", "/"), true);
  });

  test("isRouteActive: automatic resolution of aliases from CANONICAL_ROUTES", () => {
    // /unit-tasks is an alias of /tasks in CANONICAL_ROUTES
    assert.equal(isRouteActive("/tasks", "/unit-tasks"), true);
    assert.equal(isRouteActive("/tasks", "/unit-tasks/abc-123"), true);
  });

  test("isRouteActive: handles query parameters in target href", () => {
    const params = new URLSearchParams("tab=inbox");
    assert.strictEqual(isRouteActive("/documents?tab=inbox", "/documents", params), true);
    assert.strictEqual(isRouteActive("/documents?tab=sent", "/documents", params), false);
  });

  test("resolveBreadcrumb: maps routes and query states to clean Vietnamese titles", () => {
    // T88: the breadcrumb title is the canonical registry label for the route,
    // read from the registry here so the expectation can never drift again.
    const label = (href: string) =>
      CANONICAL_ROUTES.find((r) => r.href === href)!.label;

    assert.deepStrictEqual(resolveBreadcrumb("/"), ["QCET E-Office", label("/")]);
    assert.deepStrictEqual(resolveBreadcrumb("/calendar"), ["QCET E-Office", label("/calendar")]);
    assert.deepStrictEqual(resolveBreadcrumb("/notifications"), ["QCET E-Office", label("/notifications")]);
    assert.deepStrictEqual(resolveBreadcrumb("/documents"), ["QCET E-Office", label("/documents")]);
    assert.deepStrictEqual(resolveBreadcrumb("/tasks"), ["QCET E-Office", label("/tasks")]);
    assert.deepStrictEqual(resolveBreadcrumb("/org"), ["QCET E-Office", label("/org")]);
    assert.deepStrictEqual(resolveBreadcrumb("/settings"), ["QCET E-Office", label("/settings")]);
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
