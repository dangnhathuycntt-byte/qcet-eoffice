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
});
