import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const calendarPagePath = path.resolve(process.cwd(), "src/app/calendar/page.tsx");
const calendarWorkspacePath = path.resolve(
  process.cwd(),
  "src/components/calendar/executive-calendar-workspace.tsx"
);

function readPage(): string {
  assert.ok(fs.existsSync(calendarPagePath), "src/app/calendar/page.tsx must exist");
  return fs.readFileSync(calendarPagePath, "utf8");
}

// Consolidated from calendar-route.test.ts + calendar-route-hygiene.test.ts (duplicate
// sprint artifacts covering the same route). Cross-cutting invariants — light-only
// (no `dark:`) and zero decorative emojis — are enforced globally by
// tests/anti-slop-audit.test.ts and are not repeated per route here.
describe("Calendar Route (/calendar) — first-class standalone route & chrome", () => {
  test("renders the canonical month grid directly without redirect", () => {
    const content = readPage();
    assert.equal(
      content.includes("router.replace"),
      false,
      "src/app/calendar/page.tsx must not perform client redirect with router.replace"
    );
    assert.ok(
      content.includes("CalendarMonthGrid"),
      "src/app/calendar/page.tsx must mount CalendarMonthGrid directly"
    );
  });

  test("defines executive page title in Vietnamese", () => {
    const content = readPage();
    assert.ok(
      content.includes("Lịch công tác") ||
        content.includes("Lịch Công Tác") ||
        content.includes("Lịch Biểu"),
      "Page must define executive title in Vietnamese"
    );
  });

  test("integrates task fetching and Suspense loading skeleton", () => {
    const content = readPage();
    assert.ok(content.includes("Suspense"), "Page must wrap content in Suspense boundary");
    assert.ok(
      content.includes("/api/dashboard/overview") || content.includes("/api/tasks"),
      "Page must fetch tasks from task or overview API"
    );
    assert.ok(
      content.includes("useSearchParams"),
      "Page must support useSearchParams for query params"
    );
  });

  test("delegates creation to the canonical create command and avoids hardcoded 'task-1'", () => {
    const content = readPage();

    // Plan R-C1: the Create Command pipeline is canonical —
    // UI Draft -> canonical mapper -> CreateTaskInput -> API. A page must NOT
    // issue its own raw POST to /api/tasks; that duplicate-create defect is what
    // this assertion forbids.
    assert.doesNotMatch(
      content,
      /fetch\(\s*["'`]\/api\/tasks["'`]/,
      "Page must not issue a raw POST to /api/tasks — creation must go through the canonical create command"
    );

    assert.ok(
      content.includes("@/lib/adapters/create-task-mapper") ||
        content.includes("@/components/dashboard/create-task-modal"),
      "Page must route creation through the canonical create adapter/modal"
    );

    assert.doesNotMatch(
      content,
      /"task-1"/,
      "src/app/calendar/page.tsx must not use hardcoded 'task-1' fallback"
    );
  });

  // Intended chrome: primary toolbar owns the view switcher; secondary owns display only.
  describe("Intended chrome: primary view switcher, distinct Filter/Display, single +Tạo", () => {
    test("primary toolbar contains [Tháng | Tuần | Danh sách] switcher without opening secondary disclosure", () => {
      const content = readPage();
      assert.match(content, /data-slot="calendar-controls-container"/, "Must contain primary controls container");
      assert.match(content, /Tháng/, "Primary switcher must offer Tháng (month) view");
      assert.match(content, /Tuần/, "Primary switcher must offer Tuần (week) view");
      assert.match(content, /Danh sách/, "Primary switcher must offer Danh sách (agenda) view");
      assert.doesNotMatch(
        content,
        /isSecondaryOpen[\s\S]*Chế độ xem/,
        "View switcher (Chế độ xem) must NOT live inside the secondary disclosure"
      );
    });

    test("Filter and Display are distinct controls with distinct labels", () => {
      const content = readPage();
      assert.match(content, /Bộ lọc|Lọc/, "Must render a distinct Filter trigger");
      assert.match(content, /Hiển thị|Tùy chọn hiển thị/, "Must render a distinct Display trigger");
      const filterTriggers = content.match(/aria-label="[^"]*(Bộ lọc|Lọc)[^"]*"/g) || [];
      const displayTriggers = content.match(/aria-label="[^"]*(Hiển thị|Tùy chọn hiển thị)[^"]*"/g) || [];
      assert.ok(filterTriggers.length >= 1, "Filter must expose an accessible trigger");
      assert.ok(displayTriggers.length >= 1, "Display must expose an accessible trigger");
    });

    test("exactly one global +Tạo trigger exists on the calendar route", () => {
      const content = readPage();
      assert.match(content, /Tạo công việc/, "Must offer 'Tạo công việc'");
      assert.match(content, /Tạo sự kiện/, "Must offer 'Tạo sự kiện'");
      const createMenuItems = content.match(/Tạo công việc/g) || [];
      assert.equal(
        createMenuItems.length,
        1,
        "There must be exactly one 'Tạo công việc' entry — no duplicate creation control"
      );
      const createTriggers = content.match(/setIsCreateDropdownOpen\(\(previous\) => !previous\)/g) || [];
      assert.equal(
        createTriggers.length,
        1,
        "Calendar page must define exactly one create-dropdown trigger"
      );
    });

    test("local search is labeled Lọc lịch hiện tại and is not a permanent duplicate of global search", () => {
      const content = readPage();
      assert.match(content, /Lọc lịch hiện tại/, "Local search must be labeled 'Lọc lịch hiện tại'");
      assert.equal(
        content.includes("calendar-controls-row-2"),
        false,
        "Must not have a second permanent chrome row (calendar-controls-row-2)"
      );
      assert.match(content, /isSearchExpanded/, "Local search must be gated behind expansion state");
      assert.match(content, /isSecondaryOpen/, "Local search must live inside the secondary disclosure surface");
    });

    test("month navigation (prev/next/today) stays in the single primary row", () => {
      const content = readPage();
      assert.ok(content.includes("handlePrevMonth"), "Prev month handler must be present");
      assert.ok(content.includes("handleNextMonth"), "Next month handler must be present");
      assert.ok(content.includes("handleCurrentMonth"), "Today/current-month handler must be present");
      assert.ok(content.includes("Hôm nay"), "Primary chrome must show Hôm nay button");
    });

    test("day sheet preserved — CalendarDaySheet and isDaySheetOpen present", () => {
      const content = readPage();
      assert.ok(content.includes("CalendarDaySheet"), "CalendarDaySheet must be preserved");
      assert.ok(content.includes("isDaySheetOpen"), "Day sheet open state must be preserved");
    });
  });

  test("ExecutiveCalendarWorkspace branches on onSelectEvent rather than unconditionally opening a preview", () => {
    assert.ok(fs.existsSync(calendarWorkspacePath), "executive-calendar-workspace.tsx must exist");
    const content = fs.readFileSync(calendarWorkspacePath, "utf8");

    // The event-click handler must delegate to onSelectEvent when the parent supplies it,
    // so the workspace does not open its own preview modal on top of the parent's.
    assert.match(
      content,
      /else\s+if\s*\(\s*onSelectEvent\s*\)/,
      "handleEventClick must branch on onSelectEvent"
    );
  });

  test("secondary surface owns only display/preferences, never view switching", () => {
    const content = readPage();
    assert.match(content, /isSecondaryOpen/, "Secondary disclosure state must exist");
    assert.match(content, /Năm học/, "Secondary must own the academic-year display preference");
    assert.doesNotMatch(
      content,
      /handleViewChange\("month"\)[\s\S]*handleViewChange\("agenda"\)/,
      "Secondary must NOT own view-mode switching"
    );
  });

  test("parses ?taskId= from URL search params and preserves selectedTask context", () => {
    const content = readPage();
    assert.ok(
      content.includes('searchParams?.get("taskId")') || content.includes('searchParams.get("taskId")'),
      "Must read taskId query parameter from URL"
    );
    assert.ok(
      content.includes("setSelectedTask"),
      "Must update selectedTask when taskIdParam matches"
    );
  });

  test("updates browser URL via history API without client reload or router.replace", () => {
    const content = readPage();
    assert.equal(
      content.includes("router.replace"),
      false,
      "Must not use router.replace to avoid unstyled state and full reload"
    );
    assert.ok(
      content.includes("window.history.pushState") || content.includes("window.history.replaceState"),
      "Must use window.history pushState / replaceState for seamless URL sync"
    );
  });

  test("Level-1 /calendar eliminates redundant breadcrumbs while preserving task context", () => {
    const content = readPage();
    assert.equal(
      content.includes('<nav aria-label="Breadcrumb"'),
      false,
      "Level-1 primary calendar screen must not repeat location via redundant breadcrumb (P1 navigation invariant)"
    );
    assert.ok(
      content.includes("taskIdParam") || content.includes("selectedTask"),
      "Calendar page must preserve selectedTask and taskId URL context"
    );
  });
});

// Consolidated from calendar-page-persistence.test.ts — server truth for
// meetings and events on the standalone /calendar route.
describe("Calendar route persistence — server truth for meetings and events", () => {
  const gridPath = path.resolve(process.cwd(), "src/components/calendar/calendar-month-grid.tsx");

  function readGrid(): string {
    assert.ok(fs.existsSync(gridPath), "calendar-month-grid.tsx must exist");
    return fs.readFileSync(gridPath, "utf8");
  }

  test("meeting creation persists via POST /api/meetings followed by a server refetch", () => {
    const pageSource = readPage();
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
    const pageSource = readPage();
    assert.match(pageSource, /Danh sách/, "Must expose the Danh sách agenda label");
    assert.match(pageSource, /handleViewChange\("agenda"\)/, "Must preserve the internal agenda mode");
  });

  test("projects persisted meetings into both the month grid and day sheet with real times", () => {
    const pageSource = readPage();
    const gridSource = readGrid();
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
    const pageSource = readPage();
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
    const pageSource = readPage();
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
