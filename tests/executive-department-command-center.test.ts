import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { type TaskViewMode } from "@/components/dashboard/unified-task-toolbar";
import {
  getDefaultViewModeForRole,
  parseViewModeParam,
} from "@/lib/unified-task-hub";

describe("Executive Department View Mode Integration", () => {

  test("getDefaultViewModeForRole gives executive view for ADMIN and table for others", () => {
    assert.equal(getDefaultViewModeForRole("ADMIN"), "executive");
    assert.equal(getDefaultViewModeForRole("MANAGER"), "table");
    assert.equal(getDefaultViewModeForRole("STAFF"), "table");
    assert.equal(getDefaultViewModeForRole(undefined), "table");
  });

  test("parseViewModeParam correctly recognizes executive query aliases", () => {
    assert.equal(parseViewModeParam("executive"), "executive");
    assert.equal(parseViewModeParam("chi-huy"), "executive");
    assert.equal(parseViewModeParam("bgh"), "executive");
    assert.equal(parseViewModeParam("command"), "executive");
  });
});
