import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scopeToWorkspaceScope,
  workspaceScopeToTaskScope,
  workspaceScopeToUrlParam,
  urlParamToWorkspaceScope,
} from "../src/lib/unified-task-hub";

test("scopeToWorkspaceScope transforms correctly", () => {
  assert.equal(scopeToWorkspaceScope("SCHOOL_TASKS"), "school");
  assert.equal(scopeToWorkspaceScope("UNIT_TASKS"), "unit");
  assert.equal(scopeToWorkspaceScope("MY_TASKS"), "my");
});

test("workspaceScopeToTaskScope transforms correctly", () => {
  assert.equal(workspaceScopeToTaskScope("school"), "SCHOOL_TASKS");
  assert.equal(workspaceScopeToTaskScope("unit"), "UNIT_TASKS");
  assert.equal(workspaceScopeToTaskScope("my"), "MY_TASKS");
});

test("workspaceScopeToUrlParam transforms correctly", () => {
  assert.equal(workspaceScopeToUrlParam("school"), "all");
  assert.equal(workspaceScopeToUrlParam("unit"), "unit");
  assert.equal(workspaceScopeToUrlParam("my"), "personal");
});

test("urlParamToWorkspaceScope parses bidirectional URL parameters", () => {
  assert.equal(urlParamToWorkspaceScope("all"), "school");
  assert.equal(urlParamToWorkspaceScope("school"), "school");
  assert.equal(urlParamToWorkspaceScope("unit"), "unit");
  assert.equal(urlParamToWorkspaceScope("my"), "my");
  assert.equal(urlParamToWorkspaceScope("personal"), "my");
  assert.equal(urlParamToWorkspaceScope(null, "school"), "school");
  assert.equal(urlParamToWorkspaceScope(undefined, "unit"), "unit");
  assert.equal(urlParamToWorkspaceScope("unknown", "my"), "my");
});
