import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useWorkspaceQuery, type UseWorkspaceQueryReturn } from "../src/hooks/use-workspace-query";

function withBrowserQuery(query: string, run: (hook: UseWorkspaceQueryReturn, params: () => URLSearchParams) => void) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  let url = new URL(`/tasks?${query}`, "https://example.test");
  const navigate = (_state: unknown, _title: string, target: string) => {
    url = new URL(target, url);
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      get location() { return url; },
      history: { replaceState: navigate, pushState: navigate },
      dispatchEvent() {},
    },
  });
  try {
    let hook!: UseWorkspaceQueryReturn;
    function Harness() {
      hook = useWorkspaceQuery();
      return null;
    }
    renderToStaticMarkup(React.createElement(Harness));
    // Keep these callbacks deliberately: debounce and batched events can run
    // callbacks from an earlier render after the browser URL has changed.
    run(hook, () => new URLSearchParams(url.search));
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

const shallow = { shallow: true, replace: true };

test("delayed search cannot restore filters cleared by a scope switch", () => {
  withBrowserQuery("scope=school&status=COMPLETED&priority=HIGH&deadline=today", (hook, params) => {
    hook.setScope("my", shallow);
    hook.setSearchQuery("báo cáo", shallow);
    assert.equal(params().get("scope"), "my");
    assert.equal(params().get("q"), "báo cáo");
    for (const key of ["status", "priority", "deadline"]) assert.equal(params().get(key), null);
    hook.setScope("unit", shallow);
    assert.equal(params().get("scope"), "unit");
    assert.equal(params().get("q"), null);
    hook.setScope("school", shallow);
    assert.equal(params().get("scope"), "school");
    assert.equal(params().get("priority"), null);
  });
});

test("independent filter changes compose without restoring old values", () => {
  withBrowserQuery("scope=my&priority=HIGH&month=9&source=link", (hook, params) => {
    hook.setPriority("ALL", shallow);
    hook.setStatus("IN_PROGRESS", shallow);
    hook.setDeadline("today", shallow);
    hook.setPeriod({ month: "ALL" }, shallow);
    hook.setSearchQuery("test", shallow);
    assert.equal(params().get("priority"), null);
    assert.equal(params().get("month"), null);
    assert.equal(params().get("status"), "IN_PROGRESS");
    assert.equal(params().get("deadline"), "today");
    assert.equal(params().get("source"), "link");
    hook.updateWorkspaceQuery(prev => ({ category: prev.status }), shallow);
    assert.equal(params().get("category"), "IN_PROGRESS");
  });
});

 test("clear all removes status and deadline together and later edits keep them cleared", () => {
  withBrowserQuery("scope=my&status=WAITING_APPROVAL&deadline=overdue&attention=overdue&priority=HIGH&month=9", (hook, params) => {
    hook.resetFilters({ ...shallow, preserveScope: true, preserveView: true });
    assert.equal(params().toString(), "scope=my");
    hook.setPriority("NORMAL", shallow);
    assert.equal(params().get("status"), null);
    assert.equal(params().get("deadline"), null);
    assert.equal(params().get("attention"), null);
  });
});
