import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveBreadcrumb, SIDEBAR_STORAGE_KEY } from "../src/components/layout/sidebar-context";
import { CANONICAL_ROUTES } from "../src/lib/navigation/canonical-navigation-registry";

describe("Two-Tier Layout Configuration & Breadcrumbs", () => {

  it("resolves breadcrumbs accurately for all system routes", () => {
    // T88: breadcrumb titles come from the canonical navigation registry.
    const label = (href: string) =>
      CANONICAL_ROUTES.find((r) => r.href === href || r.aliases?.includes(href))?.label ?? "Hộp thư";

    assert.deepStrictEqual(resolveBreadcrumb("/"), ["QCET E-Office", label("/")]);
    assert.deepStrictEqual(resolveBreadcrumb("/tasks"), ["QCET E-Office", label("/tasks")]);
    // /unit-tasks permanent-redirects into /tasks, so it carries the same title.
    assert.deepStrictEqual(resolveBreadcrumb("/unit-tasks"), ["QCET E-Office", label("/tasks")]);
    assert.deepStrictEqual(resolveBreadcrumb("/meetings"), ["QCET E-Office", label("/meetings")]);
    // /dashboard redirects to the workbench, its registry alias target.
    assert.deepStrictEqual(resolveBreadcrumb("/dashboard"), ["QCET E-Office", label("/")]);
    assert.deepStrictEqual(resolveBreadcrumb("/org"), ["QCET E-Office", label("/org")]);
    assert.deepStrictEqual(resolveBreadcrumb("/inbox"), ["QCET E-Office", label("/inbox")]);
    assert.deepStrictEqual(resolveBreadcrumb("/notifications"), ["QCET E-Office", label("/inbox")]);
    assert.deepStrictEqual(resolveBreadcrumb("/login"), ["QCET E-Office", "Đăng nhập"]);
  });

  it("resolves breadcrumbs accurately for contextual zones via query parameters", () => {
    const zoneLabel = (zone: string) =>
      CANONICAL_ROUTES.find((r) => r.zone === zone)!.label;

    // Embedded in pathname
    assert.deepStrictEqual(resolveBreadcrumb("/?zone=portal"), ["QCET E-Office", "Cổng Portal Điều hành"]);
    assert.deepStrictEqual(resolveBreadcrumb("/?zone=dashboard"), ["QCET E-Office", zoneLabel("dashboard")]);
    assert.deepStrictEqual(resolveBreadcrumb("/?zone=tasks"), ["QCET E-Office", zoneLabel("tasks")]);

    // Query string as second parameter
    assert.deepStrictEqual(resolveBreadcrumb("/", "zone=portal"), ["QCET E-Office", "Cổng Portal Điều hành"]);
    assert.deepStrictEqual(resolveBreadcrumb("/", "zone=dashboard"), ["QCET E-Office", zoneLabel("dashboard")]);
    assert.deepStrictEqual(resolveBreadcrumb("/", "zone=tasks"), ["QCET E-Office", zoneLabel("tasks")]);

    // URLSearchParams object as second parameter
    assert.deepStrictEqual(resolveBreadcrumb("/", new URLSearchParams("zone=portal")), ["QCET E-Office", "Cổng Portal Điều hành"]);
    assert.deepStrictEqual(resolveBreadcrumb("/", new URLSearchParams("zone=dashboard")), ["QCET E-Office", zoneLabel("dashboard")]);
    assert.deepStrictEqual(resolveBreadcrumb("/", new URLSearchParams("zone=tasks")), ["QCET E-Office", zoneLabel("tasks")]);

    // Backward compatibility for direct zone name
    assert.deepStrictEqual(resolveBreadcrumb("/", "portal"), ["QCET E-Office", "Cổng Portal Điều hành"]);
    assert.deepStrictEqual(resolveBreadcrumb("/", "dashboard"), ["QCET E-Office", zoneLabel("dashboard")]);
    assert.deepStrictEqual(resolveBreadcrumb("/", "tasks"), ["QCET E-Office", zoneLabel("tasks")]);
  });

  it("uses qcet_sidebar_collapsed as persistent storage key", () => {
    assert.strictEqual(SIDEBAR_STORAGE_KEY, "qcet_sidebar_collapsed");
  });
});
