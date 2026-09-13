/**
 * W3 / Plan T05 "Đơn vị" — department attention (AC07–AC09, F06/F07/F08).
 *
 * Requirement covered: a department needs attention when it has OVERDUE tasks or
 * BLOCKED tasks. A low progress percentage alone is NOT a risk signal (the old
 * `<60%` threshold is removed). This is the fix for the baseline defect where the
 * screen read "0 nhiệm vụ · 11 đơn vị cần chú ý" on an empty dataset.
 *
 * Expected sets come from `tests/fixtures/workbench-queue-fixture.ts`.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { summarizeDepartmentAttention } from "../src/lib/executive-matrix-aggregator";
import {
  FIXTURE_DEPARTMENTS,
  EXPECTED_DEPARTMENT_TOTALS,
  EXPECTED_ATTENTION_ORDER,
  EXPECTED_NOT_ATTENTION,
} from "./fixtures/workbench-queue-fixture";

describe("W3 — department attention is overdue or blocked only", () => {
  const summary = summarizeDepartmentAttention(FIXTURE_DEPARTMENTS);

  test("all is every department in scope", () => {
    assert.equal(summary.all.length, EXPECTED_DEPARTMENT_TOTALS.all);
    assert.equal(summary.all.length, 17);
  });

  test("attentionCount is 7 — not a progress threshold", () => {
    assert.equal(summary.attentionCount, EXPECTED_DEPARTMENT_TOTALS.attention);
    assert.equal(summary.attentionCount, 7);
  });

  test("preview is capped at 5", () => {
    assert.equal(summary.preview.length, EXPECTED_DEPARTMENT_TOTALS.preview);
    assert.equal(summary.preview.length, 5);
    assert.deepEqual(
      summary.preview.map((d) => d.departmentId),
      EXPECTED_ATTENTION_ORDER.slice(0, 5)
    );
  });

  test("attention sort: overdue desc, blocked desc, then id asc", () => {
    assert.deepEqual(
      summary.attention.map((d) => d.departmentId),
      EXPECTED_ATTENTION_ORDER
    );
  });

  test("low-progress departments with zero overdue/blocked are NOT flagged", () => {
    const attentionIds = new Set(summary.attention.map((d) => d.departmentId));
    for (const id of EXPECTED_NOT_ATTENTION) {
      assert.equal(attentionIds.has(id), false, `${id} must not need attention`);
    }
  });

  test("a department with no tasks is not a risk", () => {
    const none = summary.attention.find((d) => d.departmentId === "K_NO_TASKS");
    assert.equal(none, undefined);
  });

  test("attentionCount equals the attention set size, never the preview length", () => {
    assert.equal(summary.attentionCount, summary.attention.length);
    assert.ok(summary.attentionCount > summary.preview.length);
  });
});

describe("W3 — empty scope renders empty, not a fake healthy system", () => {
  test("no departments means zero attention", () => {
    const summary = summarizeDepartmentAttention([]);
    assert.deepEqual(summary, { all: [], attention: [], attentionCount: 0, preview: [] });
  });
});
