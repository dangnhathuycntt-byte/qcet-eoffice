import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  getCalendarAttentionState,
  getCalendarDaySummary,
  sortCalendarItemsByAttention,
  filterCalendarItems,
  groupCalendarEntriesByDate,
  getMonthCellPresentation,
  sortAgendaEntries,
  getDeadlineSummary,
  isCalendarEntryVisibleForScope,
  matchesCalendarScope,
  type CalendarAttentionItem,
  type CalendarEntry,
  type CalendarTaskEntry,
  type CalendarEventEntry,
} from "../src/lib/calendar/calendar-presentation";

const REF_DATE = "2026-09-11";

function taskEntry(id: string, date: string, status: string, dueDate: string): CalendarTaskEntry {
  return {
    kind: "task",
    id,
    sourceTaskId: `src-${id}`,
    date,
    dueDate,
    title: id,
    status,
  };
}

function eventEntry(id: string, date: string, startTime: string, title: string): CalendarEventEntry {
  return {
    kind: "event",
    id,
    meetingId: `meet-${id}`,
    date,
    startTime,
    title,
  };
}

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

  test("discriminated union: CalendarTaskEntry and CalendarEventEntry type safety", () => {
    const taskEntry = {
      kind: "task" as const,
      id: "task-1",
      sourceTaskId: "st-1",
      date: "2026-09-12",
      dueDate: "2026-09-12",
      title: "Rà soát đề cương",
      status: "IN_PROGRESS",
      progressPercent: 60,
    };
    const eventEntry = {
      kind: "event" as const,
      id: "event-1",
      meetingId: "meet-1",
      date: "2026-09-12",
      startTime: "09:00",
      title: "Họp khoa",
    };

    assert.equal(taskEntry.kind, "task");
    assert.equal(taskEntry.progressPercent, 60);
    assert.equal(eventEntry.kind, "event");
    assert.equal(eventEntry.startTime, "09:00");
  });

  test("groups entries by date-only key preserving input order within each day", () => {
    const entries: CalendarEntry[] = [
      taskEntry("t1", "2026-09-12T08:00:00+07:00", "NOT_STARTED", "2026-09-12"),
      eventEntry("e1", "2026-09-12", "09:00", "Họp A"),
      taskEntry("t2", "2026-09-13", "NOT_STARTED", "2026-09-13"),
    ];

    const grouped = groupCalendarEntriesByDate(entries);
    assert.deepEqual(grouped.get("2026-09-12")?.map((entry) => entry.id), ["t1", "e1"]);
    assert.deepEqual(grouped.get("2026-09-13")?.map((entry) => entry.id), ["t2"]);
    // Date-only safety: ISO datetime with ICT offset groups under the calendar date.
    assert.equal(grouped.has("2026-09-12T08:00:00+07:00"), false);
  });

  test("month-cell presentation previews at most 1 high-value timed event with counts", () => {
    // Fixture uses future due dates (after REF_DATE 2026-09-11) so task counts
    // stay in waiting/dueToday/pending rather than collapsing into overdue.
    const entries: CalendarEntry[] = [
      eventEntry("e-early", "2026-09-12", "08:00", "Họp sáng"),
      eventEntry("e-late", "2026-09-12", "14:00", "Họp chiều"),
      taskEntry("o1", "2026-09-12", "NOT_STARTED", "2026-09-09"),
      taskEntry("w1", "2026-09-12", "WAITING_APPROVAL", "2026-09-13"),
      taskEntry("t1", "2026-09-12", "IN_PROGRESS", "2026-09-12"),
    ];

    const cell = getMonthCellPresentation("2026-09-12", entries, REF_DATE);
    assert.equal(cell.total, 5);
    assert.equal(cell.overdueCount, 1);
    assert.equal(cell.waitingCount, 1);
    assert.equal(cell.dueCount, 0);
    assert.deepEqual(cell.eventPreviews.map((entry) => entry.id), ["e-early"]);
    // 3 preview slots: 1 event + 2 attention-ranked tasks (o1, w1).
    assert.deepEqual(cell.taskPreviews.map((entry) => entry.id), ["o1", "w1"]);
    assert.equal(cell.hiddenCount, 2);
  });

  test("month-cell presentation suppresses completed titles by default but can include them", () => {
    const entries: CalendarEntry[] = [
      taskEntry("o1", "2026-09-12", "NOT_STARTED", "2026-09-10"),
      taskEntry("c1", "2026-09-12", "COMPLETED", "2026-09-12"),
      taskEntry("c2", "2026-09-12", "COMPLETED", "2026-09-12"),
    ];

    const suppressed = getMonthCellPresentation("2026-09-12", entries, REF_DATE);
    assert.deepEqual(suppressed.taskPreviews.map((entry) => entry.id), ["o1"]);
    assert.equal(suppressed.hiddenCount, 2);
    assert.equal(suppressed.total, 3);

    const included = getMonthCellPresentation("2026-09-12", entries, REF_DATE, { includeCompleted: true });
    assert.deepEqual(included.taskPreviews.map((entry) => entry.id), ["o1", "c1", "c2"]);
    assert.equal(included.hiddenCount, 0);
  });

  test("agenda ranking is attention-first and deterministic for ties", () => {
    const entries: CalendarEntry[] = [
      eventEntry("e-b", "2026-09-12", "10:00", "B"),
      taskEntry("n1", "2026-09-12", "NOT_STARTED", "2026-09-13"),
      eventEntry("e-a", "2026-09-12", "09:00", "A"),
      taskEntry("o1", "2026-09-12", "NOT_STARTED", "2026-09-10"),
      eventEntry("e-a-dup", "2026-09-12", "09:00", "A"),
    ];

    const ranked = sortAgendaEntries(entries, REF_DATE);
    assert.equal(ranked[0].id, "o1");
    assert.deepEqual(ranked.slice(1).map((entry) => entry.id), ["n1", "e-a", "e-a-dup", "e-b"]);
    // Determinism: same input order always yields the same tie-break order.
    assert.deepEqual(sortAgendaEntries(entries, REF_DATE).map((entry) => entry.id), ranked.map((entry) => entry.id));
  });

  test("deadline summary derives from the canonical attention state model", () => {
    const input = [
      item("o1", "IN_PROGRESS", "2026-09-10"),
      item("t1", "NOT_STARTED", "2026-09-11"),
      item("w1", "WAITING_APPROVAL", "2026-09-12"),
      item("p1", "IN_PROGRESS", "2026-09-12"),
      item("c1", "COMPLETED", "2026-09-12"),
    ];

    assert.deepEqual(getDeadlineSummary(input, REF_DATE), {
      total: 5,
      overdue: 1,
      dueToday: 1,
      upcoming: 2,
      completed: 1,
    });
  });

  test("keeps a 27-35 item dense day summary-first with deterministic top previews", () => {
    const denseEntries: CalendarEntry[] = [];
    for (let index = 0; index < 20; index += 1) {
      denseEntries.push(taskEntry(`done-${index}`, "2026-09-12", "COMPLETED", "2026-09-12"));
    }
    for (let index = 0; index < 6; index += 1) {
      denseEntries.push(taskEntry(`overdue-${index}`, "2026-09-12", "IN_PROGRESS", "2026-09-10"));
    }
    for (let index = 0; index < 3; index += 1) {
      denseEntries.push(taskEntry(`waiting-${index}`, "2026-09-12", "WAITING_APPROVAL", "2026-09-12"));
    }
    for (let index = 0; index < 3; index += 1) {
      denseEntries.push(eventEntry(`event-${index}`, "2026-09-12", `08:0${index}`, `Họp ${index}`));
    }
    assert.equal(denseEntries.length, 32);

    const cell = getMonthCellPresentation("2026-09-12", denseEntries, REF_DATE);
    assert.equal(cell.total, 32);
    assert.equal(cell.overdueCount, 6);
    assert.equal(cell.waitingCount, 3);
    assert.deepEqual(cell.eventPreviews.map((entry) => entry.id), ["event-0"]);
    assert.deepEqual(cell.taskPreviews.map((entry) => entry.id), ["overdue-0", "overdue-1"]);
    assert.equal(cell.hiddenCount, 29);

    const agenda = sortAgendaEntries(denseEntries, REF_DATE);
    assert.deepEqual(agenda.slice(0, 3).map((entry) => entry.id), ["overdue-0", "overdue-1", "overdue-2"]);
  });

  test("scope visibility wrapper matches display-filter semantics at boundaries", () => {
    const unitTask = taskEntry("u1", "2026-09-12", "IN_PROGRESS", "2026-09-12");
    unitTask.level = "Đơn vị";
    unitTask.departmentId = "K_CNTT";
    const schoolEvent = eventEntry("se1", "2026-09-12", "09:00", "Hội đồng trường");
    schoolEvent.level = "Trường";

    for (const entry of [unitTask, schoolEvent] as const) {
      assert.equal(
        isCalendarEntryVisibleForScope(entry, "school"),
        matchesCalendarScope(entry, "school")
      );
    }
    assert.equal(isCalendarEntryVisibleForScope(unitTask, "school"), false);
    assert.equal(isCalendarEntryVisibleForScope(schoolEvent, "school"), true);
    assert.deepEqual(isCalendarEntryVisibleForScope(unitTask, "personal"), false);
  });
});

// Consolidated from calendar-route-integration.test.ts — the dense-day semantic
// presentation cases exercise the same canonical getMonthCellPresentation
// contract against route-level fixtures.
describe("calendar dense-day semantic presentation (route integration)", () => {
  const ROUTE_REF = "2026-09-14";

  function rTask(id: string, status: string, dueDate: string): CalendarTaskEntry {
    return { kind: "task", id, sourceTaskId: id, date: ROUTE_REF, dueDate, title: id, status };
  }

  function rEvent(id: string, startTime: string): CalendarEventEntry {
    return { kind: "event", id, meetingId: id, date: ROUTE_REF, startTime, title: id };
  }

  test("semantic summary exposes overdue/waiting/due counts, not raw preview slices", () => {
    const entries: CalendarEntry[] = [
      rTask("t-overdue", "IN_PROGRESS", "2026-08-25"),
      rTask("t-waiting", "WAITING_APPROVAL", ROUTE_REF),
      rTask("t-today", "IN_PROGRESS", ROUTE_REF),
    ];
    const presentation = getMonthCellPresentation(ROUTE_REF, entries, ROUTE_REF);
    assert.equal(presentation.total, 3);
    assert.equal(presentation.overdueCount, 1);
    assert.equal(presentation.waitingCount, 1);
    assert.equal(presentation.dueCount, 1);
  });

  test("hidden count accounts for every entry beyond visible previews", () => {
    const entries: CalendarEntry[] = [];
    for (let i = 0; i < 5; i += 1) entries.push(rTask(`t-${i}`, "IN_PROGRESS", ROUTE_REF));
    const presentation = getMonthCellPresentation(ROUTE_REF, entries, ROUTE_REF, {
      maxTotalPreviews: 3,
    });
    assert.equal(presentation.total, 5);
    assert.ok(
      presentation.taskPreviews.length + presentation.eventPreviews.length <= 3,
      "Dense cell shows at most maxTotalPreviews previews"
    );
    assert.equal(
      presentation.hiddenCount,
      5 - presentation.taskPreviews.length - presentation.eventPreviews.length
    );
    assert.ok(presentation.hiddenCount > 0, "Overflow beyond previews must surface as hiddenCount");
  });

  test("dense day cell is summary-first: one earliest timed event plus attention-ranked tasks", () => {
    const entries: CalendarEntry[] = [
      rEvent("e-late", "14:00"),
      rEvent("e-early", "07:30"),
      rTask("t-waiting", "WAITING_APPROVAL", ROUTE_REF),
      rTask("t-open", "IN_PROGRESS", ROUTE_REF),
    ];
    const presentation = getMonthCellPresentation(ROUTE_REF, entries, ROUTE_REF, {
      maxTotalPreviews: 3,
      maxEventPreviews: 1,
    });
    assert.equal(presentation.eventPreviews.length, 1);
    assert.equal(
      presentation.eventPreviews[0].title,
      "e-early",
      "Single timed preview must be the earliest real startTime"
    );
    assert.equal(
      presentation.taskPreviews[0].title,
      "t-waiting",
      "Task previews must be attention-ranked (waiting first)"
    );
  });
});
