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
import {
  extractExecutiveActionItems,
  selectExecutiveActionQueue,
  type ExecutiveActionItem,
} from "../src/lib/executive-matrix-aggregator";
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

  test("a subtask NEEDS_REVIEW puts the parent in the review group", () => {
    assert.equal(byId.get("q11")?.primaryReason, "REVIEW");
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

describe("W2 — union-distinct totals", () => {
  const all = selectExecutiveActionQueue(queue, "ALL");
  const review = selectExecutiveActionQueue(queue, "PENDING_APPROVAL");
  const blockedOverdue = selectExecutiveActionQueue(queue, "BLOCKED_OVERDUE");

  test("ALL equals the distinct row count, not the sum of the groups", () => {
    assert.equal(all.filteredTotal, EXPECTED_QUEUE_ROWS.length);
    assert.equal(review.filteredTotal, 3, "q04, q03, q11");
    assert.equal(blockedOverdue.filteredTotal, 3, "q06, q04, q05");
    // q04 belongs to both groups, so the groups overlap:
    assert.ok(
      review.filteredTotal + blockedOverdue.filteredTotal > all.filteredTotal,
      "the two groups must overlap on q04 — a naive sum would over-count"
    );
  });

  test("filter counts match their predicate", () => {
    assert.equal(all.counts.PENDING_APPROVAL, review.filteredTotal);
    assert.equal(all.counts.BLOCKED_OVERDUE, blockedOverdue.filteredTotal);
  });

  test("the BLOCKED_OVERDUE predicate keeps a REVIEW-primary row that is overdue", () => {
    assert.equal(
      byId.get("q04")?.primaryReason,
      "REVIEW",
      "q04 is primarily a review file"
    );
    assert.equal(
      blockedOverdue.previewItems.some((i) => i.taskId === "q04"),
      true,
      "q04 must still list under Vướng mắc & Trễ hạn because it carries OVERDUE"
    );
  });
});

describe("W2 — labels", () => {
  test("review rows open to review, others open to detail", () => {
    assert.equal(byId.get("q03")?.actionLabel, "Xem xét");
    assert.equal(byId.get("q11")?.actionLabel, "Xem xét");
    assert.equal(byId.get("q06")?.actionLabel, "Xem chi tiết");
    assert.equal(byId.get("q05")?.actionLabel, "Xem chi tiết");
  });

  test("review badge wording does not claim the actor is the approver", () => {
    const label = String(byId.get("q03")?.badgeLabel ?? "");
    assert.equal(label.includes("Chờ bạn duyệt"), false);
    assert.equal(label.includes("Phê duyệt"), false);
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

  test("preview is sliced to exactly 5 AFTER sort, total stays 311", () => {
    const selected = selectExecutiveActionQueue(largeQueue, "ALL", 5);
    assert.equal(selected.filteredTotal, 311);
    assert.equal(selected.previewItems.length, 5);
    assert.deepEqual(
      selected.previewItems.map((i) => i.taskId),
      largeQueue.slice(0, 5).map((i) => i.taskId)
    );
  });

  test("sort is fully deterministic (no ties left unresolved)", () => {
    const ids = largeQueue.map((i) => i.taskId);
    const again = extractExecutiveActionItems(large.tasks, FIXTURE_REFERENCE_DATE).map((i) => i.taskId);
    assert.deepEqual(ids, again);
  });
});

describe("W2 — sort contract details", () => {
  const mk = (over: Partial<ExecutiveActionItem> & { taskId: string }): ExecutiveActionItem =>
    ({
      id: `act-${over.taskId}`,
      title: over.taskId,
      dueDate: D.today,
      filterType: "BLOCKED_OVERDUE",
      reasons: ["BLOCKED"],
      primaryReason: "BLOCKED",
      ...over,
    }) as ExecutiveActionItem;

  test("higher priority outranks an overdue lower-priority row", () => {
    const highNotOverdue = mk({ taskId: "a", priority: "CAO", dueDate: D.plus1 });
    const urgentOverdue = mk({
      taskId: "b",
      priority: "KHAN_CAP",
      reasons: ["OVERDUE"],
      primaryReason: "OVERDUE",
      dueDate: D.minus1,
    });
    const order = selectExecutiveActionQueue([highNotOverdue, urgentOverdue], "ALL");
    assert.deepEqual(order.previewItems.map((i) => i.taskId), ["b", "a"]);
  });

  test("same priority: overdue first, then due asc", () => {
    const normalDueLater = mk({ taskId: "c", priority: "TRUNG_BINH", dueDate: D.plus2 });
    const normalOverdue = mk({
      taskId: "d",
      priority: "TRUNG_BINH",
      reasons: ["OVERDUE"],
      primaryReason: "OVERDUE",
      dueDate: D.minus2,
    });
    const order = selectExecutiveActionQueue([normalDueLater, normalOverdue], "ALL");
    assert.deepEqual(order.previewItems.map((i) => i.taskId), ["d", "c"]);
  });

  test("a row with no usable due date sorts last, never coerced to today", () => {
    const dated = mk({ taskId: "e", priority: "TRUNG_BINH", dueDate: D.plus1 });
    const undated = mk({ taskId: "f", priority: "TRUNG_BINH", dueDate: "khong-phai-ngay" });
    const order = selectExecutiveActionQueue([undated, dated], "ALL");
    assert.deepEqual(order.previewItems.map((i) => i.taskId), ["e", "f"]);
  });
});
