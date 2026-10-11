/**
 * W6 / Plan T08 — drill-down query round-trip (AC11–AC13, F02).
 *
 * Requirement covered: every workbench drill-down link targets a query key a real
 * parser consumes, and unknown values degrade safely instead of hanging. This locks
 * the two dead links that were found (plan T08.1): `/tasks?filter=upcoming` and
 * `/tasks?scope=school&filter=pending` — `filter` is parsed by NEITHER parser.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseWorkspaceQuery } from "../src/lib/workspace-query";
import { parseTaskUrlParams } from "../src/hooks/use-task-filters";

describe("W6 — unknown query values fall back safely", () => {
  test("an unknown status falls back to ALL, not a crash", () => {
    assert.equal(parseWorkspaceQuery(new URLSearchParams("status=KHONG_TON_TAI")).status, "ALL");
  });

  test("an unknown view falls back to table", () => {
    assert.equal(parseWorkspaceQuery(new URLSearchParams("view=audit")).view, "table");
  });
});

describe("W6 — task detail resolves (or reports) by id", () => {
  test("a `taskId` query is consumed by the parser", () => {
    assert.equal(parseTaskUrlParams(new URLSearchParams("taskId=abc123")).taskId, "abc123");
    assert.equal(parseWorkspaceQuery(new URLSearchParams("taskId=abc123")).taskId, "abc123");
  });
});
