import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const calendarPagePath = path.resolve(process.cwd(), "src/app/calendar/page.tsx");

function readPage(): string {
  assert.ok(fs.existsSync(calendarPagePath), "src/app/calendar/page.tsx must exist");
  return fs.readFileSync(calendarPagePath, "utf8");
}

describe("Calendar Route (/calendar) Hygiene & First-Class Executive View", () => {
  test("src/app/calendar/page.tsx renders canonical month grid directly without redirect", () => {
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

  test("src/app/calendar/page.tsx contains ZERO dark: classes", () => {
    const content = readPage();
    assert.doesNotMatch(content, /\bdark:/, "Strict Light-Only: no dark: classes allowed");
    assert.doesNotMatch(content, /ThemeProvider/, "No ThemeProvider allowed");
  });

  test("src/app/calendar/page.tsx contains ZERO decorative emojis", () => {
    const content = readPage();
    assert.doesNotMatch(
      content,
      /[\u{1F300}-\u{1FAFF}]/u,
      "Zero decorative emojis allowed in calendar route"
    );
  });

  test("src/app/calendar/page.tsx defines executive page title and breadcrumb navigation", () => {
    const content = readPage();
    assert.ok(
      content.includes("Lịch công tác") || content.includes("Lịch Công Tác") || content.includes("Lịch Biểu"),
      "Page must define executive title in Vietnamese"
    );
    assert.ok(
      content.includes("<title>") || content.includes("document.title"),
      "Page must specify HTML document title"
    );
  });

  // Intended chrome: primary toolbar owns the view switcher; secondary owns display only.
  describe("Intended chrome: primary view switcher, distinct Filter/Display, single +Tạo", () => {
    test("primary toolbar contains [Tháng | Tuần | Danh sách] switcher without opening secondary disclosure", () => {
      const content = readPage();
      assert.match(content, /data-slot="calendar-controls-container"/, "Must contain primary controls container");
      // All three view labels must be present as selectable view options.
      assert.match(content, /Tháng/, "Primary switcher must offer Tháng (month) view");
      assert.match(content, /Tuần/, "Primary switcher must offer Tuần (week) view");
      assert.match(content, /Danh sách/, "Primary switcher must offer Danh sách (agenda) view");
      // The switcher must be reachable without opening the secondary disclosure:
      // view labels must not live exclusively inside the isSecondaryOpen block.
      assert.doesNotMatch(
        content,
        /isSecondaryOpen[\s\S]*Chế độ xem/,
        "View switcher (Chế độ xem) must NOT live inside the secondary disclosure"
      );
    });

    test("Filter and Display are distinct controls with distinct labels", () => {
      const content = readPage();
      // Filter owns dataset narrowing (scope/level/status); Display owns presentation prefs.
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
      // Local per-view filter must carry its own scoped label.
      assert.match(content, /Lọc lịch hiện tại/, "Local search must be labeled 'Lọc lịch hiện tại'");
      // No permanent second chrome row for search.
      assert.equal(
        content.includes("calendar-controls-row-2"),
        false,
        "Must not have a second permanent chrome row (calendar-controls-row-2)"
      );
      // Local search must be gated behind expansion inside the secondary surface,
      // never a permanently visible duplicate input at the top level of the chrome.
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
});
