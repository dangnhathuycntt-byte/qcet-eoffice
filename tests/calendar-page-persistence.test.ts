import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const pagePath = path.join(process.cwd(), "src/app/calendar/page.tsx");
const gridPath = path.join(process.cwd(), "src/components/calendar/calendar-month-grid.tsx");
const pageSource = fs.readFileSync(pagePath, "utf8");
const gridSource = fs.readFileSync(gridPath, "utf8");

describe("calendar route persistence — server truth for meetings and events", () => {
  test("meeting creation persists via POST /api/meetings followed by a server refetch", () => {
    assert.match(pageSource, /fetch\(["'`]\/api\/meetings\?/, "Must load meetings from the canonical API");
    assert.match(pageSource, /fetch\(["'`]\/api\/meetings["'`],\s*\{/, "Must create meetings through POST /api/meetings");
    assert.match(pageSource, /method:\s*["']POST["']/, "Creation must use POST");
    // After persisting, the route must reconcile from server truth — not a local-only copy.
    const createBlock = pageSource.slice(pageSource.indexOf('fetch(`/api/meetings'));
    assert.match(createBlock, /loadCalendarData\(\)/, "After POST, route must refetch canonical server truth");
    assert.doesNotMatch(pageSource, /setCustomEvents/, "Must never keep local-only meeting copies");
    assert.doesNotMatch(pageSource, /setMeetings\(\(previous\)/, "Must never prepend unconfirmed local meetings");
  });

  test("uses the clearer Danh sách label while preserving the internal agenda mode", () => {
    assert.match(pageSource, /Danh sách/, "Must expose the Danh sách agenda label");
    assert.match(pageSource, /handleViewChange\("agenda"\)/, "Must preserve the internal agenda mode");
  });

  test("projects persisted meetings into both the month grid and day sheet with real times", () => {
    assert.match(pageSource, /meetingDayItems/, "Must project meetings into day items");
    assert.match(pageSource, /events=\{meetingDayItems\}/, "Must feed projected meetings to the month grid");
    assert.match(pageSource, /isEvent:\s*true/, "Projected meetings must be flagged as events");
    assert.match(pageSource, /categoryLabel:\s*["']Sự kiện["']/, "Projected meetings must carry the Sự kiện label");
    // Real times: projection must carry the meeting start/end clock time, not a placeholder.
    assert.match(pageSource, /getMeetingTime\(meeting\.startTime\)/, "Projection must use the real meeting start time");
    assert.match(pageSource, /getMeetingTime\(meeting\.endTime\)/, "Projection must use the real meeting end time");
    assert.match(gridSource, /events\?:\s*DayTaskItem\[\]/, "Grid must accept projected meeting events");
  });

  test("week view receives projected meeting events with real times, not day-only markers", () => {
    assert.match(
      pageSource,
      /viewMode[\s\S]*week|week[\s\S]*viewMode/i,
      "Route must keep a dedicated week view mode alongside month/agenda"
    );
    assert.match(
      pageSource,
      /meetingDayItems[\s\S]*week|week[\s\S]*meetingDayItems/i,
      "Week view must consume the same projected meeting events (with real times)"
    );
    assert.doesNotMatch(
      pageSource,
      /week[\s\S]*dueDate\.split\("T"\)\[0\][\s\S]*=== selectedDate(?![\s\S]*getMeetingTime)/,
      "Week projection must NOT degrade meetings to day-only markers without times"
    );
  });

  test("slot creation with an initial date/time creates no local-only events", () => {
    assert.match(pageSource, /createInitialDueDate|initialDueDate/, "Slot creation must seed an initial date");
    assert.match(
      pageSource,
      /initialStartTime|initialEndTime|startTime/,
      "Slot creation must seed an initial time for timed meetings"
    );
    assert.doesNotMatch(
      pageSource,
      /setMeetings\(\[.*\.\.\.|\[\.\.\..*setMeetings|localEvent|optimisticMeeting|tempMeeting/i,
      "Slot creation must NOT synthesize local-only meeting events"
    );
    assert.doesNotMatch(pageSource, /setCustomEvents/, "Slot creation must NOT keep local-only copies");
    assert.match(
      pageSource,
      /await loadCalendarData\(\)/,
      "Creation flows must reconcile by reloading canonical server truth"
    );
  });
});
