import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getMonthCellPresentation,
  type CalendarEntry,
} from "../src/lib/calendar/calendar-presentation";

const pagePath = path.join(process.cwd(), "src/app/calendar/page.tsx");
const gridPath = path.join(process.cwd(), "src/components/calendar/calendar-month-grid.tsx");
const pageSource = fs.readFileSync(pagePath, "utf8");
const gridSource = fs.readFileSync(gridPath, "utf8");

const REFERENCE_DATE = "2026-09-14";

function taskEntry(
  id: string,
  title: string,
  status: string,
  overrides: Partial<Extract<CalendarEntry, { kind: "task" }>> = {}
): CalendarEntry {
  return {
    kind: "task",
    id,
    date: "2026-09-14",
    title,
    level: "Trường",
    sourceTaskId: id,
    dueDate: "2026-09-14",
    status,
    ...overrides,
  } as CalendarEntry;
}

function eventEntry(id: string, title: string, startTime: string): CalendarEntry {
  return {
    kind: "event",
    id,
    date: "2026-09-14",
    title,
    meetingId: id,
    startTime,
  } as CalendarEntry;
}

describe("Calendar Route Integration — semantic dense-day summary (intended)", () => {
  test("semantic summary exposes overdue/waiting counts, not raw preview slices", () => {
    const entries: CalendarEntry[] = [
      taskEntry("t-overdue", "Báo cáo kiểm định ABET", "IN_PROGRESS", {
        dueDate: "2026-08-25",
        date: "2026-09-14",
      }),
      taskEntry("t-waiting", "Đề án lab AI chờ duyệt", "WAITING_APPROVAL"),
      taskEntry("t-today", "Giao ban tuần", "IN_PROGRESS"),
    ];
    const presentation = getMonthCellPresentation("2026-09-14", entries, REFERENCE_DATE);
    assert.equal(presentation.total, 3);
    assert.equal(presentation.overdueCount, 1);
    assert.equal(presentation.waitingCount, 1);
    assert.equal(presentation.dueCount, 1);
  });

  test("hidden/remaining count accounts for every entry beyond visible previews", () => {
    const entries: CalendarEntry[] = [
      taskEntry("t-1", "Việc một", "IN_PROGRESS"),
      taskEntry("t-2", "Việc hai", "IN_PROGRESS"),
      taskEntry("t-3", "Việc ba", "IN_PROGRESS"),
      taskEntry("t-4", "Việc bốn", "IN_PROGRESS"),
      taskEntry("t-5", "Việc năm", "IN_PROGRESS"),
    ];
    const presentation = getMonthCellPresentation("2026-09-14", entries, REFERENCE_DATE, {
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

  test("completed titles are not promoted into previews, but still counted in totals", () => {
    const entries: CalendarEntry[] = [
      taskEntry("t-done-1", "Việc đã xong một", "COMPLETED"),
      taskEntry("t-done-2", "Việc đã xong hai", "COMPLETED"),
      taskEntry("t-open", "Việc đang làm", "IN_PROGRESS"),
    ];
    const presentation = getMonthCellPresentation("2026-09-14", entries, REFERENCE_DATE);
    assert.equal(presentation.total, 3);
    const previewTitles = presentation.taskPreviews.map((preview) => preview.title);
    assert.ok(!previewTitles.includes("Việc đã xong một"), "Completed titles must not be promoted");
    assert.ok(!previewTitles.includes("Việc đã xong hai"), "Completed titles must not be promoted");
    assert.ok(previewTitles.includes("Việc đang làm"), "Open work stays previewed");
  });

  test("dense day cell is summary-first: one earliest timed event plus attention-ranked tasks", () => {
    const entries: CalendarEntry[] = [
      eventEntry("e-late", "Họp giao ban chiều", "14:00"),
      eventEntry("e-early", "Chào cờ đầu tuần", "07:30"),
      taskEntry("t-waiting", "Tờ trình chờ duyệt", "WAITING_APPROVAL"),
      taskEntry("t-open", "Rà soát giáo án", "IN_PROGRESS"),
    ];
    const presentation = getMonthCellPresentation("2026-09-14", entries, REFERENCE_DATE, {
      maxTotalPreviews: 3,
      maxEventPreviews: 1,
    });
    assert.equal(presentation.eventPreviews.length, 1);
    assert.equal(
      presentation.eventPreviews[0].title,
      "Chào cờ đầu tuần",
      "Single timed preview must be the earliest real startTime"
    );
    assert.equal(
      presentation.taskPreviews[0].title,
      "Tờ trình chờ duyệt",
      "Task previews must be attention-ranked (waiting first)"
    );
  });

  test("month grid renders the canonical semantic presentation (no ad-hoc preview slicing)", () => {
    assert.match(
      gridSource,
      /getMonthCellPresentation/,
      "Grid must render through the canonical getMonthCellPresentation helper"
    );
    assert.doesNotMatch(
      gridSource,
      /MAX_PREVIEW\s*=\s*3/,
      "Grid must NOT define an ad-hoc MAX_PREVIEW = 3 slice"
    );
    assert.doesNotMatch(
      gridSource,
      /slice\(0,\s*(?:MAX_PREVIEW|3)\)/,
      "Grid must NOT slice day items to a hard-coded preview count"
    );
    assert.doesNotMatch(
      gridSource,
      /\+\{remainingCount\}\s*nhiệm vụ/,
      "Grid must NOT render the legacy +{remainingCount} nhiệm vụ overflow badge"
    );
    assert.match(
      gridSource,
      /hiddenCount/,
      "Grid must surface overflow through the canonical hiddenCount"
    );
  });

  test("primary toolbar owns the [Tháng | Tuần | Danh sách] switcher without opening secondary disclosure", () => {
    assert.match(pageSource, /data-slot="calendar-controls-container"/, "Must contain primary controls container");
    assert.match(pageSource, /Tháng/, "Primary switcher must offer Tháng (month) view");
    assert.match(pageSource, /Tuần/, "Primary switcher must offer Tuần (week) view");
    assert.match(pageSource, /Danh sách/, "Primary switcher must offer Danh sách (agenda) view");
    assert.doesNotMatch(
      pageSource,
      /Chế độ xem/,
      "View switcher must live in the primary toolbar, not behind a secondary 'Chế độ xem' disclosure"
    );
  });

  test("secondary surface owns only display/preferences, never view switching", () => {
    assert.match(pageSource, /isSecondaryOpen/, "Secondary disclosure state must exist");
    assert.match(pageSource, /Năm học/, "Secondary must own the academic-year display preference");
    assert.doesNotMatch(
      pageSource,
      /handleViewChange\("month"\)[\s\S]*handleViewChange\("agenda"\)/,
      "Secondary must NOT own view-mode switching"
    );
  });
});
