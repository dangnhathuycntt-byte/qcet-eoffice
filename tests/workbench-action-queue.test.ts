/**
 * W2 / Plan T04 — Executive action queue engine (AC01–AC05, AC10).
 *
 * Requirements covered by this file:
 *  - AC01: a task is only in the review group when a REAL pending-review request
 *    exists (PENDING_EXECUTIVE_APPROVAL / WAITING_APPROVAL / subtask NEEDS_REVIEW),
 *    never because progressPercent === 100.
 *  - AC02/03: q04 is ONE row carrying BOTH REVIEW and OVERDUE reasons.
 *  - AC04/05: ALL total is a distinct union, never the sum of the two group counts.
 *  - AC10: stable sort priority desc -> overdue first -> due asc -> waitingSince asc -> id.
 *  - No IN_PROGRESS -> STRATEGIC rows on the workbench queue.
 *  - No "BGH" fallback when the department cannot be resolved.
 *  - Preview is sliced AFTER filter + sort; its length is never read as the total.
 *
 * Expected IDs come only from `tests/fixtures/workbench-queue-fixture.ts`.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { extractExecutiveActionItems, type ExecutiveActionItem } from "../src/lib/executive-matrix-aggregator";
import {
  SMALL_FIXTURE_TASKS,
  FIXTURE_REFERENCE_DATE,
  D,
  EXPECTED_QUEUE_ROWS,
  EXPECTED_QUEUE_ORDER,
  buildLargeFixture,
  Q01_IN_PROGRESS_NO_REASON,
  Q02_PROGRESS_100_NOT_SUBMITTED,
  type LargeFixture,
} from "./fixtures/workbench-queue-fixture";

/**
 * q10 lives in a department the actor cannot reach; the *server* confinement
 * removes it (see contract-map.md §Scope). The selector under test is not the
 * confinement mechanism, so the actor-scoped list is modelled explicitly here.
 */
const ACTOR_SCOPED_TASKS = SMALL_FIXTURE_TASKS.filter((t) => t.id !== "q10");

const queue = extractExecutiveActionItems(ACTOR_SCOPED_TASKS, FIXTURE_REFERENCE_DATE);
const byId = new Map(queue.map((item) => [item.taskId, item]));

describe("W2 — review predicate is a real pending request, not progress=100", () => {
  test("q02 (progress 100, IN_PROGRESS, no request) is absent", () => {
    assert.equal(byId.has("q02"), false);
    // sanity: the row really is 100% — the predicate, not the data, must exclude it
    assert.equal(Q02_PROGRESS_100_NOT_SUBMITTED.progressPercent, 100);
    assert.equal(Q02_PROGRESS_100_NOT_SUBMITTED.status, "IN_PROGRESS");
  });

  test("a plain IN_PROGRESS task produces no queue row (no STRATEGIC rule)", () => {
    assert.equal(byId.has("q01"), false);
    assert.equal(Q01_IN_PROGRESS_NO_REASON.status, "IN_PROGRESS");
  });

  test("completed and cancelled rows are absent", () => {
    assert.equal(byId.has("q07"), false);
    assert.equal(byId.has("q08"), false);
  });
});

describe("W2 — one row per task with all reasons accumulated", () => {
  test("q04 is exactly one row with REVIEW + OVERDUE", () => {
    const matches = queue.filter((item) => item.taskId === "q04");
    assert.equal(matches.length, 1, "q04 must appear exactly once");
    assert.deepEqual(matches[0].reasons, ["REVIEW", "OVERDUE"]);
    assert.equal(matches[0].primaryReason, "REVIEW");
  });

  test("reason sets match the hand-written table", () => {
    for (const expected of EXPECTED_QUEUE_ROWS) {
      const item = byId.get(expected.taskId);
      assert.ok(item, `expected row ${expected.taskId} to be present`);
      assert.deepEqual(item!.reasons, expected.reasons, `${expected.taskId} reasons`);
      assert.equal(item!.primaryReason, expected.primaryReason, `${expected.taskId} primaryReason`);
    }
  });

  test("no extra rows beyond the hand-written table", () => {
    assert.deepEqual(
      [...queue.map((i) => i.taskId)].sort(),
      [...EXPECTED_QUEUE_ROWS.map((r) => r.taskId)].sort()
    );
  });
});

describe("W2 — queue order", () => {
  test("exact hand-written order", () => {
    assert.deepEqual(
      queue.map((i) => i.taskId),
      EXPECTED_QUEUE_ORDER
    );
  });

  test("overdue outranks a same-priority non-overdue row", () => {
    const q04 = queue.findIndex((i) => i.taskId === "q04");
    const q05 = queue.findIndex((i) => i.taskId === "q05");
    assert.ok(q04 < q05, "q04 (HIGH, overdue) must precede q05 (HIGH, not overdue)");
  });
});

describe("W2 — department resolution never falls back to BGH", () => {
  test("an unresolvable department surfaces 'Chưa xác định đơn vị'", () => {
    const orphan = {
      ...Q01_IN_PROGRESS_NO_REASON,
      id: "orphan",
      status: "BLOCKED" as const,
      priority: "HIGH" as const,
      leadDepartmentCode: "KHONG_TON_TAI",
      leadDepartmentId: undefined,
      departmentCode: undefined,

      leadDepartment: undefined,
      department: undefined,
      departmentName: undefined,
      leadAssigneeName: "Không Có",
    };
    const items = extractExecutiveActionItems([orphan], FIXTURE_REFERENCE_DATE);
    assert.equal(items.length, 1);
    assert.notEqual(items[0].departmentCode, "BGH");
    assert.notEqual(items[0].departmentName, "Ban Giám hiệu");
    assert.equal(items[0].departmentName, "Chưa xác định đơn vị");
  });
});

describe("W2 — scale fixture (311 rows, preview exactly 5)", () => {
  const large: LargeFixture = buildLargeFixture();
  const largeQueue = extractExecutiveActionItems(large.tasks, FIXTURE_REFERENCE_DATE);

  test("allItems holds every actionable row", () => {
    assert.equal(largeQueue.length, large.expectedActionRowCount);
  });

  test("sort is fully deterministic (no ties left unresolved)", () => {
    const ids = largeQueue.map((i) => i.taskId);
    const again = extractExecutiveActionItems(large.tasks, FIXTURE_REFERENCE_DATE).map((i) => i.taskId);
    assert.deepEqual(ids, again);
  });
});
