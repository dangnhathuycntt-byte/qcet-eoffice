import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_ROUTES,
  getRouteByPath,
} from "../src/lib/navigation/canonical-navigation-registry";
import { NAV_ITEMS } from "../src/lib/navigation/nav-config";
import { resolveBreadcrumb } from "../src/lib/navigation/active-matcher";

describe("T88 · one semantic naming system (breadcrumb + nav-config follow registry)", () => {
  test("resolveBreadcrumb uses the canonical registry label for every canonical route", () => {
    for (const route of CANONICAL_ROUTES) {
      const [, pageTitle] = resolveBreadcrumb(route.href);
      assert.equal(
        pageTitle,
        route.label,
        `breadcrumb for "${route.href}" must equal registry label`
      );
    }
  });

  test("resolveBreadcrumb zone/scope overrides resolve to registry labels", () => {
    const tasks = getRouteByPath("/tasks")!;
    assert.deepEqual(resolveBreadcrumb("/", "zone=tasks"), ["QCET E-Office", tasks.label]);
    assert.deepEqual(resolveBreadcrumb("/", "scope=unit"), ["QCET E-Office", tasks.label]);
    const calendar = getRouteByPath("/calendar")!;
    assert.deepEqual(resolveBreadcrumb("/", "view=month"), ["QCET E-Office", calendar.label]);
  });

  test("resolveBreadcrumb gives a nested path its owning route's label", () => {
    // A nested path under a canonical route must not fall through to the generic
    // fallback — the previous prefix-matching behaviour is preserved.
    const [root, page] = resolveBreadcrumb("/tasks/task-123");
    assert.equal(root, "QCET E-Office");
    assert.equal(page, getRouteByPath("/tasks")!.label);
  });

  test("every NAV_ITEMS badgeKey exists in the canonical registry", () => {
    const registryBadgeKeys = new Set(
      CANONICAL_ROUTES.map((r) => r.badgeKey).filter(Boolean)
    );
    for (const item of NAV_ITEMS) {
      if (item.badgeKey === undefined) continue;
      assert.ok(
        registryBadgeKeys.has(item.badgeKey as never),
        `nav-config badgeKey "${item.badgeKey}" (${item.id}) must exist in the registry`
      );
    }
  });

  test("every NAV_ITEMS entry maps to a canonical route with identical href and label", () => {
    for (const item of NAV_ITEMS) {
      const route = CANONICAL_ROUTES.find((r) => r.href === item.href);
      assert.ok(route, `nav-config item "${item.id}" must map to a canonical route`);
      assert.equal(item.label, route.label);
    }
  });
});
