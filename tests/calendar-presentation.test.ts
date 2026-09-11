import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  getCalendarAttentionState,
  getCalendarDaySummary,
  sortCalendarItemsByAttention,
  filterCalendarItems,
  type CalendarAttentionItem,
} from "../src/lib/calendar/calendar-presentation";

const REF_DATE = "2026-09-11";

function item(
  id: string,
  status: string,
  dueDate: string,
  extra: Partial<CalendarAttentionItem> = {}
): CalendarAttentionItem {
  return {
    id,
    title: id,
    status,
    dueDate,
    ...extra,
  };
}

describe("calendar attention presentation model", () => {
  test("classifies overdue, waiting, due-today, in-progress, pending and completed deterministically", () => {
    assert.equal(getCalendarAttentionState(item("overdue", "IN_PROGRESS", "2026-09-10"), REF_DATE), "overdue");
    assert.equal(getCalendarAttentionState(item("waiting", "WAITING_APPROVAL", "2026-09-12"), REF_DATE), "waiting");
    assert.equal(getCalendarAttentionState(item("review", "NEEDS_REVIEW", "2026-09-12"), REF_DATE), "waiting");
    assert.equal(getCalendarAttentionState(item("today", "NOT_STARTED", "2026-09-11"), REF_DATE), "due_today");
    assert.equal(getCalendarAttentionState(item("progress", "IN_PROGRESS", "2026-09-12"), REF_DATE), "in_progress");
    assert.equal(getCalendarAttentionState(item("pending", "NOT_STARTED", "2026-09-12"), REF_DATE), "pending");
    assert.equal(getCalendarAttentionState(item("done", "COMPLETED", "2026-09-01"), REF_DATE), "completed");
  });

  test("ranks actionable work ahead of completed work and preserves stable order for ties", () => {
    const input = [
      item("done", "COMPLETED", "2026-09-11"),
      item("progress-a", "IN_PROGRESS", "2026-09-12"),
      item("overdue-a", "NOT_STARTED", "2026-09-09"),
      item("waiting", "WAITING_APPROVAL", "2026-09-12"),
      item("today", "NOT_STARTED", "2026-09-11"),
      item("progress-b", "IN_PROGRESS", "2026-09-13"),
      item("overdue-b", "IN_PROGRESS", "2026-09-10"),
    ];

    const sorted = sortCalendarItemsByAttention(input, REF_DATE);

    assert.deepEqual(
      sorted.map((entry) => entry.id),
      ["overdue-a", "overdue-b", "waiting", "today", "progress-a", "progress-b", "done"]
    );
  });

  test("builds day summary counts used by dense month cells", () => {
    const input = [
      item("o1", "IN_PROGRESS", "2026-09-10"),
      item("o2", "NOT_STARTED", "2026-09-09"),
      item("w1", "WAITING_APPROVAL", "2026-09-12"),
      item("t1", "NOT_STARTED", "2026-09-11"),
      item("p1", "IN_PROGRESS", "2026-09-12"),
      item("n1", "NOT_STARTED", "2026-09-12"),
      item("c1", "COMPLETED", "2026-09-10"),
    ];

    assert.deepEqual(getCalendarDaySummary(input, REF_DATE), {
      total: 7,
      attention: 4,
      overdue: 2,
      waiting: 1,
      dueToday: 1,
      inProgress: 1,
      pending: 1,
      completed: 1,
    });
  });

  test("keeps a 161-item day summary-first and never promotes completed items over urgent work", () => {
    const dense: CalendarAttentionItem[] = [];
    for (let index = 0; index < 150; index += 1) {
      dense.push(item(`done-${index}`, "COMPLETED", "2026-09-11"));
    }
    for (let index = 0; index < 8; index += 1) {
      dense.push(item(`overdue-${index}`, "IN_PROGRESS", "2026-09-10"));
    }
    for (let index = 0; index < 3; index += 1) {
      dense.push(item(`waiting-${index}`, "WAITING_APPROVAL", "2026-09-12"));
    }

    const summary = getCalendarDaySummary(dense, REF_DATE);
    const previews = sortCalendarItemsByAttention(dense, REF_DATE).slice(0, 2);

    assert.equal(summary.total, 161);
    assert.equal(summary.overdue, 8);
    assert.equal(summary.waiting, 3);
    assert.equal(summary.completed, 150);
    assert.deepEqual(previews.map((entry) => entry.id), ["overdue-0", "overdue-1"]);
  });

  test("supports day-sheet quick filters from the same canonical state model", () => {
    const input = [
      item("overdue", "IN_PROGRESS", "2026-09-10"),
      item("waiting", "WAITING_APPROVAL", "2026-09-12"),
      item("today", "NOT_STARTED", "2026-09-11"),
      item("progress", "IN_PROGRESS", "2026-09-12"),
      item("done", "COMPLETED", "2026-09-10"),
    ];

    assert.deepEqual(filterCalendarItems(input, "attention", REF_DATE).map((entry) => entry.id), ["overdue", "waiting", "today"]);
    assert.deepEqual(filterCalendarItems(input, "overdue", REF_DATE).map((entry) => entry.id), ["overdue"]);
    assert.deepEqual(filterCalendarItems(input, "waiting", REF_DATE).map((entry) => entry.id), ["waiting"]);
    assert.deepEqual(filterCalendarItems(input, "all", REF_DATE).map((entry) => entry.id), ["overdue", "waiting", "today", "progress", "done"]);
  });
});
